using System.Threading;
using System.Threading.Tasks;
using FinCore.Api.Models;

namespace FinCore.Api.Services.FraudService
{
    /// <summary>
    /// Service contract for evaluating transaction risk, applying rule thresholds, and flagging potential fraud.
    /// </summary>
    public interface IFraudService
    {
        /// <summary>
        /// Evaluates a transaction by analyzing rule thresholds, behavioral signals, and geolocation data.
        /// </summary>
        /// <param name="transactionId">The ID of the transaction to evaluate.</param>
        /// <param name="amount">The transaction monetary amount.</param>
        /// <param name="ipAddress">The IP address from which the transaction originated.</param>
        /// <returns>A <see cref="FraudFlag"/> entity containing the calculated risk score, reasons, and status.</returns>
        Task<FraudFlag> EvaluateTransactionAsync(int transactionId, decimal amount, string ipAddress);

        /// <summary>
        /// Evaluates a transaction with support for cancellation.
        /// </summary>
        /// <param name="transactionId">The ID of the transaction to evaluate.</param>
        /// <param name="amount">The transaction monetary amount.</param>
        /// <param name="ipAddress">The IP address from which the transaction originated.</param>
        /// <param name="cancellationToken">Cancellation token.</param>
        /// <returns>A <see cref="FraudFlag"/> entity containing the calculated risk score, reasons, and status.</returns>
        Task<FraudFlag> EvaluateTransactionAsync(int transactionId, decimal amount, string ipAddress, CancellationToken cancellationToken);
    }
}
