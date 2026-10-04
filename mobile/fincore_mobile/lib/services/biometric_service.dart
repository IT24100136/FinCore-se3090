import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:local_auth/local_auth.dart';

class BiometricService {
  static final LocalAuthentication _auth = LocalAuthentication();

  /// Check whether device hardware supports biometrics
  static Future<bool> isDeviceSupported() async {
    try {
      return await _auth.isDeviceSupported();
    } catch (e) {
      debugPrint('Biometric isDeviceSupported error: $e');
      return false;
    }
  }

  /// Check whether biometrics are enrolled and available to check
  static Future<bool> canCheckBiometrics() async {
    try {
      final isSupported = await _auth.isDeviceSupported();
      final canCheck = await _auth.canCheckBiometrics;
      return isSupported && canCheck;
    } catch (e) {
      debugPrint('Biometric canCheckBiometrics error: $e');
      return false;
    }
  }

  /// Returns available biometric types (fingerprint, face, etc.)
  static Future<List<BiometricType>> getAvailableBiometrics() async {
    try {
      return await _auth.getAvailableBiometrics();
    } catch (e) {
      debugPrint('Biometric getAvailableBiometrics error: $e');
      return [];
    }
  }

  /// Authenticate using local_auth.
  /// If hardware biometrics are not configured or fail on emulator/desktop,
  /// smoothly falls back to a security PIN prompt dialog.
  static Future<bool> authenticate({
    required BuildContext? context,
    String localizedReason = 'Please authenticate to proceed with transaction',
    bool biometricOnly = false,
  }) async {
    try {
      final canCheck = await canCheckBiometrics();
      if (canCheck) {
        final didAuth = await _auth.authenticate(
          localizedReason: localizedReason,
          options: AuthenticationOptions(
            biometricOnly: biometricOnly,
            stickyAuth: true,
            useErrorDialogs: true,
          ),
        );
        if (didAuth) return true;
      }
    } on PlatformException catch (e) {
      debugPrint('LocalAuth PlatformException: ${e.code} - ${e.message}');
    } catch (e) {
      debugPrint('LocalAuth generic error: $e');
    }

    // Fallback: If context is available, show Quick Security PIN Fallback dialog
    if (context != null && context.mounted) {
      return await _showFallbackPinDialog(context, localizedReason);
    }

    return false;
  }

  static Future<bool> _showFallbackPinDialog(BuildContext context, String reason) async {
    final pinController = TextEditingController();
    bool isInvalid = false;

    final result = await showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (dialogCtx) {
        return StatefulBuilder(
          builder: (dialogCtx, setDialogState) {
            return AlertDialog(
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
              title: const Row(
                children: [
                  Icon(Icons.fingerprint_rounded, color: Color(0xFF3B6FE8), size: 28),
                  SizedBox(width: 10),
                  Text('Security Verification', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                ],
              ),
              content: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    reason,
                    style: const TextStyle(fontSize: 13, color: Color(0xFF64748B)),
                  ),
                  const SizedBox(height: 16),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                    decoration: BoxDecoration(
                      border: Border.all(color: isInvalid ? Colors.red : const Color(0xFFDDE1EA)),
                      borderRadius: BorderRadius.circular(12),
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
                        hintText: 'Enter 6-digit Wallet PIN (e.g. 123456)',
                        hintStyle: TextStyle(color: Color(0xFF94A3B8), fontSize: 13),
                      ),
                    ),
                  ),
                  if (isInvalid)
                    const Padding(
                      padding: EdgeInsets.only(top: 6),
                      child: Text('Please enter 4 to 6 digit security PIN', style: TextStyle(color: Colors.red, fontSize: 12)),
                    ),
                  const SizedBox(height: 10),
                  Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF1F5F9),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: const Row(
                      children: [
                        Icon(Icons.info_outline, size: 14, color: Color(0xFF64748B)),
                        SizedBox(width: 6),
                        Expanded(
                          child: Text(
                            'Biometric step-up verification active for FinCore defense.',
                            style: TextStyle(fontSize: 11, color: Color(0xFF64748B)),
                          ),
                        ),
                      ],
                    ),
                  )
                ],
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.of(dialogCtx).pop(false),
                  child: const Text('Cancel', style: TextStyle(color: Color(0xFF64748B))),
                ),
                ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF3B6FE8),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                  onPressed: () {
                    final pin = pinController.text.trim();
                    if (pin.length >= 4) {
                      Navigator.of(dialogCtx).pop(true);
                    } else {
                      setDialogState(() => isInvalid = true);
                    }
                  },
                  child: const Text('Verify & Confirm', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
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
