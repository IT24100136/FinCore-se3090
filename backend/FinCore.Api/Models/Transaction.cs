using System.ComponentModel.DataAnnotations;

namespace FinCore.Api.Models
{
    public class Transaction
    {
        [Key]
        public int Id { get; set; }
        
        public string ReferenceId { get; set; } = string.Empty; 
        
        public int SenderWalletId { get; set; }
        public int? ReceiverWalletId { get; set; } // Nullable in case of top-ups
        
        public decimal Amount { get; set; }
        
        // Workflow states: Pending -> Held / Approved -> Completed, or -> Rejected/Reversed
        public string Status { get; set; } = "Pending"; 
        
        public DateTime Timestamp { get; set; } = DateTime.UtcNow;
        
        public string? Note { get; set; }
    }
}