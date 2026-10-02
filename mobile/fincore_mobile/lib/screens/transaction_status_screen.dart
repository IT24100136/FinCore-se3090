import 'package:flutter/material.dart';
import 'held_transactions_screen.dart';
import 'wallet_home_screen.dart';

class TransactionStatusScreen extends StatelessWidget {
  final String referenceId;
  final double amount;
  final String recipient;
  final String status;
  final int? riskScore;
  final String? message;

  const TransactionStatusScreen({
    super.key,
    required this.referenceId,
    required this.amount,
    required this.recipient,
    required this.status,
    this.riskScore,
    this.message,
  });

  String _formatAmount(double v) {
    final s = v.toStringAsFixed(2);
    final parts = s.split('.');
    final intPart = parts[0].replaceAllMapped(
        RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'), (m) => '${m[1]},');
    return '$intPart.${parts[1]}';
  }

  bool get _isCompleted =>
      status.toUpperCase() == 'COMPLETED' || status.toUpperCase() == 'APPROVED';

  bool get _isPendingSecondApproval =>
      status.toUpperCase() == 'PENDINGSECONDAPPROVAL';

  bool get _isHeld =>
      !_isCompleted &&
      !_isPendingSecondApproval &&
      status.toUpperCase() != 'REJECTED' &&
      status.toUpperCase() != 'FAILED';

  bool get _isRejected =>
      status.toUpperCase() == 'REJECTED' || status.toUpperCase() == 'FAILED';

  @override
  Widget build(BuildContext context) {
    final now = DateTime.now();
    final dateStr =
        '${now.year}-${now.month.toString().padLeft(2, '0')}-${now.day.toString().padLeft(2, '0')}';
    final timeStr =
        '${now.hour.toString().padLeft(2, '0')}:${now.minute.toString().padLeft(2, '0')}';

    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        automaticallyImplyLeading: false,
        title: const Text(
          'Transaction Status',
          style: TextStyle(
            color: Color(0xFF1A2340),
            fontWeight: FontWeight.bold,
            fontSize: 18,
          ),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.close, color: Color(0xFF1A2340)),
            onPressed: () {
              Navigator.of(context).pushAndRemoveUntil(
                MaterialPageRoute(builder: (_) => const WalletHomeScreen()),
                (route) => false,
              );
            },
          ),
        ],
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              const SizedBox(height: 24),

              // ── Dynamic Status Icon ───────────────────────────────────────
              _buildStatusIcon(),

              const SizedBox(height: 16),

              // ── Dynamic Status Title & Subtitle ───────────────────────────
              Text(
                _getStatusTitle(),
                style: TextStyle(
                  fontSize: 22,
                  fontWeight: FontWeight.bold,
                  color: _getStatusColor(),
                ),
              ),
              const SizedBox(height: 6),
              Text(
                _getStatusSubtitle(),
                textAlign: TextAlign.center,
                style: const TextStyle(
                  fontSize: 13,
                  color: Color(0xFF64748B),
                ),
              ),

              const SizedBox(height: 24),

