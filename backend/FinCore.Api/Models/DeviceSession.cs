using System;

namespace FinCore.Api.Models
{
    public class DeviceSession
    {
        public int Id { get; set; }
        public int UserId { get; set; }
        public string DeviceFingerprint { get; set; } = string.Empty;
        public string IpAddress { get; set; } = string.Empty;
        public string Status { get; set; } = "Unverified"; // Unverified, Verified, Trusted, Flagged
        public DateTime LastLoginAt { get; set; } = DateTime.UtcNow;
    }
}