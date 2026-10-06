using System;

namespace FinCore.Api.Models
{
    public class FraudFlag
    {
        public int Id { get; set; }
        public int TransactionId { get; set; }
        public int RiskScore { get; set; }
        public string Reasons { get; set; } = string.Empty;
        public string Status { get; set; } = "Pending Score";
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}