using Microsoft.AspNetCore.SignalR;
using System.Threading.Tasks;

namespace FinCore.Api.Hubs
{
    public class TransactionHub : Hub
    {
        public async Task BroadcastTransactionUpdate(string referenceId, string status)
        {
            await Clients.All.SendAsync("TransactionUpdated", referenceId, status);
        }
    }
}
