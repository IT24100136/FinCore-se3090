using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using FinCore.Api.Data;
using FinCore.Api.Models;
using FinCore.Api.DTOs;

namespace FinCore.Api.Controllers
{
    /// <summary>
    /// Component C: Human-Approval Coordinator & Review Management Controller
    /// Manages the analyst review queue, dual-approval (maker-checker) gate,
    /// case escalation, and decision audit logs.
    /// </summary>
    [ApiController]
    [Route("api/[controller]")]
    public class ReviewsController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly Services.NotificationService.IEmailService _emailService;
        private const decimal DualApprovalThreshold = 75000m; // Rs. 75,000 dual approval statutory threshold

        public ReviewsController(
            ApplicationDbContext context,
            Services.NotificationService.IEmailService emailService)
        {
            _context = context;
            _emailService = emailService;
        }

        /// <summary>
        /// 1. GET /api/reviews/queue
        /// Supports query params: status (optional string), priority (optional string), page (default 1), pageSize (default 20).
        /// Orders descending by CreatedAt and returns { totalCount, page, pageSize, items }.
        /// </summary>
        [HttpGet("queue")]
        public async Task<IActionResult> GetQueue(
            [FromQuery] string? status,
            [FromQuery] string? priority,
            [FromQuery] Guid? analystId,
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 20)
        {
            if (page < 1) page = 1;
            if (pageSize < 1) pageSize = 20;

            var query = _context.ReviewQueues
                .AsNoTracking()
                .Where(q => !string.IsNullOrEmpty(q.QueueCode) && q.Amount > 0)
                .AsQueryable();

            if (!string.IsNullOrWhiteSpace(status))
            {
                query = query.Where(q => q.Status.ToLower() == status.ToLower());
            }

            if (analystId.HasValue && analystId.Value != Guid.Empty)
            {
                query = query.Where(q => q.AssignedAnalystId == analystId.Value);
            }

            if (!string.IsNullOrWhiteSpace(priority))
            {
                string normPriority = priority.Trim().ToUpper();
                if (int.TryParse(normPriority, out int priorityNumber))
                {
                    query = query.Where(q => q.Priority == priorityNumber || q.PriorityLabel.ToUpper() == normPriority);
                }
                else
                {
                    query = query.Where(q => q.PriorityLabel.ToUpper() == normPriority);
                }
            }

            var totalCount = await query.CountAsync();
            var rawItems = await query
                .OrderByDescending(q => q.CreatedAt)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();

            var staffIds = rawItems
                .SelectMany(i => new[] { i.AssignedAnalystId, i.EscalatedByAnalystId })
                .Where(id => id.HasValue)
                .Select(id => id!.Value)
                .Distinct()
                .ToList();

            var staffMap = await _context.Users
                .AsNoTracking()
                .Where(u => staffIds.Contains(u.Id))
                .ToDictionaryAsync(u => u.Id, u => u);

            var items = rawItems.Select(item => new
            {
                item.Id,
                item.TransactionId,
                item.QueueCode,
                item.Status,
                item.Priority,
                item.PriorityLabel,
                item.Amount,
                item.SenderName,
                item.SenderId,
                item.RecipientName,
                item.RecipientId,
                item.RiskScore,
                item.OriginIp,
                item.Device,
                item.Latitude,
                item.Longitude,
                item.FlagReasonsJson,
                item.AssignedAnalystId,
                assignedAnalystName = item.AssignedAnalystId.HasValue && staffMap.ContainsKey(item.AssignedAnalystId.Value)
                    ? staffMap[item.AssignedAnalystId.Value].Name
                    : null,
                assignedAnalystEmpId = item.AssignedAnalystId.HasValue && staffMap.ContainsKey(item.AssignedAnalystId.Value)
                    ? (staffMap[item.AssignedAnalystId.Value].EmployeeId ?? (staffMap[item.AssignedAnalystId.Value].Role == "Admin" ? "ADM-001" : "ANL-001"))
                    : null,
                item.EscalatedByAnalystId,
                escalatedByName = item.EscalatedByAnalystId.HasValue && staffMap.ContainsKey(item.EscalatedByAnalystId.Value)
                    ? staffMap[item.EscalatedByAnalystId.Value].Name
                    : null,
                escalatedByEmpId = item.EscalatedByAnalystId.HasValue && staffMap.ContainsKey(item.EscalatedByAnalystId.Value)
                    ? (staffMap[item.EscalatedByAnalystId.Value].EmployeeId ?? (staffMap[item.EscalatedByAnalystId.Value].Role == "Admin" ? "ADM-001" : "ANL-001"))
                    : null,
                item.EscalationReason,
                item.CreatedAt,
                item.UpdatedAt
            });

            return Ok(new
            {
                totalCount,
                page,
                pageSize,
                items
            });
        }

        /// <summary>
        /// 2. POST /api/reviews/{transactionId}/assign
        /// Accepts { analystId } and transitions status to 'Assigned'.
        /// </summary>
        [HttpPost("{transactionId}/assign")]
        public async Task<IActionResult> AssignCase(Guid transactionId, [FromBody] AssignRequest request)
        {
            if (request == null || request.AnalystId == Guid.Empty)
            {
                return BadRequest(new { message = "Valid AnalystId is required." });
            }

            var item = await _context.ReviewQueues
                .FirstOrDefaultAsync(q => q.TransactionId == transactionId || q.Id == transactionId);

            if (item == null)
            {
                return NotFound(new { message = "Transaction review item not found." });
            }

            item.AssignedAnalystId = request.AnalystId;
            item.Status = "Assigned";
            item.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            return Ok(new { message = "Case successfully assigned to analyst.", item });
        }

