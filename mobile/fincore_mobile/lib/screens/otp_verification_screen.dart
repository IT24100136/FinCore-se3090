import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../services/auth_service.dart';

class OtpVerificationScreen extends StatefulWidget {
  final String identifier;
  final String purpose;
  final int? sessionId;
  final VoidCallback? onVerified;

  const OtpVerificationScreen({
    super.key,
    required this.identifier,
    this.purpose = 'VERIFICATION',
    this.sessionId,
    this.onVerified,
  });

  @override
  State<OtpVerificationScreen> createState() => _OtpVerificationScreenState();
}

class _OtpVerificationScreenState extends State<OtpVerificationScreen> {
  static const Color _navyBlue = Color(0xFF0F1E36);
  static const Color _accentBlue = Color(0xFF3B6FE8);

  final List<TextEditingController> _controllers =
      List.generate(6, (_) => TextEditingController());
  final List<FocusNode> _focusNodes = List.generate(6, (_) => FocusNode());

  int _countdownSeconds = 60;
  Timer? _timer;
  bool _isVerifying = false;
  bool _isResending = false;
  String? _errorMessage;
  String? _successMessage;

  @override
  void initState() {
    super.initState();
    _startCountdown();
  }

  void _startCountdown() {
    setState(() => _countdownSeconds = 60);
    _timer?.cancel();
    _timer = Timer.periodic(const Duration(seconds: 1), (t) {
      if (_countdownSeconds <= 1) {
        t.cancel();
        setState(() => _countdownSeconds = 0);
      } else {
        setState(() => _countdownSeconds -= 1);
      }
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    for (var c in _controllers) {
      c.dispose();
    }
    for (var f in _focusNodes) {
      f.dispose();
    }
    super.dispose();
  }

  String get _currentCode =>
      _controllers.map((c) => c.text.trim()).join();

  Future<void> _handleVerify() async {
    final code = _currentCode;
    if (code.length < 6) {
      setState(() => _errorMessage = 'Please enter all 6 digits of the code.');
      return;
    }

    setState(() {
      _isVerifying = true;
      _errorMessage = null;
      _successMessage = null;
    });

    try {
      final res = await AuthService.verifyOtp(
        identifier: widget.identifier,
        code: code,
        purpose: widget.purpose,
      );

      if (res['success'] == true) {
        if (widget.sessionId != null) {
          try {
            await AuthService.updateDeviceStatus(
              sessionId: widget.sessionId!,
              status: 'Verified',
            );
          } catch (_) {}
        }
        setState(() => _successMessage = 'Verification successful!');
        await Future.delayed(const Duration(milliseconds: 600));
        if (mounted) {
          if (widget.onVerified != null) {
            widget.onVerified!();
          } else {
            Navigator.of(context).pop(true);
          }
        }
      } else {
        setState(() => _errorMessage = res['message'] ?? 'Invalid code.');
      }
    } catch (e) {
      setState(() => _errorMessage = 'Verification failed: $e');
    } finally {
      if (mounted) setState(() => _isVerifying = false);
    }
  }

  Future<void> _handleResend() async {
    if (_countdownSeconds > 0 || _isResending) return;

    setState(() {
      _isResending = true;
      _errorMessage = null;
      _successMessage = null;
    });

    try {
      final res = await AuthService.sendOtp(
        identifier: widget.identifier,
        purpose: widget.purpose,
      );

      if (res['success'] == true) {
        setState(() => _successMessage = 'New code sent to ${widget.identifier}');
        _startCountdown();
      } else {
        setState(() => _errorMessage = res['message'] ?? 'Failed to resend code');
      }
    } catch (e) {
      setState(() => _errorMessage = 'Error resending code: $e');
    } finally {
      if (mounted) setState(() => _isResending = false);
    }
  }

  Widget _buildDigitBox(int index) {
    return SizedBox(
      width: 46,
      height: 54,
      child: TextFormField(
        controller: _controllers[index],
        focusNode: _focusNodes[index],
        keyboardType: TextInputType.number,
        textAlign: TextAlign.center,
        style: const TextStyle(
          fontSize: 22,
          fontWeight: FontWeight.bold,
          color: Color(0xFF0F172A),
        ),
        inputFormatters: [
          LengthLimitingTextInputFormatter(1),
          FilteringTextInputFormatter.digitsOnly,
        ],
        decoration: InputDecoration(
          contentPadding: EdgeInsets.zero,
          filled: true,
          fillColor: const Color(0xFFF8FAFC),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: const BorderSide(color: Color(0xFFCBD5E1), width: 1.5),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: const BorderSide(color: _accentBlue, width: 2),
          ),
        ),
        onChanged: (value) {
          if (value.isNotEmpty) {
            if (index < 5) {
              _focusNodes[index + 1].requestFocus();
            } else {
              _focusNodes[index].unfocus();
              _handleVerify();
            }
          } else if (index > 0) {
            _focusNodes[index - 1].requestFocus();
          }
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final String formattedTime =
        '00:${_countdownSeconds.toString().padLeft(2, '0')}';

    return Scaffold(
      backgroundColor: _navyBlue,
      body: SafeArea(
        child: Column(
          children: [
            // Top Bar
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              child: Row(
                children: [
                  IconButton(
                    icon: const Icon(Icons.arrow_back, color: Colors.white),
                    onPressed: () => Navigator.of(context).pop(false),
                  ),
                  const Text(
                    'Security Verification',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ],
              ),
            ),

            // Content Card
            Expanded(
              child: Container(
                width: double.infinity,
                decoration: const BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
                ),
                padding: const EdgeInsets.fromLTRB(24, 28, 24, 24),
                child: SingleChildScrollView(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.center,
                    children: [
                      // Shield Icon
                      Container(
                        width: 64,
                        height: 64,
                        decoration: BoxDecoration(
                          color: const Color(0xFFEFF6FF),
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: const Icon(
                          Icons.shield_outlined,
                          size: 34,
                          color: _accentBlue,
                        ),
                      ),
                      const SizedBox(height: 20),

                      const Text(
                        'Enter 6-Digit OTP',
                        style: TextStyle(
                          fontSize: 22,
                          fontWeight: FontWeight.bold,
                          color: Color(0xFF0F172A),
                        ),
                      ),
                      const SizedBox(height: 8),

                      Text(
                        'A 6-digit authorization code was dispatched to\n${widget.identifier}',
                        textAlign: TextAlign.center,
                        style: const TextStyle(
                          fontSize: 13,
                          color: Color(0xFF64748B),
                          height: 1.4,
                        ),
                      ),
                      const SizedBox(height: 24),

                      // Demo / Emulator Testing Hint
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                        decoration: BoxDecoration(
                          color: const Color(0xFFF1F5F9),
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: const Color(0xFFE2E8F0)),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const Icon(Icons.bolt, size: 16, color: Color(0xFFD97706)),
                            const SizedBox(width: 6),
                            const Text(
                              'Test Mode Default Code: ',
                              style: TextStyle(fontSize: 12, color: Color(0xFF475569)),
                            ),
                            GestureDetector(
                              onTap: () {
                                const testCode = '123456';
                                for (int i = 0; i < 6; i++) {
                                  _controllers[i].text = testCode[i];
                                }
                                setState(() {});
                              },
                              child: const Text(
                                '123456 (Tap to fill)',
                                style: TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.bold,
                                  color: _accentBlue,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 28),

                      // 6 Discrete Input Boxes
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: List.generate(6, (i) => _buildDigitBox(i)),
                      ),
                      const SizedBox(height: 20),

                      // Error Banner
                      if (_errorMessage != null)
                        Container(
                          padding: const EdgeInsets.all(10),
                          margin: const EdgeInsets.only(bottom: 16),
                          decoration: BoxDecoration(
                            color: const Color(0xFFFEF2F2),
                            borderRadius: BorderRadius.circular(8),
                            border: Border.all(color: const Color(0xFFFCA5A5)),
                          ),
                          child: Row(
                            children: [
                              const Icon(Icons.error_outline, color: Color(0xFFDC2626), size: 18),
                              const SizedBox(width: 8),
                              Expanded(
                                child: Text(
                                  _errorMessage!,
                                  style: const TextStyle(color: Color(0xFFDC2626), fontSize: 13),
                                ),
                              ),
                            ],
                          ),
                        ),

                      // Success Banner
                      if (_successMessage != null)
                        Container(
                          padding: const EdgeInsets.all(10),
                          margin: const EdgeInsets.only(bottom: 16),
                          decoration: BoxDecoration(
                            color: const Color(0xFFF0FDF4),
                            borderRadius: BorderRadius.circular(8),
                            border: Border.all(color: const Color(0xFF86EFAC)),
                          ),
                          child: Row(
                            children: [
                              const Icon(Icons.check_circle_outline, color: Color(0xFF16A34A), size: 18),
                              const SizedBox(width: 8),
                              Expanded(
                                child: Text(
                                  _successMessage!,
                                  style: const TextStyle(color: Color(0xFF16A34A), fontSize: 13),
                                ),
                              ),
                            ],
                          ),
                        ),

                      // Timer & Resend Button
                      Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          const Text(
                            "Didn't receive code? ",
                            style: TextStyle(fontSize: 13, color: Color(0xFF64748B)),
                          ),
                          if (_countdownSeconds > 0)
                            Text(
                              'Resend in $formattedTime',
                              style: const TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w600,
                                color: Color(0xFF94A3B8),
                              ),
                            )
                          else
                            TextButton(
                              onPressed: _isResending ? null : _handleResend,
                              style: TextButton.styleFrom(
                                padding: EdgeInsets.zero,
                                minimumSize: Size.zero,
                                tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                              ),
                              child: _isResending
                                  ? const SizedBox(
                                      width: 14,
                                      height: 14,
                                      child: CircularProgressIndicator(strokeWidth: 2),
                                    )
                                  : const Text(
                                      'Resend Code',
                                      style: TextStyle(
                                        fontSize: 13,
                                        fontWeight: FontWeight.bold,
                                        color: _accentBlue,
                                      ),
                                    ),
                            ),
                        ],
                      ),
                      const SizedBox(height: 32),

                      // Submit Button
                      SizedBox(
                        width: double.infinity,
                        height: 52,
                        child: ElevatedButton(
                          style: ElevatedButton.styleFrom(
                            backgroundColor: _accentBlue,
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(14),
                            ),
                            elevation: 0,
                          ),
                          onPressed: _isVerifying ? null : _handleVerify,
                          child: _isVerifying
                              ? const SizedBox(
                                  width: 22,
                                  height: 22,
                                  child: CircularProgressIndicator(
                                    color: Colors.white,
                                    strokeWidth: 2.5,
                                  ),
                                )
                              : const Text(
                                  'Verify & Proceed',
                                  style: TextStyle(
                                    color: Colors.white,
                                    fontSize: 16,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
