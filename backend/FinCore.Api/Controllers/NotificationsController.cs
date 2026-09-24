using System;
using System.Linq;
using System.Threading.Tasks;
using FinCore.Api.Data;
using FinCore.Api.DTOs;
using FinCore.Api.Models;
using FinCore.Api.Services;
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
            _context = context;
            _notificationService = notificationService;
        }

        /// <summary>
        /// Retrieves notification history for a specific user.
        /// GET /api/notifications/{userId}
        /// </summary>
        [HttpGet("{userId}")]
        public async Task<IActionResult> GetUserNotifications(int userId)
        {
            var notifications = await _context.Notifications
                .Where(n => n.UserId == userId)
                .OrderByDescending(n => n.SentAt)
                .Select(n => new NotificationResponseDto
                {
                    Id = n.Id,
                    UserId = n.UserId,
                    Type = n.Type,
                    Recipient = n.Recipient,
                    Subject = n.Subject,
                    Message = n.Message,
                    Status = n.Status,
                    Provider = n.Provider,
                    ErrorDetails = n.ErrorDetails,
                    SentAt = n.SentAt
                })
                .ToListAsync();

            return Ok(notifications);
        }

        /// <summary>
        /// Retrieves a single notification by ID.
        /// GET /api/notifications/id/{id}
        /// </summary>
        [HttpGet("id/{id}")]
        public async Task<IActionResult> GetNotificationById(int id)
        {
            var notification = await _context.Notifications.FindAsync(id);
            if (notification == null)
            {
                return NotFound(new { message = "Notification record not found." });
            }

            return Ok(new NotificationResponseDto
            {
                Id = notification.Id,
                UserId = notification.UserId,
                Type = notification.Type,
                Recipient = notification.Recipient,
                Subject = notification.Subject,
                Message = notification.Message,
                Status = notification.Status,
                Provider = notification.Provider,
                ErrorDetails = notification.ErrorDetails,
                SentAt = notification.SentAt
            });
        }

        /// <summary>
        /// Triggers sending a new notification via the configured third-party integration,
        /// and records the outcome in the database.
        /// POST /api/notifications/send
        /// </summary>
        [HttpPost("send")]
        public async Task<IActionResult> SendNotification([FromBody] SendNotificationRequestDto request)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            var notification = new Notification
            {
                UserId = request.UserId,
                Type = request.Type,
                Recipient = request.Recipient,
                Subject = request.Subject,
                Message = request.Message,
                Status = "Pending",
                SentAt = DateTime.UtcNow
            };

            // Dispatch notification via active provider
            await _notificationService.SendNotificationAsync(notification);

            // Save notification log entry to database
            _context.Notifications.Add(notification);
            await _context.SaveChangesAsync();

            var responseDto = new NotificationResponseDto
            {
                Id = notification.Id,
                UserId = notification.UserId,
                Type = notification.Type,
                Recipient = notification.Recipient,
                Subject = notification.Subject,
                Message = notification.Message,
                Status = notification.Status,
                Provider = notification.Provider,
                ErrorDetails = notification.ErrorDetails,
                SentAt = notification.SentAt
            };

            return CreatedAtAction(nameof(GetNotificationById), new { id = notification.Id }, responseDto);
        }
    }
}
