import 'package:flutter/material.dart';
import '../services/wallet_service.dart';
import '../services/held_transaction_service.dart';
import 'transaction_status_screen.dart';
import 'flagged_transaction_screen.dart'; // Imported your new screen

class TransactionHistoryScreen extends StatefulWidget {
  const TransactionHistoryScreen({super.key});

  @override
  State<TransactionHistoryScreen> createState() =>
      _TransactionHistoryScreenState();
}

class _TransactionHistoryScreenState extends State<TransactionHistoryScreen> {
  final WalletService _service = WalletService();
  final HeldTransactionService _heldService = HeldTransactionService();
  final ScrollController _scrollController = ScrollController();

  // --- Data ---
  List<dynamic> _transactions = [];
  int _total = 0;
  int _totalPages = 1;
  bool _isLoading = false;
  bool _isLoadingMore = false;

  // --- Filter state ---
  String _selectedStatus = 'All';
  String _selectedSort = 'desc';
  DateTime? _dateFrom;
  DateTime? _dateTo;
  final _minAmountController = TextEditingController();
  final _maxAmountController = TextEditingController();
  int _page = 1;
  static const int _pageSize = 15;

  final List<String> _statuses = [
    'All', 'Held', 'Pending', 'Completed', 'Rejected', 'Reversed'
  ];

  @override
  void initState() {
    super.initState();
    _loadData(reset: true);
    _scrollController.addListener(_onScroll);
  }

  @override
  void dispose() {
    _scrollController.dispose();
    _minAmountController.dispose();
    _maxAmountController.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (_scrollController.position.pixels >=
            _scrollController.position.maxScrollExtent - 200 &&
        !_isLoadingMore &&
        _page < _totalPages) {
      _loadMore();
    }
  }

