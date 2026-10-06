import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:fincore_mobile/screens/notifications_screen.dart';
import 'package:fincore_mobile/widgets/notification_card.dart';

void main() {
  group('NotificationsScreen Tests', () {
    testWidgets('Renders header with Notifications title, 2 unread subtitle, and Clear All button', (WidgetTester tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: NotificationsScreen(),
        ),
      );
      await tester.pumpAndSettle();

      // Check header title and subtitle
      expect(find.text('Notifications'), findsOneWidget);
      expect(find.text('2 unread'), findsOneWidget);
      expect(find.text('Clear All'), findsOneWidget);

      // Check back button exists
      expect(find.byIcon(Icons.arrow_back), findsOneWidget);
    });

    testWidgets('Renders notification list cards with correct titles and intent icons', (WidgetTester tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: NotificationsScreen(),
        ),
      );
      await tester.pumpAndSettle();

      // Check NotificationCard widgets
      expect(find.byType(NotificationCard), findsNWidgets(5));
      expect(find.text('New Device Detected'), findsOneWidget);
      expect(find.text('Account Security Pause'), findsOneWidget);
      expect(find.text('Transfer Completed'), findsOneWidget);
      expect(find.text('Security Alert'), findsOneWidget);
      expect(find.text('System Update'), findsOneWidget);

      // Check specific intent icons
      expect(find.byIcon(Icons.shield_outlined), findsAtLeastNWidgets(1));
      expect(find.byIcon(Icons.pause_circle_outline), findsOneWidget);
      expect(find.byIcon(Icons.check_circle_outline), findsOneWidget);
      expect(find.byIcon(Icons.warning_amber_rounded), findsOneWidget);
      expect(find.byIcon(Icons.info_outline), findsOneWidget);
    });

    testWidgets('Tapping Clear All updates subtitle to 0 unread', (WidgetTester tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: NotificationsScreen(),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('2 unread'), findsOneWidget);

      await tester.tap(find.text('Clear All'));
      await tester.pumpAndSettle();

      expect(find.text('0 unread'), findsOneWidget);
    });

    testWidgets('Tapping New Device Detected opens modal bottom sheet with prompt and buttons', (WidgetTester tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: NotificationsScreen(),
        ),
      );
      await tester.pumpAndSettle();

      // Tap on New Device card
      await tester.tap(find.text('New Device Detected'));
      await tester.pumpAndSettle();

      // Verify modal content
      expect(find.text("We don't recognize this device. Is this you?"), findsOneWidget);
      expect(find.text("Yes, it's me"), findsOneWidget);
      expect(find.text("No, secure account"), findsOneWidget);

      // Tap "No, secure account" button
      await tester.tap(find.text("No, secure account"));
      await tester.pumpAndSettle();

      // Verify modal is dismissed
      expect(find.text("We don't recognize this device. Is this you?"), findsNothing);
    });

    testWidgets('Tapping Yes, it me confirms device via API and updates UI state', (WidgetTester tester) async {
      final mockClient = MockClient((request) async {
        return http.Response(
          jsonEncode({'message': 'Device session upgraded from Unverified to Verified successfully.'}),
          200,
          headers: {'content-type': 'application/json'},
        );
      });

      await tester.pumpWidget(
        MaterialApp(
          home: NotificationsScreen(httpClient: mockClient),
        ),
      );
      await tester.pumpAndSettle();

      // Tap on New Device card
      await tester.tap(find.text('New Device Detected'));
      await tester.pumpAndSettle();

      // Tap "Yes, it's me" button
      final yesButton = find.text("Yes, it's me");
      await tester.ensureVisible(yesButton);
      await tester.tap(yesButton);
      await tester.pump(Duration.zero);
      await tester.pumpAndSettle();

      // Verify modal is dismissed and device is marked as verified
      expect(find.text("We don't recognize this device. Is this you?"), findsNothing);
      expect(find.text('Device Verified'), findsOneWidget);
    });
  });
}