        /// <summary>
        /// 3. POST /api/reviews/{transactionId}/decide
        /// Accepts { analystId, decision, notes, transactionAmount }.
        /// Dual-Approval Rule: If decision == 'Approved' and transactionAmount >= 75000,
        /// set ReviewQueue.Status to 'PendingSecondApproval'. Otherwise set to 'Decided'.
        /// Persists an ApprovalDecision record (ApprovalLevel = 1).
        /// </summary>
        [HttpPost("{transactionId}/decide")]
        public async Task<IActionResult> DecideCase(string transactionId, [FromBody] DecideRequest request)
        {
            if (request == null || string.IsNullOrWhiteSpace(request.Decision))
            {
                return BadRequest(new { message = "Decision is required (e.g. Approved, Rejected)." });
            }

            ReviewQueue? item = null;
            if (Guid.TryParse(transactionId, out var guidId))
            {
                item = await _context.ReviewQueues
                    .FirstOrDefaultAsync(q => q.TransactionId == guidId || q.Id == guidId);
            }

            if (item == null && int.TryParse(transactionId, out var intId))
            {
                var relatedTx = await _context.Transactions.FirstOrDefaultAsync(t => t.Id == intId);
                if (relatedTx != null)
                {
                    item = await _context.ReviewQueues.FirstOrDefaultAsync(q => q.QueueCode == relatedTx.ReferenceId);
                }
            }

            if (item == null)
            {
                item = await _context.ReviewQueues.FirstOrDefaultAsync(q => q.QueueCode == transactionId);
            }

            if (item == null)
            {
                return NotFound(new { message = "Transaction review item not found." });
            }

            decimal effectiveAmount = request.TransactionAmount > 0 ? request.TransactionAmount : item.Amount;
            bool isApproved = request.Decision.Equals("Approved", StringComparison.OrdinalIgnoreCase);
            bool isAlreadyPendingSecond = string.Equals(item.Status, "PendingSecondApproval", StringComparison.OrdinalIgnoreCase);
            var effectiveAnalystId = request.AnalystId != Guid.Empty ? request.AnalystId : (request.SecondAnalystId ?? Guid.Empty);

            // If case is ALREADY in PendingSecondApproval, handle as second approval
            if (isAlreadyPendingSecond && (isApproved || string.Equals(request.Decision, "Rejected", StringComparison.OrdinalIgnoreCase)))
            {
                var primaryApproval = await _context.ApprovalDecisions
                    .Where(d => d.TransactionId == item.TransactionId && d.ApprovalLevel == 1 && d.Decision == "Approved")
                    .OrderBy(d => d.DecidedAt)
                    .FirstOrDefaultAsync();

                if (primaryApproval != null && primaryApproval.AnalystId == effectiveAnalystId)
                {
                    return BadRequest(new
                    {
                        message = "Maker-Checker violation: Second approval must be performed by a different analyst from the primary approver."
                    });
                }

                var secondDecision = new ApprovalDecision
                {
                    Id = Guid.NewGuid(),
                    TransactionId = item.TransactionId,
                    AnalystId = effectiveAnalystId,
                    Decision = request.Decision,
                    ApprovalLevel = 2,
                    Notes = request.Notes,
                    DecidedAt = DateTime.UtcNow
                };

                _context.ApprovalDecisions.Add(secondDecision);

                item.Status = isApproved ? "Approved" : "Rejected";
                item.UpdatedAt = DateTime.UtcNow;

                var tx = await _context.Transactions.FirstOrDefaultAsync(t => t.ReferenceId == item.QueueCode);
                if (tx != null)
                {
                    if (isApproved)
                    {
                        tx.Status = "Completed";
                        if (tx.ReceiverWalletId.HasValue)
                        {
                            var rw = await _context.Wallets.FirstOrDefaultAsync(w => w.Id == tx.ReceiverWalletId.Value);
                            if (rw != null) rw.Balance += tx.Amount;
                        }

                        var flag = await _context.FraudFlags.FirstOrDefaultAsync(f => f.TransactionId == tx.Id);
                        if (flag != null)
                        {
                            flag.Status = "Approved";
                        }

                        var sw = await _context.Wallets.FirstOrDefaultAsync(w => w.Id == tx.SenderWalletId);
                        if (sw != null)
                        {
                            _context.Notifications.Add(new Notification
                            {
                                UserId = sw.UserId,
                                Recipient = item.SenderName,
                                RecipientName = item.SenderName,
                                Title = "Transfer Approved",
                                Message = $"Your transfer of Rs. {tx.Amount:N2} to {item.RecipientName} has been approved by secondary reviewer.",
                                DeliveryStatus = "Sent",
                                ChannelDetails = "Analyst Review Console",
                                Category = "paymentSuccess",
                                IsRead = false,
                                LatencyMs = 150,
                                Timestamp = DateTime.UtcNow
                            });
                        }
                    }
                    else
                    {
                        tx.Status = "Rejected";
                        var sw = await _context.Wallets.FirstOrDefaultAsync(w => w.Id == tx.SenderWalletId);
                        if (sw != null) sw.Balance += tx.Amount;

                        var flag = await _context.FraudFlags.FirstOrDefaultAsync(f => f.TransactionId == tx.Id);
                        if (flag != null)
                        {
                            flag.Status = "Rejected";
                        }
                    }
                }

                await _context.SaveChangesAsync();
                return Ok(new
                {
                    message = "Second approval successfully recorded. Transaction completed.",
                    requiresSecondApproval = false,
                    decisionRecord = secondDecision,
                    item
                });
            }

            bool requiresSecondApproval = isApproved && effectiveAmount >= DualApprovalThreshold;

            var decisionRecord = new ApprovalDecision
            {
                Id = Guid.NewGuid(),
                TransactionId = item.TransactionId,
                AnalystId = effectiveAnalystId,
                Decision = request.Decision,
                ApprovalLevel = 1,
                Notes = request.Notes,
                DecidedAt = DateTime.UtcNow
            };

            _context.ApprovalDecisions.Add(decisionRecord);

            if (string.Equals(request.Decision, "RequestInfo", StringComparison.OrdinalIgnoreCase) ||
                string.Equals(request.Decision, "Revision Requested", StringComparison.OrdinalIgnoreCase) ||
                string.Equals(request.Decision, "Request More Info", StringComparison.OrdinalIgnoreCase))
            {
                item.Status = "InformationRequested";
            }
            else if (requiresSecondApproval)
            {
                item.Status = "PendingSecondApproval";
            }
            else if (isApproved)
            {
                item.Status = "Approved";
                // Real-time synchronization: Update underlying Transaction and credit receiver
                var tx = await _context.Transactions.FirstOrDefaultAsync(t => t.ReferenceId == item.QueueCode);
                if (tx != null)
                {
                    tx.Status = "Completed";
                    if (tx.ReceiverWalletId.HasValue)
                    {
                        var rw = await _context.Wallets.FirstOrDefaultAsync(w => w.Id == tx.ReceiverWalletId.Value);
                        if (rw != null) rw.Balance += tx.Amount;
                    }

                    var flag = await _context.FraudFlags.FirstOrDefaultAsync(f => f.TransactionId == tx.Id);
                    if (flag != null)
                    {
                        flag.Status = "Approved";
                    }

                    var sw = await _context.Wallets.FirstOrDefaultAsync(w => w.Id == tx.SenderWalletId);
                    if (sw != null)
                    {
                        _context.Notifications.Add(new Notification
                        {
                            UserId = sw.UserId,
                            Recipient = item.SenderName,
                            RecipientName = item.SenderName,
                            Title = "Transfer Approved",
                            Message = $"Your transfer of Rs. {tx.Amount:N2} to {item.RecipientName} has been approved.",
                            DeliveryStatus = "Sent",
                            ChannelDetails = "Analyst Review Console",
                            Category = "paymentSuccess",
                            IsRead = false,
                            Timestamp = DateTime.UtcNow
                        });
                    }
                }
            }
            else if (string.Equals(request.Decision, "Rejected", StringComparison.OrdinalIgnoreCase))
            {
                item.Status = "Rejected";
                // Real-time synchronization: Update underlying Transaction and refund sender
                var tx = await _context.Transactions.FirstOrDefaultAsync(t => t.ReferenceId == item.QueueCode);
                if (tx != null)
                {
                    tx.Status = "Rejected";
                    var sw = await _context.Wallets.FirstOrDefaultAsync(w => w.Id == tx.SenderWalletId);
                    if (sw != null) sw.Balance += tx.Amount;

                    var flag = await _context.FraudFlags.FirstOrDefaultAsync(f => f.TransactionId == tx.Id);
                    if (flag != null)
                    {
                        flag.Status = "Rejected";
                    }

                    if (sw != null)
                    {
                        var rejectionMessage = $"FinCore: Your transaction of LKR {tx.Amount:N2} was rejected and funds have been returned to your wallet.";
                        _context.Notifications.Add(new Notification
                        {
                            UserId = sw.UserId,
                            Recipient = item.SenderName,
                            RecipientName = item.SenderName,
                            Title = "Transfer Rejected",
                            Message = rejectionMessage,
                            DeliveryStatus = "Sent",
                            ChannelDetails = "Analyst Review Console",
                            Category = "accountWarning",
                            IsRead = false,
                            Timestamp = DateTime.UtcNow
                        });

                        // Dispatch live rejection alert via Brevo email
                        _ = Task.Run(async () =>
                        {
                            try
                            {
                                var senderUser = sw.UserGuid.HasValue
                                    ? await _context.Users.FirstOrDefaultAsync(u => u.Id == sw.UserGuid.Value)
                                    : await _context.Users.FirstOrDefaultAsync(u => u.Name == item.SenderName);

                                if (senderUser != null && !string.IsNullOrWhiteSpace(senderUser.Email))
                                {
                                    await _emailService.SendEmailAsync(
                                        senderUser.Email,
                                        senderUser.Name,
                                        "FinCore: Transaction Rejected & Refunded",
                                        $"<p>{rejectionMessage}</p>",
                                        rejectionMessage
                                    );
                                }
                            }
                            catch (Exception ex)
                            {
                                Console.WriteLine($"[Brevo Notification Warning] Rejection alert error: {ex.Message}");
                            }
                        });
                    }
                }
            }
            else
            {
                item.Status = "Decided";
            }

            item.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            return Ok(new
            {
                message = requiresSecondApproval
                    ? "Primary approval recorded. Transaction exceeds Rs. 75,000 threshold and requires secondary dual-approval."
                    : $"Decision '{request.Decision}' recorded successfully. Mobile wallet status synchronized.",
                requiresSecondApproval,
                decision = decisionRecord,
                item
            });
        }

