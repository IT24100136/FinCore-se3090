import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter/foundation.dart';

class WalletService {
  static String get baseUrl {
    if (kIsWeb) return 'http://localhost:5007/api';
    return 'http://10.0.2.2:5007/api';
  }

  final FlutterSecureStorage _storage = const FlutterSecureStorage();

  Future<String?> _getToken() async => await _storage.read(key: 'jwt_token');

  Map<String, String> _buildHeaders(String? token) => {
        'Content-Type': 'application/json',
        if (token != null) 'Authorization': 'Bearer $token',
      };

  // ── GET /wallets/balance ──────────────────────────────────────────────────
  Future<double> getBalance() async {
    final token = await _getToken();
    final res = await http.get(
      Uri.parse('$baseUrl/wallets/balance'),
      headers: _buildHeaders(token),
    );
    if (res.statusCode == 200) {
      return (jsonDecode(res.body)['balance'] as num).toDouble();
    }
    throw Exception('Failed to load balance: ${res.statusCode}');
  }

  // ── POST /wallets/topup ───────────────────────────────────────────────────
  Future<Map<String, dynamic>> topUp(double amount) async {
    final token = await _getToken();
    final res = await http.post(
      Uri.parse('$baseUrl/wallets/topup'),
      headers: _buildHeaders(token),
      body: jsonEncode({'amount': amount}),
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
    if (res.statusCode == 200) return jsonDecode(res.body);
    throw Exception('Transfer failed: ${res.body}');
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