              // ── Transaction Details Card ──────────────────────────────────
              Container(
                width: double.infinity,
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: const Color(0xFFEEF0F5)),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.04),
                      blurRadius: 10,
                      offset: const Offset(0, 4),
                    ),
                  ],
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Padding(
                      padding: EdgeInsets.fromLTRB(16, 14, 16, 10),
                      child: Text(
                        'TRANSACTION DETAILS',
                        style: TextStyle(
                          fontSize: 10,
                          letterSpacing: 1.2,
                          fontWeight: FontWeight.w700,
                          color: Color(0xFF8A94A6),
                        ),
                      ),
                    ),
                    const Divider(height: 1, color: Color(0xFFEEF0F5)),
                    _buildDetailRow('Reference ID', referenceId, valueWeight: FontWeight.bold),
                    _buildDetailRow('Amount', 'Rs. ${_formatAmount(amount)} LKR', valueWeight: FontWeight.bold),
                    _buildDetailRow('Recipient', recipient, valueWeight: FontWeight.bold),
                    _buildDetailRow('Date / Time', '$dateStr · $timeStr'),
                    _buildStatusRow(),
                    _buildRiskScoreRow(),
                  ],
                ),
              ),

              const SizedBox(height: 16),

              // ── Dynamic Informational / Warning Box ────────────────────────
              _buildInfoOrWarningBox(),

              const SizedBox(height: 28),

              // ── Bottom Action Buttons ──────────────────────────────────────
              _buildActionButtons(context),

              const SizedBox(height: 20),
            ],
          ),
        ),
      ),
    );
  }

  // ── Icon Builder ───────────────────────────────────────────────────────────
  Widget _buildStatusIcon() {
    if (_isCompleted) {
      return Container(
        width: 80,
        height: 80,
        decoration: BoxDecoration(
          color: const Color(0xFFDCFCE7),
          shape: BoxShape.circle,
          border: Border.all(color: const Color(0xFF10B981).withValues(alpha: 0.4), width: 2),
        ),
        child: const Center(
          child: Icon(Icons.check_circle_rounded, color: Color(0xFF10B981), size: 44),
        ),
      );
    } else if (_isPendingSecondApproval) {
      return Container(
        width: 80,
        height: 80,
        decoration: BoxDecoration(
          color: const Color(0xFFEDE9FE),
          shape: BoxShape.circle,
          border: Border.all(color: const Color(0xFF8B5CF6).withValues(alpha: 0.4), width: 2),
        ),
        child: const Center(
          child: Icon(Icons.admin_panel_settings_rounded, color: Color(0xFF7C3AED), size: 40),
        ),
      );
    } else if (_isRejected) {
      return Container(
        width: 80,
        height: 80,
        decoration: BoxDecoration(
          color: const Color(0xFFFEE2E2),
          shape: BoxShape.circle,
          border: Border.all(color: const Color(0xFFEF4444).withValues(alpha: 0.4), width: 2),
        ),
        child: const Center(
          child: Icon(Icons.cancel_rounded, color: Color(0xFFDC2626), size: 42),
        ),
      );
    } else {
      // Held for Review
      return Container(
        width: 80,
        height: 80,
        decoration: BoxDecoration(
          color: const Color(0xFFFFF9E6),
          shape: BoxShape.circle,
          border: Border.all(color: const Color(0xFFF9A825).withValues(alpha: 0.4), width: 2),
        ),
        child: const Center(
          child: Icon(Icons.pause_rounded, color: Color(0xFFF9A825), size: 42),
        ),
      );
    }
  }

  // ── Header Text & Colors ───────────────────────────────────────────────────
  String _getStatusTitle() {
    if (_isCompleted) return 'Transfer Completed';
    if (_isPendingSecondApproval) return 'Pending Dual Authorization';
    if (_isRejected) return 'Transfer Rejected';
    return 'Held for Review';
  }

  String _getStatusSubtitle() {
    if (_isCompleted) return 'Funds have been delivered instantly to $recipient';
    if (_isPendingSecondApproval) return 'Statutory dual maker-checker authorization required';
    if (_isRejected) return 'The transaction could not be processed';
    return 'Initiated for security review by FinCore fraud prevention';
  }

  Color _getStatusColor() {
    if (_isCompleted) return const Color(0xFF15803D);
    if (_isPendingSecondApproval) return const Color(0xFF6D28D9);
    if (_isRejected) return const Color(0xFFDC2626);
    return const Color(0xFFE65100);
  }

  // ── Detail Rows ────────────────────────────────────────────────────────────
  Widget _buildDetailRow(String label, String value, {FontWeight valueWeight = FontWeight.normal}) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 11),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: const TextStyle(fontSize: 13, color: Color(0xFF8A94A6))),
          Text(value, style: TextStyle(fontSize: 13, fontWeight: valueWeight, color: const Color(0xFF1A2340))),
        ],
      ),
    );
  }

  Widget _buildStatusRow() {
    final Color badgeBg;
    final Color badgeText;
    final String label;

    if (_isCompleted) {
      badgeBg = const Color(0xFFDCFCE7);
      badgeText = const Color(0xFF166534);
      label = 'COMPLETED';
    } else if (_isPendingSecondApproval) {
      badgeBg = const Color(0xFFEDE9FE);
      badgeText = const Color(0xFF5B21B6);
      label = 'PENDING DUAL AUTHORIZATION';
    } else if (_isRejected) {
      badgeBg = const Color(0xFFFEE2E2);
      badgeText = const Color(0xFF991B1B);
      label = 'REJECTED';
    } else {
      badgeBg = const Color(0xFFFEF3C7);
      badgeText = const Color(0xFF92400E);
      label = 'HELD FOR REVIEW';
    }

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 11),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          const Text('Status', style: TextStyle(fontSize: 13, color: Color(0xFF8A94A6))),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(
              color: badgeBg,
              borderRadius: BorderRadius.circular(6),
            ),
            child: Text(
              label,
              style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: badgeText),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildRiskScoreRow() {
    final effectiveScore = riskScore ?? (_isCompleted ? 12 : 87);
    final Color scoreColor;
    final String scoreDesc;

    if (effectiveScore < 40) {
      scoreColor = const Color(0xFF16A34A);
      scoreDesc = 'Low Risk';
    } else if (effectiveScore < 70) {
      scoreColor = const Color(0xFFD97706);
      scoreDesc = 'Moderate Risk';
    } else {
      scoreColor = const Color(0xFFDC2626);
      scoreDesc = 'High Risk';
    }

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 11),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          const Text('Risk Evaluation', style: TextStyle(fontSize: 13, color: Color(0xFF8A94A6))),
          Row(
            children: [
              Text(
                '$effectiveScore / 100',
                style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: scoreColor),
              ),
              const SizedBox(width: 6),
              Text(
                '($scoreDesc)',
                style: TextStyle(fontSize: 12, color: scoreColor, fontWeight: FontWeight.w500),
              ),
            ],
          ),
        ],
      ),
    );
  }

  // ── Info or Warning Box ────────────────────────────────────────────────────
  Widget _buildInfoOrWarningBox() {
    if (_isCompleted) {
      return Container(
        width: double.infinity,
        decoration: BoxDecoration(
          color: const Color(0xFFF0FDF4),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: const Color(0xFF86EFAC).withValues(alpha: 0.6)),
        ),
        padding: const EdgeInsets.all(16),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Icon(Icons.verified_rounded, color: Color(0xFF16A34A), size: 22),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Instant Transfer Confirmed',
                    style: TextStyle(color: Color(0xFF166534), fontWeight: FontWeight.bold, fontSize: 13),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Your transfer of Rs. ${_formatAmount(amount)} LKR to $recipient was evaluated by FinCore AI security pipeline and completed with zero hold. Receipt has been logged.',
                    style: const TextStyle(fontSize: 12, color: Color(0xFF15803D), height: 1.4),
                  ),
                ],
              ),
            ),
          ],
        ),
      );
    } else if (_isPendingSecondApproval) {
      return Container(
        width: double.infinity,
        decoration: BoxDecoration(
          color: const Color(0xFFF5F3FF),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: const Color(0xFFC4B5FD).withValues(alpha: 0.7)),
        ),
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: const [
                Icon(Icons.shield_outlined, color: Color(0xFF6D28D9), size: 20),
                SizedBox(width: 8),
                Text(
                  'Statutory High-Value Threshold (>= 75,000 LKR)',
                  style: TextStyle(color: Color(0xFF5B21B6), fontWeight: FontWeight.bold, fontSize: 13),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Text(
              'Under central banking guidelines, transfers exceeding Rs. 75,000.00 require dual authorization. A secondary senior analyst will review and release this payment.',
              style: const TextStyle(fontSize: 12, color: Color(0xFF6D28D9), height: 1.4),
            ),
          ],
        ),
      );
    } else if (_isRejected) {
      return Container(
        width: double.infinity,
        decoration: BoxDecoration(
          color: const Color(0xFFFEF2F2),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: const Color(0xFFFCA5A5).withValues(alpha: 0.7)),
        ),
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: const [
                Icon(Icons.error_outline_rounded, color: Color(0xFFDC2626), size: 20),
                SizedBox(width: 8),
                Text(
                  'Transfer Cancelled or Declined',
                  style: TextStyle(color: Color(0xFFB91C1C), fontWeight: FontWeight.bold, fontSize: 13),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Text(
              message ?? 'This transaction was rejected by system risk rules. Any deducted funds will be restored immediately.',
              style: const TextStyle(fontSize: 12, color: Color(0xFFB91C1C), height: 1.4),
            ),
          ],
        ),
      );
    } else {
      // Held for Review
      return Container(
        width: double.infinity,
        decoration: BoxDecoration(
          color: const Color(0xFFFFFDE7),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: const Color(0xFFF9A825).withValues(alpha: 0.4)),
        ),
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: const [
                Icon(Icons.warning_amber_rounded, color: Color(0xFFE65100), size: 18),
                SizedBox(width: 6),
                Text(
                  'Why is my transfer on hold?',
                  style: TextStyle(color: Color(0xFFE65100), fontWeight: FontWeight.bold, fontSize: 13),
                ),
              ],
            ),
            const SizedBox(height: 8),
            RichText(
              text: TextSpan(
                style: const TextStyle(fontSize: 13, color: Color(0xFF8A6200), height: 1.5),
                children: [
                  const TextSpan(text: 'Your transfer of '),
                  TextSpan(
                    text: 'Rs. ${_formatAmount(amount)}',
                    style: const TextStyle(fontWeight: FontWeight.bold, color: Color(0xFFE65100)),
                  ),
                  const TextSpan(
                    text:
                        ' is currently paused for security review by our fraud prevention team. Funds have not left your account.',
                  ),
                ],
              ),
            ),
            const SizedBox(height: 10),
            const Text(
              'Expected review time: 15–30 minutes',
              style: TextStyle(fontSize: 12, color: Color(0xFF8A6200), fontStyle: FontStyle.italic),
            ),
          ],
        ),
      );
    }
  }

  // ── Bottom Action Buttons ──────────────────────────────────────────────────
  Widget _buildActionButtons(BuildContext context) {
    if (_isHeld) {
      return Column(
        children: [
          SizedBox(
            width: double.infinity,
            height: 48,
            child: ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFFE65100),
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              onPressed: () {
                Navigator.of(context).pushReplacement(
                  MaterialPageRoute(builder: (_) => const HeldTransactionsScreen()),
                );
              },
              child: const Text('View in Held Transactions', style: TextStyle(fontWeight: FontWeight.bold)),
            ),
          ),
          const SizedBox(height: 10),
          SizedBox(
            width: double.infinity,
            height: 48,
            child: OutlinedButton(
              style: OutlinedButton.styleFrom(
                side: const BorderSide(color: Color(0xFFCBD5E1)),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              onPressed: () {
                Navigator.of(context).pushAndRemoveUntil(
                  MaterialPageRoute(builder: (_) => const WalletHomeScreen()),
                  (route) => false,
                );
              },
              child: const Text('Back to Home', style: TextStyle(color: Color(0xFF1E293B))),
            ),
          ),
        ],
      );
    }

    return SizedBox(
      width: double.infinity,
      height: 48,
      child: ElevatedButton(
        style: ElevatedButton.styleFrom(
          backgroundColor: const Color(0xFF2563EB),
          foregroundColor: Colors.white,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        ),
        onPressed: () {
          Navigator.of(context).pushAndRemoveUntil(
            MaterialPageRoute(builder: (_) => const WalletHomeScreen()),
            (route) => false,
          );
        },
        child: const Text('Back to Dashboard', style: TextStyle(fontWeight: FontWeight.bold)),
      ),
    );
  }
}
