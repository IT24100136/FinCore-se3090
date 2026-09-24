using System;
using System.Linq;
using System.Threading.Tasks;
using FinCore.Api.Controllers;
using FinCore.Api.Data;
using FinCore.Api.DTOs;
using FinCore.Api.Models;
using FinCore.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace FinCore.Api.Tests
{
    public class NotificationsControllerTests
    {
        private ApplicationDbContext GetDbContext(string dbName)
        {
            var options = new DbContextOptionsBuilder<ApplicationDbContext>()
                .UseInMemoryDatabase(databaseName: dbName)
                .Options;

            return new ApplicationDbContext(options);
        }

        [Fact]
        public async Task SendNotification_ShouldDispatchAndStoreInDb()
        {
            // Arrange
            var db = GetDbContext(nameof(SendNotification_ShouldDispatchAndStoreInDb));
            var mockService = new MockNotificationService(NullLogger<MockNotificationService>.Instance);
            var controller = new NotificationsController(db, mockService);

            var request = new SendNotificationRequestDto
            {
                UserId = 101,
                Type = "Email",
                Recipient = "testuser@example.com",
                Subject = "Security Alert: New Device Login",
                Message = "A new login was detected from IP 192.168.1.1"
            };

            // Act
            var result = await controller.SendNotification(request);

            // Assert
            var createdResult = Assert.IsType<CreatedAtActionResult>(result);
            var responseDto = Assert.IsType<NotificationResponseDto>(createdResult.Value);

            Assert.Equal("Sent", responseDto.Status);
            Assert.Equal("Mock", responseDto.Provider);
            Assert.Equal(101, responseDto.UserId);
            Assert.Equal("testuser@example.com", responseDto.Recipient);

            var dbNotification = await db.Notifications.FirstOrDefaultAsync(n => n.UserId == 101);
            Assert.NotNull(dbNotification);
            Assert.Equal("Sent", dbNotification.Status);
        }

        [Fact]
        public async Task GetUserNotifications_ShouldReturnUserHistoryInDescendingOrder()
        {
            // Arrange
            var db = GetDbContext(nameof(GetUserNotifications_ShouldReturnUserHistoryInDescendingOrder));
            var mockService = new MockNotificationService(NullLogger<MockNotificationService>.Instance);
            var controller = new NotificationsController(db, mockService);

            db.Notifications.AddRange(
                new Notification
                {
                    UserId = 200,
                    Type = "Email",
                    Recipient = "user200@example.com",
                    Subject = "First Notice",
                    Message = "Msg 1",
                    Status = "Sent",
                    Provider = "Mock",
                    SentAt = DateTime.UtcNow.AddHours(-2)
                },
                new Notification
                {
                    UserId = 200,
                    Type = "SMS",
                    Recipient = "+15551234567",
                    Subject = "",
                    Message = "Msg 2",
                    Status = "Sent",
                    Provider = "Mock",
                    SentAt = DateTime.UtcNow
                }
            );
            await db.SaveChangesAsync();

            // Act
            var result = await controller.GetUserNotifications(200);

            // Assert
            var okResult = Assert.IsType<OkObjectResult>(result);
            var notifications = Assert.IsAssignableFrom<System.Collections.Generic.IEnumerable<NotificationResponseDto>>(okResult.Value).ToList();

            Assert.Equal(2, notifications.Count);
            Assert.Equal("Msg 2", notifications[0].Message); // Most recent first
            Assert.Equal("Msg 1", notifications[1].Message);
        }
    }
}
