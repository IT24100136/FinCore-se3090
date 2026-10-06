using System;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using System.Threading.Tasks;
using BCrypt.Net;
using FinCore.Api.Data;
using FinCore.Api.DTOs;
using FinCore.Api.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;

namespace FinCore.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AuthController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly IConfiguration _configuration;
        private readonly Services.NotificationService.IEmailService _emailService;

        public AuthController(
            ApplicationDbContext context,
            IConfiguration configuration,
            Services.NotificationService.IEmailService emailService)
        {
            _context = context;
            _configuration = configuration;
            _emailService = emailService;
        }

        [HttpPost("register")]
        public async Task<IActionResult> Register([FromBody] RegisterRequestDto request)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            var normalizedEmail = request.Email.Trim().ToLower();

            // 1. Duplicate Email Check
            var existingUser = await _context.Users.AnyAsync(u => u.Email.ToLower() == normalizedEmail);
            if (existingUser)
            {
                return BadRequest(new { message = "User with this email already exists." });
            }

            // 2. Duplicate Employee ID Check (if provided for staff)
            var cleanEmployeeId = !string.IsNullOrWhiteSpace(request.EmployeeId)
                ? request.EmployeeId.Trim().ToUpper()
                : null;

            if (!string.IsNullOrWhiteSpace(cleanEmployeeId))
            {
                var employeeIdExists = await _context.Users.AnyAsync(u =>
                    u.EmployeeId != null && u.EmployeeId.ToUpper() == cleanEmployeeId);
                if (employeeIdExists)
                {
                    return BadRequest(new { message = $"Employee ID '{cleanEmployeeId}' is already registered to another staff member." });
                }
            }

            // 3. Password Complexity Policy Check
            // Min 8 chars, at least 1 uppercase, 1 digit, 1 special character
            if (request.Password.Length < 8 ||
                !request.Password.Any(char.IsUpper) ||
                !request.Password.Any(char.IsDigit) ||
                !request.Password.Any(ch => !char.IsLetterOrDigit(ch)))
            {
                return BadRequest(new { message = "Password must be at least 8 characters and contain at least one uppercase letter, one number, and one special character." });
            }

            // 4. Confirm Password Match Check
            if (!string.IsNullOrWhiteSpace(request.ConfirmPassword) && request.Password != request.ConfirmPassword)
            {
                return BadRequest(new { message = "Passwords do not match." });
            }

            // 5. Role Mapping
            var rawRole = (request.Role ?? "Customer").Trim();
            string resolvedRole = "Customer";
            if (rawRole.Equals("Fraud Analyst", StringComparison.OrdinalIgnoreCase) ||
                rawRole.Equals("Analyst", StringComparison.OrdinalIgnoreCase))
            {
                resolvedRole = "Analyst";
            }
            else if (rawRole.Equals("System Admin", StringComparison.OrdinalIgnoreCase) ||
                     rawRole.Equals("Admin", StringComparison.OrdinalIgnoreCase))
            {
                resolvedRole = "Admin";
            }

            if ((resolvedRole == "Admin" || resolvedRole == "Analyst") && string.IsNullOrWhiteSpace(cleanEmployeeId))
            {
                var count = await _context.Users.CountAsync(u => u.Role == resolvedRole) + 1;
                var prefix = resolvedRole == "Admin" ? "ADM" : "ANL";
                cleanEmployeeId = $"{prefix}-{count:D3}";
            }

            var displayName = !string.IsNullOrWhiteSpace(request.FullName)
                ? request.FullName.Trim()
                : (!string.IsNullOrWhiteSpace(request.Name) ? request.Name.Trim() : normalizedEmail.Split('@')[0]);

            var cardLastFour = !string.IsNullOrWhiteSpace(request.CardNumber) && request.CardNumber.Length >= 4
                ? request.CardNumber[^4..]
                : null;

            var user = new User
            {
                Id = Guid.NewGuid(),
                Name = displayName,
                Email = normalizedEmail,
                PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password),
                Role = resolvedRole,
                EmployeeId = cleanEmployeeId,
                Department = !string.IsNullOrWhiteSpace(request.Department) ? request.Department.Trim() : null,
                PhoneNumber = request.PhoneNumber,
                PinHash = !string.IsNullOrWhiteSpace(request.Pin) ? BCrypt.Net.BCrypt.HashPassword(request.Pin) : null,
                BiometricEnabled = request.BiometricEnabled,
                DateOfBirth = request.DateOfBirth.HasValue
                    ? (request.DateOfBirth.Value.Kind == DateTimeKind.Utc
                        ? request.DateOfBirth.Value
                        : DateTime.SpecifyKind(request.DateOfBirth.Value, DateTimeKind.Utc))
                    : null,
                Address = request.Address,
                City = request.City,
                PostalCode = request.PostalCode,
                IdType = request.IdType ?? "National ID",
                IdNumber = request.IdNumber,
                IdDocumentUrl = request.IdDocumentUrl ?? (!string.IsNullOrWhiteSpace(request.IdNumber) ? "verified_id_doc.png" : null),
                SelfieUrl = request.SelfieUrl ?? (!string.IsNullOrWhiteSpace(request.IdNumber) ? "verified_selfie_scan.png" : null),
                KycStatus = "Verified",
                BankAccountNumber = request.BankAccountNumber,
                BankRoutingCode = request.BankRoutingCode,
                CardLastFour = cardLastFour,
                AgreedToTerms = request.AgreedToTerms,
                MarketingOptIn = request.MarketingOptIn,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            _context.Users.Add(user);

            // Automatically provision wallet for customers
            Wallet? userWallet = null;
            if (resolvedRole == "Customer")
            {
                int walletUserId = DbInitializer.GetDeterministicUserId(user.Id);
                userWallet = await _context.Wallets.FirstOrDefaultAsync(w => w.UserGuid == user.Id || w.UserId == walletUserId);
                if (userWallet == null)
                {
                    userWallet = new Wallet
                    {
                        UserId = walletUserId,
                        UserGuid = user.Id,
                        Balance = 100000m, // Starter test balance in LKR
                        Currency = "LKR",
                        CreatedAt = DateTime.UtcNow
                    };
                    _context.Wallets.Add(userWallet);
                }
            }

            await _context.SaveChangesAsync();

            var token = GenerateJwtToken(user);

            return Ok(new AuthResponseDto
            {
                Token = token,
                Message = "Registration successful",
                User = new AuthUserDto
                {
                    Id = user.Id,
                    FullName = user.Name,
                    Email = user.Email,
                    Role = user.Role,
                    EmployeeId = user.EmployeeId,
                    Department = user.Department,
                    PhoneNumber = user.PhoneNumber,
                    WalletId = userWallet?.Id
                }
            });
        }

        [HttpPost("login")]
        public async Task<IActionResult> Login([FromBody] LoginRequestDto request)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            var identifier = request.Email.Trim().ToLower();
            var normId = identifier.ToUpper();

            // Match by Email OR Employee ID (accepts standard ANL-001, ADM-001, etc.)
            var user = await _context.Users.FirstOrDefaultAsync(u =>
                u.Email.ToLower() == identifier ||
                (u.EmployeeId != null && (
                    u.EmployeeId.ToLower() == identifier ||
                    (normId == "ANL-001" && (u.EmployeeId.ToUpper() == "ANL-1001" || u.EmployeeId.ToUpper() == "ANL-001")) ||
                    (normId == "ANL-1001" && (u.EmployeeId.ToUpper() == "ANL-1001" || u.EmployeeId.ToUpper() == "ANL-001")) ||
                    (normId == "ADM-001" && (u.EmployeeId.ToUpper() == "ADM-9001" || u.EmployeeId.ToUpper() == "ADM-001")) ||
                    (normId == "ADM-9001" && (u.EmployeeId.ToUpper() == "ADM-9001" || u.EmployeeId.ToUpper() == "ADM-001"))
                )));

            if (user == null)
            {
                return Unauthorized(new { message = "Invalid email, badge ID, or password." });
            }

            bool isPasswordValid = BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash);
            if (!isPasswordValid)
            {
                return Unauthorized(new { message = "Invalid email, badge ID, or password." });
            }

            // Ensure customer has a wallet and fetch wallet ID
            Wallet? customerWallet = null;
            if (user.Role == "Customer")
            {
                int walletUserId = DbInitializer.GetDeterministicUserId(user.Id);
                customerWallet = await _context.Wallets.FirstOrDefaultAsync(w => w.UserGuid == user.Id || w.UserId == walletUserId);
                if (customerWallet == null)
                {
                    customerWallet = new Wallet
                    {
                        UserId = walletUserId,
                        UserGuid = user.Id,
                        Balance = 100000m,
                        Currency = "LKR",
                        CreatedAt = DateTime.UtcNow
                    };
                    _context.Wallets.Add(customerWallet);
                    await _context.SaveChangesAsync();
                }
                else if (!customerWallet.UserGuid.HasValue)
                {
                    customerWallet.UserGuid = user.Id;
                    await _context.SaveChangesAsync();
                }
            }

            var token = GenerateJwtToken(user);

            return Ok(new AuthResponseDto
            {
                Token = token,
                Message = "Login successful",
                User = new AuthUserDto
                {
                    Id = user.Id,
                    FullName = user.Name,
                    Email = user.Email,
                    Role = user.Role,
                    EmployeeId = user.EmployeeId,
                    Department = user.Department,
                    PhoneNumber = user.PhoneNumber,
                    WalletId = customerWallet?.Id
                }
            });
        }

        private static readonly System.Collections.Concurrent.ConcurrentDictionary<string, (string Code, DateTime ExpiresAt)> _otpStore = new();

        [HttpPost("otp/send")]
        public async Task<IActionResult> SendOtp([FromBody] SendOtpRequestDto request)
        {
            if (string.IsNullOrWhiteSpace(request.Identifier))
            {
                return BadRequest(new { message = "Identifier (email) is required." });
            }

            var cleanId = request.Identifier.Trim().ToLower();
            var code = Random.Shared.Next(100000, 999999).ToString();
            var expiresAt = DateTime.UtcNow.AddMinutes(5);

            _otpStore[cleanId] = (code, expiresAt);

            Console.WriteLine($"[FinCore OTP Gateway] Generated OTP for {cleanId}: {code} (Valid for 5 mins)");

            // Look up user name if exists
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Email.ToLower() == cleanId);
            var recipientName = user?.Name ?? "Customer";

            // Dispatch live verification email using Brevo
            try
            {
                var emailResult = await _emailService.SendOtpEmailAsync(cleanId, recipientName, code, expirationMinutes: 5);
                if (!emailResult.Success)
                {
                    Console.WriteLine($"[Brevo OTP Dispatch Warning] Failed to deliver OTP email: {emailResult.ErrorMessage}");
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[Brevo OTP Dispatch Warning] Exception delivering OTP email: {ex.Message}");
            }

            return Ok(new
            {
                success = true,
                message = $"Verification code dispatched to {request.Identifier}.",
                expiresInSeconds = 300,
                // Provided for local testing and frictionless demo verification
                debugOtp = code,
                fallbackOtp = "123456"
            });
        }

        [HttpPost("otp/verify")]
        public IActionResult VerifyOtp([FromBody] VerifyOtpRequestDto request)
        {
            if (string.IsNullOrWhiteSpace(request.Identifier) || string.IsNullOrWhiteSpace(request.Code))
            {
                return BadRequest(new { success = false, message = "Identifier and code are required." });
            }

            var cleanId = request.Identifier.Trim().ToLower();
            var inputCode = request.Code.Trim();

            // Universal test/demo code bypass
            if (inputCode == "123456")
            {
                _otpStore.TryRemove(cleanId, out _);
                return Ok(new { success = true, message = "OTP verified successfully (Demo verification)." });
            }

            if (_otpStore.TryGetValue(cleanId, out var entry))
            {
                if (DateTime.UtcNow > entry.ExpiresAt)
                {
                    _otpStore.TryRemove(cleanId, out _);
                    return BadRequest(new { success = false, message = "Verification code has expired. Please request a new code." });
                }

                if (entry.Code == inputCode)
                {
                    _otpStore.TryRemove(cleanId, out _);
                    return Ok(new { success = true, message = "OTP verified successfully." });
                }
            }

            return BadRequest(new { success = false, message = "Invalid verification code. Please check and try again." });
        }

        /// <summary>
        /// POST /api/auth/verify-otp
        /// 2-Step Login/Registration verification endpoint: Validates OTP and returns JWT token.
        /// </summary>
        [HttpPost("verify-otp")]
        public async Task<IActionResult> VerifyOtpAndLogin([FromBody] VerifyOtpRequestDto request)
        {
            if (string.IsNullOrWhiteSpace(request.Identifier) || string.IsNullOrWhiteSpace(request.Code))
            {
                return BadRequest(new { success = false, message = "Identifier and code are required." });
            }

            var cleanId = request.Identifier.Trim().ToLower();
            var inputCode = request.Code.Trim();

            bool isDemoBypass = inputCode == "123456";
            bool isValid = false;

            if (isDemoBypass)
            {
                isValid = true;
                _otpStore.TryRemove(cleanId, out _);
            }
            else if (_otpStore.TryGetValue(cleanId, out var entry))
            {
                if (DateTime.UtcNow > entry.ExpiresAt)
                {
                    _otpStore.TryRemove(cleanId, out _);
                    return BadRequest(new { success = false, message = "Verification code has expired. Please request a new code." });
                }

                if (entry.Code == inputCode)
                {
                    isValid = true;
                    _otpStore.TryRemove(cleanId, out _);
                }
            }

            if (!isValid)
            {
                return BadRequest(new { success = false, message = "Invalid verification code. Please check and try again." });
            }

            var user = await _context.Users.FirstOrDefaultAsync(u =>
                u.Email.ToLower() == cleanId ||
                (u.PhoneNumber != null && u.PhoneNumber.ToLower() == cleanId) ||
                (u.EmployeeId != null && u.EmployeeId.ToLower() == cleanId));

            if (user == null)
            {
                return NotFound(new { success = false, message = "User record not found." });
            }

            Wallet? customerWallet = null;
            if (user.Role == "Customer")
            {
                int walletUserId = DbInitializer.GetDeterministicUserId(user.Id);
                customerWallet = await _context.Wallets.FirstOrDefaultAsync(w => w.UserGuid == user.Id || w.UserId == walletUserId);
            }

            var token = GenerateJwtToken(user);

            return Ok(new AuthResponseDto
            {
                Token = token,
                Message = "Email OTP verified successfully.",
                User = new AuthUserDto
                {
                    Id = user.Id,
                    FullName = user.Name,
                    Email = user.Email,
                    Role = user.Role,
                    EmployeeId = user.EmployeeId,
                    Department = user.Department,
                    PhoneNumber = user.PhoneNumber,
                    WalletId = customerWallet?.Id
                }
            });
        }

        [Microsoft.AspNetCore.Authorization.Authorize]
        [HttpGet("profile")]
        public async Task<IActionResult> GetProfile()
        {
            var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("UserId");
            if (!Guid.TryParse(userIdStr, out var userGuid))
            {
                return Unauthorized(new { message = "Invalid user token claims." });
            }

            var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == userGuid);
            if (user == null)
            {
                return NotFound(new { message = "User not found." });
            }

            return Ok(new UserProfileDto
            {
                Id = user.Id,
                Name = user.Name,
                Email = user.Email,
                Role = user.Role,
                PhoneNumber = user.PhoneNumber,
                BiometricEnabled = user.BiometricEnabled,
                DateOfBirth = user.DateOfBirth,
                Address = user.Address,
                City = user.City,
                PostalCode = user.PostalCode,
                IdType = user.IdType,
                IdNumber = user.IdNumber,
                IdDocumentUrl = user.IdDocumentUrl,
                SelfieUrl = user.SelfieUrl,
                KycStatus = user.KycStatus,
                BankAccountNumber = user.BankAccountNumber,
                CardLastFour = user.CardLastFour,
                AgreedToTerms = user.AgreedToTerms,
                MarketingOptIn = user.MarketingOptIn,
                CreatedAt = user.CreatedAt
            });
        }

        private string GenerateJwtToken(User user)
        {
            var jwtKey = _configuration["Jwt:Key"] ?? "your-super-secret-key-that-is-long-enough";
            var jwtIssuer = _configuration["Jwt:Issuer"] ?? "FinCore";

            var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey));
            var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

            var claims = new[]
            {
                new Claim(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
                new Claim(JwtRegisteredClaimNames.Email, user.Email),
                new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
                new Claim(ClaimTypes.Name, user.Name),
                new Claim("name", user.Name),
                new Claim(ClaimTypes.Role, user.Role),
                new Claim("role", user.Role),
                new Claim("Role", user.Role),
                new Claim("employeeId", user.EmployeeId ?? string.Empty),
                new Claim("department", user.Department ?? string.Empty),
                new Claim("UserId", user.Id.ToString()),
                new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString())
            };

            var token = new JwtSecurityToken(
                issuer: jwtIssuer,
                audience: null,
                claims: claims,
                expires: DateTime.UtcNow.AddHours(8),
                signingCredentials: credentials);

            return new JwtSecurityTokenHandler().WriteToken(token);
        }
    }
}
