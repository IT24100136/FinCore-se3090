import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;

class AuthService {
  // Use 10.0.2.2 for Android Emulator, localhost for iOS/Web/Desktop
  static String get baseUrl {
    if (kIsWeb) {
      return 'http://localhost:5007/api/auth';
    }
    return 'http://10.0.2.2:5007/api/auth';
  }

  static String get devicesBaseUrl {
    if (kIsWeb) {
      return 'http://localhost:5007/api/devices';
    }
    return 'http://10.0.2.2:5007/api/devices';
  }

  static const _storage = FlutterSecureStorage();

  static Future<String> getOrGenerateDeviceFingerprint() async {
    String? fp = await _storage.read(key: 'device_fingerprint');
    if (fp == null || fp.isEmpty) {
      fp = 'mobile-fp-${DateTime.now().millisecondsSinceEpoch}';
      await _storage.write(key: 'device_fingerprint', value: fp);
    }
    return fp;
  }

  static Map<String, dynamic>? parseJwt(String token) {
    try {
      final parts = token.split('.');
      if (parts.length != 3) return null;
      var payload = parts[1];
      while (payload.length % 4 != 0) {
        payload += '=';
      }
      final decoded = utf8.decode(base64Url.decode(payload));
      return jsonDecode(decoded) as Map<String, dynamic>;
    } catch (e) {
      return null;
    }
  }

  static Future<Map<String, dynamic>> verifyDevice({
    required int userId,
    required String deviceFingerprint,
    String ipAddress = '127.0.0.1',
  }) async {
    final response = await http.post(
      Uri.parse('$devicesBaseUrl/verify'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'userId': userId,
        'deviceFingerprint': deviceFingerprint,
        'ipAddress': ipAddress,
      }),
    );

    return jsonDecode(response.body) as Map<String, dynamic>;
  }

  static Future<Map<String, dynamic>> updateDeviceStatus({
    required int sessionId,
    required String status,
  }) async {
    final response = await http.put(
      Uri.parse('$devicesBaseUrl/$sessionId/status'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'status': status,
      }),
    );

    return jsonDecode(response.body) as Map<String, dynamic>;
  }

  static Future<Map<String, dynamic>> register({
    required String email,
    required String password,
    String role = 'Customer',
  }) async {
    final response = await http.post(
      Uri.parse('$baseUrl/register'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'email': email,
        'password': password,
        'role': role,
      }),
    );

    final data = jsonDecode(response.body);
    if (response.statusCode == 200) {
      return {'success': true, 'data': data};
    } else {
      return {'success': false, 'message': data['message'] ?? 'Registration failed'};
    }
  }

  static Future<Map<String, dynamic>> login({
    required String email,
    required String password,
  }) async {
    final response = await http.post(
      Uri.parse('$baseUrl/login'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'email': email,
        'password': password,
      }),
    );

    final data = jsonDecode(response.body);
    if (response.statusCode == 200 && data['token'] != null) {
      final token = data['token'] as String;
      await saveToken(token);

      // Extract UserId and automatically hit /api/devices/verify
      final claims = parseJwt(token);
      final rawUserId = claims?['UserId'] ?? claims?['sub'] ?? claims?['nameid'] ?? 1;
      final userId = int.tryParse(rawUserId.toString()) ?? 1;

      final fingerprint = await getOrGenerateDeviceFingerprint();

      Map<String, dynamic>? verification;
      try {
        verification = await verifyDevice(userId: userId, deviceFingerprint: fingerprint);
      } catch (e) {
        debugPrint('Device verification error: $e');
      }

      return {
        'success': true,
        'token': token,
        'message': data['message'],
        'deviceVerification': verification,
      };
    } else {
      return {'success': false, 'message': data['message'] ?? 'Login failed'};
    }
  }

  static Future<void> saveToken(String token) async {
    await _storage.write(key: 'jwt_token', value: token);
  }

  static Future<String?> getToken() async {
    return await _storage.read(key: 'jwt_token');
  }

  static Future<void> logout() async {
    await _storage.delete(key: 'jwt_token');
  }
}
