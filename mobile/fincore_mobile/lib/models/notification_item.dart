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

  factory NotificationItem.fromJson(Map<String, dynamic> json) {
    NotificationCategory category = NotificationCategory.info;
    final catStr = (json['category'] ?? json['type'] ?? '').toString().toLowerCase();
    if (catStr.contains('device')) {
      category = NotificationCategory.newDevice;
    } else if (catStr.contains('pause') || catStr.contains('held') || catStr.contains('review') || catStr.contains('security')) {
      category = NotificationCategory.securityPause;
    } else if (catStr.contains('payment') || catStr.contains('success') || catStr.contains('approved') || catStr.contains('completed')) {
      category = NotificationCategory.paymentSuccess;
    } else if (catStr.contains('warning') || catStr.contains('alert') || catStr.contains('reject') || catStr.contains('failed')) {
      category = NotificationCategory.accountWarning;
    }

    String timeStr = 'Just now';
    if (json['timestamp'] != null) {
      try {
        final dt = DateTime.parse(json['timestamp'].toString()).toLocal();
        final diff = DateTime.now().difference(dt);
        if (diff.inMinutes < 1) {
          timeStr = 'Just now';
        } else if (diff.inMinutes < 60) {
          timeStr = '${diff.inMinutes} mins ago';
        } else if (diff.inHours < 24) {
          timeStr = '${diff.inHours} ${diff.inHours == 1 ? 'hour' : 'hours'} ago';
        } else {
          timeStr = '${diff.inDays} ${diff.inDays == 1 ? 'day' : 'days'} ago';
        }
      } catch (_) {
        timeStr = json['timestamp'].toString();
      }
    }

    return NotificationItem(
      id: json['id']?.toString() ?? '',
      title: (json['title'] != null && json['title'].toString().isNotEmpty)
          ? json['title'].toString()
          : 'FinCore Notice',
      message: json['message']?.toString() ?? '',
      timestamp: timeStr,
      isUnread: !(json['isRead'] == true),
      category: category,
      extraData: json,
    );
  }
}
