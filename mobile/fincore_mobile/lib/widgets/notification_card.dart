import 'package:flutter/material.dart';
import '../models/notification_item.dart';

class NotificationCard extends StatelessWidget {
  final NotificationItem item;
  final VoidCallback? onTap;

  const NotificationCard({
    super.key,
    required this.item,
    this.onTap,
  });

  IconData _getIconData() {
    switch (item.category) {
      case NotificationCategory.newDevice:
        return Icons.shield_outlined;
      case NotificationCategory.securityPause:
        return Icons.pause_circle_outline;
      case NotificationCategory.paymentSuccess:
        return Icons.check_circle_outline;
      case NotificationCategory.accountWarning:
        return Icons.warning_amber_rounded;
      case NotificationCategory.info:
        return Icons.info_outline;
    }
  }

  Color _getIconBgColor() {
    switch (item.category) {
      case NotificationCategory.newDevice:
      case NotificationCategory.securityPause:
        return const Color(0xFFFEF3C7); // Soft light yellow
      case NotificationCategory.paymentSuccess:
        return const Color(0xFFD1FAE5); // Soft light green
      case NotificationCategory.accountWarning:
        return const Color(0xFFFEE2E2); // Soft light red
      case NotificationCategory.info:
        return const Color(0xFFDBEAFE); // Soft light blue
    }
  }

  Color _getIconColor() {
    switch (item.category) {
      case NotificationCategory.newDevice:
      case NotificationCategory.securityPause:
        return const Color(0xFFD97706); // Amber / Yellow
      case NotificationCategory.paymentSuccess:
        return const Color(0xFF059669); // Green
      case NotificationCategory.accountWarning:
        return const Color(0xFFDC2626); // Red
      case NotificationCategory.info:
        return const Color(0xFF2563EB); // Blue
    }
  }

  @override
  Widget build(BuildContext context) {
    final isUnread = item.isUnread;

    // Card background and border based on unread status
    final cardBgColor = isUnread ? const Color(0xFFFFFBEB) : Colors.white;
    final cardBorderColor = isUnread ? const Color(0xFFFDE68A) : const Color(0xFFE5E7EB);

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: cardBgColor,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: cardBorderColor, width: 1),
        boxShadow: isUnread
            ? [
                BoxShadow(
                  color: const Color(0xFFFDE68A).withOpacity(0.3),
                  blurRadius: 8,
                  offset: const Offset(0, 2),
                ),
              ]
            : [
                BoxShadow(
                  color: Colors.black.withOpacity(0.02),
                  blurRadius: 4,
                  offset: const Offset(0, 2),
                ),
              ],
      ),
      child: Material(
        color: Colors.transparent,
        borderRadius: BorderRadius.circular(16),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(16),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Leading Icon with soft circular background and blue dot indicator if unread
                Stack(
                  clipBehavior: Clip.none,
                  children: [
                    Container(
                      width: 44,
                      height: 44,
                      decoration: BoxDecoration(
                        color: _getIconBgColor(),
                        shape: BoxShape.circle,
                      ),
                      child: Icon(
                        _getIconData(),
                        color: _getIconColor(),
                        size: 22,
                      ),
                    ),
                    // Small blue dot indicator positioned near the icon when unread
                    if (isUnread)
                      Positioned(
                        top: 0,
                        right: 0,
                        child: Container(
                          width: 10,
                          height: 10,
                          decoration: BoxDecoration(
                            color: const Color(0xFF2563EB), // Bright blue
                            shape: BoxShape.circle,
                            border: Border.all(color: cardBgColor, width: 1.5),
                          ),
                        ),
                      ),
                  ],
                ),
                const SizedBox(width: 14),

                // Body: Title and Message
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Expanded(
                            child: Text(
                              item.title,
                              style: const TextStyle(
                                fontSize: 15,
                                fontWeight: FontWeight.bold,
                                color: Color(0xFF1E293B), // Dark text
                                height: 1.2,
                              ),
                            ),
                          ),
                          const SizedBox(width: 8),
                          // Trailing timestamp aligned to top-right
                          Text(
                            item.timestamp,
                            style: const TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w400,
                              color: Color(0xFF9CA3AF), // Small, light gray text
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 6),
                      Text(
                        item.message,
                        style: const TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.normal,
                          color: Color(0xFF4B5563), // Dark gray, regular weight
                          height: 1.4,
                        ),
                      ),
                      if (item.category == NotificationCategory.newDevice && !item.isVerified) ...[
                        const SizedBox(height: 8),
                        Row(
                          children: const [
                            Text(
                              'Tap to review.',
                              style: TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.bold,
                                color: Color(0xFF2563EB), // Bright blue bold
                              ),
                            ),
                            SizedBox(width: 4),
                            Icon(
                              Icons.arrow_forward_ios_rounded,
                              size: 12,
                              color: Color(0xFF2563EB),
                            ),
                          ],
                        ),
                      ] else if (item.isVerified) ...[
                        const SizedBox(height: 8),
                        Row(
                          children: const [
                            Icon(
                              Icons.check_circle_rounded,
                              size: 14,
                              color: Color(0xFF059669),
                            ),
                            SizedBox(width: 4),
                            Text(
                              'Device Verified',
                              style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w600,
                                color: Color(0xFF059669),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
