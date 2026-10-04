using System;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using FinCore.Api.Data;
using FinCore.Api.Models;

namespace FinCore.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class WalletsController : ControllerBase
    {
        private readonly ApplicationDbContext _context;

        public WalletsController(ApplicationDbContext context)
        {
            _context = context;
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

        private async Task<Wallet> GetOrCreateUserWalletAsync()
        {
            var (userGuid, intId) = ResolveUserIdentity();

            Wallet? wallet = null;
            if (userGuid.HasValue)
            {
                wallet = await _context.Wallets.FirstOrDefaultAsync(w => w.UserGuid == userGuid.Value || w.UserId == intId);
            }
            else
            {
                wallet = await _context.Wallets.FirstOrDefaultAsync(w => w.UserId == intId);
            }

            if (wallet == null)
            {
                wallet = new Wallet
                {
                    UserId = intId,
                    UserGuid = userGuid,
                    Balance = 50000m,
                    Currency = "LKR",
                    CreatedAt = DateTime.UtcNow
                };
                _context.Wallets.Add(wallet);
                await _context.SaveChangesAsync();
            }
            else if (userGuid.HasValue && !wallet.UserGuid.HasValue)
            {
                wallet.UserGuid = userGuid;
                await _context.SaveChangesAsync();
            }

            return wallet;
        }

        [HttpGet("balance")]
        public async Task<IActionResult> GetBalance()
        {
            var wallet = await GetOrCreateUserWalletAsync();
            return Ok(new
            {
                balance = wallet.Balance,
                walletId = wallet.Id,
                currency = wallet.Currency
            });
        }

        [HttpGet("me")]
        public async Task<IActionResult> GetMyWallet()
        {
            var wallet = await GetOrCreateUserWalletAsync();
            return Ok(new
            {
                id = wallet.Id,
                userId = wallet.UserId,
                balance = wallet.Balance,
                currency = wallet.Currency,
                createdAt = wallet.CreatedAt
            });
        }

        [HttpGet("{walletId}/balance")]
        public async Task<IActionResult> GetWalletBalance(int walletId)
        {
            var wallet = await _context.Wallets.FirstOrDefaultAsync(w => w.Id == walletId);
            if (wallet == null)
            {
                // Fallback to current authenticated user's wallet
                wallet = await GetOrCreateUserWalletAsync();
            }

            return Ok(new
            {
                balance = wallet.Balance,
                walletId = wallet.Id,
                currency = wallet.Currency
            });
        }

        [HttpPost("topup")]
        public async Task<IActionResult> TopUp([FromBody] TopUpRequest request)
        {
            if (request.Amount <= 0)
                return BadRequest(new { message = "Amount must be greater than zero." });

            var wallet = await GetOrCreateUserWalletAsync();
            wallet.Balance += request.Amount;

            var paymentType = string.IsNullOrWhiteSpace(request.PaymentMethodType) ? "CARD" : request.PaymentMethodType.ToUpper();
            var sourceRef = string.IsNullOrWhiteSpace(request.SourceReference)
                ? (paymentType == "BANK_TRANSFER" ? "Commercial Bank •••• 9012" : "Visa •••• 4821")
                : request.SourceReference.Trim();

            var noteDescription = $"Top Up via {paymentType} ({sourceRef})";

            var transaction = new Transaction
            {
                ReferenceId = "TOPUP" + Guid.NewGuid().ToString("N")[..8].ToUpper(),
                SenderWalletId = wallet.Id,
                ReceiverWalletId = null,
                Amount = request.Amount,
                Status = "Completed",
                Note = noteDescription,
                Timestamp = DateTime.UtcNow
            };

            _context.Transactions.Add(transaction);

            // Create In-App Notification event for topup
            var userEmail = User.FindFirstValue(ClaimTypes.Email) ?? "user@fincore.internal";
            var userName = User.FindFirstValue(ClaimTypes.Name) ?? "Valued Member";

            var notification = new Notification
            {
                UserId = wallet.UserId,
                Recipient = userEmail,
                RecipientName = userName,
                Title = "Top-Up Successful",
                Message = $"Your wallet has been credited with Rs. {request.Amount:N2} via {sourceRef}.",
                DeliveryStatus = "Sent",
                ChannelDetails = "Payment Gateway",
                IsRead = false,
                Category = "paymentSuccess",
                Timestamp = DateTime.UtcNow
            };
            _context.Notifications.Add(notification);

            await _context.SaveChangesAsync();

            return Ok(new
            {
                message = "Top-up successful",
                balance = wallet.Balance,
                transactionId = transaction.ReferenceId,
                paymentMethodType = paymentType,
                sourceReference = sourceRef
            });
        }
    }

    public class TopUpRequest
    {
        public decimal Amount { get; set; }
        public string? PaymentMethodType { get; set; } = "CARD"; // "CARD" or "BANK_TRANSFER"
        public string? SourceReference { get; set; }
    }
}
