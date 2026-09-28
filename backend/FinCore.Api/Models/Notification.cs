using System;

namespace FinCore.Api.Models
{
    public class Notification
    {
        public int Id { get; set; }
        public int UserId { get; set; }
        public string Recipient { get; set; } = string.Empty;
        public string RecipientName { get; set; } = string.Empty;
        public string Type { get; set; } = "Email"; // Email, SMS
        public string Message { get; set; } = string.Empty;
        public string DeliveryStatus { get; set; } = "Sent"; // Sent, Failed
        public string ChannelDetails { get; set; } = string.Empty;
        public int LatencyMs { get; set; } = 0;
        public DateTime Timestamp { get; set; } = DateTime.UtcNow;
    }
}
