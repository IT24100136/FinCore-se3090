using System;
using System.Collections.Generic;
using System.Data.Common;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Net.Http.Json;
using System.Text.Json;
using System.Threading.Tasks;
using FinCore.Api.Data;
using FinCore.Api.DTOs;
using FinCore.Api.Models;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace FinCore.Api.Tests
{
    public class EscalationTestWebApplicationFactory : WebApplicationFactory<Program>
    {
        private DbConnection? _connection;

        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            builder.UseSetting("DbProvider", "Sqlite");
            builder.ConfigureServices(services =>
            {
                // Remove EF Core descriptors to allow in-memory SQLite provider
                var descriptors = services.Where(
                    d => d.ServiceType == typeof(DbContextOptions<ApplicationDbContext>) ||
                         d.ServiceType == typeof(DbContextOptions) ||
                         d.ServiceType == typeof(ApplicationDbContext) ||
                         (d.ServiceType.Namespace != null && d.ServiceType.Namespace.StartsWith("Microsoft.EntityFrameworkCore"))).ToList();

                foreach (var d in descriptors)
                {
                    services.Remove(d);
                }

                _connection = new SqliteConnection("DataSource=:memory:");
                _connection.Open();

                services.AddDbContext<ApplicationDbContext>(options =>
                {
                    options.UseSqlite(_connection);
                });

                var sp = services.BuildServiceProvider();
                using var scope = sp.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
                db.Database.EnsureCreated();
                DbInitializer.InitializeAsync(db).GetAwaiter().GetResult();
            });
        }

        protected override void Dispose(bool disposing)
        {
            base.Dispose(disposing);
            if (disposing)
            {
                _connection?.Dispose();
            }
        }
    }

    public class AnalystEscalationIntegrationTests : IClassFixture<EscalationTestWebApplicationFactory>
    {
        private readonly HttpClient _client;
        private readonly EscalationTestWebApplicationFactory _factory;

        public AnalystEscalationIntegrationTests(EscalationTestWebApplicationFactory factory)
        {
            _factory = factory;
            _client = factory.CreateClient();
        }

        [Fact]
        public async Task GetEligibleAnalysts_ReturnsAnalystsFromDatabase()
        {
            // Act
            var response = await _client.GetAsync("/api/reviews/analysts");

            // Assert
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            var json = await response.Content.ReadAsStringAsync();
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;
            Assert.Equal(JsonValueKind.Array, root.ValueKind);
            Assert.True(root.GetArrayLength() > 0, "Staff analysts list should be loaded from DB");

            // Verify roles are staff roles (Analyst or Admin)
            foreach (var element in root.EnumerateArray())
            {
                var role = element.GetProperty("role").GetString();
                Assert.True(role == "Analyst" || role == "Admin" || role == "Senior Analyst", $"Role '{role}' should be eligible staff role");
            }
        }

        [Fact]
        public async Task EscalateCase_FullWorkflow_SavesToDatabase_CreatesAuditAndNotification()
        {
            // 1. Arrange - Get eligible analysts from DB
            using var scope = _factory.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

            var callerAnalyst = await db.Users.FirstOrDefaultAsync(u => u.Role == "Analyst");
            var targetAnalyst = await db.Users.FirstOrDefaultAsync(u => u.Id != callerAnalyst!.Id && (u.Role == "Analyst" || u.Role == "Admin"));
            Assert.NotNull(callerAnalyst);
            Assert.NotNull(targetAnalyst);

            // Create a test review case
            var testCase = new ReviewQueue
            {
                Id = Guid.NewGuid(),
                TransactionId = Guid.NewGuid(),
                QueueCode = "TRX-ESC-TEST-001",
                Status = "Queued",
                Priority = 1,
                PriorityLabel = "MEDIUM",
                Amount = 50000m,
                SenderName = "Sample Sender",
                SenderId = "ACC-001",
                RecipientName = "Sample Recipient",
                RecipientId = "ACC-002",
                RiskScore = 78.5,
                CreatedAt = DateTime.UtcNow
            };
            db.ReviewQueues.Add(testCase);
            await db.SaveChangesAsync();

            // 2. Act - Escalate case via API
            var payload = new EscalateRequest
            {
                AnalystId = callerAnalyst.Id,
                TargetAnalystId = targetAnalyst.Id,
                TargetAnalystName = targetAnalyst.Name,
                Reason = "High risk geolocation variance requires senior investigation."
            };

            var response = await _client.PostAsJsonAsync($"/api/reviews/{testCase.TransactionId}/escalate", payload);

            // 3. Assert Response
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);

            // 4. Verify Database Persistence (PostgreSQL / EF Core)
            using var verifyScope = _factory.Services.CreateScope();
            var verifyDb = verifyScope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

            var updatedCase = await verifyDb.ReviewQueues.AsNoTracking().FirstOrDefaultAsync(q => q.TransactionId == testCase.TransactionId);
            Assert.NotNull(updatedCase);
            Assert.Equal("Escalated", updatedCase.Status);
            Assert.Equal(3, updatedCase.Priority);
            Assert.Equal("CRITICAL", updatedCase.PriorityLabel);
            Assert.Equal(targetAnalyst.Id, updatedCase.AssignedAnalystId);
            Assert.Equal(callerAnalyst.Id, updatedCase.EscalatedByAnalystId);
            Assert.Equal("High risk geolocation variance requires senior investigation.", updatedCase.EscalationReason);

            // 5. Verify Audit Record Created
            var auditRecord = await verifyDb.AuditLogs.AsNoTracking().FirstOrDefaultAsync(a => a.Action == "ESCALATED" && a.Details.Contains(testCase.QueueCode));
            Assert.NotNull(auditRecord);
            Assert.Contains(callerAnalyst.Name, auditRecord.Details);
            Assert.Contains(targetAnalyst.Name, auditRecord.Details);
            Assert.Contains("High risk geolocation variance requires senior investigation.", auditRecord.Details);

            var decisionAudit = await verifyDb.ApprovalDecisions.AsNoTracking().FirstOrDefaultAsync(d => d.TransactionId == testCase.TransactionId && d.Decision == "Escalated");
            Assert.NotNull(decisionAudit);
            Assert.Equal(callerAnalyst.Id, decisionAudit.AnalystId);

            // 6. Verify Notification Created for Selected Analyst
            int targetIntId = DbInitializer.GetDeterministicUserId(targetAnalyst.Id);
            var notification = await verifyDb.Notifications.AsNoTracking().FirstOrDefaultAsync(n => n.UserId == targetIntId && n.Title.Contains(testCase.QueueCode));
            Assert.NotNull(notification);
            Assert.Equal(targetAnalyst.Email, notification.Recipient);
            Assert.Contains(callerAnalyst.Name, notification.Message);
        }

        [Fact]
        public async Task EscalateCase_InvalidTargetRole_ReturnsBadRequest()
        {
            using var scope = _factory.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

            var callerAnalyst = await db.Users.FirstOrDefaultAsync(u => u.Role == "Analyst");
            Assert.NotNull(callerAnalyst);

            // Create a non-staff customer user
            var customerUser = new User
            {
                Id = Guid.NewGuid(),
                Name = "Non Staff Customer",
                Email = "customer.test@fincore.com",
                Role = "Customer"
            };
            db.Users.Add(customerUser);

            var testCase = new ReviewQueue
            {
                Id = Guid.NewGuid(),
                TransactionId = Guid.NewGuid(),
                QueueCode = "TRX-INVALID-TARGET-001",
                Status = "Queued",
                Amount = 10000m,
                CreatedAt = DateTime.UtcNow
            };
            db.ReviewQueues.Add(testCase);
            await db.SaveChangesAsync();

            var payload = new EscalateRequest
            {
                AnalystId = callerAnalyst.Id,
                TargetAnalystId = customerUser.Id,
                Reason = "Escalation attempt to non-analyst"
            };

            var response = await _client.PostAsJsonAsync($"/api/reviews/{testCase.TransactionId}/escalate", payload);

            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
            var json = await response.Content.ReadAsStringAsync();
            Assert.Contains("Security policy violation", json);
        }
    }
}
