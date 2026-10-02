using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using FinCore.Api.Data;
using FinCore.Api.Models;
using FinCore.Api.Services.FraudService;
using FinCore.Api.Hubs;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace FinCore.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class TransactionsController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly IFraudService _fraudService;
        private readonly IHubContext<TransactionHub> _hubContext;

        public TransactionsController(
            ApplicationDbContext context,
            IFraudService fraudService,
            IHubContext<TransactionHub> hubContext)
        {
            _context = context;
            _fraudService = fraudService;
            _hubContext = hubContext;
        }

        private int GetUserId()
        {
            var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (int.TryParse(userIdStr, out int userId))
                return userId;

            return Math.Abs(userIdStr?.GetHashCode() ?? 0);
        }

        // ── POST /api/transactions/transfer ──────────────────────────────────
        [HttpPost("transfer")]
        public async Task<IActionResult> Transfer([FromBody] TransferRequest request)
        {
            if (request.Amount <= 0) return BadRequest("Amount must be greater than zero.");

            var userId = GetUserId();
            var senderWallet = await _context.Wallets.FirstOrDefaultAsync(w => w.UserId == userId);

            if (senderWallet == null || senderWallet.Balance < request.Amount)
                return BadRequest("Insufficient funds.");

            // Deduct from sender wallet immediately
            senderWallet.Balance -= request.Amount;

            var receiverUser = await _context.Users.FirstOrDefaultAsync(u => u.Email == request.RecipientIdentifier);
            int? receiverWalletId = null;

            if (receiverUser != null)
            {
                var receiverUserIdInt = Math.Abs(receiverUser.Id.ToString().GetHashCode());
                var rw = await _context.Wallets.FirstOrDefaultAsync(w => w.UserId == receiverUserIdInt);
                if (rw != null) receiverWalletId = rw.Id;
            }

            var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
            var userName = User.FindFirstValue(ClaimTypes.Name) ?? User.FindFirstValue(ClaimTypes.Email) ?? "Customer";

            // 1. Create Transaction in Database with initial status
            var transaction = new Transaction
            {
                ReferenceId = "TRX" + Guid.NewGuid().ToString("N")[..8].ToUpper(),
                SenderWalletId = senderWallet.Id,
                ReceiverWalletId = receiverWalletId,
                Amount = request.Amount,
                Status = "Pending",
                Note = string.IsNullOrWhiteSpace(request.Note)
                    ? $"Transfer to {request.RecipientIdentifier}"
                    : request.Note,
                Timestamp = DateTime.UtcNow
            };

            _context.Transactions.Add(transaction);
            await _context.SaveChangesAsync();

            // 2. Resolve client IP for Geolocation and Fraud Analysis
            var clientIp = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "127.0.0.1";
            if (Request.Headers.TryGetValue("X-Forwarded-For", out var forwardedFor))
            {
                clientIp = forwardedFor.FirstOrDefault()?.Split(',')[0].Trim() ?? clientIp;
            }

            // 3. Execute Dynamic Fraud & Risk Evaluation Pipeline
            var fraudFlag = await _fraudService.EvaluateTransactionAsync(transaction.Id, transaction.Amount, clientIp);

            // 4. Lifecycle Routing based on Backend Truth:
            // - Statutory Dual Approval (>= 75,000 LKR): PendingSecondApproval -> ReviewQueue
            // - High Risk (>= 70): Held -> ReviewQueue
            // - Medium Risk Flagged (40 <= RiskScore < 70): Held -> ReviewQueue
            // - Normal / Approved (RiskScore < 40): Completed immediately -> Receiver credited, NOT in ReviewQueue
            bool isStatutoryDualApproval = transaction.Amount >= 75000m;
            bool isHighRisk = fraudFlag.RiskScore >= 70;
            bool isMediumRiskFlagged = fraudFlag.RiskScore >= 40 && fraudFlag.RiskScore < 70;

            if (isStatutoryDualApproval || isHighRisk || isMediumRiskFlagged)
            {
                // Held for human analyst review
                transaction.Status = isStatutoryDualApproval ? "PendingSecondApproval" : "Held";

                var flagReasonsList = (fraudFlag.Reasons ?? "")
                    .Split(';')
                    .Where(r => !string.IsNullOrWhiteSpace(r))
                    .Select(r => new { label = r.Trim(), impact = "+25", color = "#ef4444" })
                    .ToList();

                if (flagReasonsList.Count == 0)
                {
                    flagReasonsList.Add(new {
                        label = isStatutoryDualApproval ? "Statutory Dual Approval Threshold (>75k LKR)" : "Standard Gateway Review",
                        impact = "+30",
                        color = "#f59e0b"
                    });
                }

                var reviewCase = new ReviewQueue
                {
                    Id = Guid.NewGuid(),
                    TransactionId = Guid.NewGuid(),
                    QueueCode = transaction.ReferenceId,
                    Status = isStatutoryDualApproval ? "PendingSecondApproval" : "Queued",
                    Priority = isStatutoryDualApproval ? 3 : (fraudFlag.RiskScore >= 70 ? 3 : 2),
                    PriorityLabel = isStatutoryDualApproval ? "CRITICAL" : (fraudFlag.RiskScore >= 70 ? "CRITICAL" : "HIGH"),
                    Amount = transaction.Amount,
                    SenderName = userName,
                    SenderId = userIdStr ?? userId.ToString(),
                    RecipientName = request.RecipientIdentifier,
                    RecipientId = receiverUser?.Id.ToString() ?? request.RecipientIdentifier,
                    RiskScore = fraudFlag.RiskScore,
                    FlagReasonsJson = System.Text.Json.JsonSerializer.Serialize(flagReasonsList),
                    OriginIp = clientIp,
                    Device = Request.Headers.UserAgent.ToString() ?? "Mobile Wallet App",
                    CreatedAt = DateTime.UtcNow
                };

                _context.ReviewQueues.Add(reviewCase);
            }
            else
            {
                // Case A: Normal / Approved Transaction
                transaction.Status = "Completed";

                // Credit recipient wallet immediately
                if (receiverWalletId.HasValue)
                {
                    var rw = await _context.Wallets.FirstOrDefaultAsync(w => w.Id == receiverWalletId.Value);
                    if (rw != null) rw.Balance += transaction.Amount;
                }
            }

            await _context.SaveChangesAsync();

            // 5. Broadcast real-time SignalR notifications
            try
            {
                await _hubContext.Clients.All.SendAsync("TransactionCreated", new
                {
                    id = transaction.ReferenceId,
                    dbId = transaction.Id,
                    amount = transaction.Amount,
                    status = transaction.Status,
                    riskScore = fraudFlag.RiskScore,
                    isHeld = transaction.Status != "Completed",
                    isFraudFlagged = fraudFlag.RiskScore >= 40
                });
            }
            catch { /* Resilient to offline websocket listeners */ }

            return Ok(new
            {
                message = transaction.Status == "Completed"
                    ? "Transfer completed successfully."
                    : (transaction.Status == "PendingSecondApproval"
                        ? "Transfer held for statutory dual maker-checker authorization."
                        : "Transfer held for fraud risk review."),
                referenceId = transaction.ReferenceId,
                status = transaction.Status,
                amount = transaction.Amount,
                recipient = request.RecipientIdentifier,
                riskScore = fraudFlag.RiskScore,
                isHeld = transaction.Status != "Completed",
                isFraudFlagged = fraudFlag.RiskScore >= 40
            });
        }

        // ── GET /api/transactions/history ────────────────────────────────────
        // Supports: ?status=Pending&dateFrom=2024-01-01&dateTo=2024-12-31
        //           &minAmount=100&maxAmount=5000&page=1&pageSize=20&sort=desc
        [HttpGet("history")]
        public IActionResult GetHistory(
            [FromQuery] string? status,
            [FromQuery] DateTime? dateFrom,
            [FromQuery] DateTime? dateTo,
            [FromQuery] decimal? minAmount,
            [FromQuery] decimal? maxAmount,
            [FromQuery] string sort = "desc",
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 20)
        {
            if (page < 1) page = 1;
            if (pageSize < 1 || pageSize > 100) pageSize = 20;

            var userId = GetUserId();
            var wallet = _context.Wallets.FirstOrDefault(w => w.UserId == userId);

            if (wallet == null)
                return Ok(new { data = new List<object>(), total = 0, page, pageSize });

            var query = _context.Transactions
                .Where(t => t.SenderWalletId == wallet.Id || t.ReceiverWalletId == wallet.Id)
                .AsQueryable();

            // --- Filters ---
            if (!string.IsNullOrWhiteSpace(status))
            {
                if (status.Equals("Held", StringComparison.OrdinalIgnoreCase))
                {
                    query = query.Where(t => t.Status.ToLower() == "held" || t.Status.ToLower() == "pending");
                }
                else
                {
                    query = query.Where(t => t.Status.ToLower() == status.ToLower());
                }
            }

            if (dateFrom.HasValue)
                query = query.Where(t => t.Timestamp >= dateFrom.Value);

            if (dateTo.HasValue)
                query = query.Where(t => t.Timestamp <= dateTo.Value.AddDays(1));

            if (minAmount.HasValue)
                query = query.Where(t => t.Amount >= minAmount.Value);

            if (maxAmount.HasValue)
                query = query.Where(t => t.Amount <= maxAmount.Value);

            // --- Sort ---
            query = sort.ToLower() == "asc"
                ? query.OrderBy(t => t.Timestamp)
                : query.OrderByDescending(t => t.Timestamp);

            var total = query.Count();

            var data = query
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Select(t => new
                {
                    t.Id,
                    t.ReferenceId,
                    t.Amount,
                    t.Status,
                    t.Timestamp,
                    t.Note,
                    direction = (t.ReceiverWalletId == wallet.Id || (t.ReceiverWalletId == null && t.SenderWalletId == wallet.Id && ((t.Note != null && t.Note.Contains("Top Up")) || t.ReferenceId.StartsWith("TOPUP")))) ? "credit" : "debit",
                    // Return positive for credits, negative for debits (for Flutter display)
                    displayAmount = (t.ReceiverWalletId == wallet.Id || (t.ReceiverWalletId == null && t.SenderWalletId == wallet.Id && ((t.Note != null && t.Note.Contains("Top Up")) || t.ReferenceId.StartsWith("TOPUP")))) ? t.Amount : -t.Amount,
                })
                .ToList();

            return Ok(new
            {
                data,
                total,
                page,
                pageSize,
                totalPages = (int)Math.Ceiling(total / (double)pageSize)
            });
        }

        // ── GET /api/transactions/all ────────────────────────────────────────
        // Transaction Monitoring system-wide view (Admin & Analyst)
        [HttpGet("all")]
        [AllowAnonymous]
        public IActionResult GetAllTransactions(
            [FromQuery] string? status,
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 20)
        {
            if (page < 1) page = 1;
            if (pageSize < 1 || pageSize > 100) pageSize = 20;

            var query = _context.Transactions.AsQueryable();

            if (!string.IsNullOrWhiteSpace(status) && !status.Equals("All", StringComparison.OrdinalIgnoreCase))
            {
                if (status.Equals("Held", StringComparison.OrdinalIgnoreCase))
                {
                    query = query.Where(t => t.Status.ToLower() == "held" || t.Status.ToLower() == "pending" || t.Status.ToLower() == "pendingsecondapproval");
                }
                else
                {
                    query = query.Where(t => t.Status.ToLower() == status.ToLower());
                }
            }

            var total = query.Count();

            var data = query
                .OrderByDescending(t => t.Timestamp)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Select(t => new
                {
                    id = t.ReferenceId,
                    dbId = t.Id,
                    sender = t.SenderWalletId.ToString(),
                    receiver = t.ReceiverWalletId.HasValue ? t.ReceiverWalletId.ToString() : "N/A",
                    amount = t.Amount,
                    status = t.Status,
                    timestamp = t.Timestamp,
                    riskScore = 0.0
                })
                .ToList();

            // Enrich with real data from ReviewQueues and FraudFlags
            var referenceIds = data.Select(d => d.id).ToList();
            var dbIds = data.Select(d => d.dbId).ToList();

            var reviewItems = _context.ReviewQueues
                .Where(rq => referenceIds.Contains(rq.QueueCode))
                .ToList();

            var fraudFlags = _context.FraudFlags
                .Where(f => dbIds.Contains(f.TransactionId))
                .ToList();

            var enrichedData = data.Select(d => {
                var review = reviewItems.FirstOrDefault(r => r.QueueCode == d.id);
                var flag = fraudFlags.FirstOrDefault(f => f.TransactionId == d.dbId);
                var score = review?.RiskScore ?? (flag != null ? (double)flag.RiskScore : 0.0);

                return new {
                    d.id,
                    d.dbId,
                    sender = review?.SenderName ?? $"Wallet {d.sender}",
                    receiver = review?.RecipientName ?? (d.receiver != "N/A" ? $"Wallet {d.receiver}" : "N/A"),
                    d.amount,
                    d.status,
                    d.timestamp,
                    riskScore = score
                };
            });

            return Ok(new
            {
                data = enrichedData,
                total,
                page,
                pageSize,
                totalPages = (int)Math.Ceiling(total / (double)pageSize)
            });
        }


        // ── GET /api/transactions/{id}/status ─────────────────────────────────
        [HttpGet("{id}/status")]
        public IActionResult GetStatus(int id)
        {
            var userId = GetUserId();
            var wallet = _context.Wallets.FirstOrDefault(w => w.UserId == userId);

            if (wallet == null) return NotFound("Wallet not found.");

            var transaction = _context.Transactions.FirstOrDefault(t =>
                t.Id == id &&
                (t.SenderWalletId == wallet.Id || t.ReceiverWalletId == wallet.Id));

            if (transaction == null) return NotFound("Transaction not found.");

            var reviewItem = _context.ReviewQueues.FirstOrDefault(q => q.QueueCode == transaction.ReferenceId);

            return Ok(new
            {
                transaction.Id,
                transaction.ReferenceId,
                status = transaction.Status,
                reviewStatus = reviewItem?.Status ?? (transaction.Status == "Completed" ? "Approved" : transaction.Status),
                transaction.Amount,
                transaction.Timestamp,
                transaction.Note
            });
        }

        // ── GET /api/transactions/ref/{referenceId} ───────────────────────────
        [HttpGet("ref/{referenceId}")]
        public IActionResult GetByReference(string referenceId)
        {
            var transaction = _context.Transactions.FirstOrDefault(t => t.ReferenceId == referenceId);
            if (transaction == null) return NotFound("Transaction not found.");

            var reviewItem = _context.ReviewQueues.FirstOrDefault(q => q.QueueCode == referenceId);

            return Ok(new
            {
                transaction.Id,
                transaction.ReferenceId,
                status = transaction.Status,
                reviewStatus = reviewItem?.Status ?? (transaction.Status == "Completed" ? "Approved" : transaction.Status),
                transaction.Amount,
                transaction.Timestamp,
                transaction.Note
            });
        }

        // ── POST /api/transactions/{id}/reverse ──────────────────────────────
        // Admin-only: reverses a confirmed fraudulent transaction
        [HttpPost("{id}/reverse")]
        [Authorize(Roles = "Admin")]
        public IActionResult Reverse(int id, [FromBody] ReverseRequest? request)
        {
            var transaction = _context.Transactions.FirstOrDefault(t => t.Id == id);

            if (transaction == null)
                return NotFound("Transaction not found.");

            if (transaction.Status == "Reversed")
                return BadRequest("Transaction is already reversed.");

            if (transaction.Status == "Rejected")
                return BadRequest("Cannot reverse a rejected transaction.");

            // Refund the sender's wallet
            var senderWallet = _context.Wallets.FirstOrDefault(w => w.Id == transaction.SenderWalletId);
            if (senderWallet != null)
                senderWallet.Balance += transaction.Amount;

            // Claw back from receiver if funds were already credited
            if (transaction.Status == "Completed" && transaction.ReceiverWalletId.HasValue)
            {
                var receiverWallet = _context.Wallets.FirstOrDefault(w => w.Id == transaction.ReceiverWalletId.Value);
                if (receiverWallet != null && receiverWallet.Balance >= transaction.Amount)
                    receiverWallet.Balance -= transaction.Amount;
            }

            var previousStatus = transaction.Status;
            transaction.Status = "Reversed";
            transaction.Note = $"[REVERSED by Admin] {request?.Reason ?? "Fraudulent transaction"}. Was: {previousStatus}";

            _context.SaveChanges();

            return Ok(new
            {
                message = "Transaction reversed successfully.",
                transaction.ReferenceId,
                previousStatus,
                newStatus = transaction.Status,
                refundedAmount = transaction.Amount,
                reason = request?.Reason ?? "Fraudulent transaction"
            });
        }

        // ── GET /api/transactions/analytics/summary ───────────────────────────
        // Admin-only: transaction volume and reversal rates
        [HttpGet("analytics/summary")]
        [Authorize(Roles = "Admin")]
        public IActionResult GetAnalyticsSummary(
            [FromQuery] DateTime? from,
            [FromQuery] DateTime? to)
        {
            var fromDate = from ?? DateTime.UtcNow.AddDays(-30);
            var toDate = to ?? DateTime.UtcNow;

            var allTx = _context.Transactions
                .Where(t => t.Timestamp >= fromDate && t.Timestamp <= toDate)
                .ToList();

            var totalCount = allTx.Count;
            var totalVolume = allTx.Sum(t => t.Amount);

            var byStatus = allTx
                .GroupBy(t => t.Status)
                .Select(g => new { status = g.Key, count = g.Count(), volume = g.Sum(t => t.Amount) })
                .ToList();

            var reversedCount = allTx.Count(t => t.Status == "Reversed");
            var completedCount = allTx.Count(t => t.Status == "Completed");
            var reversalRate = completedCount + reversedCount > 0
                ? Math.Round((double)reversedCount / (completedCount + reversedCount) * 100, 2)
                : 0;

            // Daily volume for chart data (last 7 days within range)
            var dailyBreakdown = allTx
                .GroupBy(t => t.Timestamp.Date)
                .OrderBy(g => g.Key)
                .Select(g => new
                {
                    date = g.Key.ToString("yyyy-MM-dd"),
                    count = g.Count(),
                    volume = g.Sum(t => t.Amount)
                })
                .ToList();

            return Ok(new
            {
                periodFrom = fromDate.ToString("yyyy-MM-dd"),
                periodTo = toDate.ToString("yyyy-MM-dd"),
                totalTransactions = totalCount,
                totalVolume,
                reversalRatePercent = reversalRate,
                byStatus,
                dailyBreakdown
            });
        }
    }

    // ── Request DTOs ──────────────────────────────────────────────────────────
    public class TransferRequest
    {
        public string RecipientIdentifier { get; set; } = string.Empty;
        public decimal Amount { get; set; }
        public string? Note { get; set; }
    }

    public class ReverseRequest
    {
        public string? Reason { get; set; }
    }
}
