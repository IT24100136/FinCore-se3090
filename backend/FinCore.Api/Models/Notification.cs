using System;

namespace FinCore.Api.Models
{
    public class Notification
    {
        public int Id { get; set; }
        public int UserId { get; set; }
        public string Type { get; set; } = "Email"; // Email, SMS, SecurityAlert
        public string Recipient { get; set; } = string.Empty;
        public string Subject { get; set; } = string.Empty;
        public string Message { get; set; } = string.Empty;
        public string Status { get; set; } = "Pending"; // Pending, Sent, Failed
        public string Provider { get; set; } = "Mock"; // Mock, Brevo, Twilio, SendGrid
        public string? ErrorDetails { get; set; }
        public DateTime SentAt { get; set; } = DateTime.UtcNow;
    }
}
