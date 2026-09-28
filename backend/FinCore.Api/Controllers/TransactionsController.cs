using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using FinCore.Api.Data;
using FinCore.Api.Models;

namespace FinCore.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class TransactionsController : ControllerBase
    {
        private readonly ApplicationDbContext _context;

        public TransactionsController(ApplicationDbContext context)
        {
            _context = context;
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
        public IActionResult Transfer([FromBody] TransferRequest request)
        {
            if (request.Amount <= 0) return BadRequest("Amount must be greater than zero.");

            var userId = GetUserId();
            var senderWallet = _context.Wallets.FirstOrDefault(w => w.UserId == userId);

            if (senderWallet == null || senderWallet.Balance < request.Amount)
                return BadRequest("Insufficient funds.");

            // Deduct from sender immediately; funds held until review completes
            senderWallet.Balance -= request.Amount;

            var receiverUser = _context.Users.FirstOrDefault(u => u.Email == request.RecipientIdentifier);
            int? receiverWalletId = null;

            if (receiverUser != null)
            {
                var receiverUserIdInt = Math.Abs(receiverUser.Id.ToString().GetHashCode());
                var rw = _context.Wallets.FirstOrDefault(w => w.UserId == receiverUserIdInt);
                if (rw != null) receiverWalletId = rw.Id;
            }

            var transaction = new Transaction
            {
                ReferenceId = "TRX" + Guid.NewGuid().ToString("N")[..8].ToUpper(),
                SenderWalletId = senderWallet.Id,
                ReceiverWalletId = receiverWalletId,
                Amount = request.Amount,
                Status = "Pending",
                Note = string.IsNullOrWhiteSpace(request.Note)
                    ? $"Transfer to {request.RecipientIdentifier}"
                    : request.Note
            };

            _context.Transactions.Add(transaction);
            _context.SaveChanges();

            return Ok(new
            {
                message = "Transfer initiated",
                referenceId = transaction.ReferenceId,
                status = transaction.Status,
                amount = transaction.Amount,
                recipient = request.RecipientIdentifier
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
                query = query.Where(t => t.Status.ToLower() == status.ToLower());

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
                    direction = t.SenderWalletId == wallet.Id ? "debit" : "credit",
                    // Return positive for credits, negative for debits (for Flutter display)
                    displayAmount = t.SenderWalletId == wallet.Id ? -t.Amount : t.Amount,
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

            return Ok(new
            {
                transaction.Id,
                transaction.ReferenceId,
                transaction.Status,
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
