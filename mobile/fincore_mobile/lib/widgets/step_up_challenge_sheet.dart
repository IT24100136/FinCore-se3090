import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../services/auth_service.dart';
import '../services/biometric_service.dart';
import '../services/wallet_service.dart';

class StepUpChallengeSheet extends StatefulWidget {
  final dynamic transactionId;
  final String referenceId;
  final double amount;
  final String recipient;
  final String senderAccountNumber;
  final int riskScore;
  final String? maskedEmail;

  const StepUpChallengeSheet({
    super.key,
    required this.transactionId,
    required this.referenceId,
    required this.amount,
    required this.recipient,
    required this.senderAccountNumber,
    required this.riskScore,
    this.maskedEmail,
  });

  static Future<Map<String, dynamic>?> show(
    BuildContext context, {
    required dynamic transactionId,
    required String referenceId,
    required double amount,
    required String recipient,
    required String senderAccountNumber,
    required int riskScore,
    String? maskedEmail,
  }) {
    return showModalBottomSheet<Map<String, dynamic>>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => StepUpChallengeSheet(
        transactionId: transactionId,
        referenceId: referenceId,
        amount: amount,
        recipient: recipient,
        senderAccountNumber: senderAccountNumber,
        riskScore: riskScore,
        maskedEmail: maskedEmail,
      ),
    );
  }

  @override
  State<StepUpChallengeSheet> createState() => _StepUpChallengeSheetState();
}

class _StepUpChallengeSheetState extends State<StepUpChallengeSheet> {
  final _walletService = WalletService();
  final _otpController = TextEditingController();
  bool _isLoading = false;
  String? _errorMessage;
  bool _showOtpField = false;
  String? _maskedEmail;
  bool _isResending = false;
  String? _resendSuccessMessage;
  int _resendCooldown = 0;
  Timer? _cooldownTimer;

  @override
  void initState() {
    super.initState();
    _maskedEmail = widget.maskedEmail;
    if (_maskedEmail == null || _maskedEmail!.isEmpty) {
      _loadUserEmail();
    }
  }

  Future<void> _loadUserEmail() async {
    try {
      final user = await AuthService.getCurrentUser();
      final email = user['email'] as String?;
      if (email != null && email.isNotEmpty && mounted) {
        setState(() {
          _maskedEmail = _maskEmail(email);
        });
      }
    } catch (_) {}
  }

  String _maskEmail(String email) {
    final parts = email.split('@');
    if (parts.length != 2) return email;
    final name = parts[0];
    final domain = parts[1];
    if (name.length <= 2) return '${name[0]}*@$domain';
    return '${name[0]}${'*' * (name.length > 5 ? 4 : name.length - 2)}${name[name.length - 1]}@$domain';
  }

  @override
  void dispose() {
    _otpController.dispose();
    _cooldownTimer?.cancel();
    super.dispose();
  }

