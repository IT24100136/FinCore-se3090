import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

import 'package:fincore_mobile/screens/notifications_screen.dart';

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  group('FinCore Component D - Flutter Integration Test Suite', () {
    testWidgets(
      'End-to-end device confirmation flow from Notifications Screen',
      (WidgetTester tester) async {
        // 1. Mock HTTP Client for PUT /api/devices/confirm with 200 OK
        final mockHttpClient = MockClient((request) async {
          if (request.method == 'PUT' && request.url.path.contains('/api/devices/confirm')) {
            return http.Response(
              jsonEncode({
                'message': 'Device session upgraded from Unverified to Verified successfully.',
                'sessionId': 1,
                'userId': 1,
                'deviceFingerprint': 'fp-macbook-pro-m3-8f92a1',
                'status': 'Verified',
                'lastLoginAt': DateTime.now().toIso8601String()
              }),
              200,
              headers: {'content-type': 'application/json'},
            );
          }
          return http.Response(jsonEncode({'message': 'Not Found'}), 404);
        });

        // 2. Launch App starting at Wallet Home Screen
        await tester.pumpWidget(
          MaterialApp(
            home: NotificationsScreen(httpClient: mockHttpClient),
          ),
        );
        await tester.pumpAndSettle();

        // Verify initial Notifications Screen state
        expect(find.text('Notifications'), findsOneWidget);
        expect(find.text('2 unread'), findsOneWidget);

        // 3. Find "New Device Detected" card and tap it
        final newDeviceCard = find.text('New Device Detected');
        expect(newDeviceCard, findsOneWidget);

        await tester.tap(newDeviceCard);
        await tester.pumpAndSettle();

        // 4. Verify Bottom Sheet modal appears
        final modalHeader = find.text("We don't recognize this device. Is this you?");
        final yesButton = find.text("Yes, it's me");

        expect(modalHeader, findsOneWidget);
        expect(yesButton, findsOneWidget);

        // 5. Tap "Yes, it's me" button (triggers mocked 200 OK response from PUT /api/devices/confirm)
        await tester.ensureVisible(yesButton);
        await tester.tap(yesButton);
        await tester.pump();
        await tester.pumpAndSettle();

        // 6. Verifications:
        // A. Verify the modal closes (modal header no longer present)
        expect(find.text("We don't recognize this device. Is this you?"), findsNothing);

        // B. Verify SnackBar appears with success message
        expect(find.byType(SnackBar), findsOneWidget);
        expect(find.text('Device confirmed successfully!'), findsOneWidget);

        // C. Verify the unread counter updates from '2 unread' to '1 unread'
        expect(find.text('1 unread'), findsOneWidget);
        expect(find.text('Device Verified'), findsOneWidget);
      },
    );
  });
}
