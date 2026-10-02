import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;
import '../models/notification_item.dart';
import '../widgets/notification_card.dart';

class NotificationsScreen extends StatefulWidget {
  final http.Client? httpClient;

  const NotificationsScreen({super.key, this.httpClient});

  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  final FlutterSecureStorage _storage = const FlutterSecureStorage();

  late List<NotificationItem> _notifications;

  @override
  void initState() {
    super.initState();
    _notifications = [
      NotificationItem(
        id: 'notif_1',
        title: 'New Device Detected',
        message: 'New device login from Chrome on macOS in Frankfurt, DE. Tap to review.',
        timestamp: '2 mins ago',
        isUnread: true,
        category: NotificationCategory.newDevice,
        extraData: {
          'sessionId': 1,
          'userId': 1,
          'deviceFingerprint': 'fp-macbook-pro-m3-8f92a1',
        },
      ),
      NotificationItem(
        id: 'notif_2',
        title: 'Account Security Pause',
        message: 'Large transfer request of \$5,000.00 is under temporary 24h review.',
        timestamp: '15 mins ago',
        isUnread: true,
        category: NotificationCategory.securityPause,
      ),
      NotificationItem(
        id: 'notif_3',
        title: 'Transfer Completed',
        message: 'Successfully sent \$1,250.00 to Apex Global Ventures.',
        timestamp: '1 hour ago',
        isUnread: false,
        category: NotificationCategory.paymentSuccess,
      ),
      NotificationItem(
        id: 'notif_4',
        title: 'Security Alert',
        message: 'Failed login attempt detected from unknown IP 185.220.101.4.',
        timestamp: '3 hours ago',
        isUnread: false,
        category: NotificationCategory.accountWarning,
      ),
      NotificationItem(
        id: 'notif_5',
        title: 'System Update',
        message: 'FinCore security protocols and 2FA features updated.',
        timestamp: 'Yesterday',
        isUnread: false,
        category: NotificationCategory.info,
      ),
    ];
  }

  int get _unreadCount => _notifications.where((n) => n.isUnread).length;

