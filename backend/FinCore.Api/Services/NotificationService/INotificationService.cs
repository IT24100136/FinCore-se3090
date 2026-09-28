using System.Threading.Tasks;
using FinCore.Api.Models;

namespace FinCore.Api.Services.NotificationService
{
    public interface INotificationService
    {
        Task<Notification> SendNotificationAsync(int userId, string recipient, string recipientName, string type, string message);
    }
}
