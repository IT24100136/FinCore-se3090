import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../services/wallet_service.dart';
import 'transaction_status_screen.dart';

class SendMoneyScreen extends StatefulWidget {
  const SendMoneyScreen({super.key});

  @override
  State<SendMoneyScreen> createState() => _SendMoneyScreenState();
}

class _SendMoneyScreenState extends State<SendMoneyScreen> {
  final _walletService = WalletService();
  final _recipientController = TextEditingController();
  final _amountController = TextEditingController(text: '0');
  final _noteController = TextEditingController();
  bool _isLoading = false;

  double get _currentAmount =>
      double.tryParse(_amountController.text.replaceAll(',', '')) ?? 0;

  void _addAmount(double add) {
    final newAmount = _currentAmount + add;
    _amountController.text = newAmount.toStringAsFixed(0);
    setState(() {});
  }

  Future<void> _transfer() async {
    final recipient = _recipientController.text.trim();
    if (recipient.isEmpty || _currentAmount <= 0) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please fill in recipient and amount')),
      );
      return;
    }

    setState(() => _isLoading = true);
    try {
      final result = await _walletService.transfer(
        recipient,
        _currentAmount,
        note: _noteController.text.trim().isNotEmpty
            ? _noteController.text.trim()
            : null,
      );

      if (!mounted) return;
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(
          builder: (_) => TransactionStatusScreen(
            referenceId: result['referenceId'] ?? 'N/A',
            amount: (result['amount'] as num?)?.toDouble() ?? _currentAmount,
            recipient: result['recipient'] ?? recipient,
            status: result['status'] ?? 'Pending',
          ),
        ),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Transfer failed: $e'),
          backgroundColor: Colors.red,
        ),
      );
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  void dispose() {
    _recipientController.dispose();
    _amountController.dispose();
    _noteController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Color(0xFF1A2340)),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Text(
          'Send Money',
          style: TextStyle(
            color: Color(0xFF1A2340),
            fontWeight: FontWeight.bold,
            fontSize: 18,
          ),
        ),
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const SizedBox(height: 12),
              // Recipient Field
              _buildLabel('Recipient'),
              const SizedBox(height: 6),
              TextField(
                controller: _recipientController,
                decoration: _inputDecoration(
                    'Email or Wallet ID (e.g. WLT-2187)'),
                style: const TextStyle(fontSize: 14, color: Color(0xFF1A2340)),
              ),
              const SizedBox(height: 20),
              // Amount Label
              _buildLabel('Transfer Amount (LKR)'),
              const SizedBox(height: 6),
              // Amount Input
              Container(
                decoration: BoxDecoration(
                  border: Border.all(color: const Color(0xFFDDE1EA)),
                  borderRadius: BorderRadius.circular(10),
                ),
                padding:
                    const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
                child: Row(
                  children: [
                    const Text(
                      'Rs.',
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w600,
                        color: Color(0xFF8A94A6),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: TextField(
                        controller: _amountController,
                        keyboardType: TextInputType.number,
                        inputFormatters: [
                          FilteringTextInputFormatter.digitsOnly
                        ],
                        style: const TextStyle(
                          fontSize: 22,
                          fontWeight: FontWeight.bold,
                          color: Color(0xFF1A2340),
                        ),
                        decoration: const InputDecoration(
                          border: InputBorder.none,
                          isDense: true,
                          contentPadding: EdgeInsets.symmetric(vertical: 10),
                        ),
                        onChanged: (_) => setState(() {}),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 10),
              // Quick Add Chips
              Row(
                children: [
                  _buildChip('+1K', 1000),
                  const SizedBox(width: 8),
                  _buildChip('+5K', 5000),
                  const SizedBox(width: 8),
                  _buildChip('+10K', 10000),
                  const SizedBox(width: 8),
                  _buildChip('+25K', 25000),
                ],
              ),
              const SizedBox(height: 20),
              // Note Field
              _buildLabel('Transfer Note (optional)'),
              const SizedBox(height: 6),
              TextField(
                controller: _noteController,
                decoration: _inputDecoration("What's this for?"),
                style: const TextStyle(fontSize: 14, color: Color(0xFF1A2340)),
              ),
              const Spacer(),
              // Transfer Button
              SizedBox(
                width: double.infinity,
                height: 52,
                child: ElevatedButton(
                  onPressed: _isLoading ? null : _transfer,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: _currentAmount > 0
                        ? const Color(0xFF3B6FE8)
                        : const Color(0xFFCDD5E0),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                    elevation: 0,
                  ),
                  child: _isLoading
                      ? const SizedBox(
                          height: 22,
                          width: 22,
                          child: CircularProgressIndicator(
                              color: Colors.white, strokeWidth: 2.5),
                        )
                      : const Text(
                          'Transfer Funds Now',
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 16,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                ),
              ),
              const SizedBox(height: 10),
              // Cancel button
              Center(
                child: TextButton(
                  onPressed: () => Navigator.pop(context),
                  child: const Text(
                    'Cancel',
                    style: TextStyle(
                      color: Color(0xFF8A94A6),
                      fontSize: 14,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 8),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildLabel(String text) {
    return Text(
      text,
      style: const TextStyle(
        fontSize: 13,
        fontWeight: FontWeight.w600,
        color: Color(0xFF8A94A6),
      ),
    );
  }

  InputDecoration _inputDecoration(String hint) {
    return InputDecoration(
      hintText: hint,
      hintStyle: const TextStyle(color: Color(0xFFB0B8C6), fontSize: 14),
      contentPadding:
          const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: const BorderSide(color: Color(0xFFDDE1EA)),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: const BorderSide(color: Color(0xFFDDE1EA)),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: const BorderSide(color: Color(0xFF3B6FE8), width: 1.5),
      ),
    );
  }

  Widget _buildChip(String label, double amount) {
    return Expanded(
      child: GestureDetector(
        onTap: () => _addAmount(amount),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 9),
          decoration: BoxDecoration(
            border: Border.all(color: const Color(0xFFDDE1EA)),
            borderRadius: BorderRadius.circular(8),
            color: Colors.white,
          ),
          child: Center(
            child: Text(
              label,
              style: const TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: Color(0xFF3B6FE8),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
