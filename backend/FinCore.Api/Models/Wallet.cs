using System;
using System.ComponentModel.DataAnnotations;

namespace FinCore.Api.Models
{
    public class Wallet
    {
        [Key]
        public int Id { get; set; }
        
        // Deterministic integer ID or legacy user ID
        public int UserId { get; set; } 
        
        // Exact User GUID for permanent association
        public Guid? UserGuid { get; set; }

        public decimal Balance { get; set; } = 0.00m;
        
        // Fixed to single currency as defined in the scope lock
        public string Currency { get; set; } = "LKR"; 
        
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}