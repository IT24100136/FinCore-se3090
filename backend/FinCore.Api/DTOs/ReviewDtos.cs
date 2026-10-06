using System;

namespace FinCore.Api.DTOs
{
    public class DecideRequest
    {
        public Guid AnalystId { get; set; }
        public Guid? SecondAnalystId { get; set; }
        public string Decision { get; set; } = string.Empty; // Approved, Rejected, Revision Requested
        public string? Notes { get; set; }
        public decimal TransactionAmount { get; set; } // Used to check dual-approval threshold
    }

    public class AssignRequest
    {
        public Guid AnalystId { get; set; }
    }

    public class SecondApprovalRequest
    {
        public Guid SecondAnalystId { get; set; }
        public Guid? AnalystId { get; set; }
        public string Decision { get; set; } = string.Empty; // Approved, Rejected
        public string? Notes { get; set; }
    }

    public class EscalateRequest
    {
        public Guid AnalystId { get; set; }
        public Guid TargetAnalystId { get; set; }
        public string? TargetAnalystName { get; set; }
        public string Reason { get; set; } = string.Empty;
    }

    public class EnqueueReviewRequest
    {
        public Guid TransactionId { get; set; }
        public string QueueCode { get; set; } = string.Empty;
        public decimal Amount { get; set; }
        public string SenderName { get; set; } = string.Empty;
        public string SenderId { get; set; } = string.Empty;
        public string RecipientName { get; set; } = string.Empty;
        public string RecipientId { get; set; } = string.Empty;
        public double RiskScore { get; set; }
        public string OriginIp { get; set; } = string.Empty;
        public string Device { get; set; } = string.Empty;
        public double Latitude { get; set; } = 6.9271;
        public double Longitude { get; set; } = 79.8612;
        public string? FlagReasonsJson { get; set; }
        public int Priority { get; set; } = 1;
        public string PriorityLabel { get; set; } = "MEDIUM";
    }

    public class DecisionHistoryDto
    {
        public Guid Id { get; set; }
        public Guid TransactionId { get; set; }
        public string ReferenceId { get; set; } = string.Empty;
        public decimal Amount { get; set; }
        public string SenderAccountNumber { get; set; } = string.Empty;
        public string SenderName { get; set; } = string.Empty;
        public string RecipientName { get; set; } = string.Empty;
        public string RecipientAccountNo { get; set; } = string.Empty;
        public string BankName { get; set; } = "FinCore Bank";
        public double RiskScore { get; set; }
        public string RiskTier { get; set; } = "MEDIUM";
        public string Action { get; set; } = string.Empty; // Approved, Rejected, Escalated, Request More Info, Reversed
        public string PreviousStatus { get; set; } = string.Empty;
        public string NewStatus { get; set; } = string.Empty;
        public int ApprovalLevel { get; set; } = 1;
        public string PrimaryAnalystName { get; set; } = string.Empty;
        public string PrimaryAnalystId { get; set; } = string.Empty;
        public string SecondaryApproverName { get; set; } = string.Empty;
        public string SecondaryApproverId { get; set; } = string.Empty;
        public string Notes { get; set; } = string.Empty;
        public string Reason { get; set; } = string.Empty;
        public DateTime DecidedAt { get; set; }
        public DateTime Timestamp { get; set; }
        public string Status { get; set; } = string.Empty;
        public string Category { get; set; } = "Decision"; // Decision, Ledger, Security
        public string? FlagReasons { get; set; }
    }
}