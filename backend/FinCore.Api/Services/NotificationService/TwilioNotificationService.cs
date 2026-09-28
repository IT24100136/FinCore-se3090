using System;
using System.Threading.Tasks;
using FinCore.Api.Models;

namespace FinCore.Api.Services.NotificationService
{
    public class TwilioNotificationService : INotificationService
    {
        public Task<Notification> SendNotificationAsync(int userId, string recipient, string recipientName, string type, string message)
        {
            var notification = new Notification
            {
                UserId = userId,
                Recipient = recipient,
                RecipientName = string.IsNullOrWhiteSpace(recipientName) ? "User" : recipientName,
                Type = "SMS",
                Message = message,
                DeliveryStatus = "Sent",
                ChannelDetails = "Twilio SMS Gateway",
                LatencyMs = 450,
                Timestamp = DateTime.UtcNow
            };

            return Task.FromResult(notification);
        }
    }
}
