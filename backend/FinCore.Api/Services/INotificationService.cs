using System.Threading.Tasks;
using FinCore.Api.Models;

namespace FinCore.Api.Services
{
    public interface INotificationService
    {
        /// <summary>
        /// Sends a notification via configured third-party provider or mock logger.
        /// </summary>
        /// <param name="notification">Notification model containing payload and recipient</param>
        /// <returns>True if notification was successfully dispatched, false otherwise.</returns>
        Task<bool> SendNotificationAsync(Notification notification);
    }
}
