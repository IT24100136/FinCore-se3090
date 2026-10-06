import 'package:flutter/material.dart';
import 'screens/login_screen.dart';
import 'screens/held_transactions_screen.dart';
import 'screens/transaction_history_screen.dart';

void main() {
  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'FinCore Mobile',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF2563EB)),
        useMaterial3: true,
      ),
      home: const LoginScreen(),
      routes: {
        '/held-transactions': (context) => const HeldTransactionsScreen(),
        '/transaction-history': (context) => const TransactionHistoryScreen(),
      },
      onGenerateRoute: (settings) {
        if (settings.name == '/transaction-flag-explanation') {
          final args = settings.arguments as Map<String, dynamic>?;
          return MaterialPageRoute(
            builder: (context) => Scaffold(
              backgroundColor: const Color(0xFFF4F6FA),
              appBar: AppBar(
                backgroundColor: Colors.white,
                elevation: 0,
                title: const Text(
                  'Transaction Explanation',
                  style: TextStyle(
                    color: Color(0xFF1A2340),
                    fontSize: 17,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                leading: IconButton(
                  icon: const Icon(Icons.arrow_back, color: Color(0xFF1A2340)),
                  onPressed: () => Navigator.of(context).pop(),
                ),
              ),
              body: Center(
                child: Padding(
                  padding: const EdgeInsets.all(24.0),
                  child: Container(
                    padding: const EdgeInsets.all(24),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(16),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withValues(alpha: 0.05),
                          blurRadius: 10,
                          offset: const Offset(0, 3),
                        ),
                      ],
                    ),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Container(
                          padding: const EdgeInsets.all(12),
                          decoration: const BoxDecoration(
                            color: Color(0xFFEBF3FF),
                            shape: BoxShape.circle,
                          ),
                          child: const Icon(
                            Icons.psychology_alt_rounded,
                            size: 48,
                            color: Color(0xFF3B6FE8),
                          ),
                        ),
                        const SizedBox(height: 16),
                        const Text(
                          "Student 2 / Explainability Module",
                          style: TextStyle(
                            color: Color(0xFF1A2340),
                            fontSize: 18,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        const SizedBox(height: 8),
                        const Text(
                          "Component C Seamless Handoff Boundary",
                          style: TextStyle(color: Color(0xFF8A94A6), fontSize: 13),
                        ),
                        const SizedBox(height: 14),
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 14,
                            vertical: 10,
                          ),
                          decoration: BoxDecoration(
                            color: const Color(0xFFF8FAFC),
                            borderRadius: BorderRadius.circular(10),
                            border: Border.all(color: const Color(0xFFE2E8F0)),
                          ),
                          child: Text(
                            "Transaction: ${args?['code'] ?? args?['transactionCode'] ?? 'TX-UNKNOWN'}\nID: ${args?['transactionId'] ?? 'N/A'}\nAmount: Rs. ${args?['amount'] ?? '0'}\nStatus: ${args?['status'] ?? 'Held'}",
                            textAlign: TextAlign.center,
                            style: const TextStyle(
                              color: Color(0xFF3B6FE8),
                              fontFamily: 'monospace',
                              fontSize: 13,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          );
        }
        return null;
      },
    );
  }
}