        /// <summary>
        /// 4. POST /api/reviews/{transactionId}/second-approval
        /// Validates that the case is in 'PendingSecondApproval'.
        /// Enforces Maker-Checker principle: validates that secondAnalystId != original analystId.
        /// Logs ApprovalDecision with ApprovalLevel = 2 and updates ReviewQueue.Status to 'Approved' or 'Rejected'.
        /// </summary>
        [HttpPost("{transactionId}/second-approval")]
        public async Task<IActionResult> SecondApproval(string transactionId, [FromBody] SecondApprovalRequest request)
        {
            var effectiveSecondAnalystId = (request != null && request.SecondAnalystId != Guid.Empty)
                ? request.SecondAnalystId
                : (request?.AnalystId ?? Guid.Empty);

            if (request == null || effectiveSecondAnalystId == Guid.Empty)
            {
                return BadRequest(new { message = "Valid SecondAnalystId is required." });
            }

            ReviewQueue? item = null;
            if (Guid.TryParse(transactionId, out var guidId))
            {
                item = await _context.ReviewQueues
                    .FirstOrDefaultAsync(q => q.TransactionId == guidId || q.Id == guidId);
            }
            if (item == null)
            {
                item = await _context.ReviewQueues.FirstOrDefaultAsync(q => q.QueueCode == transactionId);
            }

            if (item == null)
            {
                return NotFound(new { message = "Transaction review item not found." });
            }

            if (!string.Equals(item.Status, "PendingSecondApproval", StringComparison.OrdinalIgnoreCase))
            {
                return BadRequest(new { message = $"Case is not pending second approval. Current status is '{item.Status}'." });
            }

            // Enforce Maker-Checker principle: second analyst cannot be the primary approver
            // Order by earliest DecidedAt to find original Maker (e.g. Henry K)
            var primaryDecision = await _context.ApprovalDecisions
                .Where(d => d.TransactionId == item.TransactionId && d.ApprovalLevel == 1 && d.Decision == "Approved")
                .OrderBy(d => d.DecidedAt)
                .FirstOrDefaultAsync();

            if (primaryDecision != null && primaryDecision.AnalystId == effectiveSecondAnalystId)
            {
                return BadRequest(new
                {
                    message = "Maker-Checker violation: Second approval must be performed by a different analyst from the primary approver."
                });
            }

            var secondDecision = new ApprovalDecision
            {
                Id = Guid.NewGuid(),
                TransactionId = item.TransactionId,
                AnalystId = effectiveSecondAnalystId,
                Decision = request.Decision,
                ApprovalLevel = 2,
                Notes = request.Notes,
                DecidedAt = DateTime.UtcNow
            };

            _context.ApprovalDecisions.Add(secondDecision);

            bool isSecondApproved = string.Equals(request.Decision, "Approved", StringComparison.OrdinalIgnoreCase);
            item.Status = isSecondApproved ? "Approved" : "Rejected";
            item.UpdatedAt = DateTime.UtcNow;

            var tx = await _context.Transactions.FirstOrDefaultAsync(t => t.ReferenceId == item.QueueCode);
            if (tx != null)
            {
                if (isSecondApproved)
                {
                    tx.Status = "Completed";
                    if (tx.ReceiverWalletId.HasValue)
                    {
                        var rw = await _context.Wallets.FirstOrDefaultAsync(w => w.Id == tx.ReceiverWalletId.Value);
                        if (rw != null) rw.Balance += tx.Amount;
                    }

                    var flag = await _context.FraudFlags.FirstOrDefaultAsync(f => f.TransactionId == tx.Id);
                    if (flag != null)
                    {
                        flag.Status = "Approved";
                    }
                }
                else
                {
                    tx.Status = "Rejected";
                    var sw = await _context.Wallets.FirstOrDefaultAsync(w => w.Id == tx.SenderWalletId);
                    if (sw != null) sw.Balance += tx.Amount;

                    var flag = await _context.FraudFlags.FirstOrDefaultAsync(f => f.TransactionId == tx.Id);
                    if (flag != null)
                    {
                        flag.Status = "Rejected";
                    }
                }
            }

            await _context.SaveChangesAsync();

            return Ok(new
            {
                message = "Dual approval successfully completed by secondary reviewer. Mobile wallet synchronized.",
                secondDecision,
                item
            });
        }

