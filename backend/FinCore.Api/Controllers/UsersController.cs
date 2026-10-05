using System;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using FinCore.Api.Data;
using FinCore.Api.Models;

namespace FinCore.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class UsersController : ControllerBase
    {
        private readonly ApplicationDbContext _context;

        public UsersController(ApplicationDbContext context)
        {
            _context = context;
        }

        /// <summary>
        /// GET /api/users/staff/seniors
        /// Retrieves senior analysts, leads, and administrators for case escalation assignments.
        /// </summary>
        [HttpGet("staff/seniors")]
        public async Task<IActionResult> GetSeniorStaff()
        {
            var seniors = await _context.Users
                .AsNoTracking()
                .Where(u => u.Role == "Admin" || u.Role == "Analyst")
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

            return Ok(seniors);
        }

        /// <summary>
        /// GET /api/users/staff
        /// Retrieves all staff members.
        /// </summary>
        [HttpGet("staff")]
        public async Task<IActionResult> GetAllStaff()
        {
            var staff = await _context.Users
                .AsNoTracking()
                .Where(u => u.Role == "Admin" || u.Role == "Analyst")
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

            return Ok(staff);
        }
    }
}
