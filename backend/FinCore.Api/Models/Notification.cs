using System;

namespace FinCore.Api.Models
{
    public class Notification
    {
        public int Id { get; set; }
        public int UserId { get; set; }
        public string Title { get; set; } = string.Empty;
        public string Recipient { get; set; } = string.Empty;
        public string RecipientName { get; set; } = string.Empty;
        public string Type { get; set; } = "InApp"; // Email, SMS, InApp
        public string Message { get; set; } = string.Empty;
        public string DeliveryStatus { get; set; } = "Sent"; // Sent, Failed
        public string ChannelDetails { get; set; } = "Internal Notification Service";
        public int LatencyMs { get; set; } = 0;
        public bool IsRead { get; set; } = false;
        public string Category { get; set; } = "info"; // paymentSuccess, securityPause, accountWarning, newDevice, info
        public DateTime Timestamp { get; set; } = DateTime.UtcNow;
    }
}
