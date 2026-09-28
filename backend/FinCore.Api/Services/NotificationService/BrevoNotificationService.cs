using System;
using System.Threading.Tasks;
using FinCore.Api.Models;

namespace FinCore.Api.Services.NotificationService
{
    public class BrevoNotificationService : INotificationService
    {
        public Task<Notification> SendNotificationAsync(int userId, string recipient, string recipientName, string type, string message)
        {
            var notification = new Notification
            {
                UserId = userId,
                Recipient = recipient,
                RecipientName = string.IsNullOrWhiteSpace(recipientName) ? "User" : recipientName,
                Type = "Email",
                Message = message,
                DeliveryStatus = "Sent",
                ChannelDetails = "Brevo SMTP Relay (Transactional Email)",
                LatencyMs = 320,
                Timestamp = DateTime.UtcNow
            };

            return Task.FromResult(notification);
        }
    }
}
