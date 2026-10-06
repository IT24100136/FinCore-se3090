using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace FinCore.Api.Models
{
    [Table("NotificationCategories")]
    public class NotificationCategory
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int Id { get; set; }

        [Required]
        [MaxLength(64)]
        public string Code { get; set; } = string.Empty;

        [Required]
        [MaxLength(128)]
        public string Name { get; set; } = string.Empty;

        [MaxLength(500)]
        public string? Description { get; set; }

        [MaxLength(32)]
        public string Severity { get; set; } = "Info"; // Info, Warning, High, Critical

        [MaxLength(32)]
        public string DefaultChannel { get; set; } = "InApp"; // InApp, Email, SMS, Push

        [MaxLength(16)]
        public string BadgeColor { get; set; } = "#64748B";

        [MaxLength(64)]
        public string? IconName { get; set; }

        public bool IsMandatory { get; set; } = false;

        public bool IsActive { get; set; } = true;

        public bool IsAutoCreated { get; set; } = false;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public DateTime? UpdatedAt { get; set; }
    }
}
