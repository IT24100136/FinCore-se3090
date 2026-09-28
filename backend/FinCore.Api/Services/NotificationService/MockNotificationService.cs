using System;
using System.Threading.Tasks;
using FinCore.Api.Models;

namespace FinCore.Api.Services.NotificationService
{
    public class MockNotificationService : INotificationService
    {
        private readonly BrevoNotificationService _brevoService = new BrevoNotificationService();
        private readonly TwilioNotificationService _twilioService = new TwilioNotificationService();

        public Task<Notification> SendNotificationAsync(int userId, string recipient, string recipientName, string type, string message)
        {
            if (string.Equals(type, "SMS", StringComparison.OrdinalIgnoreCase))
            {
                return _twilioService.SendNotificationAsync(userId, recipient, recipientName, type, message);
            }

            return _brevoService.SendNotificationAsync(userId, recipient, recipientName, type, message);
        }
    }
}
