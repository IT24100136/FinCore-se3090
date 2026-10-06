import 'package:flutter/foundation.dart';

class ApiConfig {
  /// Default live production backend on Render
  static const String defaultLiveUrl = 'https://fincore-se3090.onrender.com/api';

  /// Resolves the API base URL. Can be overridden via `--dart-define=API_URL=https://...`
  static String get baseUrl {
    const configured = String.fromEnvironment('API_URL');
    if (configured.isNotEmpty) {
      return configured.replaceAll(RegExp(r'/+$'), '');
    }
    // Default to the live Render backend for both release APKs and general use
    return defaultLiveUrl;
  }

  static String get authUrl => '$baseUrl/auth';
  static String get devicesUrl => '$baseUrl/devices';
  static String get walletsUrl => '$baseUrl/wallets';
  static String get transactionsUrl => '$baseUrl/transactions';
  static String get notificationsUrl => '$baseUrl/notifications';
}
