using System;
using System.Net;
using System.Net.Http;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;

namespace FinCore.Api.Services.FraudService
{
    /// <summary>
    /// Service implementation for IP-based geolocation lookup via ipapi.co with resilient fallback.
    /// </summary>
    public class GeolocationService : IGeolocationService
    {
        private readonly HttpClient _httpClient;
        private readonly ILogger<GeolocationService> _logger;
        private readonly TimeSpan _timeout;

        private static readonly JsonSerializerOptions JsonOptions = new()
        {
            PropertyNameCaseInsensitive = true,
            NumberHandling = JsonNumberHandling.AllowReadingFromString
        };

        public GeolocationService(HttpClient httpClient, ILogger<GeolocationService> logger)
        {
            _httpClient = httpClient ?? throw new ArgumentNullException(nameof(httpClient));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
            _timeout = TimeSpan.FromSeconds(3);
        }

        /// <inheritdoc />
        public async Task<GeolocationResult> GetLocationAsync(string ipAddress, CancellationToken cancellationToken = default)
        {
            if (string.IsNullOrWhiteSpace(ipAddress))
            {
                _logger.LogWarning("IP address is null, empty, or whitespace. Returning default unknown location.");
                return GeolocationResult.CreateDefaultUnknown(ipAddress);
            }

            var cleanIp = ipAddress.Trim();

            // Detect localhost / loopback addresses that cannot be resolved externally
            if (cleanIp == "127.0.0.1" || cleanIp == "::1" || cleanIp.Equals("localhost", StringComparison.OrdinalIgnoreCase))
            {
                _logger.LogInformation("Local loopback IP address {IpAddress} detected. Returning default unknown location.", cleanIp);
                return GeolocationResult.CreateDefaultUnknown(cleanIp);
            }

            var requestUrl = $"https://ipapi.co/{Uri.EscapeDataString(cleanIp)}/json/";

            using var timeoutCts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
            timeoutCts.CancelAfter(_timeout);

            try
            {
                using var request = new HttpRequestMessage(HttpMethod.Get, requestUrl);
                // ipapi.co requires a User-Agent header; requests without it can be rejected with HTTP 403 Forbidden
                request.Headers.UserAgent.ParseAdd("FinCore-FraudEngine/1.0");

                using var response = await _httpClient.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, timeoutCts.Token);

                // Handle rate limiting (HTTP 429)
                if (response.StatusCode == HttpStatusCode.TooManyRequests)
                {
                    _logger.LogWarning("ipapi.co rate limit reached (HTTP 429) for IP {IpAddress}. Returning fallback location.", cleanIp);
                    return GeolocationResult.CreateDefaultUnknown(cleanIp);
                }

                // Handle other HTTP failure status codes
                if (!response.IsSuccessStatusCode)
                {
                    _logger.LogWarning("ipapi.co returned non-success HTTP status {StatusCode} for IP {IpAddress}. Returning fallback location.",
                        response.StatusCode, cleanIp);
                    return GeolocationResult.CreateDefaultUnknown(cleanIp);
                }

                var contentStream = await response.Content.ReadAsStreamAsync(timeoutCts.Token);
                var result = await JsonSerializer.DeserializeAsync<GeolocationResult>(contentStream, JsonOptions, timeoutCts.Token);

                if (result == null)
                {
                    _logger.LogWarning("ipapi.co returned empty content for IP {IpAddress}. Returning fallback location.", cleanIp);
                    return GeolocationResult.CreateDefaultUnknown(cleanIp);
                }

                // Handle API-level error responses (e.g., {"error": true, "reason": "RateLimited"})
                if (result.Error == true)
                {
                    _logger.LogWarning("ipapi.co returned API error for IP {IpAddress}. Reason: {Reason}. Returning fallback location.",
                        cleanIp, result.Reason ?? "Unknown API Error");
                    return GeolocationResult.CreateDefaultUnknown(cleanIp);
                }

                // Normalize fields and ensure safe defaults
                result.IpAddress = cleanIp;
                result.City = string.IsNullOrWhiteSpace(result.City) ? "Unknown" : result.City;
                result.Region = string.IsNullOrWhiteSpace(result.Region) ? "Unknown" : result.Region;
                result.CountryName = string.IsNullOrWhiteSpace(result.CountryName) ? "Unknown Location" : result.CountryName;
                result.IsSuccessful = true;

                _logger.LogInformation("Successfully resolved geolocation for IP {IpAddress}: {City}, {Region}, {CountryName} ({Latitude}, {Longitude})",
                    cleanIp, result.City, result.Region, result.CountryName, result.Latitude, result.Longitude);

                return result;
            }
            catch (OperationCanceledException ex)
            {
                if (cancellationToken.IsCancellationRequested)
                {
                    _logger.LogInformation("Geolocation lookup for IP {IpAddress} was cancelled by caller.", cleanIp);
                }
                else
                {
                    _logger.LogWarning(ex, "Geolocation lookup for IP {IpAddress} timed out after {TimeoutSeconds}s. Returning fallback location.",
                        cleanIp, _timeout.TotalSeconds);
                }

                return GeolocationResult.CreateDefaultUnknown(cleanIp);
            }
            catch (HttpRequestException ex)
            {
                _logger.LogWarning(ex, "HTTP network error while calling ipapi.co for IP {IpAddress}. Returning fallback location.", cleanIp);
                return GeolocationResult.CreateDefaultUnknown(cleanIp);
            }
            catch (JsonException ex)
            {
                _logger.LogWarning(ex, "Failed to deserialize JSON response from ipapi.co for IP {IpAddress}. Returning fallback location.", cleanIp);
                return GeolocationResult.CreateDefaultUnknown(cleanIp);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Unexpected error occurred during geolocation lookup for IP {IpAddress}. Returning fallback location.", cleanIp);
                return GeolocationResult.CreateDefaultUnknown(cleanIp);
            }
        }

        /// <inheritdoc />
        public Task<GeolocationResult> GetLocationByIpAsync(string ipAddress, CancellationToken cancellationToken = default)
        {
            return GetLocationAsync(ipAddress, cancellationToken);
        }
    }
}
