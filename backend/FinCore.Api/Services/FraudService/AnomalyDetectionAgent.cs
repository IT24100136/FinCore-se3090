using System;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;
using Microsoft.SemanticKernel;

namespace FinCore.Api.Services.FraudService
{
    /// <summary>
    /// Contract for the behavioral anomaly detection agent.
    /// </summary>
    public interface IAnomalyDetectionAgent
    {
        Task<int> AnalyzeBehavioralRiskAsync(int transactionId, decimal amount, string ipAddress, string timeOfDay);
        Task<int> AnalyzeBehavioralRiskAsync(int transactionId, decimal amount, string ipAddress, string timeOfDay, CancellationToken cancellationToken);
    }

    /// <summary>
    /// Anomaly-Detection Agent orchestrated via Microsoft Semantic Kernel
    /// to evaluate transaction parameters for behavioral anomalies and risk.
    /// </summary>
    public class AnomalyDetectionAgent : IAnomalyDetectionAgent
    {
        private readonly Kernel _kernel;
        private readonly ILogger<AnomalyDetectionAgent> _logger;

        public AnomalyDetectionAgent(Kernel kernel, ILogger<AnomalyDetectionAgent> logger)
        {
            _kernel = kernel ?? throw new ArgumentNullException(nameof(kernel));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        }

        /// <summary>
        /// Analyzes behavioral risk for a transaction and returns an integer risk score between 0 and 50.
        /// </summary>
        /// <param name="transactionId">The ID of the transaction.</param>
        /// <param name="amount">The transaction monetary amount.</param>
        /// <param name="ipAddress">The originating IP address.</param>
        /// <param name="timeOfDay">The local time or timestamp of the transaction (e.g., '03:00 AM').</param>
        /// <returns>An integer risk score from 0 to 50, or 0 on failure.</returns>
        public Task<int> AnalyzeBehavioralRiskAsync(int transactionId, decimal amount, string ipAddress, string timeOfDay)
        {
            return AnalyzeBehavioralRiskAsync(transactionId, amount, ipAddress, timeOfDay, CancellationToken.None);
        }

        /// <summary>
        /// Analyzes behavioral risk for a transaction with support for cancellation.
        /// </summary>
        public async Task<int> AnalyzeBehavioralRiskAsync(
            int transactionId,
            decimal amount,
            string ipAddress,
            string timeOfDay,
            CancellationToken cancellationToken)
        {
            _logger.LogInformation(
                "AnomalyDetectionAgent evaluating transaction {TransactionId} (Amount: {Amount}, IP: {IpAddress}, Time: {TimeOfDay})",
                transactionId, amount, ipAddress, timeOfDay);

            // 1. Structured prompt asking the AI to evaluate behavioral anomalies
            var prompt = $"""
                You are an AI-powered financial fraud Anomaly-Detection Agent in the FinCore platform.
                Analyze the following transaction parameters for behavioral anomalies, unusual velocity, off-hours activity, or suspicious IP behavior:

                - Transaction ID: {transactionId}
                - Monetary Amount: ${amount:F2}
                - Originating IP Address: {ipAddress}
                - Local Time of Day: {timeOfDay}

                Scoring Rules:
                - Normal daytime transactions with standard spending amounts: 0 to 15
                - Moderate behavioral anomalies (e.g., transfers occurring during off-hours like 3:00 AM with moderate amounts or new IP): 16 to 35
                - Severe anomalies (e.g., large transfers occurring late at night like 3:00 AM from unfamiliar or high-risk IP addresses): 36 to 50

                Return ONLY a single integer score between 0 and 50 representing the behavioral risk. Do NOT include markdown formatting, explanations, punctuation, or any accompanying text.
                """;

            try
            {
                // 2. Invoke prompt using the injected Semantic Kernel
                var functionResult = await _kernel.InvokePromptAsync(prompt, cancellationToken: cancellationToken);
                var rawResponse = functionResult.GetValue<string>() ?? functionResult.ToString();

                // 3. Parse AI response to extract integer-based risk score (0 to 50)
                int score = ParseRiskScore(rawResponse);

                _logger.LogInformation(
                    "AnomalyDetectionAgent successfully scored transaction {TransactionId}: {Score}/50 (Raw: '{RawResponse}')",
                    transactionId, score, rawResponse?.Trim());

                return score;
            }
            catch (Exception ex)
            {
                // 4. Resilient fallback: log failure and return fallback score of 0
                _logger.LogError(
                    ex,
                    "Semantic Kernel invocation or response parsing failed for transaction {TransactionId}. Returning fallback score of 0.",
                    transactionId);

                return 0;
            }
        }

        /// <summary>
        /// Resiliently extracts an integer score (0-50) from the LLM response.
        /// </summary>
        private static int ParseRiskScore(string? response)
        {
            if (string.IsNullOrWhiteSpace(response))
            {
                return 0;
            }

            var trimmed = response.Trim();

            // Direct parse
            if (int.TryParse(trimmed, out int directScore))
            {
                return Math.Clamp(directScore, 0, 50);
            }

            // Regex fallback for responses containing extraneous text
            var match = Regex.Match(trimmed, @"\b([0-9]{1,3})\b");
            if (match.Success && int.TryParse(match.Groups[1].Value, out int extractedScore))
            {
                return Math.Clamp(extractedScore, 0, 50);
            }

            return 0;
        }
    }
}
