// All mock data has been purged and replaced with live EF Core queries on PostgreSQL.
// Use live API endpoints:
// - /api/users
// - /api/devices/sessions
// - /api/devices/analytics/summary
// - /api/notifications/logs

export const MOCK_SUMMARY_STATS = {
  weeklyDeviceLogins: { count: 0, trendPercent: 0, isUpward: true, breakdown: { ios: 0, android: 0, web: 0 } },
  notificationSuccessRate: { rate: 100, sentCount: 0, failedCount: 0, trendPercent: 0, isUpward: true },
  flaggedUsers: { count: 0, criticalCount: 0, warningLevel: 'low', trendPercent: 0, isUpward: false }
};

export const MOCK_USERS = [];
export const MOCK_DEVICE_SESSIONS = [];
export const MOCK_NOTIFICATION_LOGS = [];
export const MOCK_DEVICE_DISTRIBUTION = [];
export const MOCK_SECURITY_ALERTS = [];
