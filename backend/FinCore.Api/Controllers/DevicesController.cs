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
        /// Retrieves all device sessions across users for Admin Device History view.
        /// GET /api/devices/sessions
        /// </summary>
        [HttpGet("sessions")]
        public async Task<IActionResult> GetAllSessions()
        {
            var sessions = await _context.DeviceSessions
                .OrderByDescending(d => d.LastLoginAt)
                .ToListAsync();

            if (!sessions.Any())
            {
                sessions = GetInitialSeedSessions(1);
                _context.DeviceSessions.AddRange(sessions);
                await _context.SaveChangesAsync();
            }

            var users = await _context.Users.AsNoTracking().ToListAsync();

            var sessionDtos = sessions.Select(s =>
            {
                var user = users.FirstOrDefault(u => DbInitializer.GetDeterministicUserId(u.Id) == s.UserId || s.UserId == 1);
                return new
                {
                    id = s.Id,
                    userId = s.UserId,
                    userName = user?.Name ?? $"User #{s.UserId}",
                    userEmail = user?.Email ?? "user@fincore.com",
                    deviceFingerprint = s.DeviceFingerprint,
                    ipAddress = s.IpAddress,
                    location = GetLocationFromIp(s.IpAddress),
                    status = s.Status,
                    lastLoginAt = s.LastLoginAt,
                    lastLoginTime = s.LastLoginAt.ToString("yyyy-MM-dd HH:mm:ss UTC"),
                    reason = s.Status == "Flagged" ? "Suspicious TOR IP exit node / unusual device fingerprint" : "Recognized device authentication"
                };
            }).ToList();

            return Ok(sessionDtos);
        }

        /// <summary>
        /// Retrieves device session history for a specific user (or all if userId is 0/1).
        /// GET /api/devices/{userId}/sessions
        /// </summary>
        [HttpGet("{userId:int}/sessions")]
        public async Task<IActionResult> GetUserSessions(int userId)
        {
            var sessions = await _context.DeviceSessions
                .Where(d => userId <= 0 || d.UserId == userId || userId == 1)
                .OrderByDescending(d => d.LastLoginAt)
                .ToListAsync();

            if (!sessions.Any())
            {
                sessions = GetInitialSeedSessions(userId <= 0 ? 1 : userId);
                _context.DeviceSessions.AddRange(sessions);
                await _context.SaveChangesAsync();
            }

            var users = await _context.Users.AsNoTracking().ToListAsync();

            var sessionDtos = sessions.Select(s =>
            {
                var user = users.FirstOrDefault(u => DbInitializer.GetDeterministicUserId(u.Id) == s.UserId);
                return new
                {
                    id = s.Id,
                    userId = s.UserId,
                    userName = user?.Name ?? $"User #{s.UserId}",
                    userEmail = user?.Email ?? "user@fincore.com",
                    deviceFingerprint = s.DeviceFingerprint,
                    ipAddress = s.IpAddress,
                    location = GetLocationFromIp(s.IpAddress),
                    status = s.Status,
                    lastLoginAt = s.LastLoginAt,
                    lastLoginTime = s.LastLoginAt.ToString("yyyy-MM-dd HH:mm:ss UTC"),
                    reason = s.Status == "Flagged" ? "Suspicious TOR IP exit node / unusual device fingerprint" : "Recognized device authentication"
                };
            }).ToList();

            return Ok(sessionDtos);
        }

        /// <summary>
        /// Verifies a device session fingerprint upon login.
        /// Strictly queries by UserId AND DeviceFingerprint.
        /// Updates LastLoginAt on existing session record if found; creates Unverified record if new.
        /// POST /api/devices/verify
        /// </summary>
        [HttpPost("verify")]
        public async Task<IActionResult> VerifyDevice([FromBody] DeviceVerifyRequestDto request)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            // Strictly query by UserId AND DeviceFingerprint
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
                    IpAddress = request.IpAddress ?? "127.0.0.1",
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
                    IpAddress = request.IpAddress ?? "127.0.0.1",
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
        [HttpPut("{id:int}/status")]
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

        private string GetLocationFromIp(string? ip)
        {
            if (string.IsNullOrWhiteSpace(ip)) return "Colombo, Sri Lanka";
            if (ip.StartsWith("192.168") || ip.StartsWith("127.") || ip.StartsWith("10.")) return "Colombo, Sri Lanka";
            if (ip.StartsWith("172.56")) return "New York, NY, USA";
            if (ip.StartsWith("185.220")) return "Frankfurt, Germany";
            return "Colombo, Sri Lanka";
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