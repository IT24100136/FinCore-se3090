using System;
using System.Collections.Generic;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using FinCore.Api.Models;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace FinCore.Api.Services
{
    public class MockNotificationService : INotificationService
    {
        private readonly ILogger<MockNotificationService> _logger;

        public MockNotificationService(ILogger<MockNotificationService> logger)
        {
            _logger = logger;
        }

        public Task<bool> SendNotificationAsync(Notification notification)
        {
            _logger.LogInformation(
                "[MOCK NOTIFICATION] Type: {Type} | Recipient: {Recipient} | Subject: {Subject} | Message: {Message}",
                notification.Type, notification.Recipient, notification.Subject, notification.Message);

            notification.Provider = "Mock";
            notification.Status = "Sent";
            notification.SentAt = DateTime.UtcNow;

            return Task.FromResult(true);
        }
    }

    public class BrevoNotificationService : INotificationService
    {
        private readonly HttpClient _httpClient;
        private readonly IConfiguration _config;
        private readonly ILogger<BrevoNotificationService> _logger;

        public BrevoNotificationService(HttpClient httpClient, IConfiguration config, ILogger<BrevoNotificationService> logger)
        {
            _httpClient = httpClient;
            _config = config;
            _logger = logger;
        }

        public async Task<bool> SendNotificationAsync(Notification notification)
        {
            var apiKey = _config["NotificationSettings:BrevoApiKey"];
            var senderEmail = _config["NotificationSettings:SenderEmail"] ?? "no-reply@fincore.com";
            var senderName = _config["NotificationSettings:SenderName"] ?? "FinCore Notifications";

            if (string.IsNullOrWhiteSpace(apiKey))
            {
                _logger.LogWarning("Brevo API key is not configured. Falling back to mock dispatch.");
                notification.Provider = "Brevo (Unconfigured)";
                notification.Status = "Failed";
                notification.ErrorDetails = "Brevo API key missing in configuration";
                return false;
            }

            try
            {
                var payload = new
                {
                    sender = new { name = senderName, email = senderEmail },
                    to = new[] { new { email = notification.Recipient } },
                    subject = string.IsNullOrWhiteSpace(notification.Subject) ? "FinCore Security Alert" : notification.Subject,
                    htmlContent = $"<p>{notification.Message}</p>"
                };

                var request = new HttpRequestMessage(HttpMethod.Post, "https://api.brevo.com/v3/smtp/email")
                {
                    Content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json")
                };
                request.Headers.Add("api-key", apiKey);

                var response = await _httpClient.SendAsync(request);
                if (response.IsSuccessStatusCode)
                {
                    notification.Provider = "Brevo";
                    notification.Status = "Sent";
                    notification.SentAt = DateTime.UtcNow;
                    return true;
                }

                var errorContent = await response.Content.ReadAsStringAsync();
                _logger.LogError("Brevo notification dispatch failed with status code {StatusCode}: {Error}", response.StatusCode, errorContent);

                notification.Provider = "Brevo";
                notification.Status = "Failed";
                notification.ErrorDetails = $"HTTP {(int)response.StatusCode}: {errorContent}";
                return false;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Exception encountered while dispatching Brevo email notification");
                notification.Provider = "Brevo";
                notification.Status = "Failed";
                notification.ErrorDetails = ex.Message;
                return false;
            }
        }
    }

    public class TwilioNotificationService : INotificationService
    {
        private readonly HttpClient _httpClient;
        private readonly IConfiguration _config;
        private readonly ILogger<TwilioNotificationService> _logger;

        public TwilioNotificationService(HttpClient httpClient, IConfiguration config, ILogger<TwilioNotificationService> logger)
        {
            _httpClient = httpClient;
            _config = config;
            _logger = logger;
        }

        public async Task<bool> SendNotificationAsync(Notification notification)
        {
            var accountSid = _config["NotificationSettings:TwilioAccountSid"];
            var authToken = _config["NotificationSettings:TwilioAuthToken"];
            var fromNumber = _config["NotificationSettings:TwilioFromPhoneNumber"];

            if (string.IsNullOrWhiteSpace(accountSid) || string.IsNullOrWhiteSpace(authToken) || string.IsNullOrWhiteSpace(fromNumber))
            {
                _logger.LogWarning("Twilio credentials are missing in configuration.");
                notification.Provider = "Twilio (Unconfigured)";
                notification.Status = "Failed";
                notification.ErrorDetails = "Twilio credentials missing in configuration";
                return false;
            }

            try
            {
                var requestUrl = $"https://api.twilio.com/2010-04-01/Accounts/{accountSid}/Messages.json";
                var formValues = new Dictionary<string, string>
                {
                    { "From", fromNumber },
                    { "To", notification.Recipient },
                    { "Body", notification.Message }
                };

                var request = new HttpRequestMessage(HttpMethod.Post, requestUrl)
                {
                    Content = new FormUrlEncodedContent(formValues)
                };

                var byteArray = Encoding.ASCII.GetBytes($"{accountSid}:{authToken}");
                request.Headers.Authorization = new AuthenticationHeaderValue("Basic", Convert.ToBase64String(byteArray));

                var response = await _httpClient.SendAsync(request);
                if (response.IsSuccessStatusCode)
                {
                    notification.Provider = "Twilio";
                    notification.Status = "Sent";
                    notification.SentAt = DateTime.UtcNow;
                    return true;
                }

                var errorContent = await response.Content.ReadAsStringAsync();
                _logger.LogError("Twilio SMS dispatch failed with status code {StatusCode}: {Error}", response.StatusCode, errorContent);

                notification.Provider = "Twilio";
                notification.Status = "Failed";
                notification.ErrorDetails = $"HTTP {(int)response.StatusCode}: {errorContent}";
                return false;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Exception encountered while dispatching Twilio SMS notification");
                notification.Provider = "Twilio";
                notification.Status = "Failed";
                notification.ErrorDetails = ex.Message;
                return false;
            }
        }
    }
}
