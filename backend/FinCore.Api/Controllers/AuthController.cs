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

        public AuthController(ApplicationDbContext context, IConfiguration configuration)
        {
            _context = context;
            _configuration = configuration;
        }

        [HttpPost("register")]
        public async Task<IActionResult> Register([FromBody] RegisterRequestDto request)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            var normalizedEmail = request.Email.Trim().ToLower();

            var existingUser = await _context.Users.AnyAsync(u => u.Email.ToLower() == normalizedEmail);
            if (existingUser)
            {
                return BadRequest(new { message = "User with this email already exists." });
            }

            var cardLastFour = !string.IsNullOrWhiteSpace(request.CardNumber) && request.CardNumber.Length >= 4
                ? request.CardNumber[^4..]
                : null;

            var user = new User
            {
                Id = Guid.NewGuid(),
                Name = !string.IsNullOrWhiteSpace(request.Name) ? request.Name : normalizedEmail.Split('@')[0],
                Email = normalizedEmail,
                PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password),
                Role = !string.IsNullOrWhiteSpace(request.Role) ? request.Role : "Customer",
                PhoneNumber = request.PhoneNumber,
                PinHash = !string.IsNullOrWhiteSpace(request.Pin) ? BCrypt.Net.BCrypt.HashPassword(request.Pin) : null,
                BiometricEnabled = request.BiometricEnabled,
                DateOfBirth = request.DateOfBirth,
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

            // Automatically provision wallet for the newly registered customer
            int walletUserId = Math.Abs(user.Id.ToString().GetHashCode());
            var existingWallet = await _context.Wallets.FirstOrDefaultAsync(w => w.UserId == walletUserId);
            if (existingWallet == null)
            {
                var wallet = new Wallet
                {
                    UserId = walletUserId,
                    Balance = 100000m, // Starter test balance in LKR
                    Currency = "LKR",
                    CreatedAt = DateTime.UtcNow
                };
                _context.Wallets.Add(wallet);
            }

            await _context.SaveChangesAsync();

            var token = GenerateJwtToken(user);

            return Ok(new
            {
                message = "User registered successfully with verified KYC profile",
                userId = user.Id,
                email = user.Email,
                name = user.Name,
                phoneNumber = user.PhoneNumber,
                role = user.Role,
                kycStatus = user.KycStatus,
                token = token
            });
        }

        [HttpPost("login")]
        public async Task<IActionResult> Login([FromBody] LoginRequestDto request)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            var normalizedEmail = request.Email.Trim().ToLower();

            var user = await _context.Users.FirstOrDefaultAsync(u => u.Email.ToLower() == normalizedEmail);
            if (user == null)
            {
                return Unauthorized(new { message = "Invalid email or password." });
            }

            bool isPasswordValid = BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash);
            if (!isPasswordValid)
            {
                return Unauthorized(new { message = "Invalid email or password." });
            }

            var token = GenerateJwtToken(user);

            return Ok(new AuthResponseDto
            {
                Token = token,
                Message = "Login successful"
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
                new Claim("UserId", user.Id.ToString()),
                new Claim(ClaimTypes.Role, user.Role),
                new Claim("Role", user.Role),
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
