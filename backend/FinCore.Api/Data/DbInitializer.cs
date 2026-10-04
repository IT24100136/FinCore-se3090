using System;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using FinCore.Api.Models;

namespace FinCore.Api.Data
{
    public static class DbInitializer
    {
        public static int GetDeterministicUserId(Guid guid)
        {
            byte[] bytes = guid.ToByteArray();
            return Math.Abs(BitConverter.ToInt32(bytes, 0));
        }

        public static async Task InitializeAsync(ApplicationDbContext context)
        {
            // 1. Ensure a default consumer demo user exists (Kasun Perera)
            var kasunUser = await context.Users.FirstOrDefaultAsync(u => u.Email == "kasun@fincore.com");
            if (kasunUser == null)
            {
                kasunUser = new User
                {
                    Id = Guid.NewGuid(),
                    Name = "Kasun Perera",
                    Email = "kasun@fincore.com",
                    PasswordHash = BCrypt.Net.BCrypt.HashPassword("Password123!"),
                    Role = "Customer",
                    PhoneNumber = "+94771234567",
                    Address = "No 42, Galle Road",
                    City = "Colombo",
                    PostalCode = "00300",
                    KycStatus = "Verified",
                    AgreedToTerms = true,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };
                context.Users.Add(kasunUser);
                await context.SaveChangesAsync();
            }

            // 2. ONLY seed default wallets if the Wallets table is completely empty
            // This prevents wiping or resetting existing balances across application reruns
            if (!await context.Wallets.AnyAsync())
            {
                var kasunIntId = GetDeterministicUserId(kasunUser.Id);
                var kasunWallet = new Wallet
                {
                    UserId = kasunIntId,
                    UserGuid = kasunUser.Id,
                    Balance = 100000m,
                    Currency = "LKR",
                    CreatedAt = DateTime.UtcNow
                };
                context.Wallets.Add(kasunWallet);

                // Add sample notification for Kasun
                context.Notifications.Add(new Notification
                {
                    UserId = kasunIntId,
                    Recipient = kasunUser.Email,
                    RecipientName = kasunUser.Name,
                    Title = "Welcome to FinCore",
                    Message = "Your digital wallet has been provisioned with an initial demo balance of Rs. 100,000.00.",
                    DeliveryStatus = "Sent",
                    ChannelDetails = "System Provisioning",
                    Category = "info",
                    IsRead = false,
                    Timestamp = DateTime.UtcNow
                });

                await context.SaveChangesAsync();
            }
            else
            {
                // Ensure Kasun has a wallet if he was created after initial seeding
                var kasunIntId = GetDeterministicUserId(kasunUser.Id);
                var existingWallet = await context.Wallets.FirstOrDefaultAsync(w => w.UserGuid == kasunUser.Id || w.UserId == kasunIntId);
                if (existingWallet == null)
                {
                    context.Wallets.Add(new Wallet
                    {
                        UserId = kasunIntId,
                        UserGuid = kasunUser.Id,
                        Balance = 100000m,
                        Currency = "LKR",
                        CreatedAt = DateTime.UtcNow
                    });
                    await context.SaveChangesAsync();
                }
                else if (!existingWallet.UserGuid.HasValue)
                {
                    existingWallet.UserGuid = kasunUser.Id;
                    await context.SaveChangesAsync();
                }
            }

            // Backfill UserGuid for customer users where missing
            var customers = await context.Users.Where(u => u.Role == "Customer").ToListAsync();
            foreach (var customer in customers)
            {
                var intId = GetDeterministicUserId(customer.Id);
                var wallet = await context.Wallets.FirstOrDefaultAsync(w => w.UserGuid == customer.Id || w.UserId == intId);
                if (wallet == null)
                {
                    context.Wallets.Add(new Wallet
                    {
                        UserId = intId,
                        UserGuid = customer.Id,
                        Balance = 50000m,
                        Currency = "LKR",
                        CreatedAt = DateTime.UtcNow
                    });
                }
                else if (!wallet.UserGuid.HasValue)
                {
                    wallet.UserGuid = customer.Id;
                }
            }

            await context.SaveChangesAsync();
        }
    }
}
