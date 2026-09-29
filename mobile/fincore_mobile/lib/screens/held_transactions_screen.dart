import 'package:flutter/material.dart';
import '../models/held_transaction_model.dart';
import '../services/held_transaction_service.dart';
import 'flagged_transaction_screen.dart'; // Added import for your new screen

class HeldTransactionsScreen extends StatefulWidget {
  final String? customerId;

  const HeldTransactionsScreen({super.key, this.customerId});

  @override
  State<HeldTransactionsScreen> createState() => _HeldTransactionsScreenState();
}

class _HeldTransactionsScreenState extends State<HeldTransactionsScreen> {
  final HeldTransactionService _service = HeldTransactionService();

  bool _isLoading = true;
  List<HeldTransaction> _heldTransactions = [];

  @override
  void initState() {
    super.initState();
    _fetchHeldTransactions();
  }

  Future<void> _fetchHeldTransactions() async {
    setState(() => _isLoading = true);

    try {
      final items = await _service.getHeldTransactions(customerId: widget.customerId);
      if (mounted) {
        setState(() {
          _heldTransactions = items;
          _isLoading = false;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          _heldTransactions = [];
          _isLoading = false;
        });
      }
    }
  }

  // Updated to route directly to your new FlaggedTransactionScreen
  void _onTransactionTapped(HeldTransaction item) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => FlaggedTransactionScreen(
          amount: item.amount,
          transactionId: item.transactionId,
          primaryShapFeature: item.transactionCode, // Passes the code to your SHAP translator
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF4F6FA),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Color(0xFF1A2340)),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Text(
          'Held Transactions',
          style: TextStyle(
            color: Color(0xFF1A2340),
            fontSize: 18,
            fontWeight: FontWeight.bold,
          ),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded, color: Color(0xFF1A2340)),
            onPressed: _fetchHeldTransactions,
            tooltip: 'Refresh Queue',
          ),
        ],
      ),
      body: _isLoading
          ? const Center(
              child: CircularProgressIndicator(
                valueColor: AlwaysStoppedAnimation<Color>(Color(0xFF3B6FE8)),
              ),
            )
          : RefreshIndicator(
              onRefresh: _fetchHeldTransactions,
              color: const Color(0xFF3B6FE8),
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  _buildSecurityBanner(),
                  const SizedBox(height: 16),
                  if (_heldTransactions.isEmpty)
                    _buildEmptyState()
                  else
                    ..._heldTransactions.map((tx) => _buildHeldCard(tx)),
                ],
              ),
            ),
    );
  }

  Widget _buildSecurityBanner() {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFFFEF3C7).withValues(alpha: 0.6),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFFDE68A)),
      ),
      child: const Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(Icons.shield_outlined, color: Color(0xFFD97706), size: 22),
          SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Human Review in Progress',
                  style: TextStyle(
                    color: Color(0xFF92400E),
                    fontSize: 13,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                SizedBox(height: 3),
                Text(
                  'Our security gateway temporarily paused these transactions. Funds are safely reserved in your account.',
                  style: TextStyle(
                    color: Color(0xFF78350F),
                    fontSize: 11.5,
                    height: 1.35,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildHeldCard(HeldTransaction tx) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 6,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(14),
          onTap: () => _onTransactionTapped(tx),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Row(
                      children: [
                        Container(
                          width: 40,
                          height: 40,
                          decoration: BoxDecoration(
                            color: const Color(0xFFFFF8E1),
                            shape: BoxShape.circle,
                          ),
                          child: const Icon(
                            Icons.pause_rounded,
                            color: Color(0xFFF9A825),
                            size: 20,
                          ),
                        ),
                        const SizedBox(width: 12),
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Transfer to ${tx.recipientName}',
                              style: const TextStyle(
                                fontWeight: FontWeight.w600,
                                fontSize: 14,
                                color: Color(0xFF1A2340),
                              ),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              tx.transactionCode,
                              style: const TextStyle(
                                fontSize: 11,
                                color: Color(0xFF8A94A6),
                                fontFamily: 'monospace',
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                    Text(
                      '-${tx.formattedAmount}',
                      style: const TextStyle(
                        fontWeight: FontWeight.bold,
                        fontSize: 15,
                        color: Color(0xFF1A2340),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                const Divider(height: 1),
                const SizedBox(height: 10),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
                      decoration: BoxDecoration(
                        color: const Color(0xFFFFFBEB),
                        borderRadius: BorderRadius.circular(6),
                        border: Border.all(color: const Color(0xFFFDE68A)),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(Icons.timer_outlined, size: 12, color: Color(0xFFD97706)),
                          const SizedBox(width: 5),
                          Text(
                            'HELD • In Analyst Queue (Est. ~${tx.estimatedWaitMinutes}m)',
                            style: const TextStyle(
                              color: Color(0xFFB45309),
                              fontSize: 11,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          'Why Flagged?',
                          style: TextStyle(
                            color: Color(0xFF3B6FE8),
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        Icon(Icons.chevron_right, size: 14, color: Color(0xFF3B6FE8)),
                      ],
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 48),
        child: Column(
          children: [
            Container(
              padding: const EdgeInsets.all(16),
              decoration: const BoxDecoration(
                color: Color(0xFFE8F5E9),
                shape: BoxShape.circle,
              ),
              child: const Icon(
                Icons.check_circle_outline_rounded,
                size: 40,
                color: Color(0xFF2E7D32),
              ),
            ),
            const SizedBox(height: 16),
            const Text(
              'No Held Transactions',
              style: TextStyle(
                color: Color(0xFF1A2340),
                fontSize: 16,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 6),
            const Text(
              'All your transfers are clear and completed normally.',
              style: TextStyle(
                color: Color(0xFF8A94A6),
                fontSize: 12,
              ),
            ),
          ],
        ),
      ),
    );
  }
}