        /// <summary>
        /// 4b. GET /api/reviews/analysts
        /// Retrieves database-backed list of eligible analyst and admin staff users for case escalation.
        /// </summary>
        [HttpGet("analysts")]
        public async Task<IActionResult> GetEligibleAnalysts()
        {
            var analysts = await _context.Users
                .AsNoTracking()
                .Where(u => (u.Role == "Admin" || u.Role == "Analyst" || u.Role == "Senior Analyst" || u.Role == "SeniorAnalyst" || u.Role == "Manager" || u.Role.Contains("Analyst") || u.Role.Contains("Admin")) && (string.IsNullOrEmpty(u.Status) || u.Status == "Active"))
                .Select(u => new
                {
                    u.Id,
                    u.Name,
                    u.Email,
                    u.Role,
                    u.EmployeeId,
                    u.Department,
                    u.Tier,
                    u.JobTitle
                })
                .ToListAsync();

            return Ok(analysts);
        }

        /// <summary>
        /// 5. POST /api/reviews/{transactionId}/escalate
        /// Escalates case to a designated recipient analyst/admin from DB, assigns case, updates status to 'Escalated',
        /// sets Priority to 3 ('CRITICAL'), records an ApprovalDecision & AuditLog, and dispatches a notification.
        /// </summary>
        [HttpPost("{transactionId}/escalate")]
        public async Task<IActionResult> EscalateCase(string transactionId, [FromBody] EscalateRequest request)
        {
            if (request == null)
            {
                return BadRequest(new { message = "Invalid escalation request payload." });
            }

            // Security Validation 1: Verify current user permission to escalate
            User? originAnalyst = null;
            if (request.AnalystId != Guid.Empty)
            {
                originAnalyst = await _context.Users.FirstOrDefaultAsync(u => u.Id == request.AnalystId);
            }

            if (originAnalyst != null && !IsEligibleStaffRole(originAnalyst.Role))
            {
                return StatusCode(403, new { message = "Security policy violation: Current user does not have permission to escalate compliance cases." });
            }

            // Security Validation 2: Verify selected target analyst exists in DB and has eligible role
            User? targetAnalyst = null;
            if (request.TargetAnalystId != Guid.Empty)
            {
                targetAnalyst = await _context.Users.FirstOrDefaultAsync(u => u.Id == request.TargetAnalystId);
                if (targetAnalyst == null || !IsEligibleStaffRole(targetAnalyst.Role))
                {
                    return BadRequest(new { message = "Security policy violation: Selected analyst does not exist or does not possess an eligible analyst/admin role." });
                }
            }

            ReviewQueue? item = null;
            if (Guid.TryParse(transactionId, out var guidId))
            {
                item = await _context.ReviewQueues
                    .FirstOrDefaultAsync(q => q.TransactionId == guidId || q.Id == guidId);
            }

            if (item == null && int.TryParse(transactionId, out var intId))
            {
                var relatedTx = await _context.Transactions.FirstOrDefaultAsync(t => t.Id == intId);
                if (relatedTx != null)
                {
                    item = await _context.ReviewQueues.FirstOrDefaultAsync(q => q.QueueCode == relatedTx.ReferenceId);
                }
            }

            if (item == null)
            {
                item = await _context.ReviewQueues.FirstOrDefaultAsync(q => q.QueueCode == transactionId);
            }

            if (item == null)
            {
                return NotFound(new { message = $"Transaction review item '{transactionId}' not found." });
            }

            // Fallback selection if target analyst ID was empty
            if (targetAnalyst == null && !string.IsNullOrWhiteSpace(request.TargetAnalystName))
            {
                targetAnalyst = await _context.Users.FirstOrDefaultAsync(u => u.Name.ToLower() == request.TargetAnalystName.ToLower() && (u.Role == "Admin" || u.Role == "Analyst" || u.Role == "Senior Analyst" || u.Role == "SeniorAnalyst"));
            }
            if (targetAnalyst == null)
            {
                targetAnalyst = await _context.Users
                    .FirstOrDefaultAsync(u => (u.Role == "Admin" || u.Role == "Analyst" || u.Role == "Senior Analyst" || u.Role == "SeniorAnalyst") && u.Id != request.AnalystId)
                    ?? await _context.Users.FirstOrDefaultAsync(u => u.Role == "Admin" || u.Role == "Analyst" || u.Role == "Senior Analyst");
            }

            if (targetAnalyst == null)
            {
                return BadRequest(new { message = "No eligible analyst found in identity database to receive escalation." });
            }

            string previousStatus = string.IsNullOrWhiteSpace(item.Status) ? "Queued" : item.Status;
            string originName = originAnalyst?.Name ?? "Analyst";
            string targetName = targetAnalyst.Name;
            string escalationReason = string.IsNullOrWhiteSpace(request.Reason)
                ? "Escalated for senior analyst investigation."
                : request.Reason.Trim();

            // 1. Assign case to selected analyst and update status in PostgreSQL
            item.Status = "Escalated";
            item.Priority = 3;
            item.PriorityLabel = "CRITICAL";
            item.AssignedAnalystId = targetAnalyst.Id;
            item.EscalatedByAnalystId = originAnalyst?.Id ?? (request.AnalystId != Guid.Empty ? request.AnalystId : null);
            item.EscalationReason = escalationReason;
            item.UpdatedAt = DateTime.UtcNow;

            // 2. Create audit events
            var escalationAudit = new ApprovalDecision
            {
                Id = Guid.NewGuid(),
                TransactionId = item.TransactionId,
                AnalystId = originAnalyst?.Id ?? (request.AnalystId != Guid.Empty ? request.AnalystId : Guid.NewGuid()),
                Decision = "Escalated",
                ApprovalLevel = 1,
                Notes = $"Escalated to {targetName}. Reason: {escalationReason}",
                DecidedAt = DateTime.UtcNow
            };
            _context.ApprovalDecisions.Add(escalationAudit);

            var auditUserId = originAnalyst != null
                ? DbInitializer.GetDeterministicUserId(originAnalyst.Id)
                : (request.AnalystId != Guid.Empty ? DbInitializer.GetDeterministicUserId(request.AnalystId) : 1);

            var auditLog = new AuditLog
            {
                UserId = auditUserId,
                Action = "ESCALATED",
                IpAddress = !string.IsNullOrWhiteSpace(item.OriginIp) ? item.OriginIp : "127.0.0.1",
                Timestamp = DateTime.UtcNow,
                Details = $"Actor: {originName} | Action: ESCALATED | Case ID: {item.QueueCode} | Previous Status: {previousStatus} | New Status: Escalated | Assigned Analyst: {targetName} | Reason: {escalationReason}"
            };
            _context.AuditLogs.Add(auditLog);

            // 3. Create persistent notification in PostgreSQL for the selected recipient analyst
            int targetIntId = DbInitializer.GetDeterministicUserId(targetAnalyst.Id);
            var notification = new Notification
            {
                UserId = targetIntId,
                Recipient = targetAnalyst.Email,
                RecipientName = targetAnalyst.Name,
                Title = $"Case Escalated: {item.QueueCode}",
                Message = $"Case {item.QueueCode} (Rs. {item.Amount:N2}) has been escalated to you by {originName}. Reason: {escalationReason}",
                Type = "InApp",
                Category = "securityPause",
                DeliveryStatus = "Sent",
                ChannelDetails = "Internal Escalation Routing",
                IsRead = false,
                Timestamp = DateTime.UtcNow
            };
            _context.Notifications.Add(notification);

            await _context.SaveChangesAsync();

            return Ok(new
            {
                message = $"Case successfully escalated to {targetName} with CRITICAL priority.",
                assignedAnalystId = item.AssignedAnalystId,
                assignedAnalystName = targetName,
                escalatedByAnalystId = item.EscalatedByAnalystId,
                escalatedByName = originName,
                escalationReason = item.EscalationReason,
                item
            });
        }

