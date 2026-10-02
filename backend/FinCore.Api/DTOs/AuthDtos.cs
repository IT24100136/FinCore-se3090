using System.ComponentModel.DataAnnotations;

namespace FinCore.Api.DTOs
{
    public class RegisterRequestDto
    {
        [Required]
        [EmailAddress]
        public string Email { get; set; } = string.Empty;

        [Required]
        [MinLength(6)]
        public string Password { get; set; } = string.Empty;

        public string? Name { get; set; }

        public string Role { get; set; } = "Customer";

        // 1. Account Credentials & Security
        public string? PhoneNumber { get; set; }
        public string? Pin { get; set; }
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

        // 3. Financial Linking (Optional during registration)
        public string? BankAccountNumber { get; set; }
        public string? BankRoutingCode { get; set; }
        public string? CardNumber { get; set; }

        // 4. Legal Agreements & Preferences
        public bool AgreedToTerms { get; set; } = true;
        public bool MarketingOptIn { get; set; } = false;
    }

    public class UserProfileDto
    {
        public Guid Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string Role { get; set; } = string.Empty;
        public string? PhoneNumber { get; set; }
        public bool BiometricEnabled { get; set; }
        public DateTime? DateOfBirth { get; set; }
        public string? Address { get; set; }
        public string? City { get; set; }
        public string? PostalCode { get; set; }
        public string? IdType { get; set; }
        public string? IdNumber { get; set; }
        public string? IdDocumentUrl { get; set; }
        public string? SelfieUrl { get; set; }
        public string KycStatus { get; set; } = "Verified";
        public string? BankAccountNumber { get; set; }
        public string? CardLastFour { get; set; }
        public bool AgreedToTerms { get; set; }
        public bool MarketingOptIn { get; set; }
        public DateTime CreatedAt { get; set; }
    }

    public class LoginRequestDto
    {
        [Required]
        [EmailAddress]
        public string Email { get; set; } = string.Empty;

        [Required]
        public string Password { get; set; } = string.Empty;
    }

    public class AuthResponseDto
    {
        public string Token { get; set; } = string.Empty;
        public string Message { get; set; } = string.Empty;
    }
}
