// Mock data for FinCore Admin Dashboard

export const MOCK_SUMMARY_STATS = {
  weeklyDeviceLogins: {
    count: 1428,
    trendPercent: 14.2,
    isUpward: true,
    breakdown: {
      ios: 842,
      android: 456,
      web: 130
    }
  },
  notificationSuccessRate: {
    rate: 98.5,
    sentCount: 14250,
    failedCount: 215,
    trendPercent: 0.4,
    isUpward: true
  },
  flaggedUsers: {
    count: 24,
    criticalCount: 7,
    warningLevel: 'high',
    trendPercent: 8.5,
    isUpward: true
  }
};

export const MOCK_USERS = [
  {
    id: 'USR-8021',
    name: 'Eleanor Vance',
    email: 'eleanor.vance@fincore-user.com',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
    status: 'Active',
    role: 'Premium Business',
    joinedDate: '2025-11-12',
    registeredDevices: 3,
    flaggedDevices: 0
  },
  {
    id: 'USR-8022',
    name: 'Marcus Sterling',
    email: 'marcus.sterling@apexcapital.org',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
    status: 'Active',
    role: 'Institutional',
    joinedDate: '2025-08-04',
    registeredDevices: 5,
    flaggedDevices: 2
  },
  {
    id: 'USR-8023',
    name: 'Sophia Chen',
    email: 'sophia.chen@techventures.io',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
    status: 'Suspended',
    role: 'Standard',
    joinedDate: '2026-01-19',
    registeredDevices: 4,
    flaggedDevices: 3
  },
  {
    id: 'USR-8024',
    name: 'David K. Ross',
    email: 'david.ross@globalfin.net',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150',
    status: 'Active',
    role: 'Premium Business',
    joinedDate: '2026-03-22',
    registeredDevices: 2,
    flaggedDevices: 0
  },
  {
    id: 'USR-8025',
    name: 'Amara Okafor',
    email: 'amara.okafor@horizon-pay.com',
    avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150',
    status: 'Active',
    role: 'Standard',
    joinedDate: '2026-04-10',
    registeredDevices: 1,
    flaggedDevices: 0
  },
  {
    id: 'USR-8026',
    name: 'Julian Thorne',
    email: 'j.thorne@darksky-sec.com',
    avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150',
    status: 'Suspended',
    role: 'High Net Worth',
    joinedDate: '2025-12-01',
    registeredDevices: 6,
    flaggedDevices: 4
  },
  {
    id: 'USR-8027',
    name: 'Elena Rostova',
    email: 'elena.r@nordic-invest.eu',
    avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150',
    status: 'Active',
    role: 'Institutional',
    joinedDate: '2026-02-14',
    registeredDevices: 2,
    flaggedDevices: 0
  },
  {
    id: 'USR-8028',
    name: 'Tariq Al-Mansoor',
    email: 'tariq.m@emirates-wealth.ae',
    avatar: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150',
    status: 'Active',
    role: 'Premium Business',
    joinedDate: '2026-05-09',
    registeredDevices: 3,
    flaggedDevices: 1
  }
];

