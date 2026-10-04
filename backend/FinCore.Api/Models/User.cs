using System;

namespace FinCore.Api.Models
{
    public class User
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        public string Name { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string PasswordHash { get; set; } = string.Empty;
        public string Role { get; set; } = "Customer";  // "Customer", "Analyst", or "Admin"
        public string? EmployeeId { get; set; }
        public string? Department { get; set; }
        
        // 1. Account Credentials & Security
        public string? PhoneNumber { get; set; }
        public string? PinHash { get; set; }
        public bool BiometricEnabled { get; set; } = false;

        // 2. Personal Information & Identity Verification (KYC)
        public DateTime? DateOfBirth { get; set; }
        public string? Address { get; set; }
        public string? City { get; set; }
        public string? PostalCode { get; set; }
        public string? IdType { get; set; } // National ID, Passport, Driver's License
        public string? IdNumber { get; set; }
        public string? IdDocumentUrl { get; set; }
        public string? SelfieUrl { get; set; }
        public string KycStatus { get; set; } = "Verified"; // Pending, Verified, Rejected

        // 3. Financial Linking (Optional during registration)
        public string? BankAccountNumber { get; set; }
        public string? BankRoutingCode { get; set; }
        public string? CardLastFour { get; set; }

        // 4. Legal Agreements & Preferences
        public bool AgreedToTerms { get; set; } = true;
        public bool MarketingOptIn { get; set; } = false;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    }
}

