import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:fincore_mobile/screens/flagged_transaction_screen.dart';

void main() {
  group('SHAP Plain Language Explanation Tests', () {
    test('location_anomaly returns expected full explanation text', () {
      final text = getShapExplanationText(
        primaryShapFeature: 'location_anomaly',
        formattedAmount: 'Rs. 75,000.00',
      );
      expect(
        text,
        'Your transfer of Rs. 75,000.00 is currently paused for security review because it was initiated from an unrecognized device and location. Our fraud prevention team is reviewing this request. Funds have not left your account.',
      );
    });

    test('high_velocity returns expected full explanation text', () {
      final text = getShapExplanationText(
        primaryShapFeature: 'high_velocity',
        formattedAmount: 'Rs. 15,000.00',
      );
      expect(
        text,
        'Your transfer of Rs. 15,000.00 is paused because we noticed an unusual number of transactions on your account today. Funds have not left your account.',
      );
    });

    test('high_amount returns expected full explanation text', () {
      final text = getShapExplanationText(
        primaryShapFeature: 'high_amount',
        formattedAmount: 'Rs. 250,000.00',
      );
      expect(
        text,
        'Your transfer of Rs. 250,000.00 is paused because it is larger than your typical transfer activity. We are verifying it for your security. Funds have not left your account.',
      );
    });
  });

  group('FlaggedTransactionScreen Widget UI Tests', () {
    testWidgets('renders specific UI container with pale yellow background and location_anomaly',
        (WidgetTester tester) async {
      await tester.pumpWidget(
        MaterialApp(
          theme: ThemeData(
            colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF2563EB)),
            useMaterial3: true,
          ),
          home: const FlaggedTransactionScreen(
            amount: 75000.0,
            transactionId: 'TX-987654',
            primaryShapFeature: 'location_anomaly',
          ),
        ),
      );

      // Verify AppBar back button and title
      expect(find.byIcon(Icons.arrow_back), findsOneWidget);
      expect(find.text('Transaction Details'), findsOneWidget);

      // Verify prominent icon and status badge
      expect(find.byIcon(Icons.pending_actions_rounded), findsOneWidget);
      expect(find.text('UNDER REVIEW'), findsOneWidget);

      // Verify formatted amount
      expect(find.text('Rs. 75,000.00'), findsOneWidget);

      // Verify specific pale yellow / amber container top row
      expect(find.byIcon(Icons.warning_amber_rounded), findsOneWidget);
      expect(find.text('Why is my transfer on hold?'), findsOneWidget);

      // Verify RichText dynamic explanation contains key segments
      expect(find.byType(RichText), findsWidgets);
      final richTextFinder = find.byWidgetPredicate((widget) {
        if (widget is RichText) {
          final plain = widget.text.toPlainText();
          return plain.contains('unrecognized device and location') &&
              plain.contains('Funds have not left your account.');
        }
        return false;
      });
      expect(richTextFinder, findsOneWidget);

      // Verify italicized bottom text
      expect(find.text('Expected review time: 15–30 minutes'), findsOneWidget);

      // Verify Transaction ID
      expect(find.text('TX-987654'), findsOneWidget);

      // Verify buttons
      expect(find.text('Contact Support'), findsOneWidget);
      final cancelButtonFinder =
          find.widgetWithText(ElevatedButton, 'Cancel Transaction (Disabled)');
      expect(cancelButtonFinder, findsOneWidget);
      final ElevatedButton cancelButton = tester.widget(cancelButtonFinder);
      expect(cancelButton.enabled, isFalse);
    });

    testWidgets('renders high_velocity scenario in RichText',
        (WidgetTester tester) async {
      await tester.pumpWidget(
        MaterialApp(
          theme: ThemeData(
            colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF2563EB)),
            useMaterial3: true,
          ),
          home: const FlaggedTransactionScreen(
            amount: 12500.50,
            transactionId: 'TX-112233',
            primaryShapFeature: 'high_velocity',
          ),
        ),
      );

      final richTextFinder = find.byWidgetPredicate((widget) {
        if (widget is RichText) {
          final plain = widget.text.toPlainText();
          return plain.contains(
                  'we noticed an unusual number of transactions on your account today') &&
              plain.contains('Funds have not left your account.');
        }
        return false;
      });
      expect(richTextFinder, findsOneWidget);
      expect(find.text('Rs. 12,500.50'), findsOneWidget);
    });

    testWidgets('supports legacy fraudReasonCode backward compatibility',
        (WidgetTester tester) async {
      await tester.pumpWidget(
        MaterialApp(
          theme: ThemeData(
            colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF2563EB)),
            useMaterial3: true,
          ),
          home: const FlaggedTransactionScreen(
            amount: 30000.0,
            transactionId: 'TX-LEGACY',
            fraudReasonCode: 'high_velocity',
          ),
        ),
      );

      final richTextFinder = find.byWidgetPredicate((widget) {
        if (widget is RichText) {
          final plain = widget.text.toPlainText();
          return plain.contains(
              'we noticed an unusual number of transactions on your account today');
        }
        return false;
      });
      expect(richTextFinder, findsOneWidget);
    });
  });
}