export const MOCK_DEVICE_SESSIONS = [
  {
    id: 'SES-9101',
    userId: 'USR-8023',
    userName: 'Sophia Chen',
    deviceFingerprint: 'fp_a98b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b',
    deviceModel: 'iPhone 15 Pro Max (iOS 17.5.1)',
    ipAddress: '192.168.1.104',
    location: 'San Francisco, CA, USA',
    status: 'Flagged',
    lastLoginTime: '2026-09-28 11:42 AM',
    riskScore: 92,
    reason: 'Multiple rapid geographic logins detected within 5 minutes'
  },
  {
    id: 'SES-9102',
    userId: 'USR-8021',
    userName: 'Eleanor Vance',
    deviceFingerprint: 'fp_3f2e1d0c9b8a7f6e5d4c3b2a1f0e9d8c7b6a5f4e',
    deviceModel: 'MacBook Pro M3 Max (macOS 14.4)',
    ipAddress: '172.56.21.90',
    location: 'New York, NY, USA',
    status: 'Trusted',
    lastLoginTime: '2026-09-28 11:28 AM',
    riskScore: 4,
    reason: 'Primary verified hardware device'
  },
  {
    id: 'SES-9103',
    userId: 'USR-8022',
    userName: 'Marcus Sterling',
    deviceFingerprint: 'fp_7e6d5c4b3a2f1e0d9c8b7a6f5e4d3c2b1a0f9e8d',
    deviceModel: 'Samsung Galaxy S24 Ultra (Android 14)',
    ipAddress: '185.220.101.5',
    location: 'Frankfurt, Germany',
    status: 'Flagged',
    lastLoginTime: '2026-09-28 10:15 AM',
    riskScore: 88,
    reason: 'TOR Exit Node IP address associated with known fraud network'
  },
  {
    id: 'SES-9104',
    userId: 'USR-8024',
    userName: 'David K. Ross',
    deviceFingerprint: 'fp_1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b',
    deviceModel: 'iPad Pro 12.9 (iPadOS 17.4)',
    ipAddress: '198.51.100.42',
    location: 'London, United Kingdom',
    status: 'Verified',
    lastLoginTime: '2026-09-28 09:50 AM',
    riskScore: 12,
    reason: 'Standard 2FA authentication passed'
  },
  {
    id: 'SES-9105',
    userId: 'USR-8026',
    userName: 'Julian Thorne',
    deviceFingerprint: 'fp_4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c',
    deviceModel: 'Google Pixel 8 Pro (Android 14)',
    ipAddress: '203.0.113.195',
    location: 'Sydney, Australia',
    status: 'Unverified',
    lastLoginTime: '2026-09-28 08:30 AM',
    riskScore: 65,
    reason: 'New unrecognized browser fingerprint without biometrics'
  },
  {
    id: 'SES-9106',
    userId: 'USR-8025',
    userName: 'Amara Okafor',
    deviceFingerprint: 'fp_9f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c3b2a1f0e',
    deviceModel: 'Dell XPS 15 (Windows 11)',
    ipAddress: '105.112.54.12',
    location: 'Lagos, Nigeria',
    status: 'Trusted',
    lastLoginTime: '2026-09-28 07:14 AM',
    riskScore: 8,
    reason: 'Recognized home IP & biometric passkey verified'
  },
  {
    id: 'SES-9107',
    userId: 'USR-8027',
    userName: 'Elena Rostova',
    deviceFingerprint: 'fp_2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d',
    deviceModel: 'iPhone 14 Pro (iOS 17.2)',
    ipAddress: '188.166.42.81',
    location: 'Stockholm, Sweden',
    status: 'Verified',
    lastLoginTime: '2026-09-27 11:55 PM',
    riskScore: 18,
    reason: 'Standard mobile app session renewal'
  },
  {
    id: 'SES-9108',
    userId: 'USR-8028',
    userName: 'Tariq Al-Mansoor',
    deviceFingerprint: 'fp_8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b',
    deviceModel: 'Custom Chrome Client (Linux x86_64)',
    ipAddress: '94.200.15.88',
    location: 'Dubai, UAE',
    status: 'Unverified',
    lastLoginTime: '2026-09-27 09:20 PM',
    riskScore: 45,
    reason: 'Headless browser user-agent string detected'
  }
];

