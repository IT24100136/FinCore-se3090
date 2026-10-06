using System;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using FinCore.Api.Models;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace FinCore.Api.Services.NotificationService
{
    public class BrevoNotificationService : INotificationService, IEmailService
    {
        private readonly HttpClient _httpClient;
        private readonly ILogger<BrevoNotificationService> _logger;
        private readonly string? _apiKey;
        private readonly string _senderEmail;
        private readonly string _senderName;
        private const string BrevoEndpoint = "https://api.brevo.com/v3/smtp/email";

        public BrevoNotificationService(
            HttpClient? httpClient = null,
            IConfiguration? configuration = null,
            ILogger<BrevoNotificationService>? logger = null)
        {
            _httpClient = httpClient ?? new HttpClient();
            _logger = logger ?? Microsoft.Extensions.Logging.Abstractions.NullLogger<BrevoNotificationService>.Instance;
            _apiKey = configuration?["Brevo:ApiKey"] ?? configuration?["Brevo__ApiKey"] ?? "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";
            _senderEmail = configuration?["Brevo:SenderEmail"] ?? configuration?["Brevo__SenderEmail"] ?? "shalithakaru2003@gmail.com";
            _senderName = configuration?["Brevo:SenderName"] ?? configuration?["Brevo__SenderName"] ?? "FinCore Security";
        }

        public async Task<Notification> SendNotificationAsync(int userId, string recipient, string recipientName, string type, string message)
        {
            var result = await SendEmailAsync(recipient, recipientName, "FinCore Security Notification", $"<p>{message}</p>", message);

            return new Notification
            {
                UserId = userId,
                Recipient = recipient,
                RecipientName = string.IsNullOrWhiteSpace(recipientName) ? "User" : recipientName,
                Type = "Email",
                Message = message,
                DeliveryStatus = result.Success ? "Sent" : "Failed",
                ChannelDetails = result.Success ? $"Brevo API (MessageId: {result.MessageId})" : $"Brevo Error: {result.ErrorMessage}",
                LatencyMs = 280,
                Timestamp = DateTime.UtcNow
            };
        }

        public async Task<EmailSendResult> SendEmailAsync(string toEmail, string recipientName, string subject, string htmlContent, string? textContent = null)
        {
            if (string.IsNullOrWhiteSpace(toEmail))
            {
                return new EmailSendResult(false, null, "Recipient email is required.");
            }

            if (string.IsNullOrWhiteSpace(_apiKey))
            {
                _logger.LogWarning("[Brevo Mock] ApiKey not provided. Skipping live HTTP dispatch to {Email}", toEmail);
                return new EmailSendResult(true, "MOCK_MSG_" + Guid.NewGuid().ToString("N")[..8], null);
            }

            try
            {
                var payload = new
                {
                    sender = new { name = _senderName, email = _senderEmail },
                    to = new[] { new { email = toEmail.Trim(), name = string.IsNullOrWhiteSpace(recipientName) ? "Customer" : recipientName } },
                    subject = subject,
                    htmlContent = htmlContent,
                    textContent = textContent ?? subject
                };

                using var request = new HttpRequestMessage(HttpMethod.Post, BrevoEndpoint);
                request.Headers.Add("api-key", _apiKey);
                request.Headers.Add("Accept", "application/json");
                request.Content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");

                var response = await _httpClient.SendAsync(request);
                var responseBody = await response.Content.ReadAsStringAsync();

                if (response.IsSuccessStatusCode)
                {
                    using var doc = JsonDocument.Parse(responseBody);
                    string? messageId = doc.RootElement.TryGetProperty("messageId", out var prop) ? prop.GetString() : null;
                    Console.WriteLine($"[Brevo Email] OTP email dispatched successfully to {toEmail} (MessageId: {messageId})");
                    _logger.LogInformation("Brevo Email dispatched successfully to {To}. MessageId: {MsgId}", toEmail, messageId);
                    return new EmailSendResult(true, messageId, null);
                }
                else if ((int)response.StatusCode == 429)
                {
                    Console.WriteLine($"[Brevo Email Error] Rate limit exceeded (HTTP 429) for recipient {toEmail}");
                    _logger.LogWarning("Brevo rate limit exceeded (HTTP 429) for recipient {To}. Response: {Resp}", toEmail, responseBody);
                    return new EmailSendResult(false, null, "Brevo rate limit exceeded (HTTP 429).");
                }
                else
                {
                    Console.WriteLine($"[Brevo Email Error] HTTP {response.StatusCode} for recipient {toEmail}: {responseBody}");
                    _logger.LogError("Brevo API failed with HTTP {Status} for recipient {To}: {Resp}", response.StatusCode, toEmail, responseBody);
                    return new EmailSendResult(false, null, $"Brevo Error HTTP {response.StatusCode}: {responseBody}");
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[Brevo Email Error] Exception communicating with Brevo: {ex.Message}");
                _logger.LogError(ex, "Unexpected error communicating with Brevo API for recipient {To}", toEmail);
                return new EmailSendResult(false, null, $"Transport error: {ex.Message}");
            }
        }

        public Task<EmailSendResult> SendOtpEmailAsync(string toEmail, string recipientName, string otpCode, int expirationMinutes = 5)
        {
            var displayName = string.IsNullOrWhiteSpace(recipientName) ? "Customer" : recipientName;
            var subject = $"FinCore Security: Your Verification Code is {otpCode}";

            var html = $@"
<!DOCTYPE html>
<html>
<head>
  <meta charset='utf-8'/>
  <style>
    body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b; }}
    .card {{ background-color: #ffffff; max-width: 500px; margin: 0 auto; border-radius: 12px; border: 1px solid #e2e8f0; padding: 36px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }}
    .header {{ font-size: 24px; font-weight: 800; color: #2563eb; margin-bottom: 20px; }}
    .title {{ font-size: 18px; font-weight: 600; color: #0f172a; margin-bottom: 12px; }}
    .otp-box {{ background-color: #f1f5f9; border-radius: 8px; padding: 18px; text-align: center; margin: 24px 0; border: 1px dashed #cbd5e1; }}
    .otp-code {{ font-size: 38px; font-weight: 800; letter-spacing: 8px; color: #1e293b; font-family: monospace; }}
    .notice {{ font-size: 14px; color: #64748b; line-height: 1.5; }}
    .footer {{ font-size: 12px; color: #94a3b8; margin-top: 32px; border-top: 1px solid #e2e8f0; padding-top: 16px; }}
  </style>
</head>
<body>
  <div class='card'>
    <div class='header'>FinCore Banking</div>
    <div class='title'>Verification Code Required</div>
    <p class='notice'>Hello <strong>{displayName}</strong>,</p>
    <p class='notice'>You requested a security verification code to access your FinCore account. Enter this code to proceed:</p>
    <div class='otp-box'>
      <span class='otp-code'>{otpCode}</span>
    </div>
    <p class='notice'>This code will expire in <strong>{expirationMinutes} minutes</strong>. If you did not make this request, please change your password immediately.</p>
    <div class='footer'>FinCore Identity & Access Security Subsystem • Automated Message</div>
  </div>
</body>
</html>";

            var text = $"FinCore Security: Your verification code is {otpCode}. Valid for {expirationMinutes} minutes.";
            return SendEmailAsync(toEmail, displayName, subject, html, text);
        }

        public Task<EmailSendResult> SendStepUpOtpEmailAsync(string toEmail, string recipientName, string otpCode, decimal amount, string? recipientAccount, int expirationMinutes = 10)
        {
            var displayName = string.IsNullOrWhiteSpace(recipientName) ? "Valued Customer" : recipientName;
            var subject = $"FinCore Security: Step-Up Verification Code for Rs. {amount:N2} LKR is {otpCode}";

            var recipientInfo = !string.IsNullOrWhiteSpace(recipientAccount)
                ? $"<div style='display:flex;justify-content:space-between;margin-top:6px;color:#475569;'><span>Recipient:</span><span style='font-weight:600;color:#0f172a;'>{recipientAccount}</span></div>"
                : "";

            var html = $@"
<!DOCTYPE html>
<html>
<head>
  <meta charset='utf-8'/>
  <style>
    body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b; }}
    .card {{ background-color: #ffffff; max-width: 500px; margin: 0 auto; border-radius: 12px; border: 1px solid #e2e8f0; padding: 32px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }}
    .header {{ font-size: 22px; font-weight: 800; color: #2563eb; margin-bottom: 6px; }}
    .badge {{ display: inline-block; background-color: #fef3c7; color: #b45309; font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 6px; margin-bottom: 16px; border: 1px solid #fde68a; }}
    .title {{ font-size: 17px; font-weight: 700; color: #0f172a; margin-bottom: 12px; }}
    .details {{ background-color: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; padding: 14px; margin: 16px 0; font-size: 13px; }}
    .details-row {{ display: flex; justify-content: space-between; color: #475569; }}
    .details-val {{ font-weight: 700; color: #15803d; }}
    .otp-box {{ background-color: #eff6ff; border-radius: 8px; padding: 18px; text-align: center; margin: 20px 0; border: 1px dashed #93c5fd; }}
    .otp-code {{ font-size: 38px; font-weight: 800; letter-spacing: 8px; color: #1d4ed8; font-family: monospace; }}
    .notice {{ font-size: 13.5px; color: #475569; line-height: 1.5; }}
    .footer {{ font-size: 12px; color: #94a3b8; margin-top: 28px; border-top: 1px solid #e2e8f0; padding-top: 14px; }}
  </style>
</head>
<body>
  <div class='card'>
    <div class='header'>FinCore Online Banking</div>
    <div class='badge'>Step-Up Security Challenge</div>
    <div class='title'>Authorize Transfer with Verification Code</div>
    <p class='notice'>Hello <strong>{displayName}</strong>,</p>
    <p class='notice'>A transfer request was flagged by our real-time security engine for step-up verification. To authorize this transaction, enter the 6-digit code below into your FinCore app:</p>
    
    <div class='details'>
      <div class='details-row'><span>Transfer Amount:</span> <span class='details-val'>Rs. {amount:N2} LKR</span></div>
      {recipientInfo}
    </div>

    <div class='otp-box'>
      <span class='otp-code'>{otpCode}</span>
    </div>
    <p class='notice'>This code is valid for <strong>{expirationMinutes} minutes</strong>. If you did not initiate this transaction, please contact customer protection immediately.</p>
    <div class='footer'>FinCore Risk Mitigation Subsystem • Security Gateway Automated Dispatch</div>
  </div>
</body>
</html>";

            var text = $"FinCore Security Challenge: Your verification code for Rs. {amount:N2} LKR transfer is {otpCode}. Valid for {expirationMinutes} minutes.";
            return SendEmailAsync(toEmail, displayName, subject, html, text);
        }
    }
}
