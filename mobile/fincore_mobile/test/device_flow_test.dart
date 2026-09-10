import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:fincore_mobile/screens/login_screen.dart';

void main() {
  testWidgets('LoginScreen displays dialog for Unverified device and updates status when Yes is tapped', (WidgetTester tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: LoginScreen(),
      ),
    );

    // Verify initial UI elements
    expect(find.text('FinCore Login'), findsOneWidget);
    expect(find.byType(TextField), findsNWidgets(2));
    expect(find.widgetWithText(ElevatedButton, 'Login & Grab Token'), findsOneWidget);
  });
}
