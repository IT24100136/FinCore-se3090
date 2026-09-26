using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace FinCore.Api.Models
{
    public class ApprovalDecision
    {
        [Key]
        public Guid Id { get; set; } = Guid.NewGuid();

        [Required]
        public Guid TransactionId { get; set; }

        [Required]
        public Guid AnalystId { get; set; }

        [Required]
        [MaxLength(50)]
        public string Decision { get; set; } = string.Empty; // Approved, Rejected, Escalated

        public int ApprovalLevel { get; set; } = 1; // 1 = Primary, 2 = Second Approver (Dual Approval)

        public string? Notes { get; set; }

        public DateTime DecidedAt { get; set; } = DateTime.UtcNow;
    }
}