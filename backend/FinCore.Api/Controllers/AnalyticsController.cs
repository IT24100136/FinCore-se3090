using System;
using System.Linq;
using System.Threading.Tasks;
using FinCore.Api.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FinCore.Api.Controllers
{
    [ApiController]
    [Route("api/devices/analytics")]
    public class AnalyticsController : ControllerBase
    {
        private readonly ApplicationDbContext _context;

        public AnalyticsController(ApplicationDbContext context)
        {
            _context = context ?? throw new ArgumentNullException(nameof(context));
        }

        /// <summary>
        /// Returns summary metrics including new devices count, notification delivery success rate, and flagged users count.
        /// GET /api/devices/analytics/summary
        /// </summary>
        [HttpGet("summary")]
        public async Task<IActionResult> GetAnalyticsSummary()
        {
            // Device Telemetry Metrics
            var deviceSessions = await _context.DeviceSessions.ToListAsync();
            var totalDevices = deviceSessions.Count;
            var newDevicesCount = deviceSessions.Count(d => d.Status == "Unverified");
            var verifiedDevicesCount = deviceSessions.Count(d => d.Status == "Verified");
            var trustedDevicesCount = deviceSessions.Count(d => d.Status == "Trusted");
            var flaggedDevicesCount = deviceSessions.Count(d => d.Status == "Flagged");

            // Distinct Flagged Users Count (from flagged sessions)
            var flaggedUsersCount = deviceSessions
                .Where(d => d.Status == "Flagged")
                .Select(d => d.UserId)
                .Distinct()
                .Count();

            // Notification Delivery Telemetry Metrics
            var notifications = await _context.Notifications.ToListAsync();
            var totalNotifications = notifications.Count;
            var sentNotificationsCount = notifications.Count(n => string.Equals(n.DeliveryStatus, "Sent", StringComparison.OrdinalIgnoreCase));
            var failedNotificationsCount = notifications.Count(n => string.Equals(n.DeliveryStatus, "Failed", StringComparison.OrdinalIgnoreCase));

            double deliverySuccessRate = totalNotifications > 0
                ? Math.Round(((double)sentNotificationsCount / totalNotifications) * 100.0, 2)
                : 100.0;

            var response = new
            {
                newDevices = newDevicesCount,
                newDevicesCount = newDevicesCount,
                deliverySuccessRate = deliverySuccessRate,
                flaggedUsers = flaggedUsersCount,
                flaggedUsersCount = flaggedUsersCount,
                telemetry = new
                {
                    totalDevices = totalDevices,
                    verifiedDevices = verifiedDevicesCount,
                    trustedDevices = trustedDevicesCount,
                    flaggedDevices = flaggedDevicesCount,
                    totalNotifications = totalNotifications,
                    sentNotifications = sentNotificationsCount,
                    failedNotifications = failedNotificationsCount
                },
                timestamp = DateTime.UtcNow
            };

            return Ok(response);
        }
    }
}
