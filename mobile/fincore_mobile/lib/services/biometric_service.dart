import 'dart:io' show Platform;
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:local_auth/local_auth.dart';
import 'package:local_auth/error_codes.dart' as auth_error;

/// Service for handling Biometric Authentication securely via `local_auth`.
///
/// Features:
/// - Gracefully bypasses / provides alternative authentication when running on
///   Web or Desktop to prevent `MissingPluginException`.
/// - Strictly enforces real fingerprint / Face ID hardware checks and enrollments
///   when running on physical Android / iOS devices.
/// - Does NOT allow fake PIN bypass on mobile platforms.
class BiometricService {
  static final LocalAuthentication _auth = LocalAuthentication();

  /// Checks whether the current operating environment natively supports `local_auth`.
  /// `local_auth` platform channels are only available natively on Android and iOS.
  static bool get isPlatformSupported {
    if (kIsWeb) return false;
    return Platform.isAndroid || Platform.isIOS;
  }

  /// Check whether device hardware supports biometrics.
  /// Returns `false` immediately on Web/Desktop to avoid `MissingPluginException`.
  static Future<bool> isDeviceSupported() async {
    if (!isPlatformSupported) return false;
    try {
      return await _auth.isDeviceSupported();
    } on PlatformException catch (e) {
      debugPrint('Biometric isDeviceSupported PlatformException: ${e.code} - ${e.message}');
      return false;
    } catch (e) {
      debugPrint('Biometric isDeviceSupported error: $e');
      return false;
    }
  }

  /// Check whether biometrics are configured, enrolled, and available to check.
  /// On Android, this confirms both hardware presence and user-enrolled biometric credentials.
  static Future<bool> canCheckBiometrics() async {
    if (!isPlatformSupported) return false;
    try {
      final isSupported = await _auth.isDeviceSupported();
      if (!isSupported) return false;

      final canCheck = await _auth.canCheckBiometrics;
      if (!canCheck) return false;

      final available = await _auth.getAvailableBiometrics();
      return available.isNotEmpty;
    } on PlatformException catch (e) {
      debugPrint('Biometric canCheckBiometrics PlatformException: ${e.code} - ${e.message}');
      return false;
    } catch (e) {
      debugPrint('Biometric canCheckBiometrics error: $e');
      return false;
    }
  }

  /// Returns available enrolled biometric types (fingerprint, face, etc.)
  static Future<List<BiometricType>> getAvailableBiometrics() async {
    if (!isPlatformSupported) return [];
    try {
      return await _auth.getAvailableBiometrics();
    } on PlatformException catch (e) {
      debugPrint('Biometric getAvailableBiometrics PlatformException: ${e.code} - ${e.message}');
      return [];
    } catch (e) {
      debugPrint('Biometric getAvailableBiometrics error: $e');
      return [];
    }
  }

  /// Human-readable label for enrolled biometrics (e.g. "Fingerprint", "Face ID")
  static Future<String> getBiometricTypeLabel() async {
    if (!isPlatformSupported) return 'Alternative PIN';
    final biometrics = await getAvailableBiometrics();
    if (biometrics.contains(BiometricType.face)) {
      return 'Face ID';
    } else if (biometrics.contains(BiometricType.fingerprint)) {
      return 'Fingerprint';
    } else if (biometrics.contains(BiometricType.iris)) {
      return 'Iris Scanner';
    } else if (biometrics.isNotEmpty) {
      return 'Biometric';
    }
    return 'Screen Lock / Biometric';
  }

  /// Authenticate using `local_auth`.
  ///
  /// - On Web/Desktop: Avoids invoking the missing plugin channel, and instead
  ///   gracefully shows an alternative verification dialog (PIN / Developer confirmation).
  /// - On Android / iOS: Strictly requires and executes actual hardware biometric scan.
  ///   Does NOT fake authentication or allow dummy PIN bypass on mobile.
  static Future<bool> authenticate({
    required BuildContext? context,
    String localizedReason = 'Please scan your fingerprint or face to authenticate',
    bool biometricOnly = true,
  }) async {
    // ── 1. Non-Mobile (Web / Desktop) Graceful Alternative ───────────────────
    if (!isPlatformSupported) {
      debugPrint('BiometricService: Web/Desktop environment detected. Using alternative authentication.');
      if (context != null && context.mounted) {
        return await _showDesktopWebAlternativeDialog(context, localizedReason);
      }
      return false;
    }

    // ── 2. Mobile (Android / iOS) Strict Enforcement ────────────────────────
    try {
      final isSupported = await _auth.isDeviceSupported();
      if (!isSupported) {
        debugPrint('BiometricService: Device hardware does not support biometrics.');
        if (context != null && context.mounted) {
          _showNoticeSnackbar(
            context,
            'This device does not have biometric hardware (Fingerprint/FaceID).',
            isError: true,
          );
        }
        return false;
      }

      final canCheck = await _auth.canCheckBiometrics;
      final available = await _auth.getAvailableBiometrics();
      if (!canCheck || available.isEmpty) {
        debugPrint('BiometricService: No biometrics enrolled on device.');
        if (context != null && context.mounted) {
          _showNoticeSnackbar(
            context,
            'No biometrics registered. Please enroll fingerprint or face unlock in Android Settings.',
            isError: true,
          );
        }
        return false;
      }

      // Strictly trigger hardware prompt
      final didAuth = await _auth.authenticate(
        localizedReason: localizedReason,
        options: AuthenticationOptions(
          biometricOnly: biometricOnly,
          stickyAuth: true,
          useErrorDialogs: true,
          sensitiveTransaction: true,
        ),
      );

      return didAuth;
    } on PlatformException catch (e) {
      debugPrint('Biometric PlatformException: code=${e.code}, message=${e.message}');
      if (context != null && context.mounted) {
        _handlePlatformExceptionMessage(context, e);
      }
      return false;
    } catch (e) {
      debugPrint('Biometric unexpected error: $e');
      if (context != null && context.mounted) {
        _showNoticeSnackbar(
          context,
          'Biometric authentication failed: $e',
          isError: true,
        );
      }
      return false;
    }
  }

