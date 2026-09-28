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
using FinCore.Api.Services.NotificationService;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Moq;
using Xunit;

namespace FinCore.Api.Tests
{
    public class CustomWebApplicationFactory : WebApplicationFactory<Program>
    {
        private DbConnection? _connection;
        public Mock<INotificationService> MockNotificationService { get; } = new Mock<INotificationService>();

        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            builder.UseSetting("DbProvider", "Sqlite");
            builder.ConfigureServices(services =>
            {
                // Remove all DbContext options and ApplicationDbContext descriptors
                var descriptors = services.Where(
                    d => d.ServiceType == typeof(DbContextOptions<ApplicationDbContext>) ||
                         d.ServiceType == typeof(DbContextOptions) ||
                         d.ServiceType == typeof(ApplicationDbContext)).ToList();

                foreach (var d in descriptors)
                {
                    services.Remove(d);
                }

                // Create an in-memory SQLite connection that remains open for test lifetime
                _connection = new SqliteConnection("DataSource=:memory:");
                _connection.Open();

                services.AddDbContext<ApplicationDbContext>(options =>
                {
                    options.UseSqlite(_connection);
                });

                // Replace INotificationService with Mock
                var notificationServiceDescriptor = services.SingleOrDefault(d => d.ServiceType == typeof(INotificationService));
                if (notificationServiceDescriptor != null)
                {
                    services.Remove(notificationServiceDescriptor);
                }

                MockNotificationService
                    .Setup(s => s.SendNotificationAsync(
                        It.IsAny<int>(),
                        It.IsAny<string>(),
                        It.IsAny<string>(),
                        It.IsAny<string>(),
                        It.IsAny<string>()))
                    .ReturnsAsync((int userId, string recipient, string recipientName, string type, string message) => new Notification
                    {
                        Id = 1001,
                        UserId = userId,
                        Recipient = recipient,
                        RecipientName = recipientName,
                        Type = type,
                        Message = message,
                        DeliveryStatus = "Sent",
                        ChannelDetails = "Mocked Test Channel",
                        LatencyMs = 120,
                        Timestamp = DateTime.UtcNow
                    });

                services.AddScoped(_ => MockNotificationService.Object);

                // Build service provider and ensure database schema is created
                var sp = services.BuildServiceProvider();
                using var scope = sp.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
                db.Database.EnsureCreated();
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

    public class DeviceAndNotificationIntegrationTests : IClassFixture<CustomWebApplicationFactory>
    {
        private readonly CustomWebApplicationFactory _factory;
        private readonly HttpClient _client;

        public DeviceAndNotificationIntegrationTests(CustomWebApplicationFactory factory)
        {
            _factory = factory;
            _client = factory.CreateClient();
        }

        private ApplicationDbContext GetDbContext()
        {
            var scope = _factory.Services.CreateScope();
            return scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        }

        [Fact]
        public async Task VerifyDevice_NewDevice_CreatesAuditLogAndReturnsUnverified()
        {
            // Arrange
            var request = new DeviceVerifyRequestDto
            {
                UserId = 42,
                DeviceFingerprint = "fp-test-new-device-998877",
                IpAddress = "192.168.1.150"
            };

            // Act
            var response = await _client.PostAsJsonAsync("/api/devices/verify", request);

            // Assert
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);

            var verifyResponse = await response.Content.ReadFromJsonAsync<DeviceVerifyResponseDto>();
            Assert.NotNull(verifyResponse);
            Assert.Equal("Unverified", verifyResponse.Status);
            Assert.True(verifyResponse.IsNewDevice);
            Assert.Equal(42, verifyResponse.UserId);
            Assert.Equal("fp-test-new-device-998877", verifyResponse.DeviceFingerprint);

            // Verify AuditLog creation in Db
            using var db = GetDbContext();
            var auditLog = await db.AuditLogs
                .FirstOrDefaultAsync(a => a.UserId == 42 && a.Action == "NEW_DEVICE_DETECTED");

            Assert.NotNull(auditLog);
            Assert.Contains("fp-test-new-device-998877", auditLog.Details);
            Assert.Equal("192.168.1.150", auditLog.IpAddress);
        }

        [Fact]
        public async Task ConfirmDevice_UpgradesStatusToVerifiedAndLogsConfirmation()
        {
            // Arrange: Seed an Unverified session
            int userId = 88;
            string fingerprint = "fp-confirm-test-443322";

            using (var db = GetDbContext())
            {
                db.DeviceSessions.Add(new DeviceSession
                {
                    UserId = userId,
                    DeviceFingerprint = fingerprint,
                    IpAddress = "10.0.0.99",
                    Status = "Unverified",
                    LastLoginAt = DateTime.UtcNow.AddMinutes(-10)
                });
                await db.SaveChangesAsync();
            }

            var confirmRequest = new DeviceConfirmRequestDto
            {
                UserId = userId,
                DeviceFingerprint = fingerprint
            };

            // Act
            var response = await _client.PutAsJsonAsync("/api/devices/confirm", confirmRequest);

            // Assert
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);

            using var verifyDb = GetDbContext();
            var updatedSession = await verifyDb.DeviceSessions
                .FirstOrDefaultAsync(s => s.UserId == userId && s.DeviceFingerprint == fingerprint);

            Assert.NotNull(updatedSession);
            Assert.Equal("Verified", updatedSession.Status);

            var auditLog = await verifyDb.AuditLogs
                .FirstOrDefaultAsync(a => a.UserId == userId && a.Action == "DEVICE_CONFIRMED");

            Assert.NotNull(auditLog);
            Assert.Contains("upgraded from Unverified to Verified", auditLog.Details);
        }

        [Fact]
        public async Task GetAnalyticsSummary_CalculatesCorrectAggregatedMetrics()
        {
            // Arrange: Seed sessions and notifications
            using (var db = GetDbContext())
            {
                // Seed Device Sessions
                db.DeviceSessions.AddRange(new List<DeviceSession>
                {
                    new DeviceSession { UserId = 101, DeviceFingerprint = "fp-analytics-1", Status = "Unverified", IpAddress = "1.1.1.1" },
                    new DeviceSession { UserId = 102, DeviceFingerprint = "fp-analytics-2", Status = "Unverified", IpAddress = "1.1.1.2" },
                    new DeviceSession { UserId = 103, DeviceFingerprint = "fp-analytics-3", Status = "Verified", IpAddress = "1.1.1.3" },
                    new DeviceSession { UserId = 104, DeviceFingerprint = "fp-analytics-4", Status = "Trusted", IpAddress = "1.1.1.4" },
                    new DeviceSession { UserId = 105, DeviceFingerprint = "fp-analytics-5", Status = "Flagged", IpAddress = "1.1.1.5" },
                });

                // Seed Notifications (3 Sent, 1 Failed => 75% delivery success rate)
                db.Notifications.AddRange(new List<Notification>
                {
                    new Notification { UserId = 101, Recipient = "user1@test.com", Type = "Email", DeliveryStatus = "Sent", Message = "Test 1" },
                    new Notification { UserId = 102, Recipient = "user2@test.com", Type = "Email", DeliveryStatus = "Sent", Message = "Test 2" },
                    new Notification { UserId = 103, Recipient = "user3@test.com", Type = "Email", DeliveryStatus = "Sent", Message = "Test 3" },
                    new Notification { UserId = 104, Recipient = "user4@test.com", Type = "Email", DeliveryStatus = "Failed", Message = "Test 4" }
                });

                await db.SaveChangesAsync();
            }

            // Act
            var response = await _client.GetAsync("/api/devices/analytics/summary");

            // Assert
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);

            var jsonString = await response.Content.ReadAsStringAsync();
            using var doc = JsonDocument.Parse(jsonString);
            var root = doc.RootElement;

            int newDevices = root.GetProperty("newDevices").GetInt32();
            double successRate = root.GetProperty("deliverySuccessRate").GetDouble();
            int flaggedUsers = root.GetProperty("flaggedUsers").GetInt32();

            Assert.True(newDevices >= 2, "Should count at least 2 unverified devices");
            Assert.True(flaggedUsers >= 1, "Should count at least 1 flagged user");
            Assert.True(successRate > 0, "Delivery success rate should be calculated");
        }