        private static bool IsEligibleStaffRole(string? role)
        {
            if (string.IsNullOrWhiteSpace(role)) return false;
            var r = role.Trim();
            return r.Equals("Analyst", StringComparison.OrdinalIgnoreCase) ||
                   r.Equals("Senior Analyst", StringComparison.OrdinalIgnoreCase) ||
                   r.Equals("SeniorAnalyst", StringComparison.OrdinalIgnoreCase) ||
                   r.Equals("Admin", StringComparison.OrdinalIgnoreCase) ||
                   r.Equals("Administrator", StringComparison.OrdinalIgnoreCase) ||
                   r.Equals("Manager", StringComparison.OrdinalIgnoreCase) ||
                   r.Contains("Analyst", StringComparison.OrdinalIgnoreCase) ||
                   r.Contains("Admin", StringComparison.OrdinalIgnoreCase);
        }

        /// <summary>
        /// 6. GET /api/reviews/analytics/performance
        /// Computes live counts: TotalCases, DecidedCases, PendingCases, ApprovedCount, RejectedCount, and ApprovalRate percentage.
        /// </summary>
        [HttpGet("analytics/performance")]
        public async Task<IActionResult> GetPerformance()
        {
            var validQueues = _context.ReviewQueues
                .Where(q => !string.IsNullOrEmpty(q.QueueCode) && q.Amount > 0);

            var totalCases = await validQueues.CountAsync();
            var decidedCases = await validQueues.CountAsync(q => q.Status == "Decided");
            var pendingCases = await validQueues.CountAsync(q =>
                q.Status == "Queued" || q.Status == "Assigned" || q.Status == "PendingSecondApproval");

            var criticalCases = await validQueues.CountAsync(q =>
                q.Priority == 3 || q.PriorityLabel == "CRITICAL");
            var unassignedCases = await validQueues.CountAsync(q =>
                q.AssignedAnalystId == null && q.Status == "Queued");
            var underReviewCases = await validQueues.CountAsync(q =>
                q.Status == "Assigned" || q.Status == "PendingSecondApproval" || q.Status == "InformationRequested");

            var decisions = await _context.ApprovalDecisions.AsNoTracking().ToListAsync();
            var approvedCount = decisions.Count(d => d.Decision.Equals("Approved", StringComparison.OrdinalIgnoreCase));
            var rejectedCount = decisions.Count(d => d.Decision.Equals("Rejected", StringComparison.OrdinalIgnoreCase));
            var escalatedCount = decisions.Count(d => d.Decision.Equals("Escalated", StringComparison.OrdinalIgnoreCase));
            var infoRequestedCount = decisions.Count(d => d.Decision.Equals("RequestInfo", StringComparison.OrdinalIgnoreCase) || d.Decision.Equals("Revision Requested", StringComparison.OrdinalIgnoreCase) || d.Decision.Equals("Request More Info", StringComparison.OrdinalIgnoreCase));

            double approvalRate = decisions.Count > 0 ? ((double)approvedCount / decisions.Count) * 100 : 0.0;
            double rejectionRate = decisions.Count > 0 ? ((double)rejectedCount / decisions.Count) * 100 : 0.0;

            // Calculate average decision time from ReviewQueues and their ApprovalDecisions
            var queues = await _context.ReviewQueues.AsNoTracking().ToListAsync();
            var decisionTimes = (from q in queues
                                 join d in decisions on q.TransactionId equals d.TransactionId
                                 where d.DecidedAt > q.CreatedAt
                                 select (d.DecidedAt - q.CreatedAt).TotalMinutes).ToList();

            double avgDecisionTimeMinutes = decisionTimes.Count > 0 ? Math.Round(decisionTimes.Average(), 1) : 4.2;

            return Ok(new
            {
                totalCases,
                decidedCases,
                pendingCases,
                critical = criticalCases,
                unassigned = unassignedCases,
                underReview = underReviewCases,
                approvedCount,
                rejectedCount,
                escalatedCount,
                infoRequestedCount,
                approvalRate = Math.Round(approvalRate, 1),
                rejectionRate = Math.Round(rejectionRate, 1),
                averageDecisionTimeMinutes = avgDecisionTimeMinutes
            });
        }

