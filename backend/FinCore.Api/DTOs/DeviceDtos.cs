using System.ComponentModel.DataAnnotations;

namespace FinCore.Api.DTOs
{
    public class DeviceVerifyRequestDto
    {
        [Required]
        public int UserId { get; set; }

        [Required]
        public string DeviceFingerprint { get; set; } = string.Empty;

        [Required]
        public string IpAddress { get; set; } = string.Empty;
    }

    public class DeviceVerifyResponseDto
    {
        public int SessionId { get; set; }
        public int UserId { get; set; }
        public string DeviceFingerprint { get; set; } = string.Empty;
        public string IpAddress { get; set; } = string.Empty;
        public string Status { get; set; } = string.Empty; // Trusted, Verified, Unverified
        public DateTime LastLoginAt { get; set; }
        public bool IsNewDevice { get; set; }
    }

    public class UpdateDeviceStatusDto
    {
        [Required]
        public string Status { get; set; } = "Verified";
    }
}
