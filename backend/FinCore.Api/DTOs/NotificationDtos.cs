using System;
using System.ComponentModel.DataAnnotations;

namespace FinCore.Api.DTOs
{
    public class SendNotificationRequestDto
    {
        [Required]
        public int UserId { get; set; }

        [Required]
        public string Type { get; set; } = "Email"; // Email, SMS, SecurityAlert

        [Required]
        public string Recipient { get; set; } = string.Empty;

        public string Subject { get; set; } = string.Empty;

        [Required]
        public string Message { get; set; } = string.Empty;
    }

    public class NotificationResponseDto
    {
        public int Id { get; set; }
        public int UserId { get; set; }
        public string Type { get; set; } = string.Empty;
        public string Recipient { get; set; } = string.Empty;
        public string Subject { get; set; } = string.Empty;
        public string Message { get; set; } = string.Empty;
        public string Status { get; set; } = string.Empty;
        public string Provider { get; set; } = string.Empty;
        public string? ErrorDetails { get; set; }
        public DateTime SentAt { get; set; }
    }
}
