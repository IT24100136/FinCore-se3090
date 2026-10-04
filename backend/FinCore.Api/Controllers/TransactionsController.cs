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

        private (Guid? userGuid, int deterministicIntId) ResolveUserIdentity()
        {
            var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("UserId");
            if (Guid.TryParse(userIdStr, out Guid userGuid))
            {
                return (userGuid, DbInitializer.GetDeterministicUserId(userGuid));
            }

            if (int.TryParse(userIdStr, out int intId))
            {
                return (null, intId);
            }

            return (null, 1);
        }

        private int GetUserId() => ResolveUserIdentity().deterministicIntId;

        // ── POST /api/transactions/transfer ──────────────────────────────────
        [HttpPost("transfer")]
        public async Task<IActionResult> Transfer([FromBody] TransferRequest request)
        {
            if (request.Amount <= 0) return BadRequest("Amount must be greater than zero.");

            var (userGuid, userId) = ResolveUserIdentity();
            var senderWallet = userGuid.HasValue
                ? await _context.Wallets.FirstOrDefaultAsync(w => w.UserGuid == userGuid.Value || w.UserId == userId)
                : await _context.Wallets.FirstOrDefaultAsync(w => w.UserId == userId);

            if (senderWallet == null || senderWallet.Balance < request.Amount)
                return BadRequest("Insufficient funds.");

            // Deduct from sender wallet immediately
            senderWallet.Balance -= request.Amount;

            var receiverUser = await _context.Users.FirstOrDefaultAsync(u => u.Email == request.RecipientIdentifier);
            int? receiverWalletId = null;

            if (receiverUser != null)
            {
                var receiverIntId = DbInitializer.GetDeterministicUserId(receiverUser.Id);
                var rw = await _context.Wallets.FirstOrDefaultAsync(w => w.UserGuid == receiverUser.Id || w.UserId == receiverIntId);
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

                // Add in-app notification for held transfer
                _context.Notifications.Add(new Notification
                {
                    UserId = senderWallet.UserId,
                    Recipient = User.FindFirstValue(ClaimTypes.Email) ?? "user@fincore.internal",
                    RecipientName = userName,
                    Title = "Security Alert: Transfer Under Review",
                    Message = $"Security Alert: Your transfer of Rs. {transaction.Amount:N2} to {request.RecipientIdentifier} is under review.",
                    DeliveryStatus = "Sent",
                    ChannelDetails = "Fraud Detection Engine",
                    IsRead = false,
                    Category = "securityPause",
                    Timestamp = DateTime.UtcNow
                });
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

                // Add in-app notification for successful transfer to sender
                _context.Notifications.Add(new Notification
                {
                    UserId = senderWallet.UserId,
                    Recipient = User.FindFirstValue(ClaimTypes.Email) ?? "user@fincore.internal",
                    RecipientName = userName,
                    Title = "Transfer Completed",
                    Message = $"Transfer of Rs. {transaction.Amount:N2} to {request.RecipientIdentifier} was successful.",
                    DeliveryStatus = "Sent",
                    ChannelDetails = "Payment Gateway",
                    IsRead = false,
                    Category = "paymentSuccess",
                    Timestamp = DateTime.UtcNow
                });

                if (receiverUser != null)
                {
                    var receiverIntId = DbInitializer.GetDeterministicUserId(receiverUser.Id);
                    _context.Notifications.Add(new Notification
                    {
                        UserId = receiverIntId,
                        Recipient = receiverUser.Email,
                        RecipientName = receiverUser.Name,
                        Title = "Funds Received",
                        Message = $"You received Rs. {transaction.Amount:N2} from {userName}.",
                        DeliveryStatus = "Sent",
                        ChannelDetails = "Payment Gateway",
                        IsRead = false,
                        Category = "paymentSuccess",
                        Timestamp = DateTime.UtcNow
                    });
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

            bool requiresStepUp = fraudFlag.RiskScore >= 50 && fraudFlag.RiskScore < 70 && !isStatutoryDualApproval;

            return Ok(new
            {
                message = transaction.Status == "Completed"
                    ? "Transfer completed successfully."
                    : (requiresStepUp
                        ? "Transfer paused for security verification. Please complete step-up authentication."
                        : (transaction.Status == "PendingSecondApproval"
                            ? "Transfer held for statutory dual maker-checker authorization."
                            : "Transfer held for fraud risk review.")),
                transactionId = transaction.Id,
                id = transaction.Id,
                referenceId = transaction.ReferenceId,
                senderAccountNumber = $"ACC-{senderWallet.Id:D8}",
                status = transaction.Status,
                amount = transaction.Amount,
                recipient = request.RecipientIdentifier,
                riskScore = fraudFlag.RiskScore,
                isHeld = transaction.Status != "Completed",
                requiresStepUp,
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
                    senderAccountNumber = $"ACC-{t.SenderWalletId:D8}",
                    senderWallet = $"WAL-USR-{t.SenderWalletId}",
                    receiverAccountNumber = t.ReceiverWalletId.HasValue ? $"ACC-{t.ReceiverWalletId.Value:D8}" : null,
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

        // ── POST /api/transactions/{id}/step-up-verify ───────────────────────
        // Step-up verification for medium risk (Score 50-69, status HELD / STEP_UP_CHALLENGE)
        [HttpPost("{id}/step-up-verify")]
        public async Task<IActionResult> StepUpVerify(string id, [FromBody] StepUpVerificationRequest? request)
        {
            Transaction? transaction = null;
            if (int.TryParse(id, out int dbId))
            {
                transaction = await _context.Transactions.FirstOrDefaultAsync(t => t.Id == dbId || t.ReferenceId == id);
            }
            else
            {
                transaction = await _context.Transactions.FirstOrDefaultAsync(t => t.ReferenceId == id);
            }

            if (transaction == null)
            {
                return NotFound(new { message = $"Transaction '{id}' was not found." });
            }

            // 1. Verify transaction status is currently held for step-up
            if (transaction.Status == "Completed")
            {
                return Ok(new
                {
                    message = "Transaction has already been completed.",
                    transactionId = transaction.Id,
                    referenceId = transaction.ReferenceId,
                    status = "Completed",
                    amount = transaction.Amount
                });
            }

            if (transaction.Status != "Held" && transaction.Status != "Pending" && transaction.Status != "PendingSecondApproval")
            {
                return BadRequest(new { message = $"Cannot verify transaction with status '{transaction.Status}'." });
            }

            // Verify demo OTP or Biometric
            var verificationType = request?.VerificationType?.ToUpper() ?? "OTP";
            var code = request?.Code ?? "123456";
            if (verificationType == "OTP" && code != "123456")
            {
                return BadRequest(new { message = "Invalid OTP code. Enter 123456 in demo mode." });
            }

            // 2. Transition status from HELD to COMPLETED
            transaction.Status = "Completed";
            transaction.Note = (transaction.Note ?? "") + $" [Step-Up Verified via {verificationType}]";

            // 3. Execute atomic balance transfer in PostgreSQL Wallets
            // Sender wallet was already debited during transfer creation. Credit recipient now.
            var senderWallet = await _context.Wallets.FirstOrDefaultAsync(w => w.Id == transaction.SenderWalletId);
            if (transaction.ReceiverWalletId.HasValue)
            {
                var receiverWallet = await _context.Wallets.FirstOrDefaultAsync(w => w.Id == transaction.ReceiverWalletId.Value);
                if (receiverWallet != null)
                {
                    receiverWallet.Balance += transaction.Amount;
                }
            }

            // 4. Update linked FraudFlags status to ClearedViaStepUp
            var flag = await _context.FraudFlags.FirstOrDefaultAsync(f => f.TransactionId == transaction.Id);
            if (flag != null)
            {
                flag.Status = "ClearedViaStepUp";
                flag.Reasons = (flag.Reasons ?? "") + $"; Step-up authentication completed ({verificationType}).";
            }

            var reviewItem = await _context.ReviewQueues.FirstOrDefaultAsync(rq => rq.QueueCode == transaction.ReferenceId);
            if (reviewItem != null)
            {
                reviewItem.Status = "ClearedViaStepUp";
            }

            // Notifications
            var userName = User.FindFirstValue(ClaimTypes.Name) ?? "Valued Customer";
            var userEmail = User.FindFirstValue(ClaimTypes.Email) ?? "user@fincore.internal";

            _context.Notifications.Add(new Notification
            {
                UserId = senderWallet?.UserId ?? 1,
                Recipient = userEmail,
                RecipientName = userName,
                Title = "Transfer Released",
                Message = $"Your transfer of Rs. {transaction.Amount:N2} was verified via {verificationType} and completed successfully.",
                DeliveryStatus = "Sent",
                ChannelDetails = "Security Gateway",
                IsRead = false,
                Category = "paymentSuccess",
                Timestamp = DateTime.UtcNow
            });

            await _context.SaveChangesAsync();

            // 5. Return updated balances and transaction status COMPLETED
            return Ok(new
            {
                message = "Step-up verification successful. Transaction completed.",
                transactionId = transaction.Id,
                referenceId = transaction.ReferenceId,
                status = "Completed",
                senderAccountNumber = senderWallet != null ? $"ACC-{senderWallet.Id:D8}" : null,
                senderBalance = senderWallet?.Balance ?? 0m,
                amount = transaction.Amount,
                verificationType
            });
        }

        // ── GET /api/transactions/lookup/{identifier} ─────────────────────────
        // Admin: Look up transaction details for financial reversal by DB ID or ReferenceId
        [HttpGet("lookup/{identifier}")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> LookupTransaction(string identifier)
        {
            Transaction? transaction = null;
            if (int.TryParse(identifier, out int dbId))
            {
                transaction = await _context.Transactions.FirstOrDefaultAsync(t => t.Id == dbId || t.ReferenceId == identifier);
            }
            else
            {
                transaction = await _context.Transactions.FirstOrDefaultAsync(t => t.ReferenceId == identifier);
            }

            if (transaction == null)
            {
                return NotFound(new { message = $"Transaction '{identifier}' not found." });
            }

            var senderWallet = await _context.Wallets.FirstOrDefaultAsync(w => w.Id == transaction.SenderWalletId);
            var senderUser = senderWallet != null
                ? await _context.Users.FirstOrDefaultAsync(u => u.Id == senderWallet.UserGuid || (u.Email != null && senderWallet.UserId > 0))
                : null;

            var receiverWallet = transaction.ReceiverWalletId.HasValue
                ? await _context.Wallets.FirstOrDefaultAsync(w => w.Id == transaction.ReceiverWalletId.Value)
                : null;
            var receiverUser = receiverWallet != null
                ? await _context.Users.FirstOrDefaultAsync(u => u.Id == receiverWallet.UserGuid)
                : null;

            var flag = await _context.FraudFlags.FirstOrDefaultAsync(f => f.TransactionId == transaction.Id);

            return Ok(new
            {
                id = transaction.Id,
                referenceId = transaction.ReferenceId,
                amount = transaction.Amount,
                status = transaction.Status,
                timestamp = transaction.Timestamp,
                note = transaction.Note,
                senderWalletId = transaction.SenderWalletId,
                senderAccountNumber = $"ACC-{transaction.SenderWalletId:D8}",
                senderName = senderUser?.Name ?? $"Wallet {transaction.SenderWalletId}",
                senderEmail = senderUser?.Email ?? "N/A",
                receiverWalletId = transaction.ReceiverWalletId,
                receiverAccountNumber = transaction.ReceiverWalletId.HasValue ? $"ACC-{transaction.ReceiverWalletId.Value:D8}" : "N/A (External/Topup)",
                receiverName = receiverUser?.Name ?? (transaction.Note ?? "Recipient"),
                receiverEmail = receiverUser?.Email ?? "N/A",
                riskScore = flag?.RiskScore ?? 0,
                canReverse = transaction.Status == "Completed" || transaction.Status == "FraudConfirmed"
            });
        }

        // ── POST /api/transactions/{id}/reverse ──────────────────────────────
        // Admin-only: reverses a completed or fraud-confirmed transaction atomically
        [HttpPost("{id}/reverse")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> Reverse(string id, [FromBody] ReverseRequest? request)
        {
            Transaction? transaction = null;
            if (int.TryParse(id, out int dbId))
            {
                transaction = await _context.Transactions.FirstOrDefaultAsync(t => t.Id == dbId || t.ReferenceId == id);
            }
            else
            {
                transaction = await _context.Transactions.FirstOrDefaultAsync(t => t.ReferenceId == id);
            }

            if (transaction == null)
                return NotFound(new { message = $"Transaction '{id}' not found." });

            if (transaction.Status == "Reversed")
                return BadRequest(new { message = "Transaction is already reversed." });

            // Enforce requirement: Only transactions in Completed or FraudConfirmed state can be reversed
            if (transaction.Status != "Completed" && transaction.Status != "FraudConfirmed")
            {
                return BadRequest(new { message = $"Only transactions in 'Completed' or 'FraudConfirmed' state can be reversed. Current status is '{transaction.Status}'." });
            }

            // Refund sender wallet
            var senderWallet = await _context.Wallets.FirstOrDefaultAsync(w => w.Id == transaction.SenderWalletId);
            if (senderWallet != null)
                senderWallet.Balance += transaction.Amount;

            // Claw back from receiver if receiver was credited
            if (transaction.ReceiverWalletId.HasValue)
            {
                var receiverWallet = await _context.Wallets.FirstOrDefaultAsync(w => w.Id == transaction.ReceiverWalletId.Value);
                if (receiverWallet != null)
                {
                    receiverWallet.Balance -= transaction.Amount;
                }
            }

            var previousStatus = transaction.Status;
            transaction.Status = "Reversed";
            transaction.Note = $"[REVERSED by Admin] {request?.Reason ?? "Admin financial reversal"}. Was: {previousStatus}";

            // Record Reversal Transaction in core ledger
            var reversalTx = new Transaction
            {
                ReferenceId = "REV" + Guid.NewGuid().ToString("N")[..8].ToUpper(),
                SenderWalletId = transaction.ReceiverWalletId ?? transaction.SenderWalletId,
                ReceiverWalletId = transaction.SenderWalletId,
                Amount = transaction.Amount,
                Status = "Completed",
                Note = $"[FINANCIAL REVERSAL for {transaction.ReferenceId}] Reason: {request?.Reason ?? "Admin financial reversal"}",
                Timestamp = DateTime.UtcNow
            };
            _context.Transactions.Add(reversalTx);

            // Add immutable entry to AuditLogs
            var adminUser = User.FindFirstValue(ClaimTypes.Name) ?? User.FindFirstValue(ClaimTypes.Email) ?? request?.AdminId ?? "Admin";
            var clientIp = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "127.0.0.1";
            _context.AuditLogs.Add(new AuditLog
            {
                UserId = GetUserId(),
                Action = "TRANSACTION_REVERSED",
                IpAddress = clientIp,
                Details = $"Reversed Transaction {transaction.ReferenceId} (Amount: Rs. {transaction.Amount:N2}). Reason: {request?.Reason}. Admin: {adminUser}",
                Timestamp = DateTime.UtcNow
            });

            await _context.SaveChangesAsync();

            return Ok(new
            {
                message = "Transaction reversed successfully.",
                transactionId = transaction.Id,
                referenceId = transaction.ReferenceId,
                reversalReferenceId = reversalTx.ReferenceId,
                previousStatus,
                newStatus = transaction.Status,
                refundedAmount = transaction.Amount,
                reason = request?.Reason ?? "Admin financial reversal",
                reversedBy = adminUser
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
        public string? AdminId { get; set; }
    }

    public class StepUpVerificationRequest
    {
        public string? VerificationType { get; set; } = "OTP";
        public string? Code { get; set; } = "123456";
    }
}
