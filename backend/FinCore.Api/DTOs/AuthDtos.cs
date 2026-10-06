using System;
using System.ComponentModel.DataAnnotations;

namespace FinCore.Api.DTOs
{
    public class RegisterRequestDto
    {
        [Required]
        [EmailAddress]
        public string Email { get; set; } = string.Empty;

        [Required]
        [MinLength(8, ErrorMessage = "Password must be at least 8 characters.")]
        public string Password { get; set; } = string.Empty;

        public string? ConfirmPassword { get; set; }

        public string? Name { get; set; }
        public string? FullName { get; set; }

        public string Role { get; set; } = "Customer"; // Customer, Analyst, Admin

        // Staff Corporate Information
        public string? EmployeeId { get; set; }
        public string? Department { get; set; }

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
        public string? EmployeeId { get; set; }
        public string? Department { get; set; }
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
        [Required(ErrorMessage = "Email or Staff Badge ID is required.")]
        public string Email { get; set; } = string.Empty; // Accepts Email or EmployeeId

        [Required(ErrorMessage = "Password is required.")]
        public string Password { get; set; } = string.Empty;
    }

    public class AuthUserDto
    {
        public Guid Id { get; set; }
        public string FullName { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string Role { get; set; } = string.Empty;
        public string? EmployeeId { get; set; }
        public string? Department { get; set; }
        public string? PhoneNumber { get; set; }
        public int? WalletId { get; set; }
    }

    public class AuthResponseDto
    {
        public string Token { get; set; } = string.Empty;
        public string Message { get; set; } = string.Empty;
        public AuthUserDto? User { get; set; }
    }

    public class SendOtpRequestDto
    {
        [Required]
        public string Identifier { get; set; } = string.Empty; // Email or Phone number
        public string? Purpose { get; set; } = "LOGIN"; // LOGIN, REGISTER, TRANSACTION
    }

    public class VerifyOtpRequestDto
    {
        [Required]
        public string Identifier { get; set; } = string.Empty;

        [Required]
        [StringLength(6, MinimumLength = 6, ErrorMessage = "OTP must be 6 digits.")]
        public string Code { get; set; } = string.Empty;

        public string? Purpose { get; set; } = "LOGIN";
    }
}

