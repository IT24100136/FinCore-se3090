import 'dart:convert';
import 'package:flutter/material.dart';

class HeldTransaction {
  final String id;
  final String transactionId;
  final String transactionCode;
  final String recipientName;
  final double amount;
  final DateTime createdAt;
  final String status; // "Queued", "Assigned", "PendingSecondApproval", "Escalated"
  final int estimatedWaitMinutes;
  final int priority;
  final String priorityLabel;
  final double riskScore;
  final List<String> reasons;
  final String? primaryReason;

  const HeldTransaction({
    required this.id,
    required this.transactionId,
    required this.transactionCode,
    required this.recipientName,
    required this.amount,
    required this.createdAt,
    required this.status,
    required this.estimatedWaitMinutes,
    this.priority = 1,
    this.priorityLabel = 'MEDIUM',
    this.riskScore = 40.0,
    this.reasons = const [],
    this.primaryReason,
  });

  factory HeldTransaction.fromJson(Map<String, dynamic> json) {
    DateTime parsedDate;
    try {
      final dateStr = json['createdAt'] ?? json['timestamp'];
      parsedDate = dateStr != null
          ? DateTime.parse(dateStr.toString())
          : DateTime.now();
    } catch (_) {
      parsedDate = DateTime.now();
    }

    final code = json['transactionCode']?.toString() ??
        json['queueCode']?.toString() ??
        json['referenceId']?.toString() ??
        'TX-UNKNOWN';

    final recipient = json['recipientName']?.toString() ??
        (json['note'] != null && json['note'].toString().isNotEmpty
            ? json['note'].toString().replaceFirst('Transfer to ', '')
            : 'Recipient');

    final rawStatus = json['status']?.toString() ?? 'Queued';
    String normalizedStatus = rawStatus;
    if (rawStatus.toLowerCase() == 'pending' || rawStatus.toLowerCase() == 'held') {
      final amt = (json['amount'] as num?)?.toDouble() ?? 0.0;
      normalizedStatus = amt >= 75000 ? 'PendingSecondApproval' : 'Queued';
    }

    final rawAmount = (json['amount'] ?? json['displayAmount'] ?? 0.0) as num;

    // Parse reasons
    final List<String> parsedReasons = [];
    if (json['flagReasonsList'] is List) {
      for (final r in json['flagReasonsList']) {
        if (r is Map && r['label'] != null) {
          parsedReasons.add(r['label'].toString());
        } else if (r != null) {
          parsedReasons.add(r.toString());
        }
      }
    } else if (json['flagReasons'] != null) {
      final str = json['flagReasons'].toString();
      if (str.startsWith('[')) {
        try {
          final decoded = jsonDecode(str);
          if (decoded is List) {
            for (final r in decoded) {
              if (r is Map && r['label'] != null) {
                parsedReasons.add(r['label'].toString());
              } else if (r != null) {
                parsedReasons.add(r.toString());
              }
            }
          }
        } catch (_) {}
      } else {
        parsedReasons.addAll(str.split(';').map((s) => s.trim()).where((s) => s.isNotEmpty));
      }
    } else if (json['reasons'] != null) {
      final str = json['reasons'].toString();
      parsedReasons.addAll(str.split(';').map((s) => s.trim()).where((s) => s.isNotEmpty));
    }

    if (parsedReasons.isEmpty) {
      if (rawAmount >= 75000) {
        parsedReasons.add('Statutory Threshold Exceeded (>= 75,000 LKR Dual Authorization)');
      } else {
        parsedReasons.add('Behavioral Pattern & Device Anomaly');
      }
    }

    final primary = parsedReasons.isNotEmpty ? parsedReasons.first : null;

    return HeldTransaction(
      id: json['id']?.toString() ?? code,
      transactionId: json['transactionId']?.toString() ?? json['id']?.toString() ?? code,
      transactionCode: code,
      recipientName: recipient,
      amount: rawAmount.toDouble().abs(),
      createdAt: parsedDate,
      status: normalizedStatus,
      estimatedWaitMinutes: (json['estimatedWaitMinutes'] as num?)?.toInt() ?? 10,
      priority: (json['priority'] as num?)?.toInt() ?? 1,
      priorityLabel: json['priorityLabel']?.toString() ?? 'MEDIUM',
      riskScore: (json['riskScore'] as num?)?.toDouble() ?? 40.0,
      reasons: parsedReasons,
      primaryReason: primary,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'transactionId': transactionId,
        'transactionCode': transactionCode,
        'recipientName': recipientName,
        'amount': amount,
        'createdAt': createdAt.toIso8601String(),
        'status': status,
        'estimatedWaitMinutes': estimatedWaitMinutes,
        'priority': priority,
        'priorityLabel': priorityLabel,
        'riskScore': riskScore,
      };

  /// Returns user-friendly status badge label matching Component C design
  String get statusDisplayTitle {
    switch (status.trim().toLowerCase()) {
      case 'queued':
        return 'Queued for Review';
      case 'assigned':
      case 'under review':
      case 'inreview':
        return 'Analyst Reviewing';
      case 'pendingsecondapproval':
      case 'dualdemand':
      case 'secondapproval':
        return 'Requires Dual Approval';
      case 'escalated':
      case 'compliance':
        return 'Escalated to Compliance';
      default:
        return 'Under Review';
    }
  }

  /// Badge primary color
  Color get statusColor {
    switch (status.trim().toLowerCase()) {
      case 'queued':
        return const Color(0xFFD97706); // Amber
      case 'assigned':
      case 'under review':
      case 'inreview':
        return const Color(0xFF2563EB); // Blue
      case 'pendingsecondapproval':
      case 'dualdemand':
      case 'secondapproval':
        return const Color(0xFF8B5CF6); // Purple
      case 'escalated':
      case 'compliance':
        return const Color(0xFFEF4444); // Red
      default:
        return const Color(0xFFD97706);
    }
  }

  /// Formatted LKR representation (e.g., Rs. 75,000.00)
  String get formattedAmount {
    final fixed = amount.toStringAsFixed(2);
    final parts = fixed.split('.');
    final integerPart = parts[0].replaceAllMapped(
      RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'),
      (Match m) => '${m[1]},',
    );
    return 'Rs. $integerPart.${parts[1]}';
  }
}
