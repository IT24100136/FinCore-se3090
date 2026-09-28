import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../services/auth_service.dart';
import '../services/wallet_service.dart';
import 'login_screen.dart';
import 'notifications_screen.dart';
import 'send_money_screen.dart';
import 'transaction_history_screen.dart';

class WalletHomeScreen extends StatefulWidget {
  const WalletHomeScreen({super.key});

  @override
  State<WalletHomeScreen> createState() => _WalletHomeScreenState();
}

class _WalletHomeScreenState extends State<WalletHomeScreen> {
  final WalletService _walletService = WalletService();

  // --- State ---
  double _balance = 0.0;
  List<dynamic> _transactions = [];
  bool _isLoading = true;

  // --- Static display data ---
  final String userName = 'Kasun Perera';
  final String walletId = 'WLT-4421';

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    setState(() => _isLoading = true);
    try {
      final balance = await _walletService.getBalance();
      final historyResult = await _walletService.getHistory(pageSize: 5);
      setState(() {
        _balance = balance;
        _transactions = historyResult['data'] as List<dynamic>;
        _isLoading = false;
      });
    } catch (e) {
      setState(() => _isLoading = false);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to load data: $e'),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }

  // ── Top Up Bottom Sheet ────────────────────────────────────────────────────
  void _showTopUpSheet() {
    final amountController = TextEditingController();
    bool isProcessing = false;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) {
        return StatefulBuilder(
          builder: (ctx, setSheetState) {
            return Padding(
              padding: EdgeInsets.only(
                  bottom: MediaQuery.of(ctx).viewInsets.bottom),
              child: Container(
                decoration: const BoxDecoration(
                  color: Colors.white,
                  borderRadius:
                      BorderRadius.vertical(top: Radius.circular(24)),
                ),
                padding: const EdgeInsets.fromLTRB(24, 20, 24, 32),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    // Drag handle
                    Center(
                      child: Container(
                        width: 40,
                        height: 4,
                        decoration: BoxDecoration(
                          color: const Color(0xFFDDE1EA),
                          borderRadius: BorderRadius.circular(2),
                        ),
                      ),
                    ),
                    const SizedBox(height: 20),
                    const Text(
                      'Top Up Wallet',
                      style: TextStyle(
                        fontSize: 20,
                        fontWeight: FontWeight.bold,
                        color: Color(0xFF1A2340),
                      ),
                    ),
                    const SizedBox(height: 6),
                    const Text(
                      'Enter the amount you want to add to your wallet.',
                      style: TextStyle(
                          fontSize: 13, color: Color(0xFF8A94A6)),
                    ),
                    const SizedBox(height: 20),
                    // Amount field
                    Container(
                      decoration: BoxDecoration(
                        border: Border.all(color: const Color(0xFFDDE1EA)),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      padding: const EdgeInsets.symmetric(
                          horizontal: 14, vertical: 4),
                      child: Row(
                        children: [
                          const Text(
                            'Rs.',
                            style: TextStyle(
                                fontSize: 18,
                                fontWeight: FontWeight.w600,
                                color: Color(0xFF8A94A6)),
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: TextField(
                              controller: amountController,
                              autofocus: true,
                              keyboardType: TextInputType.number,
                              inputFormatters: [
                                FilteringTextInputFormatter.digitsOnly
                              ],
                              style: const TextStyle(
                                fontSize: 24,
                                fontWeight: FontWeight.bold,
                                color: Color(0xFF1A2340),
                              ),
                              decoration: const InputDecoration(
                                border: InputBorder.none,
                                hintText: '0',
                                hintStyle:
                                    TextStyle(color: Color(0xFFB0B8C6)),
                                isDense: true,
                                contentPadding:
                                    EdgeInsets.symmetric(vertical: 12),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 12),
                    // Quick amount chips
                    Row(
                      children: [1000, 5000, 10000, 25000].map((amt) {
                        return Expanded(
                          child: Padding(
                            padding: const EdgeInsets.only(right: 6),
                            child: GestureDetector(
                              onTap: () {
                                final current = int.tryParse(
                                        amountController.text) ??
                                    0;
                                amountController.text =
                                    (current + amt).toString();
                              },
                              child: Container(
                                padding:
                                    const EdgeInsets.symmetric(vertical: 9),
                                decoration: BoxDecoration(
                                  border: Border.all(
                                      color: const Color(0xFFDDE1EA)),
                                  borderRadius: BorderRadius.circular(8),
                                ),
                                child: Center(
                                  child: Text(
                                    '+${amt >= 1000 ? '${(amt / 1000).toInt()}K' : amt}',
                                    style: const TextStyle(
                                      fontSize: 13,
                                      fontWeight: FontWeight.w600,
                                      color: Color(0xFF3B6FE8),
                                    ),
                                  ),
                                ),
                              ),
                            ),
                          ),
                        );
                      }).toList(),
                    ),
                    const SizedBox(height: 24),
                    // Confirm button
                    SizedBox(
                      height: 52,
                      child: ElevatedButton(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF3B6FE8),
                          shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12)),
                          elevation: 0,
                        ),
                        onPressed: isProcessing
                            ? null
                            : () async {
                                final amount = double.tryParse(
                                    amountController.text.trim());
                                if (amount == null || amount <= 0) {
                                  ScaffoldMessenger.of(ctx).showSnackBar(
                                    const SnackBar(
                                        content: Text(
                                            'Please enter a valid amount')),
                                  );
                                  return;
                                }
                                setSheetState(
                                    () => isProcessing = true);
                                try {
                                  await _walletService.topUp(amount);
                                  if (ctx.mounted) Navigator.pop(ctx);
                                  await _loadData();
                                  if (mounted) {
                                    ScaffoldMessenger.of(context)
                                        .showSnackBar(
                                      SnackBar(
                                        content: Text(
                                            'Rs. ${amount.toStringAsFixed(0)} added to your wallet!'),
                                        backgroundColor: Colors.green,
                                      ),
                                    );
                                  }
                                } catch (e) {
                                  setSheetState(
                                      () => isProcessing = false);
                                  if (ctx.mounted) {
                                    ScaffoldMessenger.of(ctx).showSnackBar(
                                      SnackBar(
                                          content: Text('Top up failed: $e'),
                                          backgroundColor: Colors.red),
                                    );
                                  }
                                }
                              },
                        child: isProcessing
                            ? const SizedBox(
                                height: 22,
                                width: 22,
                                child: CircularProgressIndicator(
                                    color: Colors.white, strokeWidth: 2.5),
                              )
                            : const Text(
                                'Confirm Top Up',
                                style: TextStyle(
                                    color: Colors.white,
                                    fontSize: 16,
                                    fontWeight: FontWeight.w600),
                              ),
                      ),
                    ),
                  ],
                ),
              ),
            );
          },
        );
      },
    );
  }

  // ── Logout ─────────────────────────────────────────────────────────────────
  Future<void> _confirmLogout() async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape:
            RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text('Sign Out',
            style: TextStyle(fontWeight: FontWeight.bold)),
        content: const Text('Are you sure you want to sign out?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
                backgroundColor: Colors.red.shade600),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Sign Out',
                style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );
    if (confirm == true) {
      await AuthService.logout();
      if (mounted) {
        Navigator.pushAndRemoveUntil(
          context,
          MaterialPageRoute(builder: (_) => const LoginScreen()),
          (route) => false,
        );
      }
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────────
  String _fmt(double v) {
    return v
        .toStringAsFixed(0)
        .replaceAllMapped(
            RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'), (m) => '${m[1]},');
  }

  Color _statusColor(String status) {
    switch (status.toUpperCase()) {
      case 'HELD':
      case 'PENDING':
        return const Color(0xFFF9A825);
      case 'COMPLETED':
        return const Color(0xFF2E7D32);
      case 'REJECTED':
      case 'REVERSED':
        return Colors.red;
      default:
        return Colors.grey;
    }
  }

  // ── Build ──────────────────────────────────────────────────────────────────
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF4F6FA),
      body: SafeArea(
        child: Column(
          children: [
            _buildHeader(),
            Expanded(
              child: _isLoading
                  ? const Center(child: CircularProgressIndicator())
                  : RefreshIndicator(
                      onRefresh: _loadData,
                      child: SingleChildScrollView(
                        physics: const AlwaysScrollableScrollPhysics(),
                        padding:
                            const EdgeInsets.symmetric(horizontal: 16),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const SizedBox(height: 16),
                            _buildBalanceCard(),
                            const SizedBox(height: 16),
                            _buildSummaryRow(),
                            const SizedBox(height: 20),
                            _buildRecentActivity(),
                            const SizedBox(height: 24),
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

  Widget _buildHeader() {
    return Container(
      color: Colors.white,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      child: Row(
        children: [
          Container(
            width: 42,
            height: 42,
            decoration: BoxDecoration(
              color: const Color(0xFF3B6FE8),
              borderRadius: BorderRadius.circular(12),
            ),
            child: const Center(
              child: Text('KP',
                  style: TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.bold,
                      fontSize: 15)),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Good morning,',
                    style: TextStyle(
                        fontSize: 12, color: Color(0xFF8A94A6))),
                Text(userName,
                    style: const TextStyle(
                        fontSize: 17,
                        fontWeight: FontWeight.bold,
                        color: Color(0xFF1A2340))),
              ],
            ),
          ),
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              GestureDetector(
                onTap: () {
                  Navigator.push(
                    context,
                    MaterialPageRoute(builder: (_) => const NotificationsScreen()),
                  );
                },
                child: Stack(
                  children: [
                    const Icon(Icons.notifications_outlined,
                        size: 26, color: Color(0xFF1A2340)),
                    Positioned(
                      right: 0,
                      top: 0,
                      child: Container(
                        width: 8,
                        height: 8,
                        decoration: const BoxDecoration(
                            color: Colors.orange, shape: BoxShape.circle),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 12),
              GestureDetector(
                onTap: _confirmLogout,
                child: Container(
                  padding: const EdgeInsets.all(6),
                  decoration: BoxDecoration(
                    color: Colors.red.shade50,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Icon(Icons.logout_rounded,
                      size: 20, color: Colors.red.shade600),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildBalanceCard() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(22),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFF1B2B5E), Color(0xFF243480)],
        ),
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF1B2B5E).withValues(alpha: 0.35),
            blurRadius: 18,
            offset: const Offset(0, 8),
          )
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('AVAILABLE BALANCE',
              style: TextStyle(
                  color: Color(0xFF8DA3CC),
                  fontSize: 11,
                  letterSpacing: 1.2,
                  fontWeight: FontWeight.w600)),
          const SizedBox(height: 8),
          RichText(
            text: TextSpan(children: [
              TextSpan(
                text: 'Rs. ${_fmt(_balance).split('.')[0]}',
                style: const TextStyle(
                    color: Colors.white,
                    fontSize: 34,
                    fontWeight: FontWeight.bold),
              ),
              const TextSpan(
                text: '.00',
                style: TextStyle(
                    color: Color(0xFF8DA3CC),
                    fontSize: 20,
                    fontWeight: FontWeight.bold),
              ),
            ]),
          ),
          const SizedBox(height: 4),
          Text('LKR · Wallet ID: $walletId',
              style: const TextStyle(
                  color: Color(0xFF5B8FE8),
                  fontSize: 12,
                  fontWeight: FontWeight.w500)),
          const SizedBox(height: 20),
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: _showTopUpSheet,   // ← WIRED
                  style: OutlinedButton.styleFrom(
                    side: const BorderSide(color: Color(0xFF5B8FE8)),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(10)),
                    padding: const EdgeInsets.symmetric(vertical: 13),
                  ),
                  child: const Text('+ Top Up',
                      style: TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.w600)),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: ElevatedButton(
                  onPressed: () async {
                    await Navigator.push(
                      context,
                      MaterialPageRoute(
                          builder: (_) => const SendMoneyScreen()),
                    );
                    _loadData();
                  },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF3B6FE8),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(10)),
                    padding: const EdgeInsets.symmetric(vertical: 13),
                    elevation: 0,
                  ),
                  child: const Text('Send Money',
                      style: TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.w600)),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildSummaryRow() {
    final spent = _transactions
        .where((t) => (t['amount'] as num) < 0)
        .fold<double>(0, (sum, t) => sum + (t['amount'] as num).abs());
    final received = _transactions
        .where((t) => (t['amount'] as num) > 0)
        .fold<double>(0, (sum, t) => sum + (t['amount'] as num).toDouble());

    return Row(
      children: [
        Expanded(
          child: _buildSummaryCard(
            label: 'SPENT THIS MONTH',
            value: 'Rs. ${_fmt(spent)}',
            valueColor: const Color(0xFFE53935),
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: _buildSummaryCard(
            label: 'RECEIVED',
            value: 'Rs. ${_fmt(received)}',
            valueColor: const Color(0xFF2E7D32),
          ),
        ),
      ],
    );
  }

  Widget _buildSummaryCard(
      {required String label,
      required String value,
      required Color valueColor}) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        boxShadow: [
          BoxShadow(
              color: Colors.black.withValues(alpha: 0.05),
              blurRadius: 8,
              offset: const Offset(0, 3))
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label,
              style: const TextStyle(
                  color: Color(0xFF8A94A6),
                  fontSize: 10,
                  letterSpacing: 0.8,
                  fontWeight: FontWeight.w600)),
          const SizedBox(height: 6),
          Text(value,
              style: TextStyle(
                  color: valueColor,
                  fontSize: 16,
                  fontWeight: FontWeight.bold)),
        ],
      ),
    );
  }

  Widget _buildRecentActivity() {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
              color: Colors.black.withValues(alpha: 0.05),
              blurRadius: 8,
              offset: const Offset(0, 3))
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Padding(
            padding: EdgeInsets.fromLTRB(16, 16, 16, 8),
            child: Row(
              children: [
                Text('Recent Activity',
                    style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                        color: Color(0xFF1A2340))),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const SizedBox.shrink(),
                GestureDetector(
                  onTap: () => Navigator.push(
                    context,
                    MaterialPageRoute(
                        builder: (_) => const TransactionHistoryScreen()),
                  ),
                  child: const Text(
                    'See All →',
                    style: TextStyle(
                        fontSize: 13,
                        color: Color(0xFF3B6FE8),
                        fontWeight: FontWeight.w600),
                  ),
                ),
              ],
            ),
          ),
          _transactions.isEmpty
              ? const Padding(
                  padding: EdgeInsets.all(24),
                  child: Center(
                    child: Text('No transactions yet',
                        style: TextStyle(color: Color(0xFF8A94A6))),
                  ),
                )
              : ListView.separated(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  itemCount: _transactions.length,
                  separatorBuilder: (_, _) =>
                      const Divider(height: 1, indent: 16),
                  itemBuilder: (_, i) =>
                      _buildTransactionRow(_transactions[i]),
                ),
        ],
      ),
    );
  }

  Widget _buildTransactionRow(dynamic tx) {
    final double amount =
        (tx['displayAmount'] as num?)?.toDouble() ?? (tx['amount'] as num?)?.toDouble() ?? 0;
    final String status = (tx['status'] ?? 'UNKNOWN').toString();
    final bool isReceive = amount > 0;
    final bool isHeld =
        status.toUpperCase() == 'HELD' || status.toUpperCase() == 'PENDING';

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

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            decoration:
                BoxDecoration(color: iconBg, shape: BoxShape.circle),
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
                Text(tx['note'] ?? (isReceive ? 'Received' : 'Sent'),
                    style: const TextStyle(
                        fontWeight: FontWeight.w600,
                        fontSize: 14,
                        color: Color(0xFF1A2340))),
                const SizedBox(height: 2),
                Text(tx['referenceId'] ?? '',
                    style: const TextStyle(
                        fontSize: 11, color: Color(0xFF8A94A6))),
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
                        : const Color(0xFF1A2340)),
              ),
              const SizedBox(height: 4),
              _buildBadge(status),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildBadge(String status) {
    final color = _statusColor(status);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(6),
      ),
      child: Text(status.toUpperCase(),
          style: TextStyle(
              color: color,
              fontSize: 10,
              fontWeight: FontWeight.bold,
              letterSpacing: 0.5)),
    );
  }
}