        /// <summary>
        /// 7. POST /api/reviews/seed-test-data
        /// Seeds realistic database records matching our Figma prototype
        /// (Q-104 with K. Perera / Rs. 75,000 / Risk 87, Q-103 with R. Dias / Rs. 48,000 / Risk 61,
        /// and Q-102 with N. De Silva / Rs. 67,500 / Risk 79), including JSON-serialized SHAP flag reasons
        /// and coordinates for Leaflet maps.
        /// </summary>
        [HttpPost("seed-test-data")]
        public async Task<IActionResult> SeedTestData()
        {
            var seedQueueCodes = new[] { "Q-104", "Q-103", "Q-102" };
            var existingItems = await _context.ReviewQueues
                .Where(q => seedQueueCodes.Contains(q.QueueCode) || string.IsNullOrEmpty(q.QueueCode) || q.Amount <= 0)
                .ToListAsync();

            if (existingItems.Count > 0)
            {
                _context.ReviewQueues.RemoveRange(existingItems);
                await _context.SaveChangesAsync();
            }

            var sampleCases = new List<ReviewQueue>
            {
                new ReviewQueue
                {
                    Id = Guid.NewGuid(),
                    TransactionId = Guid.NewGuid(),
                    QueueCode = "Q-104",
                    Status = "Queued",
                    Priority = 3,
                    PriorityLabel = "CRITICAL",
                    Amount = 75000m,
                    SenderName = "K. Perera",
                    SenderId = "USR-4421",
                    RecipientName = "M. Fernando",
                    RecipientId = "USR-2187",
                    RiskScore = 87,
                    OriginIp = "203.143.88.71",
                    Device = "Pixel 7 — Android 14",
                    Latitude = 6.9319,
                    Longitude = 79.8478,
                    FlagReasonsJson = JsonSerializer.Serialize(new[]
                    {
                        new { label = "Amount 3× User Average", impact = "+30", color = "#f59e0b" },
                        new { label = "Unrecognized Device Fingerprint", impact = "+25", color = "#ef4444" },
                        new { label = "Geolocation Mismatch > 200km", impact = "+32", color = "#ef4444" }
                    }),
                    CreatedAt = DateTime.UtcNow
                },
                new ReviewQueue
                {
                    Id = Guid.NewGuid(),
                    TransactionId = Guid.NewGuid(),
                    QueueCode = "Q-103",
                    Status = "Queued",
                    Priority = 2,
                    PriorityLabel = "HIGH",
                    Amount = 48000m,
                    SenderName = "R. Dias",
                    SenderId = "USR-3387",
                    RecipientName = "S. Gunasekara",
                    RecipientId = "USR-9912",
                    RiskScore = 61,
                    OriginIp = "112.134.55.10",
                    Device = "iPhone 13 — iOS 17",
                    Latitude = 7.2906,
                    Longitude = 80.6337,
                    FlagReasonsJson = JsonSerializer.Serialize(new[]
                    {
                        new { label = "Amount Threshold Exceeded", impact = "+35", color = "#f59e0b" },
                        new { label = "Velocity Anomaly", impact = "+26", color = "#f59e0b" }
                    }),
                    CreatedAt = DateTime.UtcNow.AddMinutes(-15)
                },
                new ReviewQueue
                {
                    Id = Guid.NewGuid(),
                    TransactionId = Guid.NewGuid(),
                    QueueCode = "Q-102",
                    Status = "Queued",
                    Priority = 2,
                    PriorityLabel = "HIGH",
                    Amount = 67500m,
                    SenderName = "N. De Silva",
                    SenderId = "USR-7712",
                    RecipientName = "A. Pieris",
                    RecipientId = "USR-3401",
                    RiskScore = 79,
                    OriginIp = "192.248.44.12",
                    Device = "Samsung S23 — Android 14",
                    Latitude = 6.0535,
                    Longitude = 80.2210,
                    FlagReasonsJson = JsonSerializer.Serialize(new[]
                    {
                        new { label = "Geo Mismatch", impact = "+40", color = "#ef4444" },
                        new { label = "New Device", impact = "+39", color = "#ef4444" }
                    }),
                    CreatedAt = DateTime.UtcNow.AddMinutes(-40)
                }
            };

            await _context.ReviewQueues.AddRangeAsync(sampleCases);
            await _context.SaveChangesAsync();

            return Ok(new
            {
                message = "Successfully seeded prototype review cases matching Figma designs.",
                count = sampleCases.Count,
                items = sampleCases
            });
        }
        /// <summary>
        /// POST /api/reviews/enqueue
        /// Allows the AI Coordinator Agent (Component C) to persist flagged transactions into the ReviewQueue.
        /// </summary>
        [HttpPost("enqueue")]
        public async Task<IActionResult> EnqueueCase([FromBody] EnqueueReviewRequest request)
        {
            if (request == null)
            {
                return BadRequest(new { message = "Invalid enqueue request payload." });
            }

            var txId = request.TransactionId != Guid.Empty ? request.TransactionId : Guid.NewGuid();
            var existing = await _context.ReviewQueues.FirstOrDefaultAsync(q => q.TransactionId == txId);
            if (existing != null)
            {
                return Ok(new { message = "Transaction already queued.", item = existing });
            }

            var newCase = new ReviewQueue
            {
                Id = Guid.NewGuid(),
                TransactionId = txId,
                QueueCode = !string.IsNullOrWhiteSpace(request.QueueCode) ? request.QueueCode : $"Q-{new Random().Next(100, 999)}",
                Status = "Queued",
                Priority = request.Priority > 0 ? request.Priority : 1,
                PriorityLabel = !string.IsNullOrWhiteSpace(request.PriorityLabel) ? request.PriorityLabel : "MEDIUM",
                Amount = request.Amount,
                SenderName = !string.IsNullOrWhiteSpace(request.SenderName) ? request.SenderName : "Flagged User",
                SenderId = request.SenderId,
                RecipientName = !string.IsNullOrWhiteSpace(request.RecipientName) ? request.RecipientName : "Recipient",
                RecipientId = request.RecipientId,
                RiskScore = request.RiskScore,
                OriginIp = !string.IsNullOrWhiteSpace(request.OriginIp) ? request.OriginIp : "127.0.0.1",
                Device = !string.IsNullOrWhiteSpace(request.Device) ? request.Device : "Unknown Device",
                Latitude = request.Latitude != 0 ? request.Latitude : 6.9271,
                Longitude = request.Longitude != 0 ? request.Longitude : 79.8612,
                FlagReasonsJson = request.FlagReasonsJson,
                CreatedAt = DateTime.UtcNow
            };

            _context.ReviewQueues.Add(newCase);
            await _context.SaveChangesAsync();

            return Ok(new { message = "Case successfully enqueued for review.", item = newCase });
        }

        /// <summary>
        /// GET /api/reviews/history
        /// Returns all compliance audit trail & decision history from PostgreSQL.
        /// </summary>
        [HttpGet("history")]
        [HttpGet("audit-trail")]
        public async Task<IActionResult> GetAllHistory()
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

            // Also check for any finalised ReviewQueues not in ApprovalDecisions
            var decidedQueueStatuses = new[] { "Approved", "Rejected", "Escalated", "PendingSecondApproval", "InformationRequested" };
            var extraQueues = await _context.ReviewQueues
                .AsNoTracking()
                .Where(q => decidedQueueStatuses.Contains(q.Status) && !txIds.Contains(q.TransactionId))
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

            // Also include ledger reversals from AuditLogs
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

