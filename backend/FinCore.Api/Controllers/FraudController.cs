using System;
using System.ComponentModel.DataAnnotations;
using System.Linq;
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

        public FraudController(ApplicationDbContext context, IFraudService fraudService)
        {
            _context = context ?? throw new ArgumentNullException(nameof(context));
            _fraudService = fraudService ?? throw new ArgumentNullException(nameof(fraudService));
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
        [HttpPost("rules")]
        [Authorize(Roles = "Admin,Analyst")]
        public async Task<IActionResult> CreateRule([FromBody] RuleThreshold rule)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            rule.LastUpdated = DateTime.UtcNow;
            _context.RuleThresholds.Add(rule);
            await _context.SaveChangesAsync();

            return StatusCode(StatusCodes.Status201Created, rule);
        }

        // PUT: api/fraud/rules/{id}
        [HttpPut("rules/{id}")]
        [Authorize(Roles = "Admin,Analyst")]
        public async Task<IActionResult> UpdateRule(int id, [FromBody] RuleThreshold updated)
        {
            var existing = await _context.RuleThresholds.FindAsync(id);
            if (existing == null)
            {
                return NotFound(new { message = $"Rule with ID {id} not found." });
            }

            existing.RuleName = updated.RuleName ?? existing.RuleName;
            existing.ThresholdValue = updated.ThresholdValue;
            existing.IsActive = updated.IsActive;
            existing.LastUpdated = DateTime.UtcNow;

            await _context.SaveChangesAsync();
            return Ok(existing);
        }

        // DELETE: api/fraud/rules/{id}
        [HttpDelete("rules/{id}")]
        [Authorize(Roles = "Admin,Analyst")]
        public async Task<IActionResult> DeleteRule(int id)
        {
            var existing = await _context.RuleThresholds.FindAsync(id);
            if (existing == null)
            {
                return NotFound(new { message = $"Rule with ID {id} not found." });
            }

            _context.RuleThresholds.Remove(existing);
            await _context.SaveChangesAsync();
            return Ok(new { message = $"Rule {id} deleted successfully." });
        }

        // GET: api/fraud/rules
        [HttpGet("rules")]
        public async Task<IActionResult> GetRules()
        {
            var rules = await _context.RuleThresholds
                .Where(r => r.IsActive)
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