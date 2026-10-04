using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace FinCore.Api.Models
{
    [Table("RuleAuditLogs")]
    public class RuleAuditLog
    {
        [Key]
        public Guid Id { get; set; } = Guid.NewGuid();

        [Required]
        [MaxLength(100)]
        public string RuleId { get; set; } = string.Empty;

        [Required]
        [MaxLength(200)]
        public string RuleName { get; set; } = string.Empty;

        [Required]
        [MaxLength(50)]
        public string Action { get; set; } = string.Empty; // CREATED, UPDATED, TOGGLED, DELETED

        public string? PreviousValue { get; set; }

        public string? NewValue { get; set; }

        [MaxLength(150)]
        public string ModifiedBy { get; set; } = string.Empty;

        public DateTime Timestamp { get; set; } = DateTime.UtcNow;
    }
}
