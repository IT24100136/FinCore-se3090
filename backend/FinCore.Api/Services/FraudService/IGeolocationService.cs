using System.Text.Json.Serialization;
using System.Threading;
using System.Threading.Tasks;

namespace FinCore.Api.Services.FraudService
{
    /// <summary>
    /// Represents the geographic location details resolved from an IP address.
    /// </summary>
    public class GeolocationResult
    {
        [JsonPropertyName("city")]
        public string City { get; set; } = "Unknown";

        [JsonPropertyName("region")]
        public string Region { get; set; } = "Unknown";

        [JsonPropertyName("country_name")]
        public string CountryName { get; set; } = "Unknown Location";

        [JsonPropertyName("latitude")]
        public double? Latitude { get; set; }

        [JsonPropertyName("longitude")]
        public double? Longitude { get; set; }

        [JsonPropertyName("ip")]
        public string IpAddress { get; set; } = string.Empty;

        [JsonPropertyName("error")]
        public bool? Error { get; set; }

        [JsonPropertyName("reason")]
        public string? Reason { get; set; }

        [JsonIgnore]
        public bool IsSuccessful { get; set; } = true;

        /// <summary>
        /// Provides a safe fallback instance representing an unknown location.
        /// </summary>
        public static GeolocationResult DefaultUnknown => new()
        {
            City = "Unknown",
            Region = "Unknown",
            CountryName = "Unknown Location",
            Latitude = null,
            Longitude = null,
            IpAddress = string.Empty,
            IsSuccessful = false
        };

        /// <summary>
        /// Creates a safe fallback instance with the specified IP address.
        /// </summary>
        public static GeolocationResult CreateDefaultUnknown(string? ip = null) => new()
        {
            City = "Unknown",
            Region = "Unknown",
            CountryName = "Unknown Location",
            Latitude = null,
            Longitude = null,
            IpAddress = ip ?? string.Empty,
            IsSuccessful = false
        };
    }

    /// <summary>
    /// Service contract for IP-based geolocation lookup used in fraud scoring and behavioral analysis.
    /// </summary>
    public interface IGeolocationService
    {
        /// <summary>
        /// Resolves geolocation data for a given IP address.
        /// </summary>
        /// <param name="ipAddress">The IP address to look up.</param>
        /// <param name="cancellationToken">Optional cancellation token.</param>
        /// <returns>A <see cref="GeolocationResult"/> containing location details or safe fallback values.</returns>
        Task<GeolocationResult> GetLocationAsync(string ipAddress, CancellationToken cancellationToken = default);

        /// <summary>
        /// Resolves geolocation data for a given IP address.
        /// </summary>
        /// <param name="ipAddress">The IP address to look up.</param>
        /// <param name="cancellationToken">Optional cancellation token.</param>
        /// <returns>A <see cref="GeolocationResult"/> containing location details or safe fallback values.</returns>
        Task<GeolocationResult> GetLocationByIpAsync(string ipAddress, CancellationToken cancellationToken = default);
    }
}
