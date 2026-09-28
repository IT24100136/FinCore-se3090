import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:fincore_mobile/main.dart';

void main() {
  testWidgets('App renders LoginScreen smoke test', (WidgetTester tester) async {
    await tester.pumpWidget(const MyApp());

    expect(find.text('FinCore'), findsOneWidget);
    expect(find.byType(TextField), findsNWidgets(2));
  });
}
