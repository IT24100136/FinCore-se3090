using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using FinCore.Api.Data;
using FinCore.Api.Models;
using System.Linq;
using System.Threading.Tasks;

namespace FinCore.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class DevicesController : ControllerBase
    {
        private readonly ApplicationDbContext _context;

        public DevicesController(ApplicationDbContext context)
        {
            _context = context;
        }

        [HttpGet("{userId}/sessions")]
        public async Task<IActionResult> GetUserSessions(int userId)
        {
            var sessions = await _context.DeviceSessions
                .Where(d => d.UserId == userId)
                .OrderByDescending(d => d.LastLoginAt)
                .ToListAsync();

            return Ok(sessions);
        }
    }
}