  Future<void> _handleResendOtp() async {
    if (_isResending || _resendCooldown > 0) return;

    setState(() {
      _isResending = true;
      _errorMessage = null;
      _resendSuccessMessage = null;
    });

    try {
      final res = await _walletService.resendStepUpOtp(widget.transactionId);
      if (mounted) {
        setState(() {
          _isResending = false;
          if (res['maskedEmail'] != null) {
            _maskedEmail = res['maskedEmail'].toString();
          }
          _resendSuccessMessage = res['message'] ?? 'New verification code sent to your email!';
          _resendCooldown = 30;
        });

        _cooldownTimer?.cancel();
        _cooldownTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
          if (!mounted) {
            timer.cancel();
            return;
          }
          setState(() {
            if (_resendCooldown > 1) {
              _resendCooldown--;
            } else {
              _resendCooldown = 0;
              timer.cancel();
            }
          });
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isResending = false;
          _errorMessage = 'Failed to resend code: ${e.toString().replaceAll("Exception: ", "")}';
        });
      }
    }
  }

  String _formatAmount(double v) {
    final s = v.toStringAsFixed(2);
    final parts = s.split('.');
    final intPart = parts[0].replaceAllMapped(
        RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'), (m) => '${m[1]},');
    return '$intPart.${parts[1]}';
  }

  Future<void> _handleBiometricAuth() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final didAuth = await BiometricService.authenticate(
        context: context,
        localizedReason:
            'Authorize release of Rs. ${_formatAmount(widget.amount)} LKR from ${widget.senderAccountNumber}',
      );

      if (!didAuth) {
        if (mounted) {
          setState(() {
            _isLoading = false;
            _errorMessage = 'Biometric verification cancelled or unavailable. Use OTP below.';
            _showOtpField = true;
          });
        }
        return;
      }

      // Biometric check succeeded client-side -> invoke step-up-verify on backend
      final res = await _walletService.stepUpVerify(
        widget.transactionId,
        verificationType: 'BIOMETRIC',
        code: '123456',
      );

      if (mounted) {
        Navigator.of(context).pop({
          'verified': true,
          ...res,
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isLoading = false;
          _errorMessage = 'Verification error: ${e.toString().replaceAll("Exception: ", "")}';
        });
      }
    }
  }

  Future<void> _handleOtpVerify() async {
    final code = _otpController.text.trim();
    if (code.length < 6) {
      setState(() => _errorMessage = 'Please enter the 6-digit verification code.');
      return;
    }

    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final res = await _walletService.stepUpVerify(
        widget.transactionId,
        verificationType: 'OTP',
        code: code,
      );

      if (mounted) {
        Navigator.of(context).pop({
          'verified': true,
          ...res,
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isLoading = false;
          _errorMessage = 'Invalid code or verification error: ${e.toString().replaceAll("Exception: ", "")}';
        });
      }
    }
  }

  void _fillDemoOtp() {
    _otpController.text = '123456';
    setState(() {
      _showOtpField = true;
      _errorMessage = null;
    });
  }

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.of(context).viewInsets.bottom;

    return Padding(
      padding: EdgeInsets.only(bottom: bottomInset),
      child: Container(
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        ),
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Drag Handle
              Center(
                child: Container(
                  width: 44,
                  height: 4,
                  margin: const EdgeInsets.only(bottom: 16),
                  decoration: BoxDecoration(
                    color: const Color(0xFFE2E8F0),
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),

              // Title Row
              Row(
                children: [
                  Container(
                    width: 44,
                    height: 44,
                    decoration: BoxDecoration(
                      color: const Color(0xFFFEF3C7),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: const Color(0xFFFDE68A)),
                    ),
                    child: const Icon(
                      Icons.shield_outlined,
                      color: Color(0xFFD97706),
                      size: 24,
                    ),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'Step-Up Security Challenge',
                          style: TextStyle(
                            fontSize: 17,
                            fontWeight: FontWeight.bold,
                            color: Color(0xFF1E293B),
                          ),
                        ),
                        const SizedBox(height: 2),
                        Row(
                          children: [
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                              decoration: BoxDecoration(
                                color: const Color(0xFFFFFBEB),
                                borderRadius: BorderRadius.circular(4),
                                border: Border.all(color: const Color(0xFFFDE68A)),
                              ),
                              child: Text(
                                'Risk Score: ${widget.riskScore}/100 · MEDIUM RISK',
                                style: const TextStyle(
                                  fontSize: 10,
                                  fontWeight: FontWeight.bold,
                                  color: Color(0xFFB45309),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ],
              ),

              const SizedBox(height: 16),

              // Transaction Summary Card
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: const Color(0xFFF8FAFC),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: const Color(0xFFE2E8F0)),
                ),
                child: Column(
                  children: [
                    _buildSummaryRow('Sender Account', widget.senderAccountNumber, isBold: true),
                    const SizedBox(height: 6),
                    _buildSummaryRow('Recipient', widget.recipient),
                    const SizedBox(height: 6),
                    _buildSummaryRow('Amount', 'Rs. ${_formatAmount(widget.amount)} LKR', isAmount: true),
                    const SizedBox(height: 6),
                    _buildSummaryRow('Reference ID', widget.referenceId),
                  ],
                ),
              ),

              const SizedBox(height: 14),

              // Explanation notice
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                decoration: BoxDecoration(
                  color: const Color(0xFFEFF6FF),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: const Color(0xFFBFDBFE)),
                ),
                child: const Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Icon(Icons.info_outline, size: 16, color: Color(0xFF2563EB)),
                    SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        'This transfer requires step-up verification under FinCore security policy. Confirm your identity to instantly clear the hold and credit the recipient.',
                        style: TextStyle(fontSize: 11.5, color: Color(0xFF1E40AF), height: 1.35),
                      ),
                    ),
                  ],
                ),
              ),

              if (_errorMessage != null) ...[
                const SizedBox(height: 12),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  decoration: BoxDecoration(
                    color: const Color(0xFFFEF2F2),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: const Color(0xFFFCA5A5)),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.error_outline, size: 16, color: Color(0xFFDC2626)),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          _errorMessage!,
                          style: const TextStyle(fontSize: 12, color: Color(0xFFB91C1C)),
                        ),
                      ),
                    ],
                  ),
                ),
              ],

              const SizedBox(height: 20),

              if (_isLoading) ...[
                const Center(
                  child: Padding(
                    padding: EdgeInsets.symmetric(vertical: 20),
                    child: Column(
                      children: [
                        CircularProgressIndicator(color: Color(0xFF3B6FE8)),
                        SizedBox(height: 12),
                        Text(
                          'Verifying step-up challenge...',
                          style: TextStyle(fontSize: 13, color: Color(0xFF64748B)),
                        ),
                      ],
                    ),
                  ),
                ),
              ] else ...[
                // Primary Option: Biometrics
                SizedBox(
                  height: 50,
                  child: ElevatedButton.icon(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF3B6FE8),
                      foregroundColor: Colors.white,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      elevation: 0,
                    ),
                    icon: const Icon(Icons.fingerprint_rounded, size: 22),
                    label: const Text(
                      'Verify via Biometrics',
                      style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold),
                    ),
                    onPressed: _handleBiometricAuth,
                  ),
                ),

                const SizedBox(height: 14),

                // Secondary Option: 6-Digit Email OTP Accordion / Toggle
                if (!_showOtpField) ...[
                  OutlinedButton.icon(
                    style: OutlinedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 13),
                      side: const BorderSide(color: Color(0xFFCBD5E1)),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                    icon: const Icon(Icons.mark_email_read_outlined, size: 18, color: Color(0xFF1E293B)),
                    label: const Text(
                      'Or Verify with 6-Digit Email OTP',
                      style: TextStyle(fontSize: 14, color: Color(0xFF1E293B), fontWeight: FontWeight.w600),
                    ),
                    onPressed: () => setState(() => _showOtpField = true),
                  ),
                ] else ...[
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF8FAFC),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: const Color(0xFFE2E8F0)),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // Email OTP Sent Indicator
                        Container(
                          margin: const EdgeInsets.only(bottom: 10),
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
                          decoration: BoxDecoration(
                            color: const Color(0xFFF0FDF4),
                            borderRadius: BorderRadius.circular(8),
                            border: Border.all(color: const Color(0xFFBBF7D0)),
                          ),
                          child: Row(
                            children: [
                              const Icon(Icons.mark_email_read_outlined, size: 16, color: Color(0xFF16A34A)),
                              const SizedBox(width: 8),
                              Expanded(
                                child: Text(
                                  _maskedEmail != null && _maskedEmail!.isNotEmpty
                                      ? 'Verification code dispatched to $_maskedEmail'
                                      : 'Verification code sent to your registered email.',
                                  style: const TextStyle(fontSize: 11.5, color: Color(0xFF15803D), fontWeight: FontWeight.w600),
                                ),
                              ),
                            ],
                          ),
                        ),

                        if (_resendSuccessMessage != null) ...[
                          Container(
                            margin: const EdgeInsets.only(bottom: 10),
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
                            decoration: BoxDecoration(
                              color: const Color(0xFFEFF6FF),
                              borderRadius: BorderRadius.circular(8),
                              border: Border.all(color: const Color(0xFFBFDBFE)),
                            ),
                            child: Row(
                              children: [
                                const Icon(Icons.check_circle_outline, size: 15, color: Color(0xFF2563EB)),
                                const SizedBox(width: 6),
                                Expanded(
                                  child: Text(
                                    _resendSuccessMessage!,
                                    style: const TextStyle(fontSize: 11.5, color: Color(0xFF1D4ED8), fontWeight: FontWeight.w500),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],

                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            const Text(
                              'Enter 6-Digit Email Code',
                              style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF334155)),
                            ),
                            GestureDetector(
                              onTap: _fillDemoOtp,
                              child: Container(
                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                decoration: BoxDecoration(
                                  color: const Color(0xFFEFF6FF),
                                  borderRadius: BorderRadius.circular(6),
                                  border: Border.all(color: const Color(0xFF93C5FD)),
                                ),
                                child: const Text(
                                  'Auto-fill Demo (123456)',
                                  style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF2563EB)),
                                ),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 10),
                        TextField(
                          controller: _otpController,
                          keyboardType: TextInputType.number,
                          maxLength: 6,
                          textAlign: TextAlign.center,
                          style: const TextStyle(
                            fontSize: 20,
                            letterSpacing: 10,
                            fontWeight: FontWeight.bold,
                            fontFamily: 'monospace',
                            color: Color(0xFF1E293B),
                          ),
                          inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                          decoration: InputDecoration(
                            hintText: '123456',
                            counterText: '',
                            contentPadding: const EdgeInsets.symmetric(vertical: 10),
                            border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                            focusedBorder: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(10),
                              borderSide: const BorderSide(color: Color(0xFF3B6FE8), width: 1.5),
                            ),
                          ),
                        ),
                        const SizedBox(height: 10),

                        // Resend Email OTP Link
                        Center(
                          child: InkWell(
                            onTap: (_isResending || _resendCooldown > 0) ? null : _handleResendOtp,
                            borderRadius: BorderRadius.circular(6),
                            child: Padding(
                              padding: const EdgeInsets.symmetric(vertical: 4, horizontal: 8),
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  if (_isResending)
                                    const SizedBox(
                                      width: 12,
                                      height: 12,
                                      child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFF2563EB)),
                                    )
                                  else
                                    Icon(
                                      Icons.refresh_rounded,
                                      size: 14,
                                      color: _resendCooldown > 0 ? const Color(0xFF94A3B8) : const Color(0xFF2563EB),
                                    ),
                                  const SizedBox(width: 5),
                                  Text(
                                    _resendCooldown > 0
                                        ? 'Resend Code via Email (${_resendCooldown}s)'
                                        : 'Resend Code via Email',
                                    style: TextStyle(
                                      fontSize: 12,
                                      fontWeight: FontWeight.w600,
                                      color: _resendCooldown > 0 ? const Color(0xFF94A3B8) : const Color(0xFF2563EB),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ),

                        const SizedBox(height: 10),
                        SizedBox(
                          width: double.infinity,
                          height: 44,
                          child: ElevatedButton(
                            style: ElevatedButton.styleFrom(
                              backgroundColor: const Color(0xFF0F172A),
                              foregroundColor: Colors.white,
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                              elevation: 0,
                            ),
                            onPressed: _handleOtpVerify,
                            child: const Text(
                              'Confirm OTP & Release Transfer',
                              style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13.5),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],

                const SizedBox(height: 10),

                // Dismiss / Review Later Button
                TextButton(
                  onPressed: () => Navigator.of(context).pop(null),
                  child: const Text(
                    'Keep on Hold / Review Later',
                    style: TextStyle(color: Color(0xFF64748B), fontSize: 13),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildSummaryRow(String label, String value, {bool isBold = false, bool isAmount = false}) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          label,
          style: const TextStyle(fontSize: 12, color: Color(0xFF64748B)),
        ),
        Text(
          value,
          style: TextStyle(
            fontSize: isAmount ? 13.5 : 12.5,
            fontWeight: isBold || isAmount ? FontWeight.bold : FontWeight.w500,
            color: isAmount ? const Color(0xFF15803D) : const Color(0xFF1E293B),
          ),
        ),
      ],
    );
  }
}
