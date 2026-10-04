import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:http/http.dart' as http;
import '../services/auth_service.dart';
import '../services/wallet_service.dart';
import 'login_screen.dart';
import 'notifications_screen.dart';
import 'send_money_screen.dart';
import 'transaction_history_screen.dart';
import 'held_transactions_screen.dart';

class WalletHomeScreen extends StatefulWidget {
  const WalletHomeScreen({super.key});

  @override
  State<WalletHomeScreen> createState() => _WalletHomeScreenState();
}

class _WalletHomeScreenState extends State<WalletHomeScreen> {
  final WalletService _walletService = WalletService();

  // --- Dynamic State ---
  double _balance = 0.0;
  List<dynamic> _transactions = [];
  double _monthlySpent = 0.0;
  double _monthlyReceived = 0.0;
  bool _isLoading = true;

  // --- Dynamic User Session & Profile ---
  String _userName = 'FinCore User';
  String _walletId = 'WLT-0000';
  String _accountNumber = 'ACC-00000001';
  int _unreadNotifCount = 0;

  // --- Saved Payment Methods for Top-Up ---
  final List<Map<String, dynamic>> _paymentMethods = [
    {
      'id': 'card_visa',
      'type': 'CARD',
      'brand': 'Visa',
      'name': 'Visa Classic',
      'maskedNumber': '•••• 4821',
      'subtitle': 'Expires 08/28',
      'icon': Icons.credit_card_rounded,
      'color': const Color(0xFF1A1F71),
    },
    {
      'id': 'card_mc',
      'type': 'CARD',
      'brand': 'Mastercard',
      'name': 'Mastercard Platinum',
      'maskedNumber': '•••• 3390',
      'subtitle': 'Expires 11/27',
      'icon': Icons.credit_card_rounded,
      'color': const Color(0xFFEB001B),
    },
    {
      'id': 'bank_comb',
      'type': 'BANK_TRANSFER',
      'brand': 'Commercial Bank',
      'name': 'Commercial Bank Ceylon',
      'maskedNumber': '•••• 9012',
      'subtitle': 'Primary Savings Acc',
      'icon': Icons.account_balance_rounded,
      'color': const Color(0xFF005696),
    },
    {
      'id': 'bank_hnb',
      'type': 'BANK_TRANSFER',
      'brand': 'HNB Bank',
      'name': 'Hatton National Bank',
      'maskedNumber': '•••• 4155',
      'subtitle': 'Checking Acc',
      'icon': Icons.account_balance_rounded,
      'color': const Color(0xFFC98200),
    },
    {
      'id': 'bank_sampath',
      'type': 'BANK_TRANSFER',
      'brand': 'Sampath Bank',
      'name': 'Sampath Bank',
      'maskedNumber': '•••• 7720',
      'subtitle': 'Super Saver Account',
      'icon': Icons.account_balance_rounded,
      'color': const Color(0xFFE85D04),
    },
  ];
  String _selectedPaymentMethodId = 'card_visa';

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  String _getInitials(String name) {
    if (name.trim().isEmpty) return 'FC';
    final parts = name.trim().split(RegExp(r'\s+'));
    if (parts.length >= 2) {
      return '${parts[0][0]}${parts[1][0]}'.toUpperCase();
    }
    return parts[0].substring(0, parts[0].length >= 2 ? 2 : 1).toUpperCase();
  }