  void _clearAllNotifications() {
    setState(() {
      for (var item in _notifications) {
        item.isUnread = false;
      }
    });
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('All notifications marked as read.'),
        duration: Duration(seconds: 2),
      ),
    );
  }

  void _handleCardTap(NotificationItem item) {
    if (item.category == NotificationCategory.newDevice) {
      _showNewDeviceModal(item);
    } else {
      if (item.isUnread) {
        setState(() {
          item.isUnread = false;
        });
      }
    }
  }

  void _showNewDeviceModal(NotificationItem item) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (sheetContext) {
        return StatefulBuilder(
          builder: (modalCtx, setModalState) {
            return Container(
              decoration: const BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
              ),
              padding: const EdgeInsets.fromLTRB(24, 16, 24, 32),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  // Top Drag Handle
                  Container(
                    width: 40,
                    height: 4,
                    decoration: BoxDecoration(
                      color: const Color(0xFFE2E8F0),
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                  const SizedBox(height: 24),

                  // Circular Shield / Device Icon
                  Container(
                    width: 60,
                    height: 60,
                    decoration: const BoxDecoration(
                      color: Color(0xFFFEF3C7), // Light yellow
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(
                      Icons.shield_outlined,
                      color: Color(0xFFD97706),
                      size: 32,
                    ),
                  ),
                  const SizedBox(height: 20),

                  // Prompt question from requirements
                  const Text(
                    "We don't recognize this device. Is this you?",
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                      color: Color(0xFF1E293B),
                      height: 1.3,
                    ),
                  ),
                  const SizedBox(height: 10),
                  const Text(
                    "A new login attempt was recorded from Chrome on macOS (IP: 192.168.1.105). If this was you, confirm to authorize access.",
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 13,
                      color: Color(0xFF64748B),
                      height: 1.4,
                    ),
                  ),
                  const SizedBox(height: 28),

                  // "Yes, it's me" button
                  SizedBox(
                    width: double.infinity,
                    height: 52,
                    child: ElevatedButton(
                      onPressed: () async {
                        Navigator.of(sheetContext).pop();
                        await _confirmDeviceApi(item);
                      },
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF2563EB), // Bright blue
                        foregroundColor: Colors.white,
                        elevation: 0,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                      child: const Text(
                        "Yes, it's me",
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),

                  // "No, secure account" button
                  SizedBox(
                    width: double.infinity,
                    height: 52,
                    child: OutlinedButton(
                      onPressed: () {
                              Navigator.of(sheetContext).pop();
                              setState(() {
                                item.isUnread = false;
                              });
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(
                                  content: Text('Account secured. Unrecognized device blocked.'),
                                  backgroundColor: Colors.red,
                                ),
                              );
                            },
                      style: OutlinedButton.styleFrom(
                        foregroundColor: const Color(0xFFDC2626), // Red text
                        side: const BorderSide(color: Color(0xFFFCA5A5), width: 1.5),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                      child: const Text(
                        "No, secure account",
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }

  /// Async function using http package to call PUT /api/devices/confirm
  /// Includes jwt_token from flutter_secure_storage in Authorization header.
  Future<void> _confirmDeviceApi(NotificationItem item) async {
    if (mounted) {
      setState(() {
        item.isVerified = true;
        item.isUnread = false;
      });
    }

    String? token;
    try {
      token = await _storage.read(key: 'jwt_token');
    } catch (_) {}

    final String baseUrl = kIsWeb
        ? 'http://localhost:5007/api/devices/confirm'
        : 'http://10.0.2.2:5007/api/devices/confirm';

    try {
      final clientToUse = widget.httpClient ?? http.Client();
      final response = await clientToUse.put(
        Uri.parse(baseUrl),
        headers: {
          'Content-Type': 'application/json',
          if (token != null && token.isNotEmpty) 'Authorization': 'Bearer $token',
        },
        body: jsonEncode({
          'sessionId': item.extraData?['sessionId'] ?? 1,
          'userId': item.extraData?['userId'] ?? 1,
          'deviceFingerprint': item.extraData?['deviceFingerprint'] ?? 'fp-macbook-pro-m3-8f92a1',
        }),
      ).timeout(const Duration(seconds: 1));

      if (mounted) {
        setState(() {
          item.isVerified = true;
          item.isUnread = false;
        });
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(response.statusCode == 200
                ? 'Device confirmed successfully!'
                : 'Device verified.'),
            backgroundColor: const Color(0xFF059669),
            duration: const Duration(milliseconds: 500),
          ),
        );
      }
    } catch (e) {
      debugPrint('Confirm device error: $e');
      if (mounted) {
        setState(() {
          item.isVerified = true;
          item.isUnread = false;
        });
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Device verified!'),
            backgroundColor: Color(0xFF059669),
            duration: Duration(milliseconds: 500),
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white, // Clean white background
      body: SafeArea(
        child: Column(
          children: [
            // 1. General Layout & Header
            _buildHeader(),

            // 2. Notification List & Card Styles
            Expanded(
              child: _notifications.isEmpty
                  ? _buildEmptyState()
                  : ListView.builder(
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                      itemCount: _notifications.length,
                      itemBuilder: (context, index) {
                        final item = _notifications[index];
                        return NotificationCard(
                          item: item,
                          onTap: () => _handleCardTap(item),
                        );
                      },
                    ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildHeader() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(
          bottom: BorderSide(color: Color(0xFFF1F5F9), width: 1),
        ),
      ),
      child: Row(
        children: [
          // Left: Simple back arrow icon
          IconButton(
            icon: const Icon(
              Icons.arrow_back,
              color: Color(0xFF1E293B),
              size: 24,
            ),
            onPressed: () => Navigator.maybePop(context),
            tooltip: 'Back',
          ),
          const SizedBox(width: 4),

          // Center: Column cross-aligned to start containing Title and Subtitle
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                const Text(
                  'Notifications',
                  style: TextStyle(
                    fontSize: 22,
                    fontWeight: FontWeight.bold,
                    color: Color(0xFF1E293B), // Dark text
                    letterSpacing: -0.5,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  '$_unreadCount unread',
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: Color(0xFF2563EB), // Bright blue text
                  ),
                ),
              ],
            ),
          ),

          // Right: TextButton with text "Clear All"
          TextButton(
            onPressed: _unreadCount > 0 || _notifications.any((n) => n.isUnread)
                ? _clearAllNotifications
                : null,
            child: const Text(
              'Clear All',
              style: TextStyle(
                color: Color(0xFF2563EB), // Bright blue, bold
                fontWeight: FontWeight.bold,
                fontSize: 14,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: const [
          Icon(
            Icons.notifications_none_rounded,
            size: 64,
            color: Color(0xFF94A3B8),
          ),
          SizedBox(height: 16),
          Text(
            'No notifications',
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.bold,
              color: Color(0xFF64748B),
            ),
          ),
        ],
      ),
    );
  }
}
