import 'package:flutter/material.dart';
import '../screens/held_transactions_screen.dart';
import '../screens/transaction_history_screen.dart';

class RecentActivityWidget extends StatelessWidget {
  final List<dynamic> transactions;
  final VoidCallback? onRefresh;

  const RecentActivityWidget({
    super.key,
    required this.transactions,
    this.onRefresh,
  });

  String _fmt(double v) => v.toStringAsFixed(0).replaceAllMapped(
      RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'), (m) => '${m[1]},');

  Color _statusColor(String status) {
    switch (status.toUpperCase()) {
      case 'COMPLETED':
        return const Color(0xFF2E7D32);
      case 'PENDING':
      case 'HELD':
      case 'QUEUED':
        return const Color(0xFFD97706);
      case 'REJECTED':
      case 'REVERSED':
        return const Color(0xFFC62828);
      default:
        return const Color(0xFF8A94A6);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.05),
            blurRadius: 8,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  'Recent Activity',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                    color: Color(0xFF1A2340),
                  ),
                ),
                GestureDetector(
                  onTap: () => Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (_) => const TransactionHistoryScreen(),
                    ),
                  ),
                  child: const Text(
                    'See All →',
                    style: TextStyle(
                      fontSize: 13,
                      color: Color(0xFF3B6FE8),
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ],
            ),
          ),
          transactions.isEmpty
              ? const Padding(
                  padding: EdgeInsets.all(24),
                  child: Center(
                    child: Text(
                      'No transactions yet',
                      style: TextStyle(color: Color(0xFF8A94A6)),
                    ),
                  ),
                )
              : ListView.separated(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  itemCount: transactions.length,
                  separatorBuilder: (_, _) =>
                      const Divider(height: 1, indent: 16),
                  itemBuilder: (_, i) =>
                      _buildTransactionRow(context, transactions[i]),
                ),
        ],
      ),
    );
  }

  Widget _buildTransactionRow(BuildContext context, dynamic tx) {
    final double amount = (tx['displayAmount'] as num?)?.toDouble() ??
        (tx['amount'] as num?)?.toDouble() ??
        0;
    final String status = (tx['status'] ?? 'UNKNOWN').toString();
    final bool isReceive = amount > 0;
    final bool isHeld = status.toUpperCase() == 'HELD' ||
        status.toUpperCase() == 'PENDING' ||
        status.toUpperCase() == 'QUEUED';

    final Color iconBg = isHeld
        ? const Color(0xFFFFF8E1)
        : isReceive
            ? const Color(0xFFE8F5E9)
            : const Color(0xFFE3F0FF);
    final Color iconColor = isHeld
        ? const Color(0xFFF9A825)
        : isReceive
            ? const Color(0xFF2E7D32)
            : const Color(0xFF3B6FE8);

    final rowWidget = Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(color: iconBg, shape: BoxShape.circle),
            child: Icon(
              isHeld
                  ? Icons.pause_rounded
                  : isReceive
                      ? Icons.arrow_downward_rounded
                      : Icons.arrow_upward_rounded,
              color: iconColor,
              size: 18,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  tx['note'] ?? (isReceive ? 'Received' : 'Sent'),
                  style: const TextStyle(
                    fontWeight: FontWeight.w600,
                    fontSize: 14,
                    color: Color(0xFF1A2340),
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  tx['referenceId'] ?? '',
                  style: const TextStyle(
                    fontSize: 11,
                    color: Color(0xFF8A94A6),
                  ),
                ),
              ],
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                '${isReceive ? '+' : ''}Rs. ${_fmt(amount.abs())}',
                style: TextStyle(
                  fontWeight: FontWeight.bold,
                  fontSize: 14,
                  color: isReceive
                      ? const Color(0xFF2E7D32)
                      : const Color(0xFF1A2340),
                ),
              ),
              const SizedBox(height: 4),
              _buildBadge(status),
            ],
          ),
        ],
      ),
    );

    if (isHeld) {
      return InkWell(
        onTap: () {
          Navigator.push(
            context,
            MaterialPageRoute(
              builder: (_) => const HeldTransactionsScreen(),
            ),
          );
        },
        child: rowWidget,
      );
    }

    return rowWidget;
  }

  Widget _buildBadge(String status) {
    final sUpper = status.toUpperCase();
    final bool isHeld =
        sUpper == 'PENDING' || sUpper == 'HELD' || sUpper == 'QUEUED';
    final color = isHeld ? const Color(0xFFD97706) : _statusColor(status);
    final label = isHeld ? 'HELD' : sUpper;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.14),
        borderRadius: BorderRadius.circular(6),
        border: isHeld ? Border.all(color: color.withValues(alpha: 0.3)) : null,
      ),
      child: Text(
        label,
        style: TextStyle(
          color: color,
          fontSize: 10,
          fontWeight: FontWeight.bold,
          letterSpacing: 0.5,
        ),
      ),
    );
  }
}
