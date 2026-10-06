import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter/foundation.dart';
import '../config/api_config.dart';

class WalletService {
  static String get baseUrl => ApiConfig.baseUrl;

  final FlutterSecureStorage _storage = const FlutterSecureStorage();

  Future<String?> _getToken() async => await _storage.read(key: 'jwt_token');

  Map<String, String> _buildHeaders(String? token) => {
        'Content-Type': 'application/json',
        if (token != null) 'Authorization': 'Bearer $token',
      };

  // ── GET /wallets/balance ──────────────────────────────────────────────────
  Future<double> getBalance() async {
    final token = await _getToken();
    try {
      final res = await http.get(
        Uri.parse('$baseUrl/wallets/balance'),
        headers: _buildHeaders(token),
      ).timeout(const Duration(seconds: 4));
      if (res.statusCode == 200) {
        final data = jsonDecode(res.body);
        if (data['walletId'] != null) {
          final wid = data['walletId'].toString();
          await _storage.write(key: 'wallet_id', value: wid);
          final idNum = int.tryParse(wid) ?? 1;
          final accNum = 'ACC-${idNum.toString().padLeft(8, '0')}';
          await _storage.write(key: 'account_number', value: accNum);
        }
        if (data['accountNumber'] != null) {
          await _storage.write(key: 'account_number', value: data['accountNumber'].toString());
        }
        final bal = (data['balance'] as num).toDouble();
        await _storage.write(key: 'cached_balance', value: bal.toString());
        return bal;
      }
    } catch (_) {
      final cached = await _storage.read(key: 'cached_balance');
      if (cached != null) {
        final val = double.tryParse(cached);
        if (val != null) return val;
      }
      rethrow;
    }
    final cached = await _storage.read(key: 'cached_balance');
    if (cached != null) {
      final val = double.tryParse(cached);
      if (val != null) return val;
    }
    throw Exception('Failed to load balance');
  }

  Future<String> getAccountNumber() async {
    final acc = await _storage.read(key: 'account_number');
    if (acc != null && acc.isNotEmpty) return acc;
    final wid = await _storage.read(key: 'wallet_id');
    final id = int.tryParse(wid ?? '1') ?? 1;
    return 'ACC-${id.toString().padLeft(8, '0')}';
  }

  // ── POST /wallets/topup ───────────────────────────────────────────────────
  Future<Map<String, dynamic>> topUp(
    double amount, {
    String paymentMethodType = 'CARD',
    String? sourceReference,
  }) async {
    final token = await _getToken();
    final res = await http.post(
      Uri.parse('$baseUrl/wallets/topup'),
      headers: _buildHeaders(token),
      body: jsonEncode({
        'amount': amount,
        'paymentMethodType': paymentMethodType,
        if (sourceReference != null && sourceReference.isNotEmpty)
          'sourceReference': sourceReference,
      }),
    );
    if (res.statusCode == 200) return jsonDecode(res.body);
    throw Exception('Top up failed: ${res.body}');
  }

  // ── POST /transactions/transfer ───────────────────────────────────────────
  Future<Map<String, dynamic>> transfer(
      String recipientIdentifier, double amount,
      {String? note}) async {
    final token = await _getToken();
    final res = await http.post(
      Uri.parse('$baseUrl/transactions/transfer'),
      headers: _buildHeaders(token),
      body: jsonEncode({
        'recipientIdentifier': recipientIdentifier,
        'amount': amount,
        if (note != null && note.isNotEmpty) 'note': note,
      }),
    );
    if (res.statusCode == 200) {
      final data = jsonDecode(res.body);
      if (data['senderAccountNumber'] != null) {
        await _storage.write(key: 'account_number', value: data['senderAccountNumber'].toString());
      }
      return data;
    }
    throw Exception('Transfer failed: ${res.body}');
  }

  // ── POST /transactions/{id}/step-up-verify ──────────────────────────────
  Future<Map<String, dynamic>> stepUpVerify(
    dynamic transactionId, {
    String verificationType = 'OTP',
    String code = '123456',
  }) async {
    final token = await _getToken();
    final res = await http.post(
      Uri.parse('$baseUrl/transactions/$transactionId/step-up-verify'),
      headers: _buildHeaders(token),
      body: jsonEncode({
        'verificationType': verificationType,
        'code': code,
      }),
    );
    if (res.statusCode == 200) {
      final data = jsonDecode(res.body);
      if (data['senderBalance'] != null) {
        final bal = (data['senderBalance'] as num).toDouble();
        await _storage.write(key: 'cached_balance', value: bal.toString());
      }
      if (data['senderAccountNumber'] != null) {
        await _storage.write(key: 'account_number', value: data['senderAccountNumber'].toString());
      }
      return data;
    }
    final errData = jsonDecode(res.body);
    throw Exception(errData['message'] ?? 'Step-up verification failed (${res.statusCode})');
  }

  // ── POST /transactions/{id}/step-up-otp ──────────────────────────────────
  Future<Map<String, dynamic>> resendStepUpOtp(dynamic transactionId) async {
    final token = await _getToken();
    final res = await http.post(
      Uri.parse('$baseUrl/transactions/$transactionId/step-up-otp'),
      headers: _buildHeaders(token),
    );
    if (res.statusCode == 200) {
      return jsonDecode(res.body) as Map<String, dynamic>;
    }
    final errData = jsonDecode(res.body);
    throw Exception(errData['message'] ?? 'Failed to resend verification OTP (${res.statusCode})');
  }

  // ── GET /transactions/history (with filters + pagination) ─────────────────
  Future<Map<String, dynamic>> getHistory({
    String? status,
    DateTime? dateFrom,
    DateTime? dateTo,
    double? minAmount,
    double? maxAmount,
    String sort = 'desc',
    int page = 1,
    int pageSize = 20,
  }) async {
    final token = await _getToken();

    final params = <String, String>{
      'page': page.toString(),
      'pageSize': pageSize.toString(),
      'sort': sort,
      if (status != null && status != 'All') 'status': status,
      if (dateFrom != null)
        'dateFrom': dateFrom.toIso8601String().split('T')[0],
      if (dateTo != null) 'dateTo': dateTo.toIso8601String().split('T')[0],
      if (minAmount != null) 'minAmount': minAmount.toString(),
      if (maxAmount != null) 'maxAmount': maxAmount.toString(),
    };

    final uri = Uri.parse('$baseUrl/transactions/history')
        .replace(queryParameters: params);

    final res = await http.get(uri, headers: _buildHeaders(token));
    if (res.statusCode == 200) return jsonDecode(res.body);
    throw Exception('Failed to load history: ${res.statusCode}');
  }

  // ── GET /transactions/{id}/status ─────────────────────────────────────────
  Future<Map<String, dynamic>> getTransactionStatus(int id) async {
    final token = await _getToken();
    final res = await http.get(
      Uri.parse('$baseUrl/transactions/$id/status'),
      headers: _buildHeaders(token),
    );
    if (res.statusCode == 200) return jsonDecode(res.body);
    throw Exception('Failed to get status: ${res.statusCode}');
  }
}