export const MOCK_NOTIFICATION_LOGS = [
  {
    id: 'NTF-7001',
    recipient: 'eleanor.vance@fincore-user.com',
    recipientName: 'Eleanor Vance',
    type: 'Email',
    message: 'Your FinCore security verification code is 849-201. Valid for 5 minutes.',
    deliveryStatus: 'Sent',
    timestamp: '2026-09-28 12:05:14',
    channelDetails: 'Mailgun SMTP Relay (sg-east-1)',
    latencyMs: 340
  },
  {
    id: 'NTF-7002',
    recipient: '+1 (555) 382-9102',
    recipientName: 'Marcus Sterling',
    type: 'SMS',
    message: 'FinCore Alert: Unrecognized login attempt from Frankfurt, DE. Reply STOP if not you.',
    deliveryStatus: 'Sent',
    timestamp: '2026-09-28 11:43:02',
    channelDetails: 'Twilio SMS Gateway',
    latencyMs: 620
  },
  {
    id: 'NTF-7003',
    recipient: 'sophia.chen@techventures.io',
    recipientName: 'Sophia Chen',
    type: 'Email',
    message: 'Account Status Warning: Your FinCore account has been temporarily restricted due to suspicious multi-device activity.',
    deliveryStatus: 'Failed',
    timestamp: '2026-09-28 11:30:45',
    channelDetails: 'SendGrid API (Error 550: Recipient mailbox full)',
    latencyMs: 1250
  },
  {
    id: 'NTF-7004',
    recipient: '+1 (555) 902-1488',
    recipientName: 'David K. Ross',
    type: 'SMS',
    message: 'Wire transfer of $45,000.00 to Apex Global has been processed successfully.',
    deliveryStatus: 'Sent',
    timestamp: '2026-09-28 10:52:19',
    channelDetails: 'Twilio SMS Gateway',
    latencyMs: 410
  },
  {
    id: 'NTF-7005',
    recipient: 'amara.okafor@horizon-pay.com',
    recipientName: 'Amara Okafor',
    type: 'Email',
    message: 'Monthly Statement Available: Your September 2026 FinCore statement is ready to view.',
    deliveryStatus: 'Sent',
    timestamp: '2026-09-28 09:15:30',
    channelDetails: 'Mailgun SMTP Relay (sg-east-1)',
    latencyMs: 290
  },
  {
    id: 'NTF-7006',
    recipient: '+44 7700 900123',
    recipientName: 'Julian Thorne',
    type: 'SMS',
    message: 'FinCore Security: Your 2FA security settings were updated from a new device.',
    deliveryStatus: 'Failed',
    timestamp: '2026-09-28 08:31:10',
    channelDetails: 'AWS SNS (Error 400: Invalid phone number routing)',
    latencyMs: 2100
  },
  {
    id: 'NTF-7007',
    recipient: 'elena.r@nordic-invest.eu',
    recipientName: 'Elena Rostova',
    type: 'Email',
    message: 'New Device Registration: iPhone 14 Pro was successfully paired to your account.',
    deliveryStatus: 'Sent',
    timestamp: '2026-09-27 23:56:01',
    channelDetails: 'Postmark Transactional Engine',
    latencyMs: 180
  },
  {
    id: 'NTF-7008',
    recipient: '+971 50 123 4567',
    recipientName: 'Tariq Al-Mansoor',
    type: 'SMS',
    message: 'FinCore OTP: 301-948 is your authentication passcode for international payout.',
    deliveryStatus: 'Sent',
    timestamp: '2026-09-27 21:22:15',
    channelDetails: 'Twilio SMS Gateway',
    latencyMs: 510
  }
];

export const MOCK_DEVICE_DISTRIBUTION = [
  { name: 'iOS App (Native)', percentage: 58, count: 842, color: '#3B82F6' },
  { name: 'Android App (Native)', percentage: 32, count: 456, color: '#10B981' },
  { name: 'Web Dashboard', percentage: 10, count: 130, color: '#6366F1' }
];

export const MOCK_SECURITY_ALERTS = [
  { id: 'ALT-101', title: 'Concurrent Multi-Region Logins', severity: 'High', count: 7, time: '15 mins ago' },
  { id: 'ALT-102', title: 'Unusual IP Range Traversal', severity: 'Medium', count: 14, time: '1 hour ago' },
  { id: 'ALT-103', title: 'Failed SMS OTP Retries', severity: 'Low', count: 32, time: '3 hours ago' }
];
