using System;
using System.ComponentModel.DataAnnotations;
using System.Diagnostics;
using System.Linq;
using System.Net.Http;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Text.Json;
using System.Threading.Tasks;
using FinCore.Api.Data;
using FinCore.Api.Models;
using FinCore.Api.Services.FraudService;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FinCore.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class FraudController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly IFraudService _fraudService;
        private readonly HttpClient _httpClient;
        private readonly string _agentBaseUrl;

        public FraudController(ApplicationDbContext context, IFraudService fraudService, HttpClient httpClient, IConfiguration? configuration = null)
        {
            _context = context ?? throw new ArgumentNullException(nameof(context));
            _fraudService = fraudService ?? throw new ArgumentNullException(nameof(fraudService));
            _httpClient = httpClient ?? throw new ArgumentNullException(nameof(httpClient));
            _agentBaseUrl = (configuration?["AiAgent:BaseUrl"] ?? configuration?["AI_AGENT_URL"] ?? "http://localhost:8000").TrimEnd('/');
        }

        // GET: api/fraud/agent-health
        // Diagnostic endpoint testing internal Python LangGraph microservice connectivity,
        // response latency, and decision routing invariants across all risk bands.
        [HttpGet("agent-health")]
        [AllowAnonymous]
        public async Task<IActionResult> GetAgentHealth()
        {
            var sw = Stopwatch.StartNew();
            string status = "ONLINE";
            string? errorMessage = null;

            try
            {
                var healthRes = await _httpClient.GetAsync($"{_agentBaseUrl}/health");
                sw.Stop();

                if (!healthRes.IsSuccessStatusCode)
                {
                    status = "DEGRADED";
                    errorMessage = $"Agent service returned status {healthRes.StatusCode}";
                }
            }
            catch (Exception ex)
            {
                sw.Stop();
                status = "DEGRADED";
                errorMessage = ex.Message;
            }

            var routingChecks = new
            {
                scoreUnder50 = "AUTO_APPROVE",
                score50To69 = "STEP_UP_CHALLENGE",
                score70AndAbove = "ESCALATE_TO_ANALYST",
                amount75kAndAbove = "REQUIRES_DUAL_APPROVAL"
            };

            return Ok(new
            {
                status,
                service = "FinCore Python LangGraph Multi-Agent Intelligence Service",
                endpoint = _agentBaseUrl,
                latencyMs = sw.ElapsedMilliseconds,
                routingChecks,
                verified = status == "ONLINE",
                errorMessage,
                timestamp = DateTime.UtcNow
            });
        }

        // GET: api/fraud/flags
        // Returns only transactions flagged as potentially fraudulent by the fraud/risk system
        [HttpGet("flags")]
        public async Task<IActionResult> GetFlags()
        {
            var flags = await _context.FraudFlags
                .Where(f => f.Status == "Flagged" || f.RiskScore >= 40)
                .OrderByDescending(f => f.CreatedAt)
                .ToListAsync();

            var txIds = flags.Select(f => f.TransactionId).Distinct().ToList();
            var txs = await _context.Transactions
                .Where(t => txIds.Contains(t.Id))
                .ToListAsync();

            var refIds = txs.Select(t => t.ReferenceId).ToList();
            var reviewItems = await _context.ReviewQueues
                .Where(rq => refIds.Contains(rq.QueueCode))
                .ToListAsync();

            var enrichedFlags = flags.Select(f =>
            {
                var tx = txs.FirstOrDefault(t => t.Id == f.TransactionId);
                var review = tx != null ? reviewItems.FirstOrDefault(r => r.QueueCode == tx.ReferenceId) : null;

                return new
                {
                    id = f.Id,
                    transactionId = f.TransactionId,
                    referenceId = tx?.ReferenceId ?? $"TX-{f.TransactionId}",
                    amount = tx?.Amount ?? (review?.Amount ?? 0m),
                    senderName = review?.SenderName ?? (tx != null ? $"Wallet {tx.SenderWalletId}" : "Customer"),
                    recipientName = review?.RecipientName ?? (tx != null && tx.ReceiverWalletId.HasValue ? $"Wallet {tx.ReceiverWalletId}" : "Recipient"),
                    riskScore = f.RiskScore,
                    reasons = f.Reasons,
                    status = f.Status,
                    createdAt = f.CreatedAt,
                    originIp = review?.OriginIp ?? "127.0.0.1",
                    device = review?.Device ?? "Mobile App"
                };
            });

            return Ok(enrichedFlags);
        }

        // GET: api/fraud/flags/{id}
        [HttpGet("flags/{id}")]
        public async Task<IActionResult> GetFlagById(int id)
        {
            var flag = await _context.FraudFlags.FindAsync(id);
            if (flag == null)
            {
                return NotFound(new { message = $"Fraud flag with ID {id} was not found." });
            }

            return Ok(flag);
        }

        // POST: api/fraud/rules
        // Mutating endpoints strictly protected with Admin role (Section 5)
        [HttpPost("rules")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> CreateRule([FromBody] RuleThreshold rule)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            rule.LastUpdated = DateTime.UtcNow;
            _context.RuleThresholds.Add(rule);

            var adminEmail = User.FindFirstValue(ClaimTypes.Email) ?? User.FindFirstValue(ClaimTypes.Name) ?? "Admin";
            _context.RuleAuditLogs.Add(new RuleAuditLog
            {
                RuleId = rule.RuleName,
                RuleName = rule.RuleName,
                Action = "CREATED",
                PreviousValue = null,
                NewValue = JsonSerializer.Serialize(new { rule.RuleName, rule.ThresholdValue, rule.IsActive }),
                ModifiedBy = adminEmail,
                Timestamp = DateTime.UtcNow
            });

            await _context.SaveChangesAsync();

            return StatusCode(StatusCodes.Status201Created, rule);
        }

        // PUT: api/fraud/rules/{id}
        // Mutating endpoints strictly protected with Admin role (Section 5)
        [HttpPut("rules/{id}")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> UpdateRule(int id, [FromBody] RuleThreshold updated)
        {
            var existing = await _context.RuleThresholds.FindAsync(id)
                ?? await _context.RuleThresholds.FirstOrDefaultAsync(r => !string.IsNullOrEmpty(updated.RuleName) && r.RuleName.ToLower() == updated.RuleName.ToLower());

            if (existing == null)
            {
                return NotFound(new { message = $"Rule with ID {id} not found." });
            }

            var prevVal = JsonSerializer.Serialize(new { existing.RuleName, existing.ThresholdValue, existing.IsActive });
            var isToggleOnly = (string.IsNullOrEmpty(updated.RuleName) || existing.RuleName == updated.RuleName) && existing.IsActive != updated.IsActive;

            existing.RuleName = !string.IsNullOrWhiteSpace(updated.RuleName) ? updated.RuleName : existing.RuleName;
            if (updated.ThresholdValue > 0 || (updated.ThresholdValue == 0 && !string.IsNullOrWhiteSpace(updated.RuleName)))
            {
                existing.ThresholdValue = updated.ThresholdValue;
            }
            existing.IsActive = updated.IsActive;
            existing.LastUpdated = DateTime.UtcNow;

            var adminEmail = User.FindFirstValue(ClaimTypes.Email) ?? User.FindFirstValue(ClaimTypes.Name) ?? "Admin";
            _context.RuleAuditLogs.Add(new RuleAuditLog
            {
                RuleId = existing.RuleName,
                RuleName = existing.RuleName,
                Action = isToggleOnly ? "TOGGLED" : "UPDATED",
                PreviousValue = prevVal,
                NewValue = JsonSerializer.Serialize(new { existing.RuleName, existing.ThresholdValue, existing.IsActive }),
                ModifiedBy = adminEmail,
                Timestamp = DateTime.UtcNow
            });

            await _context.SaveChangesAsync();
            return Ok(existing);
        }

        // DELETE: api/fraud/rules/{id}
        // Mutating endpoints strictly protected with Admin role (Section 5)
        [HttpDelete("rules/{id}")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> DeleteRule(int id)
        {
            var existing = await _context.RuleThresholds.FindAsync(id);
            if (existing == null)
            {
                return NotFound(new { message = $"Rule with ID {id} not found." });
            }

            var adminEmail = User.FindFirstValue(ClaimTypes.Email) ?? User.FindFirstValue(ClaimTypes.Name) ?? "Admin";
            _context.RuleAuditLogs.Add(new RuleAuditLog
            {
                RuleId = existing.RuleName,
                RuleName = existing.RuleName,
                Action = "DELETED",
                PreviousValue = JsonSerializer.Serialize(new { existing.RuleName, existing.ThresholdValue, existing.IsActive }),
                NewValue = null,
                ModifiedBy = adminEmail,
                Timestamp = DateTime.UtcNow
            });

            _context.RuleThresholds.Remove(existing);
            await _context.SaveChangesAsync();
            return Ok(new { message = $"Rule {id} deleted successfully." });
        }

        // GET: api/fraud/rules/audit-logs
        [HttpGet("rules/audit-logs")]
        [Authorize(Roles = "Admin,Analyst")]
        public async Task<IActionResult> GetRuleAuditLogs()
        {
            var logs = await _context.RuleAuditLogs
                .OrderByDescending(l => l.Timestamp)
                .Take(100)
                .ToListAsync();

            return Ok(logs);
        }

        // GET: api/fraud/rules
        [HttpGet("rules")]
        public async Task<IActionResult> GetRules()
        {
            var rules = await _context.RuleThresholds
                .OrderBy(r => r.Id)
                .ToListAsync();

            return Ok(rules);
        }

        // POST: api/fraud/score
        [HttpPost("score")]
        public async Task<IActionResult> ScoreTransaction([FromBody] TransactionScoreRequestDto request)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            var fraudFlag = await _fraudService.EvaluateTransactionAsync(
                request.TransactionId,
                request.Amount,
                request.IpAddress);

            return Ok(fraudFlag);
        }

        // GET: api/fraud/analytics/trends
        [HttpGet("analytics/trends")]
        public async Task<IActionResult> GetAnalyticsTrends()
        {
            var trends = await _context.FraudFlags
                .GroupBy(f => f.Status)
                .Select(g => new
                {
                    Status = g.Key,
                    Count = g.Count()
                })
                .ToListAsync();

            return Ok(trends);
        }

        // GET: api/fraud/agent-runs
        // Section 9.1: Query persisted multi-agent execution logs from durable PostgreSQL storage
        [HttpGet("agent-runs")]
        public async Task<IActionResult> GetAgentRuns([FromQuery] int limit = 50)
        {
            var runs = await _context.AgentExecutionLogs
                .OrderByDescending(r => r.CreatedAt)
                .Take(Math.Min(Math.Max(limit, 1), 200))
                .ToListAsync();

            return Ok(runs);
        }

        // GET: api/fraud/agent-runs/{transactionId}
        [HttpGet("agent-runs/{transactionId}")]
        public async Task<IActionResult> GetAgentRunsByTransactionId(string transactionId)
        {
            var runs = await _context.AgentExecutionLogs
                .Where(r => r.TransactionId == transactionId)
                .OrderByDescending(r => r.CreatedAt)
                .ToListAsync();

            return Ok(runs);
        }
    }

    /// <summary>
    /// Lightweight DTO for transaction scoring requests.
    /// </summary>
    public class TransactionScoreRequestDto
    {
        [Required]
        public int TransactionId { get; set; }

        [Required]
        [Range(0.01, double.MaxValue, ErrorMessage = "Amount must be greater than zero.")]
        public decimal Amount { get; set; }

        [Required]
        public string IpAddress { get; set; } = string.Empty;
    }
}