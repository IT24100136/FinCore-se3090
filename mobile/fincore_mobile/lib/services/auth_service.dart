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
    String? name,
    String? phoneNumber,
    String? pin,
    bool biometricEnabled = false,
    DateTime? dateOfBirth,
    String? address,
    String? city,
    String? postalCode,
    String? idType,
    String? idNumber,
    String? idDocumentUrl,
    String? selfieUrl,
    String? bankAccountNumber,
    String? bankRoutingCode,
    String? cardNumber,
    bool agreedToTerms = true,
    bool marketingOptIn = false,
    String role = 'Customer',
  }) async {
    final response = await http.post(
      Uri.parse('$baseUrl/register'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'email': email,
        'password': password,
        'name': name,
        'phoneNumber': phoneNumber,
        'pin': pin,
        'biometricEnabled': biometricEnabled,
        'dateOfBirth': dateOfBirth != null
            ? DateTime.utc(dateOfBirth.year, dateOfBirth.month, dateOfBirth.day).toIso8601String()
            : null,
        'address': address,
        'city': city,
        'postalCode': postalCode,
        'idType': idType,
        'idNumber': idNumber,
        'idDocumentUrl': idDocumentUrl,
        'selfieUrl': selfieUrl,
        'bankAccountNumber': bankAccountNumber,
        'bankRoutingCode': bankRoutingCode,
        'cardNumber': cardNumber,
        'agreedToTerms': agreedToTerms,
        'marketingOptIn': marketingOptIn,
        'role': role,
      }),
    );

    Map<String, dynamic> data = {};
    try {
      if (response.body.isNotEmpty) {
        data = jsonDecode(response.body) as Map<String, dynamic>;
      }
    } catch (_) {
      // Body was not JSON (e.g. server error page)
    }

    if (response.statusCode == 200) {
      if (data['token'] != null) {
        await saveToken(data['token']);
      }
      return {'success': true, 'data': data};
    } else {
      return {
        'success': false,
        'message': data['message'] ??
            (response.statusCode >= 500
                ? 'Server error (${response.statusCode})'
                : 'Registration failed (${response.statusCode})'),
      };
    }
  }

  static Future<Map<String, dynamic>?> getProfile() async {
    final token = await getToken();
    if (token == null) return null;
    try {
      final response = await http.get(
        Uri.parse('$baseUrl/profile'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
      );
      if (response.statusCode == 200) {
        return jsonDecode(response.body) as Map<String, dynamic>;
      }
    } catch (e) {
      debugPrint('Error fetching user profile: $e');
    }
    return null;
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

      // Extract User Profile and save to SecureStorage
      final userObj = data['user'] as Map<String, dynamic>?;
      final claims = parseJwt(token);

      final id = userObj?['id']?.toString() ?? claims?['UserId']?.toString() ?? claims?['sub']?.toString() ?? '';
      final name = userObj?['fullName']?.toString() ?? claims?['name']?.toString() ?? claims?['unique_name']?.toString() ?? email.split('@')[0];
      final userEmail = userObj?['email']?.toString() ?? claims?['email']?.toString() ?? email;
      final phone = userObj?['phoneNumber']?.toString();
      final role = userObj?['role']?.toString() ?? claims?['role']?.toString() ?? 'Customer';
      final rawWalletId = userObj?['walletId'];
      final walletId = rawWalletId is int ? rawWalletId : int.tryParse(rawWalletId?.toString() ?? '');

      await saveUserProfile(
        id: id,
        name: name,
        email: userEmail,
        phone: phone,
        role: role,
        walletId: walletId,
      );

      // Extract UserId and automatically hit /api/devices/verify
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
        'user': userObj,
        'message': data['message'],
        'deviceVerification': verification,
      };
    } else {
      return {'success': false, 'message': data['message'] ?? 'Login failed'};
    }
  }

  // ── OTP Verification Flow ──────────────────────────────────────────────────
  static Future<Map<String, dynamic>> sendOtp(
    String email, [
    String? password,
  ]) async {
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/otp/send'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'identifier': email.trim().toLowerCase(),
          'purpose': 'LOGIN',
        }),
      );

      final data = jsonDecode(response.body) as Map<String, dynamic>;
      if (response.statusCode == 200) {
        return {
          'success': true,
          'message': data['message'] ?? 'Verification code sent to $email.',
          'data': data,
        };
      } else {
        return {
          'success': false,
          'message': data['message'] ?? 'Failed to send verification code.',
        };
      }
    } catch (e) {
      return {
        'success': false,
        'message': 'Network error sending OTP: $e',
      };
    }
  }

  static Future<Map<String, dynamic>> verifyOtp(
    String email,
    String otpCode,
  ) async {
    try {
      final cleanEmail = email.trim().toLowerCase();
      final cleanCode = otpCode.trim();

      final response = await http.post(
        Uri.parse('$baseUrl/verify-otp'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'identifier': cleanEmail,
          'code': cleanCode,
          'purpose': 'LOGIN',
        }),
      );

      final data = jsonDecode(response.body) as Map<String, dynamic>;
      if (response.statusCode == 200 && data['token'] != null) {
        final token = data['token'] as String;

        // Store JWT securely using flutter_secure_storage
        await saveToken(token);

        // Extract profile and claims
        final userObj = data['user'] as Map<String, dynamic>?;
        final claims = parseJwt(token);

        final id = userObj?['id']?.toString() ??
            claims?['UserId']?.toString() ??
            claims?['sub']?.toString() ??
            '';
        final name = userObj?['fullName']?.toString() ??
            claims?['name']?.toString() ??
            claims?['unique_name']?.toString() ??
            cleanEmail.split('@')[0];
        final role = userObj?['role']?.toString() ??
            claims?['role']?.toString() ??
            'Customer';
        final rawWalletId = userObj?['walletId'];
        final walletId = rawWalletId is int
            ? rawWalletId
            : int.tryParse(rawWalletId?.toString() ?? '');

        await saveUserProfile(
          id: id,
          name: name,
          email: cleanEmail,
          phone: userObj?['phoneNumber']?.toString(),
          role: role,
          walletId: walletId,
        );

        // Optional device verification check
        final rawUserId = claims?['UserId'] ?? claims?['sub'] ?? claims?['nameid'] ?? 1;
        final userId = int.tryParse(rawUserId.toString()) ?? 1;
        final fingerprint = await getOrGenerateDeviceFingerprint();

        try {
          await verifyDevice(userId: userId, deviceFingerprint: fingerprint);
        } catch (_) {}

        return {
          'success': true,
          'token': token,
          'user': userObj,
          'message': data['message'] ?? 'Verification successful.',
        };
      } else {
        return {
          'success': false,
          'message': data['message'] ?? 'Invalid or expired verification code.',
        };
      }
    } catch (e) {
      return {
        'success': false,
        'message': 'Network error verifying OTP: $e',
      };
    }
  }

  static String formatAccountNumber(dynamic walletId) {
    final id = (walletId is int ? walletId : int.tryParse(walletId?.toString() ?? '1')) ?? 1;
    return 'ACC-${id.toString().padLeft(8, '0')}';
  }

  // ── Storage Operations ─────────────────────────────────────────────────────
  static Future<void> saveToken(String token) async {
    await _storage.write(key: 'jwt_token', value: token);
  }

  static Future<String?> getToken() async {
    return await _storage.read(key: 'jwt_token');
  }

  static Future<void> saveUserProfile({
    required String id,
    required String name,
    required String email,
    String? phone,
    String? role,
    int? walletId,
  }) async {
    await _storage.write(key: 'user_id', value: id);
    await _storage.write(key: 'user_name', value: name);
    await _storage.write(key: 'user_email', value: email);
    if (phone != null) await _storage.write(key: 'user_phone', value: phone);
    if (role != null) await _storage.write(key: 'user_role', value: role);
    if (walletId != null) {
      await _storage.write(key: 'wallet_id', value: walletId.toString());
      await _storage.write(key: 'account_number', value: formatAccountNumber(walletId));
    }
  }

  static Future<Map<String, dynamic>> getCurrentUser() async {
    final id = await _storage.read(key: 'user_id');
    final name = await _storage.read(key: 'user_name');
    final email = await _storage.read(key: 'user_email');
    final phone = await _storage.read(key: 'user_phone');
    final role = await _storage.read(key: 'user_role');
    final walletIdStr = await _storage.read(key: 'wallet_id');
    final walletIdInt = int.tryParse(walletIdStr ?? '') ?? 1;
    final savedAcc = await _storage.read(key: 'account_number');
    final accountNumber = (savedAcc != null && savedAcc.isNotEmpty) ? savedAcc : formatAccountNumber(walletIdInt);

    return {
      'id': id ?? '',
      'name': (name != null && name.isNotEmpty) ? name : (email != null ? email.split('@')[0] : 'Valued Member'),
      'email': email ?? '',
      'phone': phone ?? '',
      'role': role ?? 'Customer',
      'walletId': walletIdInt,
      'accountNumber': accountNumber,
    };
  }

  static Future<void> logout() async {
    await _storage.delete(key: 'jwt_token');
    await _storage.delete(key: 'user_id');
    await _storage.delete(key: 'user_name');
    await _storage.delete(key: 'user_email');
    await _storage.delete(key: 'user_phone');
    await _storage.delete(key: 'user_role');
    await _storage.delete(key: 'wallet_id');
  }
}
