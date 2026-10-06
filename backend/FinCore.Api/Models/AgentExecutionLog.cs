using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace FinCore.Api.Models
{
    /// <summary>
    /// Section 9.1: Durable persistence of multi-agent workflow state in PostgreSQL.
    /// Captures objective, execution plan, agent delegations, tool results, validation outputs,
    /// latency, and final approval decisions.
    /// </summary>
    [Table("AgentExecutionLogs")]
    public class AgentExecutionLog
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int Id { get; set; }

        [Required]
        [MaxLength(100)]
        public string WorkflowId { get; set; } = string.Empty;

        [Required]
        [MaxLength(100)]
        public string TransactionId { get; set; } = string.Empty;

        [MaxLength(255)]
        public string WorkflowObjective { get; set; } = "Multi-Agent Cooperative Fraud Risk Assessment & Policy Governance";

        public string PlanJson { get; set; } = string.Empty;

        [MaxLength(100)]
        public string AgentName { get; set; } = "FinCore-MultiAgent-Cooperative-Orchestrator";

        public string AgentDelegationsJson { get; set; } = string.Empty;

        public string ToolCallsJson { get; set; } = string.Empty;

        public string ValidationOutputsJson { get; set; } = string.Empty;

        [MaxLength(50)]
        public string FinalDecision { get; set; } = string.Empty;

        [MaxLength(50)]
        public string ApprovalStatus { get; set; } = string.Empty;

        public double CompositeRiskScore { get; set; }

        public long ExecutionLatencyMs { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
