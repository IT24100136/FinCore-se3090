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
            _context = context ?? throw new ArgumentNullException(nameof(context));
        }

        /// <summary>
        /// GET /api/users
        /// Retrieves all registered user accounts (customers & staff) for Admin User Management panel.
        /// </summary>
        [HttpGet]
        public async Task<IActionResult> GetAllUsers()
        {
            var users = await _context.Users.AsNoTracking().ToListAsync();
            var sessions = await _context.DeviceSessions.AsNoTracking().ToListAsync();

            var userList = users.Select(u =>
            {
                int intUserId = DbInitializer.GetDeterministicUserId(u.Id);
                var userSessions = sessions.Where(s => s.UserId == intUserId || s.UserId == 1).ToList();

                return new
                {
                    id = u.Id.ToString(),
                    userId = intUserId,
                    name = u.Name,
                    email = u.Email,
                    role = u.Role == "Customer" ? "Standard" : (u.Role == "Admin" ? "Administrator" : "Analyst"),
                    rawRole = u.Role,
                    status = string.IsNullOrEmpty(u.Status) ? "Active" : u.Status,
                    joinedDate = u.CreatedAt.ToString("yyyy-MM-dd"),
                    registeredDevices = userSessions.Count > 0 ? userSessions.Count : 1,
                    flaggedDevices = userSessions.Count(s => s.Status == "Flagged"),
                    avatar = $"https://api.dicebear.com/7.x/avataaars/svg?seed={Uri.EscapeDataString(u.Email)}"
                };
            }).ToList();

            return Ok(userList);
        }

        /// <summary>
        /// PUT /api/users/{id}/status
        /// Toggles or sets user account status ('Active' or 'Suspended').
        /// </summary>
        [HttpPut("{id}/status")]
        public async Task<IActionResult> UpdateUserStatus(string id, [FromBody] UserStatusUpdateDto request)
        {
            User? user = null;
            if (Guid.TryParse(id, out Guid userGuid))
            {
                user = await _context.Users.FirstOrDefaultAsync(u => u.Id == userGuid);
            }

            if (user == null)
            {
                user = await _context.Users.FirstOrDefaultAsync(u => u.Email == id);
            }

            if (user == null)
            {
                return NotFound(new { message = $"User with ID '{id}' was not found in the database." });
            }

            user.Status = request.Status;
            user.UpdatedAt = DateTime.UtcNow;

            _context.AuditLogs.Add(new AuditLog
            {
                UserId = DbInitializer.GetDeterministicUserId(user.Id),
                Action = "USER_STATUS_UPDATED",
                Timestamp = DateTime.UtcNow,
                IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "127.0.0.1",
                Details = $"User account '{user.Email}' status updated to '{user.Status}'"
            });

            await _context.SaveChangesAsync();

            return Ok(new
            {
                message = $"User account status successfully updated to {user.Status}.",
                id = user.Id.ToString(),
                status = user.Status
            });
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

    public class UserStatusUpdateDto
    {
        public string Status { get; set; } = "Active";
    }
}
