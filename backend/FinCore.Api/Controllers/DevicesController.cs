using System;
using System.Linq;
using System.Threading.Tasks;
using FinCore.Api.Data;
using FinCore.Api.DTOs;
using FinCore.Api.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

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

        [HttpPost("verify")]
        public async Task<IActionResult> VerifyDevice([FromBody] DeviceVerifyRequestDto request)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            var existingSession = await _context.DeviceSessions
                .FirstOrDefaultAsync(d => d.UserId == request.UserId && d.DeviceFingerprint == request.DeviceFingerprint);

            if (existingSession != null)
            {
                existingSession.LastLoginAt = DateTime.UtcNow;
                if (!string.IsNullOrWhiteSpace(request.IpAddress))
                {
                    existingSession.IpAddress = request.IpAddress;
                }

                await _context.SaveChangesAsync();

                return Ok(new DeviceVerifyResponseDto
                {
                    SessionId = existingSession.Id,
                    UserId = existingSession.UserId,
                    DeviceFingerprint = existingSession.DeviceFingerprint,
                    IpAddress = existingSession.IpAddress,
                    Status = existingSession.Status,
                    LastLoginAt = existingSession.LastLoginAt,
                    IsNewDevice = false
                });
            }
            else
            {
                var newSession = new DeviceSession
                {
                    UserId = request.UserId,
                    DeviceFingerprint = request.DeviceFingerprint,
                    IpAddress = request.IpAddress,
                    Status = "Unverified",
                    LastLoginAt = DateTime.UtcNow
                };

                _context.DeviceSessions.Add(newSession);

                // Audit log for new device detection
                _context.AuditLogs.Add(new AuditLog
                {
                    UserId = request.UserId,
                    Action = "NEW_DEVICE_DETECTED",
                    Timestamp = DateTime.UtcNow,
                    IpAddress = request.IpAddress ?? string.Empty,
                    Details = $"New unverified device session created with fingerprint: {newSession.DeviceFingerprint}"
                });

                await _context.SaveChangesAsync();

                return Ok(new DeviceVerifyResponseDto
                {
                    SessionId = newSession.Id,
                    UserId = newSession.UserId,
                    DeviceFingerprint = newSession.DeviceFingerprint,
                    IpAddress = newSession.IpAddress,
                    Status = newSession.Status,
                    LastLoginAt = newSession.LastLoginAt,
                    IsNewDevice = true
                });
            }
        }

        [HttpPut("{id}/status")]
        public async Task<IActionResult> UpdateDeviceStatus(int id, [FromBody] UpdateDeviceStatusDto request)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            var session = await _context.DeviceSessions.FindAsync(id);
            if (session == null)
            {
                return NotFound(new { message = "Device session not found." });
            }

            session.Status = request.Status;
            session.LastLoginAt = DateTime.UtcNow;

            // Audit log for device status confirmation/update
            _context.AuditLogs.Add(new AuditLog
            {
                UserId = session.UserId,
                Action = "DEVICE_STATUS_UPDATED",
                Timestamp = DateTime.UtcNow,
                IpAddress = session.IpAddress ?? string.Empty,
                Details = $"Device session {session.Id} status updated to '{session.Status}' (Fingerprint: {session.DeviceFingerprint})"
            });

            await _context.SaveChangesAsync();

            return Ok(new
            {
                message = "Device status updated successfully.",
                sessionId = session.Id,
                status = session.Status,
                lastLoginAt = session.LastLoginAt
            });
        }
    }
}