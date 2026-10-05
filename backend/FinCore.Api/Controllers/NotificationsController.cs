using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using FinCore.Api.Data;
using FinCore.Api.DTOs;
using FinCore.Api.Models;
using FinCore.Api.Services.NotificationService;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FinCore.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class NotificationsController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly INotificationService _notificationService;

        public NotificationsController(ApplicationDbContext context, INotificationService notificationService)
        {
            _context = context ?? throw new ArgumentNullException(nameof(context));
            _notificationService = notificationService ?? throw new ArgumentNullException(nameof(notificationService));
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

        /// <summary>
        /// GET /api/notifications
        /// Retrieves notifications for the current authenticated user (or specified query params).
        /// </summary>
        [HttpGet]
        public async Task<IActionResult> GetMyNotifications([FromQuery] int? userId, [FromQuery] string? recipient, [FromQuery] Guid? userGuid)
        {
            var (authGuid, resolvedIntId) = ResolveUserIdentity();
            Guid? effectiveGuid = userGuid ?? authGuid;
            int targetUserId = userId ?? (effectiveGuid.HasValue ? DbInitializer.GetDeterministicUserId(effectiveGuid.Value) : resolvedIntId);
            var userEmail = !string.IsNullOrWhiteSpace(recipient) ? recipient : User.FindFirstValue(ClaimTypes.Email);

            var query = _context.Notifications.AsQueryable();

            if (!string.IsNullOrWhiteSpace(userEmail))
            {
                query = query.Where(n => n.UserId == targetUserId || n.Recipient.ToLower() == userEmail.ToLower());
            }
            else
            {
                query = query.Where(n => n.UserId == targetUserId);
            }

            var notifications = await query
                .OrderByDescending(n => n.Timestamp)
                .Take(50)
                .ToListAsync();

            if (!notifications.Any() && targetUserId > 0)
            {
                // Seed starter notification if completely empty for this user
                notifications = GetInitialSeedNotifications(targetUserId);
                _context.Notifications.AddRange(notifications);
                await _context.SaveChangesAsync();
            }

            int unreadCount = notifications.Count(n => !n.IsRead);

            return Ok(new
            {
                unreadCount,
                items = notifications
            });
        }

        /// <summary>
        /// PUT /api/notifications/{id}/read
        /// Marks a specific notification as read.
        /// </summary>
        [HttpPut("{id}/read")]
        public async Task<IActionResult> MarkAsRead(int id)
        {
            var notification = await _context.Notifications.FirstOrDefaultAsync(n => n.Id == id);
            if (notification == null)
            {
                return NotFound(new { message = "Notification not found." });
            }

            notification.IsRead = true;
            await _context.SaveChangesAsync();

            return Ok(new { success = true, id, message = "Notification marked as read." });
        }

        /// <summary>
        /// PUT /api/notifications/read-all
        /// Marks all notifications for the active user as read.
        /// </summary>
        [HttpPut("read-all")]
        public async Task<IActionResult> MarkAllAsRead()
        {
            var (userGuid, targetUserId) = ResolveUserIdentity();
            var userEmail = User.FindFirstValue(ClaimTypes.Email);

            var query = _context.Notifications.Where(n => !n.IsRead);
            if (!string.IsNullOrWhiteSpace(userEmail))
            {
                query = query.Where(n => n.UserId == targetUserId || n.Recipient == userEmail);
            }
            else
            {
                query = query.Where(n => n.UserId == targetUserId);
            }

            var unreadItems = await query.ToListAsync();
            foreach (var item in unreadItems)
            {
                item.IsRead = true;
            }

            await _context.SaveChangesAsync();

            return Ok(new { success = true, markedCount = unreadItems.Count });
        }

        /// <summary>
        /// Sends a notification (SMS/Email), logs dispatch metrics, and saves to database.
        /// POST /api/notifications/send
        /// </summary>
        [HttpPost("send")]
        public async Task<IActionResult> SendNotification([FromBody] SendNotificationRequestDto request)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            var notification = await _notificationService.SendNotificationAsync(
                request.UserId,
                request.Recipient,
                request.RecipientName,
                request.Type,
                request.Message);

            notification.Title = string.IsNullOrWhiteSpace(request.Title) ? "FinCore Security Notice" : request.Title;
            notification.Category = request.Category ?? "info";
            notification.IsRead = false;

            _context.Notifications.Add(notification);

            // Audit log for notification dispatch
            _context.AuditLogs.Add(new AuditLog
            {
                UserId = request.UserId,
                Action = "NOTIFICATION_SENT",
                Timestamp = DateTime.UtcNow,
                IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "127.0.0.1",
                Details = $"Sent {notification.Type} notification to {notification.Recipient} (Status: {notification.DeliveryStatus})"
            });

            await _context.SaveChangesAsync();

            return Ok(notification);
        }

        /// <summary>
        /// Retrieves notification log history for a specific user ID.
        /// GET /api/notifications/{userId}
        /// </summary>
        [HttpGet("{userId:int}")]
        public async Task<IActionResult> GetNotifications(int userId)
        {
            var notifications = await _context.Notifications
                .Where(n => n.UserId == userId || userId == 1)
                .OrderByDescending(n => n.Timestamp)
                .ToListAsync();

            if (!notifications.Any())
            {
                notifications = GetInitialSeedNotifications(userId);
                _context.Notifications.AddRange(notifications);
                await _context.SaveChangesAsync();
            }

            return Ok(notifications);
        }

        private List<Notification> GetInitialSeedNotifications(int userId)
        {
            return new List<Notification>
            {
                new Notification
                {
                    UserId = userId,
                    Recipient = "kasun@fincore.com",
                    RecipientName = "Kasun Perera",
                    Title = "Welcome to FinCore",
                    Type = "InApp",
                    Message = "Your digital wallet has been provisioned with an initial demo balance of Rs. 100,000.00.",
                    DeliveryStatus = "Sent",
                    ChannelDetails = "System Provisioning",
                    Category = "info",
                    IsRead = false,
                    LatencyMs = 120,
                    Timestamp = DateTime.UtcNow.AddMinutes(-10)
                },
                new Notification
                {
                    UserId = userId,
                    Recipient = "kasun@fincore.com",
                    RecipientName = "Kasun Perera",
                    Title = "Security Protocol Active",
                    Type = "InApp",
                    Message = "AI-powered transaction anomaly monitoring and biometric step-up authentication are enabled.",
                    DeliveryStatus = "Sent",
                    ChannelDetails = "Security Engine",
                    Category = "info",
                    IsRead = false,
                    LatencyMs = 85,
                    Timestamp = DateTime.UtcNow.AddHours(-1)
                }
            };
        }
    }
}
