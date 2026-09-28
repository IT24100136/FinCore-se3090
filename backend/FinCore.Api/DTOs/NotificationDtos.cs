using System;
using System.ComponentModel.DataAnnotations;

namespace FinCore.Api.DTOs
{
    public class SendNotificationRequestDto
    {
        [Required]
        public int UserId { get; set; }

        [Required]
        public string Recipient { get; set; } = string.Empty;

        public string RecipientName { get; set; } = string.Empty;

        [Required]
        public string Type { get; set; } = "Email"; // Email or SMS

        [Required]
        public string Message { get; set; } = string.Empty;
    }

    public class NotificationResponseDto
    {
        public int Id { get; set; }
        public int UserId { get; set; }
        public string Recipient { get; set; } = string.Empty;
        public string RecipientName { get; set; } = string.Empty;
        public string Type { get; set; } = string.Empty;
        public string Message { get; set; } = string.Empty;
        public string DeliveryStatus { get; set; } = string.Empty;
        public string ChannelDetails { get; set; } = string.Empty;
        public int LatencyMs { get; set; }
        public DateTime Timestamp { get; set; }
    }
}
