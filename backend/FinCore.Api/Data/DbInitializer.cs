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
            // 0. Ensure ReviewQueues table has EscalatedByAnalystId and EscalationReason columns in PostgreSQL
            try
            {
                await context.Database.ExecuteSqlRawAsync(@"
                    ALTER TABLE ""ReviewQueues"" ADD COLUMN IF NOT EXISTS ""EscalatedByAnalystId"" uuid;
                    ALTER TABLE ""ReviewQueues"" ADD COLUMN IF NOT EXISTS ""EscalationReason"" text;
                ");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"DB Schema migration notice: {ex.Message}");
            }

            // 1. Ensure eligible staff users (Analysts & Admins) exist in the database for escalation workflows
            if (!await context.Users.AnyAsync(u => u.Role == "Admin" || u.Role == "Analyst"))
            {
                var defaultStaff = new[]
                {
                    new User
                    {
                        Id = Guid.Parse("22222222-2222-2222-2222-222222222222"),
                        Name = "Diluni Silva",
                        Email = "diluni.silva@fincore.internal",
                        PasswordHash = BCrypt.Net.BCrypt.HashPassword("Password123!"),
                        Role = "Analyst",
                        EmployeeId = "ANL-001",
                        Department = "Fraud Operations & Investigation",
                        JobTitle = "Senior Fraud Analyst",
                        Tier = "L2",
                        KycStatus = "Verified",
                        CreatedAt = DateTime.UtcNow,
                        UpdatedAt = DateTime.UtcNow
                    },
                    new User
                    {
                        Id = Guid.Parse("33333333-3333-3333-3333-333333333333"),
                        Name = "Elena Rostova",
                        Email = "elena.rostova@fincore.internal",
                        PasswordHash = BCrypt.Net.BCrypt.HashPassword("Password123!"),
                        Role = "Analyst",
                        EmployeeId = "ANL-002",
                        Department = "Financial Crime Unit",
                        JobTitle = "Lead AML Specialist",
                        Tier = "L3",
                        KycStatus = "Verified",
                        CreatedAt = DateTime.UtcNow,
                        UpdatedAt = DateTime.UtcNow
                    },
                    new User
                    {
                        Id = Guid.Parse("44444444-4444-4444-4444-444444444444"),
                        Name = "Abhishek Admin",
                        Email = "admin.abhishek@fincore.internal",
                        PasswordHash = BCrypt.Net.BCrypt.HashPassword("AdminPassword123!"),
                        Role = "Admin",
                        EmployeeId = "ADM-001",
                        Department = "System & Infrastructure Administration",
                        JobTitle = "Chief Security Officer",
                        Tier = "L4",
                        KycStatus = "Verified",
                        CreatedAt = DateTime.UtcNow,
                        UpdatedAt = DateTime.UtcNow
                    }
                };

                context.Users.AddRange(defaultStaff);
                await context.SaveChangesAsync();
            }
            else
            {
                // Synchronize and normalize registration numbers for existing staff
                var existingStaff = await context.Users.Where(u => u.Role == "Admin" || u.Role == "Analyst").ToListAsync();
                bool changed = false;
                foreach (var s in existingStaff)
                {
                    if (s.EmployeeId == "ANL-1001" || s.Email == "diluni.silva@fincore.internal")
                    {
                        if (s.EmployeeId != "ANL-001") { s.EmployeeId = "ANL-001"; changed = true; }
                    }
                    else if (s.EmployeeId == "ANL-1002" || s.Email == "elena.rostova@fincore.internal")
                    {
                        if (s.EmployeeId != "ANL-002") { s.EmployeeId = "ANL-002"; changed = true; }
                    }
                    else if (s.EmployeeId == "ADM-9001" || s.Email == "admin.abhishek@fincore.internal")
                    {
                        if (s.EmployeeId != "ADM-001") { s.EmployeeId = "ADM-001"; changed = true; }
                    }
                    else if (string.IsNullOrWhiteSpace(s.EmployeeId))
                    {
                        s.EmployeeId = s.Role == "Admin" ? "ADM-001" : "ANL-001";
                        changed = true;
                    }
                }
                if (changed)
                {
                    await context.SaveChangesAsync();
                }
            }

            // 2. Ensure a default consumer demo user exists (Kasun Perera)
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

            // 4. Automatically reconcile any stuck PendingSecondApproval cases where 2 distinct analysts already approved
            var pendingSecondCases = await context.ReviewQueues
                .Where(q => q.Status == "PendingSecondApproval")
                .ToListAsync();

            foreach (var item in pendingSecondCases)
            {
                var approvals = await context.ApprovalDecisions
                    .Where(d => d.TransactionId == item.TransactionId && d.Decision == "Approved")
                    .OrderBy(d => d.DecidedAt)
                    .ToListAsync();

                var distinctAnalysts = approvals.Select(a => a.AnalystId).Distinct().ToList();
                if (distinctAnalysts.Count >= 2)
                {
                    // Primary maker is first analyst; checker is the second analyst
                    var secondAnalystId = distinctAnalysts[1];
                    var secondDecisions = approvals.Where(a => a.AnalystId == secondAnalystId).ToList();
                    foreach (var sd in secondDecisions)
                    {
                        sd.ApprovalLevel = 2;
                    }

                    item.Status = "Approved";
                    item.UpdatedAt = DateTime.UtcNow;

                    var tx = await context.Transactions.FirstOrDefaultAsync(t => t.ReferenceId == item.QueueCode);
                    if (tx != null)
                    {
                        tx.Status = "Completed";
                        if (tx.ReceiverWalletId.HasValue)
                        {
                            var rw = await context.Wallets.FirstOrDefaultAsync(w => w.Id == tx.ReceiverWalletId.Value);
                            if (rw != null) rw.Balance += tx.Amount;
                        }

                        var flag = await context.FraudFlags.FirstOrDefaultAsync(f => f.TransactionId == tx.Id);
                        if (flag != null)
                        {
                            flag.Status = "Approved";
                        }
                    }
                }
            }

            await context.SaveChangesAsync();
        }
    }
}
