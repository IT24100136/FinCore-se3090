import 'package:flutter/material.dart';

class TransactionStatusScreen extends StatelessWidget {
  final String referenceId;
  final double amount;
  final String recipient;
  final String status;

  const TransactionStatusScreen({
    super.key,
    required this.referenceId,
    required this.amount,
    required this.recipient,
    required this.status,
  });

  String _formatAmount(double v) {
    final s = v.toStringAsFixed(2);
    final parts = s.split('.');
    final intPart = parts[0].replaceAllMapped(
        RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'), (m) => '${m[1]},');
    return '$intPart.${parts[1]}';
  }

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
            onPressed: () => Navigator.pop(context),
          ),
        ],
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              const SizedBox(height: 28),
              // Pause Icon in yellow circle
              Container(
                width: 80,
                height: 80,
                decoration: BoxDecoration(
                  color: const Color(0xFFFFF9E6),
                  shape: BoxShape.circle,
                  border:
                      Border.all(color: const Color(0xFFF9A825).withValues(alpha: 0.3), width: 1.5),
                ),
                child: const Center(
                  child: Icon(
                    Icons.pause_rounded,
                    color: Color(0xFFF9A825),
                    size: 38,
                  ),
                ),
              ),
              const SizedBox(height: 16),
              const Text(
                'Held for Review',
                style: TextStyle(
                  fontSize: 22,
                  fontWeight: FontWeight.bold,
                  color: Color(0xFFE65100),
                ),
              ),
              const SizedBox(height: 24),
              // Transaction Details Card
              Container(
                width: double.infinity,
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: const Color(0xFFEEF0F5)),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.05),
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
                    _buildDetailRow('Reference ID', referenceId,
                        valueWeight: FontWeight.bold),
                    _buildDetailRow('Amount',
                        'Rs. ${_formatAmount(amount)} LKR',
                        valueWeight: FontWeight.bold),
                    _buildDetailRow('Recipient', recipient,
                        valueWeight: FontWeight.bold),
                    _buildDetailRow('Date / Time', '$dateStr · $timeStr'),
                    _buildDetailRowRichRisk(),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              // Warning box
              Container(
                width: double.infinity,
                decoration: BoxDecoration(
                  color: const Color(0xFFFFFDE7),
                  borderRadius: BorderRadius.circular(14),
                  border:
                      Border.all(color: const Color(0xFFF9A825).withValues(alpha: 0.4)),
                ),
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: const [
                        Icon(Icons.warning_amber_rounded,
                            color: Color(0xFFE65100), size: 18),
                        SizedBox(width: 6),
                        Text(
                          'Why is my transfer on hold?',
                          style: TextStyle(
                            color: Color(0xFFE65100),
                            fontWeight: FontWeight.bold,
                            fontSize: 13,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    RichText(
                      text: TextSpan(
                        style: const TextStyle(
                            fontSize: 13,
                            color: Color(0xFF8A6200),
                            height: 1.5),
                        children: [
                          const TextSpan(text: 'Your transfer of '),
                          TextSpan(
                            text: 'Rs. ${_formatAmount(amount)}',
                            style: const TextStyle(
                                fontWeight: FontWeight.bold,
                                color: Color(0xFFE65100)),
                          ),
                          const TextSpan(
                              text:
                                  ' is currently paused for security review because it was initiated from an unrecognized device and location. Our fraud prevention team is reviewing this request. '),
                          const TextSpan(
                            text: 'Funds have not left your account.',
                            style: TextStyle(fontWeight: FontWeight.bold),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 10),
                    const Text(
                      'Expected review time: 15–30 minutes',
                      style: TextStyle(
                        fontSize: 12,
                        color: Color(0xFF8A6200),
                        fontStyle: FontStyle.italic,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 28),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildDetailRow(String label, String value,
      {FontWeight valueWeight = FontWeight.normal}) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 11),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: const TextStyle(
              fontSize: 13,
              color: Color(0xFF8A94A6),
            ),
          ),
          Text(
            value,
            style: TextStyle(
              fontSize: 13,
              fontWeight: valueWeight,
              color: const Color(0xFF1A2340),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDetailRowRichRisk() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 11),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          const Text(
            'Risk Score',
            style: TextStyle(fontSize: 13, color: Color(0xFF8A94A6)),
          ),
          RichText(
            text: const TextSpan(
              style: TextStyle(fontSize: 13, color: Color(0xFF1A2340)),
              children: [
                TextSpan(
                  text: '87',
                  style: TextStyle(
                    fontWeight: FontWeight.bold,
                    color: Color(0xFFE53935),
                  ),
                ),
                TextSpan(text: ' / '),
                TextSpan(
                  text: '100',
                  style: TextStyle(fontWeight: FontWeight.bold),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