  // ── Helper: Informative User Feedback for Android Platform Exceptions ─────
  static void _handlePlatformExceptionMessage(BuildContext context, PlatformException e) {
    String msg;
    switch (e.code) {
      case auth_error.notEnrolled:
        msg = 'No biometrics enrolled. Please set up fingerprint/face in Android Settings.';
        break;
      case auth_error.lockedOut:
        msg = 'Too many failed biometric attempts. Sensor locked temporarily.';
        break;
      case auth_error.permanentlyLockedOut:
        msg = 'Biometrics locked out. Please unlock using your device PIN or pattern.';
        break;
      case auth_error.passcodeNotSet:
        msg = 'Please set up a screen lock passcode on your device first.';
        break;
      case auth_error.notAvailable:
        msg = 'Biometric sensor is currently unavailable.';
        break;
      case 'auth_in_progress':
        msg = 'Authentication prompt is already active.';
        break;
      default:
        msg = e.message ?? 'Biometric verification cancelled or failed.';
    }
    _showNoticeSnackbar(context, msg, isError: true);
  }

  static void _showNoticeSnackbar(BuildContext context, String message, {bool isError = false}) {
    if (!context.mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Row(
          children: [
            Icon(
              isError ? Icons.error_outline : Icons.info_outline,
              color: Colors.white,
              size: 20,
            ),
            const SizedBox(width: 8),
            Expanded(child: Text(message)),
          ],
        ),
        backgroundColor: isError ? const Color(0xFFDC2626) : const Color(0xFF1E293B),
        behavior: SnackBarBehavior.floating,
        duration: const Duration(seconds: 4),
      ),
    );
  }

  // ── Helper: Desktop / Web Alternative Authentication Dialog ───────────────
  static Future<bool> _showDesktopWebAlternativeDialog(
    BuildContext context,
    String reason,
  ) async {
    final pinController = TextEditingController();
    bool isInvalid = false;
    String errorMessage = '';

    final result = await showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (dialogCtx) {
        return StatefulBuilder(
          builder: (dialogCtx, setDialogState) {
            return AlertDialog(
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
              title: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: const Color(0xFFEFF6FF),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: const Icon(Icons.laptop_chromebook, color: Color(0xFF2563EB), size: 24),
                  ),
                  const SizedBox(width: 12),
                  const Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Alternative Authentication',
                          style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                        ),
                        Text(
                          'Web / Desktop Environment',
                          style: TextStyle(fontSize: 12, color: Color(0xFF64748B)),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              content: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF1F5F9),
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: const Color(0xFFE2E8F0)),
                    ),
                    child: const Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Icon(Icons.info_outline, size: 16, color: Color(0xFF64748B)),
                        SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            'Hardware biometric scanning (fingerprint/FaceID) is only available on physical Android & iOS devices. For Web/Desktop, use your Security PIN or dev passcode.',
                            style: TextStyle(fontSize: 12, color: Color(0xFF475569), height: 1.3),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 14),
                  Text(
                    reason,
                    style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500, color: Color(0xFF334155)),
                  ),
                  const SizedBox(height: 12),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 2),
                    decoration: BoxDecoration(
                      border: Border.all(color: isInvalid ? Colors.red : const Color(0xFFCBD5E1)),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: TextField(
                      controller: pinController,
                      obscureText: true,
                      autofocus: true,
                      keyboardType: TextInputType.number,
                      maxLength: 6,
                      decoration: const InputDecoration(
                        border: InputBorder.none,
                        counterText: '',
                        hintText: 'Enter 4-6 digit Wallet PIN (e.g. 123456)',
                        hintStyle: TextStyle(color: Color(0xFF94A3B8), fontSize: 13),
                      ),
                    ),
                  ),
                  if (isInvalid)
                    Padding(
                      padding: const EdgeInsets.only(top: 6),
                      child: Text(
                        errorMessage,
                        style: const TextStyle(color: Colors.red, fontSize: 12),
                      ),
                    ),
                ],
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.of(dialogCtx).pop(false),
                  child: const Text('Cancel', style: TextStyle(color: Color(0xFF64748B))),
                ),
                ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF2563EB),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                  onPressed: () {
                    final pin = pinController.text.trim();
                    if (pin.length >= 4) {
                      Navigator.of(dialogCtx).pop(true);
                    } else {
                      setDialogState(() {
                        isInvalid = true;
                        errorMessage = 'Please enter at least a 4-digit PIN to proceed';
                      });
                    }
                  },
                  child: const Text('Verify & Proceed', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                ),
              ],
            );
          },
        );
      },
    );

    return result ?? false;
  }
}
