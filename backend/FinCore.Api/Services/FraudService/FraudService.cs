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
            bool isLocalOrLoopback = string.IsNullOrWhiteSpace(ipAddress) ||
                                     ipAddress == "127.0.0.1" || ipAddress == "::1" ||
                                     ipAddress.Equals("localhost", StringComparison.OrdinalIgnoreCase) ||
                                     ipAddress.StartsWith("10.0.2.") || ipAddress.StartsWith("192.168.") || ipAddress.StartsWith("10.");

            if (!isLocalOrLoopback && (!location.IsSuccessful || string.Equals(location.CountryName, "Unknown Location", StringComparison.OrdinalIgnoreCase)))
            {
                riskScore += 30;
                reasons.Add($"Geolocation resolution unresolved or fallback triggered for IP address '{ipAddress}'.");
            }
            else if (!isLocalOrLoopback)
            {
                // Check if the transaction originated from a foreign / non-domestic location
                bool isDomestic = string.Equals(location.CountryName, "United States", StringComparison.OrdinalIgnoreCase) ||
                                  string.Equals(location.CountryName, "US", StringComparison.OrdinalIgnoreCase) ||
                                  string.Equals(location.CountryName, "Sri Lanka", StringComparison.OrdinalIgnoreCase) ||
                                  string.Equals(location.CountryName, "LK", StringComparison.OrdinalIgnoreCase);

                if (!isDomestic)
                {
                    riskScore += 25;
                    reasons.Add($"Transaction originated from foreign/cross-border region: {location.City}, {location.Region}, {location.CountryName}.");
                }
            }

            // 6. Multi-Agent Cooperative AI Pipeline Orchestration (Agents 1-4)
            // Agent 1: Transaction Analysis Agent (Spending Profile & 90d Window Expansion)
            // Agent 2: Anomaly Detection Agent (LangGraph Behavioral Signals & Deep Context)
            // Agent 3: Human-Approval Coordinator Agent (Policies, Dual Approval, & Resolution Path)
            // Agent 4: Tool-Use Agent (Security Notification Dispatch & Telemetry)
            bool agentPipelineExecuted = false;
            MultiAgentResponseDto? agentResponse = null;

            try
            {
                var tx = await _context.Transactions
                    .AsNoTracking()
                    .FirstOrDefaultAsync(t => t.Id == transactionId, cancellationToken);

                int senderUserId = 1;
                string recipientIdentifier = "external_recipient";
                int velocity24h = 1;
                string transactionNote = tx?.Note ?? "";

                if (tx != null)
                {
                    var senderWallet = await _context.Wallets
                        .AsNoTracking()
                        .FirstOrDefaultAsync(w => w.Id == tx.SenderWalletId, cancellationToken);
                    if (senderWallet != null)
                    {
                        senderUserId = senderWallet.UserId;
                    }

                    if (tx.ReceiverWalletId.HasValue)
                    {
                        var receiverWallet = await _context.Wallets
                            .AsNoTracking()
                            .FirstOrDefaultAsync(w => w.Id == tx.ReceiverWalletId.Value, cancellationToken);
                        recipientIdentifier = receiverWallet != null
                            ? receiverWallet.UserId.ToString()
                            : tx.ReceiverWalletId.Value.ToString();
                    }

                    velocity24h = await _context.Transactions
                        .CountAsync(t => t.SenderWalletId == tx.SenderWalletId && t.Timestamp >= DateTime.UtcNow.AddHours(-24), cancellationToken);
                    if (velocity24h < 1) velocity24h = 1;
                }

                double currentLat = location.Latitude ?? 6.9271;
                double currentLon = location.Longitude ?? 79.8612;

                var deviceSession = await _context.DeviceSessions
                    .AsNoTracking()
                    .OrderByDescending(d => d.LastLoginAt)
                    .FirstOrDefaultAsync(d => d.UserId == senderUserId, cancellationToken);

                string activeDeviceId = deviceSession != null && !string.IsNullOrWhiteSpace(deviceSession.DeviceFingerprint)
                    ? deviceSession.DeviceFingerprint
                    : $"mobile_device_usr_{senderUserId}";

                var multiAgentPayload = new
                {
                    transaction_id = tx?.ReferenceId ?? transactionId.ToString(),
                    user_id = senderUserId.ToString(),
                    amount = (double)amount,
                    recipient_id = recipientIdentifier,
                    note = transactionNote,
                    ip_address = ipAddress,
                    device_id = activeDeviceId,
                    velocity_24h = velocity24h,
                    current_lat = currentLat,
                    current_lon = currentLon,
                    current_timestamp = DateTime.UtcNow.ToString("o")
                };

                var httpResponse = await _httpClient.PostAsJsonAsync(
                    "http://localhost:8000/api/agents/evaluate",
                    multiAgentPayload,
                    cancellationToken);

                if (httpResponse.IsSuccessStatusCode)
                {
                    agentResponse = await httpResponse.Content.ReadFromJsonAsync<MultiAgentResponseDto>(
                        cancellationToken: cancellationToken);

                    if (agentResponse != null)
                    {
                        agentPipelineExecuted = true;
                        _logger.LogInformation(
                            "Multi-Agent Evaluation successful for TX {TransactionId}: Decision={Decision}, CompositeRisk={Risk}",
                            transactionId, agentResponse.Decision, agentResponse.CompositeRiskScore);
                    }
                }
                else
                {
                    _logger.LogWarning("Multi-Agent endpoint returned status {StatusCode}, applying deterministic fallback.", httpResponse.StatusCode);
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to reach Multi-Agent FastAPI service on port 8000 for Transaction {TransactionId}. Applying Circuit Breaker fallback.", transactionId);
            }

            // 7. Resolve Final Risk Score, Status, and Reasons
            var flagThresholdRule = activeThresholds.FirstOrDefault(r =>
                string.Equals(r.RuleName, "FlagThreshold", StringComparison.OrdinalIgnoreCase) ||
                string.Equals(r.RuleName, "RiskScoreThreshold", StringComparison.OrdinalIgnoreCase));

            int flagThreshold = flagThresholdRule != null && flagThresholdRule.ThresholdValue > 0
                ? (int)flagThresholdRule.ThresholdValue
                : 40;

            string status;

            if (agentPipelineExecuted && agentResponse != null)
            {
                // Incorporate Multi-Agent Score
                riskScore = (int)Math.Round(agentResponse.CompositeRiskScore);

                // Merge agent reasons
                foreach (var r in agentResponse.Reasons)
                {
                    if (!string.IsNullOrWhiteSpace(r) && !reasons.Contains(r))
                    {
                        reasons.Add(r);
                    }
                }

                if (!string.IsNullOrEmpty(agentResponse.PrimaryShapFeature))
                {
                    reasons.Add($"Primary SHAP Driver: {agentResponse.PrimaryShapFeature}");
                }

                // Policy alignment from Agent 3 (Coordinator)
                if (agentResponse.Decision == "STEP_UP_CHALLENGE")
                {
                    reasons.Add("Agent 3: Step-up authentication required");
                    if (riskScore < 50) riskScore = 50;
                }
                else if (agentResponse.Decision == "ESCALATE_TO_ANALYST")
                {
                    reasons.Add("Agent 3: Escalated to analyst review");
                    if (riskScore < 70) riskScore = 70;
                }
                else if (agentResponse.Decision == "AUTO_APPROVE" && amount < 75000m)
                {
                    if (riskScore >= flagThreshold) riskScore = Math.Min(riskScore, flagThreshold - 1);
                }

                if (amount >= 75000m)
                {
                    reasons.Add("Statutory Dual Approval Threshold (>= 75,000 LKR)");
                    if (riskScore < 70) riskScore = 75;
                }

                status = (riskScore >= flagThreshold || amount >= 75000m || agentResponse.Decision != "AUTO_APPROVE")
                    ? "Flagged"
                    : "Approved";
            }
            else
            {
                // Circuit Breaker Deterministic Fallback
                string timeOfDay = DateTime.Now.ToString("hh:mm tt");
                int aiScore = await _anomalyDetectionAgent.AnalyzeBehavioralRiskAsync(
                    transactionId, amount, ipAddress, timeOfDay, cancellationToken);

                if (aiScore > 0)
                {
                    riskScore += aiScore;
                    reasons.Add($"AI Behavioral Analysis added {aiScore} risk points.");
                }

                status = (riskScore >= flagThreshold || amount >= 75000m) ? "Flagged" : "Approved";

                // Attempt standalone SHAP call if flagged
                if (status == "Flagged")
                {
                    try
                    {
                        var shapPayload = new
                        {
                            transaction_id = transactionId.ToString(),
                            amount = (double)amount,
                            features = new Dictionary<string, double>
                            {
                                { "amount", (double)amount },
                                { "ip_distance_km", location.IsSuccessful ? 0.0 : 1250.0 },
                                { "is_new_device", 1.0 },
                                { "tx_count_24h", 3.0 },
                                { "amount_to_avg_ratio", (double)(amount / 15000m) }
                            }
                        };

                        var shapUrl = "http://localhost:8000/api/fraud/explain";
                        var shapResponse = await _httpClient.PostAsJsonAsync(shapUrl, shapPayload, cancellationToken);
                        if (shapResponse.IsSuccessStatusCode)
                        {
                            var shapResult = await shapResponse.Content.ReadFromJsonAsync<ShapResponseDto>(cancellationToken: cancellationToken);
                            if (shapResult != null && !string.IsNullOrEmpty(shapResult.PrimaryShapFeature))
                            {
                                reasons.Add($"Primary SHAP Driver: {shapResult.PrimaryShapFeature}");
                            }
                        }
                    }
                    catch
                    {
                        // Non-critical telemetry logging
                    }
                }
            }

            string concatenatedReasons = reasons.Count > 0
                ? string.Join("; ", reasons)
                : "Transaction within normal parameters.";

            // 8. Instantiate and Persist FraudFlag entity
            var fraudFlag = new FraudFlag
            {
                TransactionId = transactionId,
                RiskScore = riskScore,
                Reasons = concatenatedReasons,
                Status = status,
                CreatedAt = DateTime.UtcNow
            };

            _context.FraudFlags.Add(fraudFlag);
            await _context.SaveChangesAsync(cancellationToken);

            _logger.LogInformation(
                "Completed fraud evaluation for transaction ID {TransactionId}: RiskScore={RiskScore}, Status={Status}",
                transactionId, riskScore, status);

            return fraudFlag;
        }
    }

    // DTO mappings for JSON responses from the Python Multi-Agent Microservice
    public class MultiAgentResponseDto
    {
        [System.Text.Json.Serialization.JsonPropertyName("transaction_id")]
        public string TransactionId { get; set; } = string.Empty;

        [System.Text.Json.Serialization.JsonPropertyName("decision")]
        public string Decision { get; set; } = string.Empty;

        [System.Text.Json.Serialization.JsonPropertyName("status")]
        public string Status { get; set; } = string.Empty;

        [System.Text.Json.Serialization.JsonPropertyName("composite_risk_score")]
        public double CompositeRiskScore { get; set; }

        [System.Text.Json.Serialization.JsonPropertyName("requires_human_approval")]
        public bool RequiresHumanApproval { get; set; }

        [System.Text.Json.Serialization.JsonPropertyName("requires_step_up")]
        public bool RequiresStepUp { get; set; }

        [System.Text.Json.Serialization.JsonPropertyName("primary_shap_feature")]
        public string PrimaryShapFeature { get; set; } = string.Empty;

        [System.Text.Json.Serialization.JsonPropertyName("reasons")]
        public List<string> Reasons { get; set; } = new();
    }

    public class ShapResponseDto
    {
        [System.Text.Json.Serialization.JsonPropertyName("primary_shap_feature")]
        public string PrimaryShapFeature { get; set; } = string.Empty;
    }
}