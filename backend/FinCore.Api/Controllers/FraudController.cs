using System;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Threading.Tasks;
using FinCore.Api.Data;
using FinCore.Api.Models;
using FinCore.Api.Services.FraudService;
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
        [HttpGet("flags")]
        public async Task<IActionResult> GetFlags()
        {
            var flags = await _context.FraudFlags
                .OrderByDescending(f => f.CreatedAt)
                .ToListAsync();

            return Ok(flags);
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