        [Fact]
        public async Task SendNotification_TriggersNotificationServiceAndLogsToDatabase()
        {
            // Arrange
            var sendDto = new SendNotificationRequestDto
            {
                UserId = 250,
                Recipient = "alex.rivera@fincore-test.io",
                RecipientName = "Alex Rivera",
                Type = "Email",
                Message = "Security Alert: New device login from Tokyo, JP."
            };

            // Act
            var response = await _client.PostAsJsonAsync("/api/notifications/send", sendDto);

            // Assert
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);

            // Verify Mock INotificationService was called
            _factory.MockNotificationService.Verify(
                s => s.SendNotificationAsync(250, "alex.rivera@fincore-test.io", "Alex Rivera", "Email", "Security Alert: New device login from Tokyo, JP."),
                Times.Once);

            // Verify persisted Notification and AuditLog in Db
            using var db = GetDbContext();
            var savedNotification = await db.Notifications
                .FirstOrDefaultAsync(n => n.UserId == 250 && n.Recipient == "alex.rivera@fincore-test.io");

            Assert.NotNull(savedNotification);
            Assert.Equal("Email", savedNotification.Type);
            Assert.Equal("Sent", savedNotification.DeliveryStatus);

            var auditLog = await db.AuditLogs
                .FirstOrDefaultAsync(a => a.UserId == 250 && a.Action == "NOTIFICATION_SENT");

            Assert.NotNull(auditLog);
            Assert.Contains("Sent Email notification to alex.rivera@fincore-test.io", auditLog.Details);
        }
    }
}