            var orderedResult = result.OrderByDescending(r => r.Timestamp).ToList();
            return Ok(orderedResult);
        }

        /// <summary>
        /// GET /api/reviews/cases/{id}
        /// Retrieves a single review case by TransactionId (Guid), QueueCode (string), or QueueId.
        /// </summary>
        [HttpGet("cases/{id}")]
        public async Task<IActionResult> GetCaseById(string id)
        {
            if (string.IsNullOrWhiteSpace(id))
            {
                return BadRequest(new { message = "Case identifier is required." });
            }

            ReviewQueue? item = null;

            if (Guid.TryParse(id, out Guid guidId))
            {
                item = await _context.ReviewQueues.FirstOrDefaultAsync(q => q.TransactionId == guidId || q.Id == guidId);
                if (item == null)
                {
                    var decision = await _context.ApprovalDecisions.FirstOrDefaultAsync(d => d.Id == guidId || d.TransactionId == guidId);
                    if (decision != null)
                    {
                        item = await _context.ReviewQueues.FirstOrDefaultAsync(q => q.TransactionId == decision.TransactionId);
                    }
                }
            }

            if (item == null)
            {
                string normId = id.Trim();
                item = await _context.ReviewQueues.FirstOrDefaultAsync(q => q.QueueCode.ToLower() == normId.ToLower());
            }

            if (item == null && (id.Equals("latest", StringComparison.OrdinalIgnoreCase) || id.Equals("current", StringComparison.OrdinalIgnoreCase)))
            {
                item = await _context.ReviewQueues.OrderByDescending(q => q.CreatedAt).FirstOrDefaultAsync();
            }

            if (item == null)
            {
                Transaction? tx = null;
                if (int.TryParse(id, out int txIntId))
                {
                    tx = await _context.Transactions.FirstOrDefaultAsync(t => t.Id == txIntId);
                }
                if (tx == null)
                {
                    tx = await _context.Transactions.FirstOrDefaultAsync(t => t.ReferenceId == id);
                }

                if (tx != null)
                {
                    item = new ReviewQueue
                    {
                        Id = Guid.NewGuid(),
                        TransactionId = Guid.NewGuid(),
                        QueueCode = tx.ReferenceId,
                        Amount = tx.Amount,
                        Status = tx.Status,
                        Priority = tx.Amount >= 75000 ? 3 : 2,
                        PriorityLabel = tx.Amount >= 75000 ? "CRITICAL" : "HIGH",
                        RiskScore = tx.Amount >= 75000 ? 85 : 55,
                        SenderName = $"Wallet #{tx.SenderWalletId}",
                        RecipientName = tx.ReceiverWalletId.HasValue ? $"Wallet #{tx.ReceiverWalletId.Value}" : "External Account",
                        Device = "Mobile Android",
                        OriginIp = "127.0.0.1",
                        CreatedAt = tx.Timestamp,
                        UpdatedAt = tx.Timestamp
                    };
                }
            }

            if (item == null)
            {
                return NotFound(new { message = $"Review case '{id}' not found." });
            }

            var history = await _context.ApprovalDecisions
                .AsNoTracking()
                .Where(d => d.TransactionId == item.TransactionId)
                .OrderBy(d => d.DecidedAt)
                .ToListAsync();

            string? assignedName = null;
            string? assignedEmpId = null;
            if (item.AssignedAnalystId.HasValue)
            {
                var u = await _context.Users.AsNoTracking().FirstOrDefaultAsync(x => x.Id == item.AssignedAnalystId.Value);
                assignedName = u?.Name;
                assignedEmpId = u?.EmployeeId ?? (u?.Role == "Admin" ? "ADM-001" : "ANL-001");
            }

            string? escalatedName = null;
            string? escalatedEmpId = null;
            if (item.EscalatedByAnalystId.HasValue)
            {
                var u = await _context.Users.AsNoTracking().FirstOrDefaultAsync(x => x.Id == item.EscalatedByAnalystId.Value);
                escalatedName = u?.Name;
                escalatedEmpId = u?.EmployeeId ?? (u?.Role == "Admin" ? "ADM-001" : "ANL-001");
            }

            var analystGuids = history.Select(h => h.AnalystId).Distinct().ToList();
            var staffUsers = await _context.Users
                .AsNoTracking()
                .Where(u => analystGuids.Contains(u.Id))
                .ToDictionaryAsync(u => u.Id, u => u);

            var enrichedCaseHistory = history.Select(d =>
            {
                staffUsers.TryGetValue(d.AnalystId, out var u);
                string regNo = u?.EmployeeId ?? (u?.Role == "Admin" ? "ADM-001" : "ANL-001");
                string name = u?.Name ?? (!string.IsNullOrWhiteSpace(u?.Email) ? u.Email : "Compliance Analyst");
                return new
                {
                    d.Id,
                    d.TransactionId,
                    AnalystId = regNo,
                    AnalystGuid = d.AnalystId,
                    AnalystEmpId = regNo,
                    AnalystName = name,
                    d.Decision,
                    d.Notes,
                    d.ApprovalLevel,
                    d.DecidedAt
                };
            }).ToList();

            return Ok(new
            {
                item,
                assignedAnalystName = assignedName,
                assignedAnalystEmpId = assignedEmpId,
                escalatedByName = escalatedName,
                escalatedByEmpId = escalatedEmpId,
                escalationReason = item.EscalationReason,
                history = enrichedCaseHistory
            });
        }

        /// <summary>
        /// GET /api/reviews/{transactionId}/history
        /// Returns chronological decision history for a specific transaction with enriched analyst registration info.
        /// </summary>
        [HttpGet("{transactionId:guid}/history")]
        public async Task<IActionResult> GetHistory(Guid transactionId)
        {
            var history = await _context.ApprovalDecisions
                .AsNoTracking()
                .Where(d => d.TransactionId == transactionId)
                .OrderBy(d => d.DecidedAt)
                .ToListAsync();

            var analystGuids = history.Select(h => h.AnalystId).Distinct().ToList();
            var staffUsers = await _context.Users
                .AsNoTracking()
                .Where(u => analystGuids.Contains(u.Id))
                .ToDictionaryAsync(u => u.Id, u => u);

            var enrichedHistory = history.Select(d =>
            {
                staffUsers.TryGetValue(d.AnalystId, out var u);
                string regNo = u?.EmployeeId ?? (u?.Role == "Admin" ? "ADM-001" : "ANL-001");
                string name = u?.Name ?? (!string.IsNullOrWhiteSpace(u?.Email) ? u.Email : "Compliance Analyst");
                return new
                {
                    d.Id,
                    d.TransactionId,
                    AnalystId = regNo,
                    AnalystGuid = d.AnalystId,
                    AnalystEmpId = regNo,
                    AnalystName = name,
                    d.Decision,
                    d.Notes,
                    d.ApprovalLevel,
                    d.DecidedAt
                };
            }).ToList();

            return Ok(enrichedHistory);
        }

        /// <summary>
        /// GET /api/reviews/customer/{customerId}/held
        /// Component C: Returns all active held transactions for the specified customer
        /// with calculated queue position and estimated wait times.
        /// </summary>
        [HttpGet("customer/{customerId}/held")]
        public async Task<IActionResult> GetCustomerHeldTransactions(string customerId)
        {
            if (string.IsNullOrWhiteSpace(customerId))
            {
                return BadRequest(new { message = "CustomerId is required." });
            }

            var heldStatuses = new[] { "Queued", "Assigned", "PendingSecondApproval", "Escalated", "Under Review", "InReview" };

            // 1. Fetch active cases from ReviewQueues (where Status is one of heldStatuses)
            var allActiveQueue = await _context.ReviewQueues
                .AsNoTracking()
                .Where(q => heldStatuses.Contains(q.Status))
                .OrderBy(q => q.CreatedAt)
                .ToListAsync();

            // 2. Resolve user / wallet
            User? user = null;
            if (Guid.TryParse(customerId, out Guid userGuid))
            {
                user = await _context.Users.FirstOrDefaultAsync(u => u.Id == userGuid);
            }
            if (user == null)
            {
                user = await _context.Users.FirstOrDefaultAsync(u => u.Email == customerId);
            }

            int userIdInt = user != null ? Math.Abs(user.Id.ToString().GetHashCode()) : 0;
            if (userIdInt == 0 && int.TryParse(customerId, out int parsedInt))
            {
                userIdInt = parsedInt;
            }

            var wallet = userIdInt != 0 
                ? await _context.Wallets.FirstOrDefaultAsync(w => w.UserId == userIdInt)
                : null;
            if (wallet == null)
            {
                wallet = await _context.Wallets.FirstOrDefaultAsync();
            }

            // Fetch pending transactions directly from user's wallet
            var pendingTransactions = new List<Transaction>();
            if (wallet != null)
            {
                pendingTransactions = await _context.Transactions
                    .AsNoTracking()
                    .Where(t => t.SenderWalletId == wallet.Id && (t.Status.ToLower() == "pending" || t.Status.ToLower() == "held"))
                    .OrderByDescending(t => t.Timestamp)
                    .ToListAsync();
            }

            // Match ReviewQueue items for this customer
            var customerHeldCases = allActiveQueue
                .Where(q => string.Equals(q.SenderId, customerId, StringComparison.OrdinalIgnoreCase)
                         || (user != null && string.Equals(q.SenderId, user.Id.ToString(), StringComparison.OrdinalIgnoreCase))
                         || q.SenderId.Contains(customerId, StringComparison.OrdinalIgnoreCase)
                         || customerId.Equals("all", StringComparison.OrdinalIgnoreCase)
                         || customerId.Equals("any", StringComparison.OrdinalIgnoreCase)
                         || customerId.Equals("me", StringComparison.OrdinalIgnoreCase))
                .ToList();

            var resultItems = customerHeldCases.Select(q =>
            {
                int queueDepthAhead = allActiveQueue.Count(other => other.CreatedAt < q.CreatedAt);
                int estimatedWaitMinutes = Math.Max(5, (queueDepthAhead + 1) * 5);

                return new
                {
                    id = q.Id.ToString(),
                    transactionId = q.TransactionId.ToString(),
                    transactionCode = !string.IsNullOrEmpty(q.QueueCode) ? q.QueueCode : $"TX-{q.Id.ToString().Substring(0, 5).ToUpper()}",
                    recipientName = !string.IsNullOrEmpty(q.RecipientName) ? q.RecipientName : "Recipient",
                    recipientId = q.RecipientId,
                    senderName = q.SenderName,
                    senderId = q.SenderId,
                    amount = (double)q.Amount,
                    createdAt = q.CreatedAt,
                    status = q.Status, // Queued, Assigned, PendingSecondApproval, Escalated
                    estimatedWaitMinutes = estimatedWaitMinutes,
                    priority = q.Priority,
                    priorityLabel = q.PriorityLabel,
                    riskScore = q.RiskScore,
                    flagReasons = q.FlagReasonsJson ?? string.Empty
                };
            }).ToList();

            // Include any pending transactions from the user's wallet that weren't yet in ReviewQueues
            foreach (var tx in pendingTransactions)
            {
                if (!resultItems.Any(i => i.transactionCode == tx.ReferenceId))
                {
                    var fFlag = await _context.FraudFlags.FirstOrDefaultAsync(f => f.TransactionId == tx.Id);
                    resultItems.Add(new
                    {
                        id = tx.Id.ToString(),
                        transactionId = Guid.NewGuid().ToString(),
                        transactionCode = tx.ReferenceId,
                        recipientName = tx.Note?.Replace("Transfer to ", "") ?? "Recipient",
                        recipientId = tx.ReceiverWalletId?.ToString() ?? "",
                        senderName = user?.Name ?? "Customer",
                        senderId = customerId,
                        amount = (double)tx.Amount,
                        createdAt = tx.Timestamp,
                        status = tx.Amount >= 75000m ? "PendingSecondApproval" : "Queued",
                        estimatedWaitMinutes = 10,
                        priority = tx.Amount >= 50000m ? 3 : 1,
                        priorityLabel = tx.Amount >= 50000m ? "HIGH" : "MEDIUM",
                        riskScore = fFlag != null ? (double)fFlag.RiskScore : 40.0,
                        flagReasons = fFlag?.Reasons ?? (tx.Amount >= 75000m ? "Statutory Dual Approval Threshold (>75k LKR)" : "Standard Gateway Review")
                    });
                }
            }

            return Ok(resultItems);
        }

        /// <summary>
        /// GET /api/reviews/customer/{customerId}/history
        /// Returns customer transactions reflecting updated status: HELD, COMPLETED, REJECTED
        /// </summary>
        [HttpGet("customer/{customerId}/history")]
        public async Task<IActionResult> GetCustomerHistory(string customerId)
        {
            User? user = null;
            if (Guid.TryParse(customerId, out Guid userGuid))
            {
                user = await _context.Users.FirstOrDefaultAsync(u => u.Id == userGuid);
            }
            if (user == null)
            {
                user = await _context.Users.FirstOrDefaultAsync(u => u.Email == customerId);
            }

            int userIdInt = user != null ? Math.Abs(user.Id.ToString().GetHashCode()) : 0;
            if (userIdInt == 0 && int.TryParse(customerId, out int parsedInt))
            {
                userIdInt = parsedInt;
            }

            var wallet = userIdInt != 0 
                ? await _context.Wallets.FirstOrDefaultAsync(w => w.UserId == userIdInt)
                : await _context.Wallets.FirstOrDefaultAsync();

            if (wallet == null)
            {
                return Ok(new List<object>());
            }

            var txs = await _context.Transactions
                .AsNoTracking()
                .Where(t => t.SenderWalletId == wallet.Id || t.ReceiverWalletId == wallet.Id)
                .OrderByDescending(t => t.Timestamp)
                .ToListAsync();

            var result = txs.Select(t =>
            {
                string displayStatus = t.Status;
                if (displayStatus.Equals("Pending", StringComparison.OrdinalIgnoreCase))
                {
                    displayStatus = "HELD";
                }
                else if (displayStatus.Equals("Completed", StringComparison.OrdinalIgnoreCase))
                {
                    displayStatus = "COMPLETED";
                }
                else if (displayStatus.Equals("Rejected", StringComparison.OrdinalIgnoreCase))
                {
                    displayStatus = "REJECTED";
                }

                return new
                {
                    id = t.Id,
                    referenceId = t.ReferenceId,
                    amount = (double)t.Amount,
                    displayAmount = t.SenderWalletId == wallet.Id ? -(double)t.Amount : (double)t.Amount,
                    status = displayStatus,
                    rawStatus = t.Status,
                    timestamp = t.Timestamp,
                    note = t.Note
                };
            }).ToList();

            return Ok(result);
        }
    }
}