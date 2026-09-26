using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace FinCore.Api.Models
{
    public class ReviewQueue
    {
        [Key]
        public Guid Id { get; set; } = Guid.NewGuid();

        [Required]
        public Guid TransactionId { get; set; }

        public string QueueCode { get; set; } = string.Empty;

        [Required]
        [MaxLength(50)]
        public string Status { get; set; } = "Queued"; // Queued, Assigned, PendingSecondApproval, Decided, Escalated

        public int Priority { get; set; } = 1; // 1 = Medium, 2 = High, 3 = Critical

        public string PriorityLabel { get; set; } = "MEDIUM"; // MEDIUM, HIGH, CRITICAL

        [Column(TypeName = "decimal(18,2)")]
        public decimal Amount { get; set; }

        public string SenderName { get; set; } = string.Empty;
        public string SenderId { get; set; } = string.Empty;

        public string RecipientName { get; set; } = string.Empty;
        public string RecipientId { get; set; } = string.Empty;

        public double RiskScore { get; set; }

        public string OriginIp { get; set; } = string.Empty;
        public string Device { get; set; } = string.Empty;

        public double Latitude { get; set; } = 6.9271; // Default to Colombo
        public double Longitude { get; set; } = 79.8612;

        public string? FlagReasonsJson { get; set; }

        public Guid? AssignedAnalystId { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? UpdatedAt { get; set; }
    }
}