  Future<void> _loadData() async {
    setState(() => _isLoading = true);
    try {
      // 1. Load authenticated user profile
      final user = await AuthService.getCurrentUser();
      if (user['name'] != null && user['name'].toString().isNotEmpty) {
        _userName = user['name'].toString();
      }
      if (user['walletId'] != null) {
        _walletId = 'WLT-${user['walletId']}';
      }
      if (user['accountNumber'] != null && user['accountNumber'].toString().isNotEmpty) {
        _accountNumber = user['accountNumber'].toString();
      } else if (user['walletId'] != null) {
        _accountNumber = AuthService.formatAccountNumber(user['walletId']);
      }
      try {
        final serverAcc = await _walletService.getAccountNumber();
        if (serverAcc.isNotEmpty) {
          _accountNumber = serverAcc;
        }
      } catch (_) {}

      // 2. Fetch live unread notifications count
      try {
        final token = await AuthService.getToken();
        final notifRes = await http.get(
          Uri.parse('${WalletService.baseUrl}/notifications'),
          headers: {
            'Content-Type': 'application/json',
            if (token != null && token.isNotEmpty) 'Authorization': 'Bearer $token',
          },
        ).timeout(const Duration(seconds: 4));
        if (notifRes.statusCode == 200) {
          final data = jsonDecode(notifRes.body);
          if (data is List) {
            _unreadNotifCount = data.where((n) => n['isRead'] == false).length;
          }
        }
      } catch (_) {}

      // 3. Load wallet balance and transaction ledger
      final balance = await _walletService.getBalance();
      final historyResult = await _walletService.getHistory(pageSize: 50);
      final list = (historyResult['data'] as List<dynamic>?) ?? [];

      final now = DateTime.now();
      final currentMonthTxs = list.where((t) {
        if (t['timestamp'] == null) return true;
        try {
          final dt = DateTime.parse(t['timestamp'].toString());
          return dt.year == now.year && dt.month == now.month;
        } catch (_) {
          return true;
        }
      }).toList();

      // Only COMPLETED transactions count toward actual spent/received
      final completedTxs = currentMonthTxs.where((t) {
        final status = (t['status'] ?? '').toString().toUpperCase();
        return status == 'COMPLETED';
      });

      final spent = completedTxs
          .where((t) => t['direction'] == 'debit' || ((t['displayAmount'] as num?) ?? 0) < 0)
          .fold<double>(0, (sum, t) {
            final amt = ((t['displayAmount'] as num?)?.toDouble() ?? (t['amount'] as num?)?.toDouble() ?? 0).abs();
            return sum + amt;
          });

      final received = completedTxs
          .where((t) => t['direction'] == 'credit' || (((t['displayAmount'] as num?) ?? 0) > 0 && t['direction'] != 'debit'))
          .fold<double>(0, (sum, t) {
            final amt = ((t['displayAmount'] as num?)?.toDouble() ?? (t['amount'] as num?)?.toDouble() ?? 0).abs();
            return sum + amt;
          });

      setState(() {
        _balance = balance;
        _transactions = list.take(5).toList();
        _monthlySpent = spent;
        _monthlyReceived = received;
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

  // ── Add New Payment Method Modal ───────────────────────────────────────────
  void _showAddPaymentMethodModal(BuildContext parentCtx, StateSetter updateParentSheet) {
    showModalBottomSheet(
      context: parentCtx,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (modalCtx) {
        String methodType = 'CARD'; // 'CARD' or 'BANK_TRANSFER'
        final nameController = TextEditingController();
        final numberController = TextEditingController();
        final expiryController = TextEditingController();
        final cvvController = TextEditingController();
        String selectedBank = 'Commercial Bank';
        final banks = ['Commercial Bank', 'Hatton National Bank', 'Sampath Bank', 'Bank of Ceylon', 'Nations Trust Bank'];

        return StatefulBuilder(
          builder: (modalCtx, setModalState) {
            return Padding(
              padding: EdgeInsets.only(bottom: MediaQuery.of(modalCtx).viewInsets.bottom),
              child: Container(
                decoration: const BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
                ),
                padding: const EdgeInsets.fromLTRB(24, 20, 24, 32),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
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
                    const SizedBox(height: 16),
                    const Text(
                      'Add Payment Method',
                      style: TextStyle(
                        fontSize: 19,
                        fontWeight: FontWeight.bold,
                        color: Color(0xFF1A2340),
                      ),
                    ),
                    const SizedBox(height: 4),
                    const Text(
                      'Link a debit/credit card or bank account for instant top-ups.',
                      style: TextStyle(fontSize: 12, color: Color(0xFF8A94A6)),
                    ),
                    const SizedBox(height: 18),
                    // Type selector tabs
                    Container(
                      padding: const EdgeInsets.all(4),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF1F5F9),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Row(
                        children: [
                          Expanded(
                            child: GestureDetector(
                              onTap: () => setModalState(() => methodType = 'CARD'),
                              child: Container(
                                padding: const EdgeInsets.symmetric(vertical: 10),
                                decoration: BoxDecoration(
                                  color: methodType == 'CARD' ? Colors.white : Colors.transparent,
                                  borderRadius: BorderRadius.circular(8),
                                  boxShadow: methodType == 'CARD'
                                      ? [BoxShadow(color: Colors.black.withValues(alpha: 0.05), blurRadius: 4)]
                                      : null,
                                ),
                                child: Row(
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  children: [
                                    Icon(
                                      Icons.credit_card_rounded,
                                      size: 18,
                                      color: methodType == 'CARD' ? const Color(0xFF3B6FE8) : const Color(0xFF64748B),
                                    ),
                                    const SizedBox(width: 6),
                                    Text(
                                      'Credit / Debit Card',
                                      style: TextStyle(
                                        fontSize: 13,
                                        fontWeight: FontWeight.bold,
                                        color: methodType == 'CARD' ? const Color(0xFF1A2340) : const Color(0xFF64748B),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          ),
                          Expanded(
                            child: GestureDetector(
                              onTap: () => setModalState(() => methodType = 'BANK_TRANSFER'),
                              child: Container(
                                padding: const EdgeInsets.symmetric(vertical: 10),
                                decoration: BoxDecoration(
                                  color: methodType == 'BANK_TRANSFER' ? Colors.white : Colors.transparent,
                                  borderRadius: BorderRadius.circular(8),
                                  boxShadow: methodType == 'BANK_TRANSFER'
                                      ? [BoxShadow(color: Colors.black.withValues(alpha: 0.05), blurRadius: 4)]
                                      : null,
                                ),
                                child: Row(
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  children: [
                                    Icon(
                                      Icons.account_balance_rounded,
                                      size: 18,
                                      color: methodType == 'BANK_TRANSFER' ? const Color(0xFF3B6FE8) : const Color(0xFF64748B),
                                    ),
                                    const SizedBox(width: 6),
                                    Text(
                                      'Bank Account',
                                      style: TextStyle(
                                        fontSize: 13,
                                        fontWeight: FontWeight.bold,
                                        color: methodType == 'BANK_TRANSFER' ? const Color(0xFF1A2340) : const Color(0xFF64748B),
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
                    const SizedBox(height: 18),
                    if (methodType == 'CARD') ...[
                      TextField(
                        controller: nameController,
                        decoration: InputDecoration(
                          labelText: 'Cardholder Name',
                          hintText: 'e.g. Kasun Perera',
                          border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                          contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                        ),
                      ),
                      const SizedBox(height: 12),
                      TextField(
                        controller: numberController,
                        keyboardType: TextInputType.number,
                        maxLength: 16,
                        inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                        decoration: InputDecoration(
                          labelText: 'Card Number',
                          hintText: '•••• •••• •••• 4821',
                          counterText: '',
                          border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                          contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                        ),
                      ),
                      const SizedBox(height: 12),
                      Row(
                        children: [
                          Expanded(
                            child: TextField(
                              controller: expiryController,
                              maxLength: 5,
                              decoration: InputDecoration(
                                labelText: 'Expiry Date',
                                hintText: 'MM/YY',
                                counterText: '',
                                border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                                contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                              ),
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: TextField(
                              controller: cvvController,
                              obscureText: true,
                              maxLength: 4,
                              keyboardType: TextInputType.number,
                              inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                              decoration: InputDecoration(
                                labelText: 'CVV',
                                hintText: '•••',
                                counterText: '',
                                border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                                contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ] else ...[
                      DropdownButtonFormField<String>(
                        initialValue: selectedBank,
                        decoration: InputDecoration(
                          labelText: 'Bank Name',
                          border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                          contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                        ),
                        items: banks.map((b) => DropdownMenuItem(value: b, child: Text(b, style: const TextStyle(fontSize: 14)))).toList(),
                        onChanged: (val) {
                          if (val != null) setModalState(() => selectedBank = val);
                        },
                      ),
                      const SizedBox(height: 12),
                      TextField(
                        controller: numberController,
                        keyboardType: TextInputType.number,
                        inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                        decoration: InputDecoration(
                          labelText: 'Account Number',
                          hintText: 'e.g. 1000293847',
                          border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                          contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                        ),
                      ),
                      const SizedBox(height: 12),
                      TextField(
                        controller: nameController,
                        decoration: InputDecoration(
                          labelText: 'Account Holder Name',
                          hintText: 'e.g. Kasun Perera',
                          border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                          contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                        ),
                      ),
                    ],
                    const SizedBox(height: 20),
                    SizedBox(
                      height: 48,
                      child: ElevatedButton(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF3B6FE8),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                          elevation: 0,
                        ),
                        onPressed: () {
                          final numStr = numberController.text.trim();
                          if (numStr.length < 4) {
                            ScaffoldMessenger.of(modalCtx).showSnackBar(
                              const SnackBar(content: Text('Please enter a valid card/account number')),
                            );
                            return;
                          }
                          final last4 = numStr.substring(numStr.length - 4);
                          final id = 'pm_${DateTime.now().millisecondsSinceEpoch}';

                          final newMethod = methodType == 'CARD'
                              ? {
                                  'id': id,
                                  'type': 'CARD',
                                  'brand': numStr.startsWith('5') ? 'Mastercard' : 'Visa',
                                  'name': numStr.startsWith('5') ? 'Mastercard' : 'Visa Card',
                                  'maskedNumber': '•••• $last4',
                                  'subtitle': expiryController.text.trim().isNotEmpty
                                      ? 'Expires ${expiryController.text.trim()}'
                                      : 'Expires 12/28',
                                  'icon': Icons.credit_card_rounded,
                                  'color': numStr.startsWith('5') ? const Color(0xFFEB001B) : const Color(0xFF1A1F71),
                                }
                              : {
                                  'id': id,
                                  'type': 'BANK_TRANSFER',
                                  'brand': selectedBank,
                                  'name': selectedBank,
                                  'maskedNumber': '•••• $last4',
                                  'subtitle': 'Verified Account',
                                  'icon': Icons.account_balance_rounded,
                                  'color': const Color(0xFF005696),
                                };

                          setState(() {
                            _paymentMethods.insert(0, newMethod);
                            _selectedPaymentMethodId = id;
                          });
                          updateParentSheet(() {});
                          Navigator.pop(modalCtx);
                          ScaffoldMessenger.of(parentCtx).showSnackBar(
                            SnackBar(
                              content: Text('Added ${newMethod['brand']} ${newMethod['maskedNumber']}!'),
                              backgroundColor: Colors.green,
                            ),
                          );
                        },
                        child: const Text(
                          'Save Payment Method',
                          style: TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.bold),
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
            final selectedMethod = _paymentMethods.firstWhere(
              (m) => m['id'] == _selectedPaymentMethodId,
              orElse: () => _paymentMethods.first,
            );

            return Padding(
              padding: EdgeInsets.only(
                  bottom: MediaQuery.of(ctx).viewInsets.bottom),
              child: Container(
                constraints: BoxConstraints(
                  maxHeight: MediaQuery.of(ctx).size.height * 0.85,
                ),
                decoration: const BoxDecoration(
                  color: Colors.white,
                  borderRadius:
                      BorderRadius.vertical(top: Radius.circular(24)),
                ),
                padding: const EdgeInsets.fromLTRB(24, 20, 24, 32),
                child: SingleChildScrollView(
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
                      const SizedBox(height: 18),
                      const Text(
                        'Top Up Wallet',
                        style: TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.bold,
                          color: Color(0xFF1A2340),
                        ),
                      ),
                      const SizedBox(height: 4),
                      const Text(
                        'Enter amount and select your funding payment source.',
                        style: TextStyle(
                            fontSize: 13, color: Color(0xFF8A94A6)),
                      ),
                      const SizedBox(height: 18),
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
                      const SizedBox(height: 20),

                      // ── Payment Source Selector ──────────────────────────────
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          const Text(
                            'Funding Source',
                            style: TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.bold,
                              color: Color(0xFF1A2340),
                            ),
                          ),
                          InkWell(
                            onTap: () => _showAddPaymentMethodModal(ctx, setSheetState),
                            child: const Padding(
                              padding: EdgeInsets.symmetric(horizontal: 4, vertical: 2),
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Icon(Icons.add_circle_outline, size: 16, color: Color(0xFF3B6FE8)),
                                  SizedBox(width: 4),
                                  Text(
                                    'Add New',
                                    style: TextStyle(
                                      fontSize: 13,
                                      fontWeight: FontWeight.bold,
                                      color: Color(0xFF3B6FE8),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 10),

                      // List of available payment methods
                      ..._paymentMethods.map((pm) {
                        final isSelected = pm['id'] == _selectedPaymentMethodId;
                        return Container(
                          margin: const EdgeInsets.only(bottom: 8),
                          decoration: BoxDecoration(
                            border: Border.all(
                              color: isSelected
                                  ? const Color(0xFF3B6FE8)
                                  : const Color(0xFFE2E8F0),
                              width: isSelected ? 1.8 : 1.0,
                            ),
                            borderRadius: BorderRadius.circular(12),
                            color: isSelected
                                ? const Color(0xFF3B6FE8).withValues(alpha: 0.04)
                                : Colors.white,
                          ),
                          child: ListTile(
                            onTap: () {
                              setSheetState(() {
                                _selectedPaymentMethodId = pm['id'];
                              });
                            },
                            contentPadding: const EdgeInsets.symmetric(
                                horizontal: 12, vertical: 2),
                            leading: Container(
                              width: 38,
                              height: 38,
                              decoration: BoxDecoration(
                                color: (pm['color'] as Color).withValues(alpha: 0.12),
                                borderRadius: BorderRadius.circular(10),
                              ),
                              child: Icon(
                                pm['icon'] as IconData,
                                color: pm['color'] as Color,
                                size: 20,
                              ),
                            ),
                            title: Text(
                              '${pm['name']}  ${pm['maskedNumber']}',
                              style: TextStyle(
                                fontSize: 13.5,
                                fontWeight: isSelected
                                    ? FontWeight.bold
                                    : FontWeight.w600,
                                color: const Color(0xFF1A2340),
                              ),
                            ),
                            subtitle: Text(
                              pm['subtitle'] as String,
                              style: const TextStyle(
                                  fontSize: 11.5, color: Color(0xFF64748B)),
                            ),
                            trailing: Icon(
                              isSelected
                                  ? Icons.radio_button_checked
                                  : Icons.radio_button_off,
                              color: isSelected
                                  ? const Color(0xFF3B6FE8)
                                  : const Color(0xFF94A3B8),
                              size: 20,
                            ),
                          ),
                        );
                      }),

                      const SizedBox(height: 20),
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
                                    final methodType = selectedMethod['type'] as String? ?? 'CARD';
                                    final sourceRef = '${selectedMethod['brand']} ${selectedMethod['maskedNumber']}';

                                    await _walletService.topUp(
                                      amount,
                                      paymentMethodType: methodType,
                                      sourceReference: sourceRef,
                                    );
                                    if (ctx.mounted) Navigator.pop(ctx);
                                    await _loadData();
                                    if (mounted) {
                                      ScaffoldMessenger.of(context)
                                          .showSnackBar(
                                        SnackBar(
                                          content: Text(
                                              'Rs. ${amount.toStringAsFixed(0)} topped up via $sourceRef!'),
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
                              : Text(
                                  'Top Up with ${selectedMethod['brand']}',
                                  style: const TextStyle(
                                      color: Colors.white,
                                      fontSize: 16,
                                      fontWeight: FontWeight.w600),
                                ),
                        ),
                      ),
                    ],
                  ),
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
            child: Center(
              child: Text(
                _getInitials(_userName),
                style: const TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.bold,
                    fontSize: 15),
              ),
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
                Text(
                  _userName,
                  style: const TextStyle(
                      fontSize: 17,
                      fontWeight: FontWeight.bold,
                      color: Color(0xFF1A2340)),
                ),
              ],
            ),
          ),
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              GestureDetector(
                onTap: () async {
                  await Navigator.push(
                    context,
                    MaterialPageRoute(builder: (_) => const NotificationsScreen()),
                  );
                  _loadData();
                },
                child: Stack(
                  clipBehavior: Clip.none,
                  children: [
                    const Icon(Icons.notifications_outlined,
                        size: 26, color: Color(0xFF1A2340)),
                    if (_unreadNotifCount > 0)
                      Positioned(
                        right: -4,
                        top: -4,
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
                          decoration: BoxDecoration(
                            color: const Color(0xFFE53935),
                            borderRadius: BorderRadius.circular(10),
                            boxShadow: [
                              BoxShadow(
                                color: Colors.red.withValues(alpha: 0.4),
                                blurRadius: 4,
                                offset: const Offset(0, 2),
                              ),
                            ],
                          ),
                          constraints: const BoxConstraints(
                            minWidth: 16,
                            minHeight: 16,
                          ),
                          child: Center(
                            child: Text(
                              _unreadNotifCount > 9 ? '9+' : '$_unreadNotifCount',
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 9,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ),
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
          Text('LKR · Account: $_accountNumber · $_walletId',
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
    return Row(
      children: [
        Expanded(
          child: _buildSummaryCard(
            label: 'SPENT THIS MONTH',
            value: 'Rs. ${_fmt(_monthlySpent)}',
            valueColor: const Color(0xFFE53935),
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: _buildSummaryCard(
            label: 'RECEIVED',
            value: 'Rs. ${_fmt(_monthlyReceived)}',
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

    final rowWidget = Padding(
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
                Text('${tx['senderAccountNumber'] ?? _accountNumber} · ${tx['referenceId'] ?? ''}',
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
    final bool isHeld = sUpper == 'PENDING' || sUpper == 'HELD' || sUpper == 'QUEUED';
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
