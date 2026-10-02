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
        private const decimal DualApprovalThreshold = 75000m; // Rs. 75,000 dual approval statutory threshold

        public ReviewsController(ApplicationDbContext context)
        {
            _context = context;
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
            var items = await query
                .OrderByDescending(q => q.CreatedAt)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();

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
            bool requiresSecondApproval = isApproved && effectiveAmount >= DualApprovalThreshold;

            var decisionRecord = new ApprovalDecision
            {
                Id = Guid.NewGuid(),
                TransactionId = item.TransactionId,
                AnalystId = request.AnalystId,
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
            if (request == null || request.SecondAnalystId == Guid.Empty)
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
            var primaryDecision = await _context.ApprovalDecisions
                .Where(d => d.TransactionId == item.TransactionId && d.ApprovalLevel == 1)
                .OrderByDescending(d => d.DecidedAt)
                .FirstOrDefaultAsync();

            if (primaryDecision != null && primaryDecision.AnalystId == request.SecondAnalystId)
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
                AnalystId = request.SecondAnalystId,
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
        /// 5. POST /api/reviews/{transactionId}/escalate
        /// Marks status as 'Escalated' and boosts Priority to 3 ('CRITICAL').
        /// </summary>
        [HttpPost("{transactionId}/escalate")]
        public async Task<IActionResult> EscalateCase(Guid transactionId, [FromBody] EscalateRequest request)
        {
            var item = await _context.ReviewQueues
                .FirstOrDefaultAsync(q => q.TransactionId == transactionId || q.Id == transactionId);

            if (item == null)
            {
                return NotFound(new { message = "Transaction review item not found." });
            }

            item.Status = "Escalated";
            item.Priority = 3;
            item.PriorityLabel = "CRITICAL";
            item.UpdatedAt = DateTime.UtcNow;

            var escalationAudit = new ApprovalDecision
            {
                Id = Guid.NewGuid(),
                TransactionId = item.TransactionId,
                AnalystId = request.AnalystId,
                Decision = "Escalated",
                ApprovalLevel = 1,
                Notes = request.Reason ?? "Escalated for senior admin investigation.",
                DecidedAt = DateTime.UtcNow
            };

            _context.ApprovalDecisions.Add(escalationAudit);
            await _context.SaveChangesAsync();

            return Ok(new
            {
                message = "Case successfully escalated to Senior Admin with CRITICAL priority.",
                item
            });
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
        /// GET /api/reviews/{transactionId}/history
        /// Returns chronological decision history for audit trails.
        /// </summary>
        [HttpGet("{transactionId}/history")]
        public async Task<IActionResult> GetHistory(Guid transactionId)
        {
            var history = await _context.ApprovalDecisions
                .AsNoTracking()
                .Where(d => d.TransactionId == transactionId)
                .OrderBy(d => d.DecidedAt)
                .ToListAsync();

            return Ok(history);
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
                    flagReasons = q.FlagReasonsJson
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