  Future<void> _loadData({bool reset = false}) async {
    if (reset) {
      _page = 1;
      _transactions = [];
    }
    setState(() => _isLoading = true);

    // If 'Held' tab is chosen, query Component C Held Endpoint with estimated wait times
    if (_selectedStatus == 'Held') {
      try {
        final heldItems = await _heldService.getHeldTransactions();
        final mapped = heldItems.map((h) => {
          'id': h.id,
          'transactionId': h.transactionId,
          'referenceId': h.transactionCode,
          'amount': h.amount,
          'displayAmount': -h.amount,
          'status': 'Held',
          'timestamp': h.createdAt.toIso8601String(),
          'note': 'Transfer to ${h.recipientName}',
          'estimatedWaitMinutes': h.estimatedWaitMinutes,
          'priorityLabel': h.priorityLabel,
          'primaryShapFeature': h.transactionCode,
        }).toList();

        if (mounted) {
          setState(() {
            _transactions = mapped;
            _total = mapped.length;
            _totalPages = 1;
            _isLoading = false;
          });
        }
        return;
      } catch (e) {
        debugPrint('Error loading held transactions: $e');
      }
    }

    try {
      final result = await _service.getHistory(
        status: _selectedStatus == 'All' ? null : _selectedStatus,
        dateFrom: _dateFrom,
        dateTo: _dateTo,
        minAmount: double.tryParse(_minAmountController.text),
        maxAmount: double.tryParse(_maxAmountController.text),
        sort: _selectedSort,
        page: _page,
        pageSize: _pageSize,
      );
      setState(() {
        _transactions = result['data'] as List<dynamic>;
        _total = result['total'] as int;
        _totalPages = result['totalPages'] as int;
        _isLoading = false;
      });
    } catch (e) {
      setState(() => _isLoading = false);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error: $e'), backgroundColor: Colors.red),
        );
      }
    }
  }

  Future<void> _loadMore() async {
    setState(() {
      _isLoadingMore = true;
      _page++;
    });
    try {
      final result = await _service.getHistory(
        status: _selectedStatus == 'All' ? null : _selectedStatus,
        dateFrom: _dateFrom,
        dateTo: _dateTo,
        minAmount: double.tryParse(_minAmountController.text),
        maxAmount: double.tryParse(_maxAmountController.text),
        sort: _selectedSort,
        page: _page,
        pageSize: _pageSize,
      );
      setState(() {
        _transactions.addAll(result['data'] as List<dynamic>);
        _isLoadingMore = false;
      });
    } catch (_) {
      setState(() {
        _isLoadingMore = false;
        _page--;
      });
    }
  }

  void _showFilterSheet() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => _FilterSheet(
        selectedStatus: _selectedStatus,
        selectedSort: _selectedSort,
        dateFrom: _dateFrom,
        dateTo: _dateTo,
        minAmountController: _minAmountController,
        maxAmountController: _maxAmountController,
        statuses: _statuses,
        onApply: (status, sort, from, to) {
          setState(() {
            _selectedStatus = status;
            _selectedSort = sort;
            _dateFrom = from;
            _dateTo = to;
          });
          Navigator.pop(ctx);
          _loadData(reset: true);
        },
        onClear: () {
          setState(() {
            _selectedStatus = 'All';
            _selectedSort = 'desc';
            _dateFrom = null;
            _dateTo = null;
            _minAmountController.clear();
            _maxAmountController.clear();
          });
          Navigator.pop(ctx);
          _loadData(reset: true);
        },
      ),
    );
  }

  bool get _hasActiveFilters =>
      _selectedStatus != 'All' ||
      _dateFrom != null ||
      _dateTo != null ||
      _minAmountController.text.isNotEmpty ||
      _maxAmountController.text.isNotEmpty;

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
          'Transaction History',
          style: TextStyle(
              color: Color(0xFF1A2340),
              fontWeight: FontWeight.bold,
              fontSize: 18),
        ),
        actions: [
          Stack(
            children: [
              IconButton(
                icon: const Icon(Icons.tune_rounded, color: Color(0xFF1A2340)),
                onPressed: _showFilterSheet,
              ),
              if (_hasActiveFilters)
                Positioned(
                  right: 8,
                  top: 8,
                  child: Container(
                    width: 8,
                    height: 8,
                    decoration: const BoxDecoration(
                        color: Color(0xFF3B6FE8), shape: BoxShape.circle),
                  ),
                ),
            ],
          ),
        ],
      ),
      body: Column(
        children: [
          // Status chip row
          _buildStatusChips(),
          // Result count
          if (!_isLoading)
            Padding(
              padding:
                  const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
              child: Row(
                children: [
                  Text(
                    '$_total transaction${_total != 1 ? 's' : ''} found',
                    style: const TextStyle(
                        fontSize: 12, color: Color(0xFF8A94A6)),
                  ),
                  const Spacer(),
                  GestureDetector(
                    onTap: () {
                      setState(() => _selectedSort =
                          _selectedSort == 'desc' ? 'asc' : 'desc');
                      _loadData(reset: true);
                    },
                    child: Row(
                      children: [
                        Icon(
                          _selectedSort == 'desc'
                              ? Icons.arrow_downward_rounded
                              : Icons.arrow_upward_rounded,
                          size: 14,
                          color: const Color(0xFF3B6FE8),
                        ),
                        const SizedBox(width: 4),
                        Text(
                          _selectedSort == 'desc' ? 'Newest first' : 'Oldest first',
                          style: const TextStyle(
                              fontSize: 12,
                              color: Color(0xFF3B6FE8),
                              fontWeight: FontWeight.w600),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          // List
          Expanded(
            child: _isLoading
                ? const Center(child: CircularProgressIndicator())
                : _transactions.isEmpty
                    ? _buildEmpty()
                    : RefreshIndicator(
                        onRefresh: () => _loadData(reset: true),
                        child: ListView.builder(
                          controller: _scrollController,
                          padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                          itemCount:
                              _transactions.length + (_isLoadingMore ? 1 : 0),
                          itemBuilder: (_, i) {
                            if (i == _transactions.length) {
                              return const Padding(
                                padding: EdgeInsets.all(16),
                                child: Center(
                                    child: CircularProgressIndicator()),
                              );
                            }
                            return _buildTxCard(_transactions[i]);
                          },
                        ),
                      ),
          ),
        ],
      ),
    );
  }

  Widget _buildStatusChips() {
    return Container(
      color: Colors.white,
      height: 48,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        itemCount: _statuses.length,
        separatorBuilder: (_, _) => const SizedBox(width: 8),
        itemBuilder: (_, i) {
          final s = _statuses[i];
          final isActive = s == _selectedStatus;
          return GestureDetector(
            onTap: () {
              setState(() => _selectedStatus = s);
              _loadData(reset: true);
            },
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 180),
              padding:
                  const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
              decoration: BoxDecoration(
                color: isActive
                    ? const Color(0xFF3B6FE8)
                    : const Color(0xFFF0F2F7),
                borderRadius: BorderRadius.circular(20),
              ),
              child: Text(
                s,
                style: TextStyle(
                  color: isActive ? Colors.white : const Color(0xFF8A94A6),
                  fontWeight:
                      isActive ? FontWeight.bold : FontWeight.normal,
                  fontSize: 13,
                ),
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _buildEmpty() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.receipt_long_outlined,
              size: 64, color: Colors.grey.shade300),
          const SizedBox(height: 12),
          const Text('No transactions found',
              style: TextStyle(color: Color(0xFF8A94A6), fontSize: 15)),
          if (_hasActiveFilters) ...[
            const SizedBox(height: 8),
            TextButton(
              onPressed: () {
                setState(() {
                  _selectedStatus = 'All';
                  _dateFrom = null;
                  _dateTo = null;
                  _minAmountController.clear();
                  _maxAmountController.clear();
                });
                _loadData(reset: true);
              },
              child: const Text('Clear filters'),
            )
          ],
        ],
      ),
    );
  }

  Widget _buildTxCard(dynamic tx) {
    final double amount = (tx['displayAmount'] as num).toDouble();
    final bool isCredit = amount > 0;
    final String status = (tx['status'] ?? '').toString();
    final bool isHeld =
        status.toLowerCase() == 'held' || status.toLowerCase() == 'pending';
    final int waitMinutes = (tx['estimatedWaitMinutes'] as num?)?.toInt() ?? 10;
    final DateTime timestamp = DateTime.tryParse(tx['timestamp'] ?? '') ??
        DateTime.now();

    Color statusColor;
    switch (status.toLowerCase()) {
      case 'completed':
        statusColor = const Color(0xFF2E7D32);
        break;
      case 'held':
      case 'pending':
        statusColor = const Color(0xFFF9A825);
        break;
      case 'rejected':
      case 'reversed':
        statusColor = Colors.red;
        break;
      default:
        statusColor = Colors.grey;
    }

    return GestureDetector(
      onTap: () {
        if (isHeld) {
          final transactionId =
              tx['transactionId'] ?? tx['id']?.toString() ?? '';
          final code = tx['referenceId'] ?? 'TX-UNKNOWN';
          final shapFeature = tx['primaryShapFeature']?.toString() ?? code;
          
          // Replaced placeholder logic with direct navigation to your SHAP screen
          Navigator.push(
            context,
            MaterialPageRoute(
              builder: (context) => FlaggedTransactionScreen(
                amount: amount.abs(),
                transactionId: transactionId,
                primaryShapFeature: shapFeature,
              ),
            ),
          );
        } else {
          Navigator.push(
            context,
            MaterialPageRoute(
              builder: (_) => TransactionStatusScreen(
                referenceId: tx['referenceId'] ?? '',
                amount: amount.abs(),
                recipient: tx['note'] ?? '',
                status: status,
              ),
            ),
          );
        }
      },
      child: Container(
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14),
          boxShadow: [
            BoxShadow(
                color: Colors.black.withValues(alpha: 0.04),
                blurRadius: 6,
                offset: const Offset(0, 2))
          ],
        ),
        child: Row(
          children: [
            // Icon
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: statusColor.withValues(alpha: 0.1),
                shape: BoxShape.circle,
              ),
              child: Icon(
                isHeld
                    ? Icons.pause_rounded
                    : isCredit
                        ? Icons.arrow_downward_rounded
                        : Icons.arrow_upward_rounded,
                color: statusColor,
                size: 20,
              ),
            ),
            const SizedBox(width: 12),
            // Details
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    tx['note'] ?? (isCredit ? 'Received' : 'Sent'),
                    style: const TextStyle(
                        fontWeight: FontWeight.w600,
                        fontSize: 14,
                        color: Color(0xFF1A2340)),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 3),
                  Text(
                    '${_formatDate(timestamp)}  ·  ${tx['referenceId'] ?? ''}',
                    style: const TextStyle(
                        fontSize: 11, color: Color(0xFF8A94A6)),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 8),
            // Amount + badge
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text(
                  '${isCredit ? '+' : '-'}Rs. ${_fmt(amount.abs())}',
                  style: TextStyle(
                    fontWeight: FontWeight.bold,
                    fontSize: 14,
                    color: isCredit
                        ? const Color(0xFF2E7D32)
                        : const Color(0xFF1A2340),
                  ),
                ),
                const SizedBox(height: 4),
                if (isHeld)
                  Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: const Color(0xFFFFFBEB),
                      borderRadius: BorderRadius.circular(6),
                      border: Border.all(
                          color: const Color(0xFFFDE68A)),
                    ),
                    child: Text(
                      'HELD • In Analyst Queue (Est. ~${waitMinutes}m)',
                      style: const TextStyle(
                        color: Color(0xFFB45309),
                        fontSize: 10,
                        fontWeight: FontWeight.bold,
                        letterSpacing: 0.2,
                      ),
                    ),
                  )
                else
                  Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: statusColor.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Text(
                      status.toUpperCase(),
                      style: TextStyle(
                          color: statusColor,
                          fontSize: 10,
                          fontWeight: FontWeight.bold,
                          letterSpacing: 0.4),
                    ),
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  String _fmt(double v) => v.toStringAsFixed(0).replaceAllMapped(
      RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'), (m) => '${m[1]},');

  String _formatDate(DateTime dt) {
    final now = DateTime.now();
    if (dt.year == now.year && dt.month == now.month && dt.day == now.day) {
      return 'Today ${dt.hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')}';
    }
    return '${dt.day}/${dt.month}/${dt.year}';
  }
}

