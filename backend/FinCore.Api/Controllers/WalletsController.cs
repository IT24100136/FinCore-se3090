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
    public class WalletsController : ControllerBase
    {
        private readonly ApplicationDbContext _context;

        public WalletsController(ApplicationDbContext context)
        {
            _context = context;
        }

        private int GetUserId()
        {
            var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (int.TryParse(userIdStr, out int userId))
                return userId;
            
            // Fallback strategy if claim is Guid string instead of int
            return Math.Abs(userIdStr?.GetHashCode() ?? 0); 
        }

        [HttpGet("balance")]
        public IActionResult GetBalance()
        {
            var userId = GetUserId();
            var wallet = _context.Wallets.FirstOrDefault(w => w.UserId == userId);
            
            if (wallet == null)
            {
                wallet = new Wallet { UserId = userId, Balance = 0 };
                _context.Wallets.Add(wallet);
                _context.SaveChanges();
            }

            return Ok(new { balance = wallet.Balance });
        }

        [HttpPost("topup")]
        public IActionResult TopUp([FromBody] TopUpRequest request)
        {
            if (request.Amount <= 0) return BadRequest("Amount must be greater than zero.");

            var userId = GetUserId();
            var wallet = _context.Wallets.FirstOrDefault(w => w.UserId == userId);
            
            if (wallet == null)
            {
                wallet = new Wallet { UserId = userId, Balance = 0 };
                _context.Wallets.Add(wallet);
            }

            wallet.Balance += request.Amount;

            var transaction = new Transaction
            {
                ReferenceId = "TOPUP" + Guid.NewGuid().ToString("N").Substring(0, 8).ToUpper(),
                SenderWalletId = wallet.Id,
                ReceiverWalletId = null,
                Amount = request.Amount,
                Status = "Completed",
                Note = "Top Up"
            };

            _context.Transactions.Add(transaction);
            _context.SaveChanges();

            return Ok(new { message = "Top-up successful", balance = wallet.Balance });
        }
    }

    public class TopUpRequest
    {
        public decimal Amount { get; set; }
    }
}
