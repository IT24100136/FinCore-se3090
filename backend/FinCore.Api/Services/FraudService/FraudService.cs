using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using System.Net.Http.Json;
using System.Threading;
using System.Threading.Tasks;
using FinCore.Api.Data;
using FinCore.Api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace FinCore.Api.Services.FraudService
{
    /// <summary>
    /// Evaluates transaction risk against database rule thresholds, geolocation behavioral signals,
    /// and AI-powered anomaly detection via Microsoft Semantic Kernel.
    /// </summary>
    public class FraudService : IFraudService
    {
        private readonly ApplicationDbContext _context;
        private readonly IGeolocationService _geolocationService;
        private readonly IAnomalyDetectionAgent _anomalyDetectionAgent;
        private readonly ILogger<FraudService> _logger;
        private readonly HttpClient _httpClient;

        public FraudService(
            ApplicationDbContext context,
            IGeolocationService geolocationService,
            IAnomalyDetectionAgent anomalyDetectionAgent,
            ILogger<FraudService> logger,
            HttpClient httpClient)
        {
            _context = context ?? throw new ArgumentNullException(nameof(context));
            _geolocationService = geolocationService ?? throw new ArgumentNullException(nameof(geolocationService));
            _anomalyDetectionAgent = anomalyDetectionAgent ?? throw new ArgumentNullException(nameof(anomalyDetectionAgent));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
            _httpClient = httpClient ?? throw new ArgumentNullException(nameof(httpClient));
        }

        /// <inheritdoc />
        public Task<FraudFlag> EvaluateTransactionAsync(int transactionId, decimal amount, string ipAddress)
        {
            return EvaluateTransactionAsync(transactionId, amount, ipAddress, CancellationToken.None);
        }

        /// <inheritdoc />
        public async Task<FraudFlag> EvaluateTransactionAsync(
            int transactionId,
            decimal amount,
            string ipAddress,
            CancellationToken cancellationToken)
        {
            _logger.LogInformation(
                "Starting fraud evaluation for transaction ID: {TransactionId}, Amount: {Amount}, IP: {IpAddress}",
                transactionId, amount, ipAddress);

            // 1. Fetch active RuleThresholds from the database
            var activeThresholds = await _context.RuleThresholds
                .Where(r => r.IsActive)
                .ToListAsync(cancellationToken);

            // 2. Resolve origin using IGeolocationService
            var location = await _geolocationService.GetLocationAsync(ipAddress, cancellationToken);

            // 3. Initialize RiskScore and list of Reasons
            int riskScore = 0;
            var reasons = new List<string>();

            // 4. Evaluate Transaction Amount against threshold
            var highAmountRule = activeThresholds.FirstOrDefault(r =>
                string.Equals(r.RuleName, "HighAmount", StringComparison.OrdinalIgnoreCase));

            decimal highAmountThreshold = highAmountRule?.ThresholdValue ?? 10000m;

            if (amount > highAmountThreshold)
            {
                riskScore += 50;
                reasons.Add($"Transaction amount ({amount:C}) exceeds HighAmount threshold ({highAmountThreshold:C}).");
            }

            // 5. Evaluate Geolocation signals
            if (!location.IsSuccessful || string.Equals(location.CountryName, "Unknown Location", StringComparison.OrdinalIgnoreCase))
            {
                riskScore += 30;
                reasons.Add($"Geolocation resolution unresolved or fallback triggered for IP address '{ipAddress}'.");
            }
            else
            {
                // Check if the transaction originated from a foreign / non-domestic location
                bool isDomestic = string.Equals(location.CountryName, "United States", StringComparison.OrdinalIgnoreCase) ||
                                  string.Equals(location.CountryName, "US", StringComparison.OrdinalIgnoreCase);

                if (!isDomestic)
                {
                    riskScore += 25;
                    reasons.Add($"Transaction originated from foreign/cross-border region: {location.City}, {location.Region}, {location.CountryName}.");
                }
            }

            // 6. Evaluate AI Behavioral Anomaly Risk via Semantic Kernel Agent
            string timeOfDay = DateTime.Now.ToString("hh:mm tt");
            int aiScore = await _anomalyDetectionAgent.AnalyzeBehavioralRiskAsync(
                transactionId, amount, ipAddress, timeOfDay, cancellationToken);

            if (aiScore > 0)
            {
                riskScore += aiScore;
                reasons.Add($"AI Behavioral Analysis added {aiScore} risk points.");
            }

            // 7. Determine Status based on final score (< 40 = Approved, >= 40 = Flagged)
            var flagThresholdRule = activeThresholds.FirstOrDefault(r =>
                string.Equals(r.RuleName, "FlagThreshold", StringComparison.OrdinalIgnoreCase) ||
                string.Equals(r.RuleName, "RiskScoreThreshold", StringComparison.OrdinalIgnoreCase));

            int flagThreshold = flagThresholdRule != null && flagThresholdRule.ThresholdValue > 0
                ? (int)flagThresholdRule.ThresholdValue
                : 40;

            string status = riskScore >= flagThreshold ? "Flagged" : "Approved";
            string concatenatedReasons = reasons.Count > 0
                ? string.Join("; ", reasons)
                : "Transaction within normal parameters.";

            // 8. Instantiate new FraudFlag entity
            var fraudFlag = new FraudFlag
            {
                TransactionId = transactionId,
                RiskScore = riskScore,
                Reasons = concatenatedReasons,
                Status = status,
                CreatedAt = DateTime.UtcNow
            };

            // 9. POST transaction telemetry to Python SHAP service if Flagged
            if (status == "Flagged")
            {
                try
                {
                    // -------------------------------------------------------------
                    // Impossible Travel (Velocity of Travel) Telemetry Preparation
                    // -------------------------------------------------------------
                    // Current transaction coordinates (resolved from IP geolocation or standard fallback)
                    double currentLat = location.Latitude ?? 6.9271;
                    double currentLon = location.Longitude ?? 79.8612;
                    string currentTimestamp = DateTime.UtcNow.ToString("o"); // ISO 8601 UTC format

                    // Simulated previous transaction telemetry for testing Impossible Travel (> 900 km/h)
                    // Simulates a transaction in London (~5,400+ km away from Colombo) occurring 1 hour ago
                    double prevTxLat = 51.5074;
                    double prevTxLon = -0.1278;
                    string prevTxTimestamp = DateTime.UtcNow.AddHours(-1).ToString("o");

                    // Construct anonymous payload expected by the Python Agent / SHAP service
                    var shapPayload = new
                    {
                        transaction_id = transactionId.ToString(),
                        amount = (double)amount,
                        prev_tx_lat = prevTxLat,
                        prev_tx_lon = prevTxLon,
                        prev_tx_timestamp = prevTxTimestamp,
                        current_lat = currentLat,
                        current_lon = currentLon,
                        current_timestamp = currentTimestamp,
                        features = new Dictionary<string, double>
                        {
                            { "amount", (double)amount },
                            { "ip_distance_km", location.IsSuccessful ? 0.0 : 1250.0 },
                            { "is_new_device", 1.0 },
                            { "tx_count_24h", 3.0 },
                            { "amount_to_avg_ratio", (double)(amount / 15000m) },
                            { "prev_tx_lat", prevTxLat },
                            { "prev_tx_lon", prevTxLon },
                            { "current_lat", currentLat },
                            { "current_lon", currentLon }
                        }
                    };

                    var response = await _httpClient.PostAsJsonAsync("http://localhost:8001/api/fraud/explain", shapPayload, cancellationToken);
                    
                    if (response.IsSuccessStatusCode)
                    {
                        var shapResult = await response.Content.ReadFromJsonAsync<ShapResponseDto>(cancellationToken: cancellationToken);
                        
                        if (shapResult != null && !string.IsNullOrEmpty(shapResult.PrimaryShapFeature))
                        {
                            // Extracted standardized reason: "location_anomaly" | "high_velocity" | "high_amount"
                            string primaryShap = shapResult.PrimaryShapFeature;
                            fraudFlag.Reasons += $"; Primary SHAP Driver: {primaryShap}";
                        }
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Failed to reach Python SHAP explainability service for Transaction {TransactionId}", transactionId);
                }
            }

            // 10. Persist to database and return
            _context.FraudFlags.Add(fraudFlag);
            await _context.SaveChangesAsync(cancellationToken);

            _logger.LogInformation(
                "Completed fraud evaluation for transaction ID {TransactionId}: RiskScore={RiskScore}, Status={Status}",
                transactionId, riskScore, status);

            return fraudFlag;
        }
    }

    // DTO mapping for the JSON response from the Python microservice
    public class ShapResponseDto
    {
        public string PrimaryShapFeature { get; set; } = string.Empty;
    }
}