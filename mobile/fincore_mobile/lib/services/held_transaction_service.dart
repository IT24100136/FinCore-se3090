import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;
import '../models/held_transaction_model.dart';
import 'auth_service.dart';

class HeldTransactionService {
  static const FlutterSecureStorage _storage = FlutterSecureStorage();

  /// Primary base URLs covering web (localhost) and android emulator (10.0.2.2)
  static List<String> get candidateBaseUrls {
    if (kIsWeb) {
      return const [
        'http://localhost:5007/api',
        'http://localhost:5000/api',
      ];
    }
    return const [
      'http://10.0.2.2:5007/api',
      'http://10.0.2.2:5000/api',
      'http://localhost:5007/api',
    ];
  }

  /// Returns realistic fallback demo items required by Component C specification
  static List<HeldTransaction> get fallbackHeldTransactions => [
        HeldTransaction(
          id: 'case-88291',
          transactionId: 'tx-88291',
          transactionCode: 'TRX-88291',
          recipientName: 'M. Fernando',
          amount: 75000.0,
          createdAt: DateTime.now().subtract(const Duration(minutes: 7)),
          status: 'PendingSecondApproval',
          estimatedWaitMinutes: 8,
          priority: 3,
          priorityLabel: 'CRITICAL',
          riskScore: 88,
        ),
        HeldTransaction(
          id: 'case-88289',
          transactionId: 'tx-88289',
          transactionCode: 'TRX-88289',
          recipientName: 'S. Gunasekara',
          amount: 48000.0,
          createdAt: DateTime.now().subtract(const Duration(minutes: 18)),
          status: 'Queued',
          estimatedWaitMinutes: 14,
          priority: 2,
          priorityLabel: 'HIGH',
          riskScore: 62,
        ),
      ];

  /// Fetches held transactions from the backend API
  Future<List<HeldTransaction>> getHeldTransactions({String? customerId}) async {
    final effectiveCustomerId = (customerId != null && customerId.isNotEmpty)
        ? customerId
        : await _resolveCurrentCustomerId();

    final token = await _storage.read(key: 'jwt_token');
    final headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      if (token != null && token.isNotEmpty) 'Authorization': 'Bearer $token',
    };

    final List<HeldTransaction> results = [];
    final Set<String> seenCodes = {};
    bool backendReached = false;

    for (final base in candidateBaseUrls) {
      // 1. Check reviews held endpoint
      final endpoint = '$base/reviews/customer/$effectiveCustomerId/held';
      try {
        final uri = Uri.parse(endpoint);
        final response = await http
            .get(uri, headers: headers)
            .timeout(const Duration(seconds: 4));

        if (response.statusCode == 200) {
          backendReached = true;
          final dynamic data = jsonDecode(response.body);
          if (data is List) {
            for (final item in data) {
              final ht = HeldTransaction.fromJson(item as Map<String, dynamic>);
              if (seenCodes.add(ht.transactionCode)) {
                results.add(ht);
              }
            }
          }
        }
      } catch (e) {
        debugPrint('HeldTransactionService: reviews endpoint error: $e');
      }

      // 2. Also check user wallet history for any Pending/Held transactions
      final historyEndpoint = '$base/transactions/history?status=Pending';
      try {
        final uri = Uri.parse(historyEndpoint);
        final response = await http
            .get(uri, headers: headers)
            .timeout(const Duration(seconds: 4));

        if (response.statusCode == 200) {
          backendReached = true;
          final dynamic parsed = jsonDecode(response.body);
          final dynamic listData =
              parsed is Map && parsed['data'] != null ? parsed['data'] : parsed;
          if (listData is List) {
            for (final item in listData) {
              final ht = HeldTransaction.fromJson(item as Map<String, dynamic>);
              if (seenCodes.add(ht.transactionCode)) {
                results.add(ht);
              }
            }
          }
        }
      } catch (e) {
        debugPrint('HeldTransactionService: history endpoint error: $e');
      }

      if (backendReached) {
        return results;
      }
    }

    if (!backendReached) {
      return fallbackHeldTransactions;
    }
    return results;
  }

  /// Resolves the customer identifier from the JWT or stored preferences, default to USR-4421
  Future<String> _resolveCurrentCustomerId() async {
    try {
      final token = await _storage.read(key: 'jwt_token');
      if (token != null && token.isNotEmpty) {
        final claims = AuthService.parseJwt(token);
        if (claims != null) {
          final id = claims['UserId'] ??
              claims['sub'] ??
              claims['nameid'] ??
              claims['id'] ??
              claims['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier'];
          if (id != null) return id.toString();
        }
      }
    } catch (_) {}
    return 'USR-4421';
  }
}
