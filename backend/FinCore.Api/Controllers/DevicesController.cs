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
            _context = context ?? throw new ArgumentNullException(nameof(context));
        }

        /// <summary>
        /// Retrieves device session history for a specific user.
        /// GET /api/devices/{userId}/sessions
        /// </summary>
        [HttpGet("{userId}/sessions")]
        public async Task<IActionResult> GetUserSessions(int userId)
        {
            var sessions = await _context.DeviceSessions
                .Where(d => d.UserId == userId || userId == 1) // Default or specific user
                .OrderByDescending(d => d.LastLoginAt)
                .ToListAsync();

            if (!sessions.Any())
            {
                // Seed initial device sessions if empty for demonstration/testing
                sessions = GetInitialSeedSessions(userId);
                _context.DeviceSessions.AddRange(sessions);
                await _context.SaveChangesAsync();
            }

            return Ok(sessions);
        }

        /// <summary>
        /// Verifies a device session fingerprint upon login. Creates Unverified status & AuditLog if new device.
        /// POST /api/devices/verify
        /// </summary>
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

                // Audit log for new unrecognized device detection
                _context.AuditLogs.Add(new AuditLog
                {
                    UserId = request.UserId,
                    Action = "NEW_DEVICE_DETECTED",
                    Timestamp = DateTime.UtcNow,
                    IpAddress = request.IpAddress ?? string.Empty,
                    Details = $"New unrecognized device detected (Fingerprint: {request.DeviceFingerprint})"
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

        /// <summary>
        /// Confirms an unverified device session, upgrading its status from Unverified to Verified.
        /// PUT /api/devices/confirm
        /// </summary>
        [HttpPut("confirm")]
        public async Task<IActionResult> ConfirmDevice([FromBody] DeviceConfirmRequestDto request)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            DeviceSession? session = null;
            if (request.SessionId > 0)
            {
                session = await _context.DeviceSessions.FindAsync(request.SessionId);
            }

            if (session == null && !string.IsNullOrEmpty(request.DeviceFingerprint))
            {
                session = await _context.DeviceSessions
                    .FirstOrDefaultAsync(d => d.UserId == request.UserId && d.DeviceFingerprint == request.DeviceFingerprint);
            }

            if (session == null)
            {
                return NotFound(new { message = "Device session not found to confirm." });
            }

            session.Status = "Verified";
            session.LastLoginAt = DateTime.UtcNow;

            // Audit log for device confirmation
            _context.AuditLogs.Add(new AuditLog
            {
                UserId = session.UserId,
                Action = "DEVICE_CONFIRMED",
                Timestamp = DateTime.UtcNow,
                IpAddress = session.IpAddress ?? string.Empty,
                Details = $"Device session {session.Id} upgraded from Unverified to Verified"
            });

            await _context.SaveChangesAsync();

            return Ok(new
            {
                message = "Device session upgraded from Unverified to Verified successfully.",
                sessionId = session.Id,
                userId = session.UserId,
                deviceFingerprint = session.DeviceFingerprint,
                status = session.Status,
                lastLoginAt = session.LastLoginAt
            });
        }

        /// <summary>
        /// Updates a device session status directly by ID (e.g. Unverified, Verified, Trusted, Flagged).
        /// PUT /api/devices/{id}/status
        /// </summary>
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

            // Audit log for device status update
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

        private System.Collections.Generic.List<DeviceSession> GetInitialSeedSessions(int userId)
        {
            return new System.Collections.Generic.List<DeviceSession>
            {
                new DeviceSession
                {
                    UserId = userId,
                    DeviceFingerprint = "fp-macbook-pro-m3-8f92a1",
                    IpAddress = "192.168.1.105",
                    Status = "Trusted",
                    LastLoginAt = DateTime.UtcNow.AddMinutes(-12)
                },
                new DeviceSession
                {
                    UserId = userId,
                    DeviceFingerprint = "fp-iphone-15-pro-3c71b9",
                    IpAddress = "172.56.21.90",
                    Status = "Verified",
                    LastLoginAt = DateTime.UtcNow.AddHours(-3)
                },
                new DeviceSession
                {
                    UserId = userId,
                    DeviceFingerprint = "fp-unrecognized-linux-77e4d2",
                    IpAddress = "185.220.101.4",
                    Status = "Flagged",
                    LastLoginAt = DateTime.UtcNow.AddHours(-8)
                },
                new DeviceSession
                {
                    UserId = userId,
                    DeviceFingerprint = "fp-windows-desktop-1a2b3c",
                    IpAddress = "10.0.0.42",
                    Status = "Unverified",
                    LastLoginAt = DateTime.UtcNow.AddDays(-1)
                }
            };
        }
    }
}