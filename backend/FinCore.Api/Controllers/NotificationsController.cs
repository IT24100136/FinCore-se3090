using System;
using System.Collections.Generic;
using System.Linq;
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
        /// Retrieves notification log history for a specific user.
        /// GET /api/notifications/{userId}
        /// </summary>
        [HttpGet("{userId}")]
        public async Task<IActionResult> GetNotifications(int userId)
        {
            var notifications = await _context.Notifications
                .Where(n => n.UserId == userId || userId == 1) // Default to user or mock list
                .OrderByDescending(n => n.Timestamp)
                .ToListAsync();

            if (!notifications.Any())
            {
                // Seed initial notification telemetry if empty
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
                    Recipient = "eleanor.vance@fincore-user.com",
                    RecipientName = "Eleanor Vance",
                    Type = "Email",
                    Message = "Your FinCore security verification code is 849-201. Valid for 5 minutes.",
                    DeliveryStatus = "Sent",
                    ChannelDetails = "Mailgun SMTP Relay (sg-east-1)",
                    LatencyMs = 340,
                    Timestamp = DateTime.UtcNow.AddMinutes(-25)
                },
                new Notification
                {
                    UserId = userId,
                    Recipient = "+1 (555) 382-9102",
                    RecipientName = "Marcus Sterling",
                    Type = "SMS",
                    Message = "FinCore Alert: Unrecognized login attempt from Frankfurt, DE. Reply STOP if not you.",
                    DeliveryStatus = "Sent",
                    ChannelDetails = "Twilio SMS Gateway",
                    LatencyMs = 620,
                    Timestamp = DateTime.UtcNow.AddMinutes(-47)
                },
                new Notification
                {
                    UserId = userId,
                    Recipient = "sophia.chen@techventures.io",
                    RecipientName = "Sophia Chen",
                    Type = "Email",
                    Message = "Account Status Warning: Your FinCore account has been temporarily restricted due to suspicious multi-device activity.",
                    DeliveryStatus = "Failed",
                    ChannelDetails = "SendGrid API (Error 550: Recipient mailbox full)",
                    LatencyMs = 1250,
                    Timestamp = DateTime.UtcNow.AddHours(-1)
                },
                new Notification
                {
                    UserId = userId,
                    Recipient = "+1 (555) 902-1488",
                    RecipientName = "David K. Ross",
                    Type = "SMS",
                    Message = "Wire transfer of $45,000.00 to Apex Global has been processed successfully.",
                    DeliveryStatus = "Sent",
                    ChannelDetails = "Twilio SMS Gateway",
                    LatencyMs = 410,
                    Timestamp = DateTime.UtcNow.AddHours(-2)
                },
                new Notification
                {
                    UserId = userId,
                    Recipient = "amara.okafor@horizon-pay.com",
                    RecipientName = "Amara Okafor",
                    Type = "Email",
                    Message = "Monthly Statement Available: Your September 2026 FinCore statement is ready to view.",
                    DeliveryStatus = "Sent",
                    ChannelDetails = "Mailgun SMTP Relay (sg-east-1)",
                    LatencyMs = 290,
                    Timestamp = DateTime.UtcNow.AddHours(-4)
                },
                new Notification
                {
                    UserId = userId,
                    Recipient = "+44 7700 900123",
                    RecipientName = "Julian Thorne",
                    Type = "SMS",
                    Message = "FinCore Security: Your 2FA security settings were updated from a new device.",
                    DeliveryStatus = "Failed",
                    ChannelDetails = "AWS SNS (Error 400: Invalid phone number routing)",
                    LatencyMs = 2100,
                    Timestamp = DateTime.UtcNow.AddHours(-6)
                }
            };
        }
    }
}
