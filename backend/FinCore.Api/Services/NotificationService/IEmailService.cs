using System.Threading.Tasks;

namespace FinCore.Api.Services.NotificationService
{
    public record EmailSendResult(bool Success, string? MessageId, string? ErrorMessage);

    public interface IEmailService
    {
        /// <summary>
        /// Sends an email via Brevo REST API with rate-limit and error handling.
        /// </summary>
        Task<EmailSendResult> SendEmailAsync(string toEmail, string recipientName, string subject, string htmlContent, string? textContent = null);

        /// <summary>
        /// Sends a 6-digit OTP verification email for authentication/registration.
        /// </summary>
        Task<EmailSendResult> SendOtpEmailAsync(string toEmail, string recipientName, string otpCode, int expirationMinutes = 5);

        /// <summary>
        /// Sends a 6-digit OTP verification email specifically for step-up transaction authorization.
        /// </summary>
        Task<EmailSendResult> SendStepUpOtpEmailAsync(string toEmail, string recipientName, string otpCode, decimal amount, string? recipientAccount, int expirationMinutes = 10);
    }
}
