enum NotificationCategory {
  newDevice,
  securityPause,
  paymentSuccess,
  accountWarning,
  info,
}

class NotificationItem {
  final String id;
  final String title;
  final String message;
  final String timestamp;
  bool isUnread;
  final NotificationCategory category;
  final Map<String, dynamic>? extraData;
  bool isVerified;

  NotificationItem({
    required this.id,
    required this.title,
    required this.message,
    required this.timestamp,
    required this.isUnread,
    required this.category,
    this.extraData,
    this.isVerified = false,
  });
}
