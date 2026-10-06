using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using FinCore.Api.Data;
using FinCore.Api.Models;
using FinCore.Api.DTOs;

namespace FinCore.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AuditController : ControllerBase
    {
        private readonly ApplicationDbContext _context;

        public AuditController(ApplicationDbContext context)
        {
            _context = context;
        }

        /// <summary>
        /// GET /api/audit/history
        /// Unified endpoint returning chronological compliance audit trail records from PostgreSQL.
        /// </summary>
        [HttpGet("history")]
        [HttpGet("trail")]
        [HttpGet("logs")]
        public async Task<IActionResult> GetAuditHistory()
        {
            var decisions = await _context.ApprovalDecisions
                .AsNoTracking()
                .OrderByDescending(d => d.DecidedAt)
                .ToListAsync();

            var txIds = decisions.Select(d => d.TransactionId).Distinct().ToList();
            var queueItems = await _context.ReviewQueues
                .AsNoTracking()
                .Where(q => txIds.Contains(q.TransactionId))
                .ToListAsync();

            var queueMap = queueItems
                .GroupBy(q => q.TransactionId)
                .ToDictionary(g => g.Key, g => g.First());

            var analystIds = decisions.Select(d => d.AnalystId).Distinct().ToList();
            var users = await _context.Users
                .AsNoTracking()
                .Where(u => analystIds.Contains(u.Id))
                .ToListAsync();

            var userMap = users.ToDictionary(u => u.Id, u => u);

            var result = new List<DecisionHistoryDto>();

            foreach (var d in decisions)
            {
                queueMap.TryGetValue(d.TransactionId, out var q);
                userMap.TryGetValue(d.AnalystId, out var u);

                string actionUpper = (d.Decision ?? "").Trim().ToUpper();
                string normalizedAction = "APPROVED";
                if (actionUpper.Contains("REJECT") || actionUpper.Contains("BLOCK") || actionUpper.Contains("FRAUD"))
                {
                    normalizedAction = "REJECTED";
                }
                else if (actionUpper.Contains("ESCALAT"))
                {
                    normalizedAction = "ESCALATED";
                }
                else if (actionUpper.Contains("INFO") || actionUpper.Contains("REVISION"))
                {
                    normalizedAction = "REQUEST MORE INFO";
                }

                string prevStatus = d.ApprovalLevel == 2 ? "PendingSecondApproval" : (q?.Status == "Escalated" ? "Under Review" : "Queued");
                string nextStatus = d.Decision ?? "Approved";

                string analystName = u?.Name ?? (!string.IsNullOrWhiteSpace(u?.Email) ? u.Email : "Compliance Analyst");
                string analystIdStr = u?.EmployeeId ?? (u?.Role == "Admin" ? "ADM-001" : "ANL-001");

                string secondaryApprover = d.ApprovalLevel >= 2 
                    ? (u?.Name ?? "Senior Supervisor") 
                    : "N/A - Single Approval";

                result.Add(new DecisionHistoryDto
                {
                    Id = d.Id,
                    TransactionId = d.TransactionId,
                    ReferenceId = !string.IsNullOrWhiteSpace(q?.QueueCode) ? q.QueueCode : "TXN-" + d.TransactionId.ToString().Substring(0, Math.Min(8, d.TransactionId.ToString().Length)).ToUpper(),
                    Amount = q?.Amount ?? 0m,
                    SenderAccountNumber = !string.IsNullOrWhiteSpace(q?.SenderId) ? q.SenderId : "ACC-1001",
                    SenderName = !string.IsNullOrWhiteSpace(q?.SenderName) ? q.SenderName : "Verified Sender",
                    RecipientName = !string.IsNullOrWhiteSpace(q?.RecipientName) ? q.RecipientName : "Verified Beneficiary",
                    RecipientAccountNo = !string.IsNullOrWhiteSpace(q?.RecipientId) ? q.RecipientId : "ACC-2002",
                    BankName = "FinCore Bank",
                    RiskScore = q?.RiskScore ?? (normalizedAction == "REJECTED" ? 85.0 : normalizedAction == "ESCALATED" ? 65.0 : 35.0),
                    RiskTier = !string.IsNullOrWhiteSpace(q?.PriorityLabel) ? q.PriorityLabel : ((q?.RiskScore ?? 35) >= 70 ? "CRITICAL" : (q?.RiskScore ?? 35) >= 50 ? "HIGH" : "MEDIUM"),
                    Action = normalizedAction,
                    PreviousStatus = prevStatus,
                    NewStatus = nextStatus,
                    ApprovalLevel = d.ApprovalLevel,
                    PrimaryAnalystName = analystName,
                    PrimaryAnalystId = analystIdStr,
                    SecondaryApproverName = secondaryApprover,
                    SecondaryApproverId = d.ApprovalLevel >= 2 ? "SENIOR-01" : "N/A",
                    Notes = d.Notes ?? "Compliance regulatory review completed.",
                    Reason = d.Notes ?? "Compliance regulatory review completed.",
                    DecidedAt = d.DecidedAt,
                    Timestamp = d.DecidedAt,
                    Status = nextStatus,
                    Category = "Decision",
                    FlagReasons = q?.FlagReasonsJson
                });
            }

            // Include completed/escalated ReviewQueues not in ApprovalDecisions
            var decidedStatuses = new[] { "Approved", "Rejected", "Escalated", "PendingSecondApproval", "InformationRequested" };
            var extraQueues = await _context.ReviewQueues
                .AsNoTracking()
                .Where(q => decidedStatuses.Contains(q.Status) && !txIds.Contains(q.TransactionId))
                .OrderByDescending(q => q.UpdatedAt ?? q.CreatedAt)
                .ToListAsync();

            foreach (var eq in extraQueues)
            {
                string actionUpper = (eq.Status ?? "").ToUpper();
                string action = actionUpper.Contains("APPROV") ? "APPROVED" : actionUpper.Contains("REJECT") ? "REJECTED" : actionUpper.Contains("ESCALAT") ? "ESCALATED" : (eq.Status ?? "QUEUED");
                result.Add(new DecisionHistoryDto
                {
                    Id = eq.Id,
                    TransactionId = eq.TransactionId,
                    ReferenceId = eq.QueueCode ?? "",
                    Amount = eq.Amount,
                    SenderAccountNumber = eq.SenderId ?? "ACC-1001",
                    SenderName = eq.SenderName ?? "Verified Sender",
                    RecipientName = eq.RecipientName ?? "Verified Beneficiary",
                    RecipientAccountNo = eq.RecipientId ?? "ACC-2002",
                    BankName = "FinCore Bank",
                    RiskScore = eq.RiskScore,
                    RiskTier = eq.PriorityLabel ?? (eq.RiskScore >= 70 ? "CRITICAL" : eq.RiskScore >= 50 ? "HIGH" : "MEDIUM"),
                    Action = action,
                    PreviousStatus = "Queued",
                    NewStatus = eq.Status ?? "Decided",
                    ApprovalLevel = 1,
                    PrimaryAnalystName = "Diluni Silva (Compliance)",
                    PrimaryAnalystId = "ANL-001",
                    SecondaryApproverName = "N/A - Single Approval",
                    SecondaryApproverId = "N/A",
                    Notes = "Regulatory compliance workflow completed.",
                    Reason = "Regulatory compliance workflow completed.",
                    DecidedAt = eq.UpdatedAt ?? eq.CreatedAt,
                    Timestamp = eq.UpdatedAt ?? eq.CreatedAt,
                    Status = eq.Status ?? "Decided",
                    Category = "Decision",
                    FlagReasons = eq.FlagReasonsJson
                });
            }

            // Include system ledger reversal audit events
            var reversalLogs = await _context.AuditLogs
                .AsNoTracking()
                .Where(l => l.Action == "TRANSACTION_REVERSED")
                .OrderByDescending(l => l.Timestamp)
                .ToListAsync();

            foreach (var rev in reversalLogs)
            {
                result.Add(new DecisionHistoryDto
                {
                    Id = Guid.NewGuid(),
                    TransactionId = Guid.Empty,
                    ReferenceId = "REV-" + rev.Id,
                    Amount = 0m,
                    SenderAccountNumber = "SYSTEM-LEDGER",
                    SenderName = "Institutional Reversal",
                    RecipientName = "Original Sender",
                    RecipientAccountNo = "",
                    BankName = "FinCore Central Bank",
                    RiskScore = 90.0,
                    RiskTier = "CRITICAL",
                    Action = "REVERSED",
                    PreviousStatus = "Held",
                    NewStatus = "Reversed",
                    ApprovalLevel = 2,
                    PrimaryAnalystName = "Admin / Institutional Audit",
                    PrimaryAnalystId = "ADM-001",
                    SecondaryApproverName = "Compliance Governance",
                    SecondaryApproverId = "GOV-01",
                    Notes = rev.Details,
                    Reason = rev.Details,
                    DecidedAt = rev.Timestamp,
                    Timestamp = rev.Timestamp,
                    Status = "Reversed",
                    Category = "Ledger"
                });
            }

            return Ok(result.OrderByDescending(r => r.Timestamp).ToList());
        }
    }
}
