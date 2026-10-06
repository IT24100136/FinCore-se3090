using System;

namespace FinCore.Api.Models
{
    public class RuleThreshold
    {
        public int Id { get; set; }
        public string RuleName { get; set; } = string.Empty;
        public decimal ThresholdValue { get; set; }
        public bool IsActive { get; set; } = true;
        public DateTime LastUpdated { get; set; } = DateTime.UtcNow;
    }
}