// ── Filter Bottom Sheet ───────────────────────────────────────────────────────
class _FilterSheet extends StatefulWidget {
  final String selectedStatus;
  final String selectedSort;
  final DateTime? dateFrom;
  final DateTime? dateTo;
  final TextEditingController minAmountController;
  final TextEditingController maxAmountController;
  final List<String> statuses;
  final void Function(String, String, DateTime?, DateTime?) onApply;
  final VoidCallback onClear;

  const _FilterSheet({
    required this.selectedStatus,
    required this.selectedSort,
    required this.dateFrom,
    required this.dateTo,
    required this.minAmountController,
    required this.maxAmountController,
    required this.statuses,
    required this.onApply,
    required this.onClear,
  });

  @override
  State<_FilterSheet> createState() => _FilterSheetState();
}

class _FilterSheetState extends State<_FilterSheet> {
  late String _status;
  late String _sort;
  DateTime? _from;
  DateTime? _to;

  @override
  void initState() {
    super.initState();
    _status = widget.selectedStatus;
    _sort = widget.selectedSort;
    _from = widget.dateFrom;
    _to = widget.dateTo;
  }

  Future<void> _pickDate(bool isFrom) async {
    final picked = await showDatePicker(
      context: context,
      initialDate: (isFrom ? _from : _to) ?? DateTime.now(),
      firstDate: DateTime(2020),
      lastDate: DateTime.now(),
      builder: (ctx, child) => Theme(
        data: Theme.of(ctx).copyWith(
          colorScheme: const ColorScheme.light(primary: Color(0xFF3B6FE8)),
        ),
        child: child!,
      ),
    );
    if (picked != null) {
      setState(() => isFrom ? _from = picked : _to = picked);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      padding: EdgeInsets.fromLTRB(
          24, 20, 24, MediaQuery.of(context).viewInsets.bottom + 24),
      child: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Center(
              child: Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                    color: const Color(0xFFDDE1EA),
                    borderRadius: BorderRadius.circular(2)),
              ),
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                const Text('Filters',
                    style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                        color: Color(0xFF1A2340))),
                const Spacer(),
                TextButton(
                    onPressed: widget.onClear,
                    child: const Text('Clear all',
                        style: TextStyle(color: Color(0xFF3B6FE8)))),
              ],
            ),
            const SizedBox(height: 16),
            // Status
            const Text('Status',
                style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: Color(0xFF4A5568))),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: widget.statuses.map((s) {
                final active = s == _status;
                return GestureDetector(
                  onTap: () => setState(() => _status = s),
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 14, vertical: 8),
                    decoration: BoxDecoration(
                      color: active
                          ? const Color(0xFF3B6FE8)
                          : const Color(0xFFF0F2F7),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Text(s,
                        style: TextStyle(
                            color: active
                                ? Colors.white
                                : const Color(0xFF8A94A6),
                            fontWeight: FontWeight.w500,
                            fontSize: 13)),
                  ),
                );
              }).toList(),
            ),
            const SizedBox(height: 20),
            // Date range
            const Text('Date Range',
                style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: Color(0xFF4A5568))),
            const SizedBox(height: 8),
            Row(
              children: [
                Expanded(child: _dateTile('From', _from, () => _pickDate(true))),
                const SizedBox(width: 10),
                Expanded(child: _dateTile('To', _to, () => _pickDate(false))),
              ],
            ),
            const SizedBox(height: 20),
            // Amount range
            const Text('Amount Range (Rs.)',
                style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: Color(0xFF4A5568))),
            const SizedBox(height: 8),
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: widget.minAmountController,
                    keyboardType: TextInputType.number,
                    decoration: _inputDeco('Min'),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: TextField(
                    controller: widget.maxAmountController,
                    keyboardType: TextInputType.number,
                    decoration: _inputDeco('Max'),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 24),
            SizedBox(
              width: double.infinity,
              height: 50,
              child: ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF3B6FE8),
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12)),
                  elevation: 0,
                ),
                onPressed: () => widget.onApply(_status, _sort, _from, _to),
                child: const Text('Apply Filters',
                    style: TextStyle(
                        color: Colors.white,
                        fontSize: 15,
                        fontWeight: FontWeight.w600)),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _dateTile(String label, DateTime? date, VoidCallback onTap) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
        decoration: BoxDecoration(
          border: Border.all(color: const Color(0xFFDDE1EA)),
          borderRadius: BorderRadius.circular(10),
        ),
        child: Row(
          children: [
            const Icon(Icons.calendar_today_outlined,
                size: 14, color: Color(0xFF8A94A6)),
            const SizedBox(width: 6),
            Text(
              date != null
                  ? '${date.day}/${date.month}/${date.year}'
                  : label,
              style: TextStyle(
                  fontSize: 13,
                  color: date != null
                      ? const Color(0xFF1A2340)
                      : const Color(0xFFB0B8C6)),
            ),
          ],
        ),
      ),
    );
  }

  InputDecoration _inputDeco(String hint) => InputDecoration(
        hintText: hint,
        hintStyle: const TextStyle(color: Color(0xFFB0B8C6), fontSize: 13),
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
        border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(10),
            borderSide: const BorderSide(color: Color(0xFFDDE1EA))),
        enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(10),
            borderSide: const BorderSide(color: Color(0xFFDDE1EA))),
        focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(10),
            borderSide:
                const BorderSide(color: Color(0xFF3B6FE8), width: 1.5)),
      );
}