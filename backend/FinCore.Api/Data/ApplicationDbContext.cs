using Microsoft.EntityFrameworkCore;
using FinCore.Api.Models;

namespace FinCore.Api.Data
{
    public class ApplicationDbContext : DbContext
    {
        public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options)
            : base(options) { }



        public DbSet<User> Users { get; set; }
        public DbSet<DeviceSession> DeviceSessions { get; set; }
        public DbSet<AuditLog> AuditLogs { get; set; }
        public DbSet<FraudFlag> FraudFlags { get; set; }
        public DbSet<RuleThreshold> RuleThresholds { get; set; }
    }
}