// ---------------------------------------------------------------------------
// NAVIGATION USAGE:
// To navigate to this screen from your transaction history list, use:
//
// Navigator.push(
//   context,
//   MaterialPageRoute(
//     builder: (context) => FlaggedTransactionScreen(
//       amount: amount.abs(),
//       transactionId: transactionId,
//       primaryShapFeature: primaryShapFeature,
//     ),
//   ),
// );
// ---------------------------------------------------------------------------

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

/// Translates a primary SHAP feature key into a customer-friendly plain-language
/// string for external use or testing.
String getShapExplanationText({
  required String primaryShapFeature,
  required String formattedAmount,
}) {
  final normalized = primaryShapFeature
      .trim()
      .toLowerCase()
      .replaceAll(RegExp(r'[\s\-_]'), '');

  if (normalized.contains('location') ||
      normalized.contains('device') ||
      normalized.contains('geo') ||
      normalized.contains('ip')) {
    return 'Your transfer of $formattedAmount is currently paused for security review because it was initiated from an unrecognized device and location. Our fraud prevention team is reviewing this request. Funds have not left your account.';
  } else if (normalized.contains('velocity') ||
      normalized.contains('frequency') ||
      normalized.contains('rate') ||
      normalized.contains('burst') ||
      normalized.contains('count')) {
    return 'Your transfer of $formattedAmount is paused because we noticed an unusual number of transactions on your account today. Funds have not left your account.';
  } else if (normalized.contains('amount') ||
      normalized.contains('value') ||
      normalized.contains('large')) {
    return 'Your transfer of $formattedAmount is paused because it is larger than your typical transfer activity. We are verifying it for your security. Funds have not left your account.';
  }

  return 'Your transfer of $formattedAmount is currently paused for security review because it was initiated from an unrecognized device and location. Our fraud prevention team is reviewing this request. Funds have not left your account.';
}

/// A customer-facing screen displaying explainable AI (SHAP) explanations
/// for transactions placed on security hold by FinCore's fraud detection engine.
class FlaggedTransactionScreen extends StatelessWidget {
  final double amount;
  final String transactionId;
  final String primaryShapFeature;
  final String? referenceCode;
  final double? riskScore;
  final List<String>? holdReasons;

  const FlaggedTransactionScreen({
    super.key,
    required this.amount,
    required this.transactionId,
    String? primaryShapFeature,
    // Backward-compatibility parameter if caller passes legacy fraudReasonCode
    String? fraudReasonCode,
    this.referenceCode,
    this.riskScore,
    this.holdReasons,
  }) : primaryShapFeature =
            primaryShapFeature ?? fraudReasonCode ?? 'location_anomaly';

  /// Formats currency with thousand separators and 2 decimal places (e.g., Rs. 45,000.00).
  String _formatAmount(double value) {
    final fixed = value.abs().toStringAsFixed(2);
    final parts = fixed.split('.');
    final integerPart = parts[0].replaceAllMapped(
      RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'),
      (Match m) => '${m[1]},',
    );
    return 'Rs. $integerPart.${parts[1]}';
  }

  /// Builds the dynamic explanation TextSpan with bold amount and bold funds status.
  TextSpan _buildExplanationSpan(String formattedAmount) {
    const textBaseStyle = TextStyle(
      fontSize: 13,
      color: Color(0xFF8A6200),
      height: 1.5,
    );
    const amountBoldStyle = TextStyle(
      fontWeight: FontWeight.bold,
      color: Color(0xFFE65100),
      fontSize: 13,
      height: 1.5,
    );
    const fundsBoldStyle = TextStyle(
      fontWeight: FontWeight.bold,
      color: Color(0xFF8A6200),
      fontSize: 13,
      height: 1.5,
    );

    final normalized = primaryShapFeature
        .trim()
        .toLowerCase()
        .replaceAll(RegExp(r'[\s\-_]'), '');

    if (normalized.contains('location') ||
        normalized.contains('device') ||
        normalized.contains('geo') ||
        normalized.contains('ip')) {
      return TextSpan(
        style: textBaseStyle,
        children: [
          const TextSpan(text: 'Your transfer of '),
          TextSpan(text: formattedAmount, style: amountBoldStyle),
          const TextSpan(
            text:
                ' is currently paused for security review because it was initiated from an unrecognized device and location. Our fraud prevention team is reviewing this request. ',
          ),
          const TextSpan(
            text: 'Funds have not left your account.',
            style: fundsBoldStyle,
          ),
        ],
      );
    } else if (normalized.contains('velocity') ||
        normalized.contains('frequency') ||
        normalized.contains('rate') ||
        normalized.contains('burst') ||
        normalized.contains('count')) {
      return TextSpan(
        style: textBaseStyle,
        children: [
          const TextSpan(text: 'Your transfer of '),
          TextSpan(text: formattedAmount, style: amountBoldStyle),
          const TextSpan(
            text:
                ' is paused because we noticed an unusual number of transactions on your account today. ',
          ),
          const TextSpan(
            text: 'Funds have not left your account.',
            style: fundsBoldStyle,
          ),
        ],
      );
    } else if (normalized.contains('amount') ||
        normalized.contains('value') ||
        normalized.contains('large')) {
      return TextSpan(
        style: textBaseStyle,
        children: [
          const TextSpan(text: 'Your transfer of '),
          TextSpan(text: formattedAmount, style: amountBoldStyle),
          const TextSpan(
            text:
                ' is paused because it is larger than your typical transfer activity. We are verifying it for your security. ',
          ),
          const TextSpan(
            text: 'Funds have not left your account.',
            style: fundsBoldStyle,
          ),
        ],
      );
    }

    // Default fallback
    return TextSpan(
      style: textBaseStyle,
      children: [
        const TextSpan(text: 'Your transfer of '),
        TextSpan(text: formattedAmount, style: amountBoldStyle),
        const TextSpan(
          text:
              ' is currently paused for security review because it was initiated from an unrecognized device and location. Our fraud prevention team is reviewing this request. ',
        ),
        const TextSpan(
          text: 'Funds have not left your account.',
          style: fundsBoldStyle,
        ),
      ],
    );
  }

  /// Maps standardized SHAP feature to human-readable factor label
  String get _featureDisplayLabel {
    if (holdReasons != null && holdReasons!.isNotEmpty) {
      return holdReasons!.first;
    }
    final normalized = primaryShapFeature
        .trim()
        .toLowerCase()
        .replaceAll(RegExp(r'[\s\-_]'), '');

    if (normalized.contains('location') ||
        normalized.contains('device') ||
        normalized.contains('geo') ||
        normalized.contains('ip')) {
      return 'Unrecognized Location & Device';
    } else if (normalized.contains('velocity') ||
        normalized.contains('frequency') ||
        normalized.contains('rate') ||
        normalized.contains('count')) {
      return 'Unusual Account Frequency';
    } else if (normalized.contains('amount') ||
        normalized.contains('value') ||
        normalized.contains('large')) {
      return 'Unusually High Transfer Amount';
    }
    return 'Behavioral Pattern Anomaly';
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;
    final textTheme = theme.textTheme;

    const warningAmber = Color(0xFFD97706);
    final formattedAmount = _formatAmount(amount);

    return Scaffold(
      backgroundColor: theme.scaffoldBackgroundColor,
      appBar: AppBar(
        backgroundColor: colorScheme.surface,
        foregroundColor: colorScheme.onSurface,
        elevation: 0,
        scrolledUnderElevation: 1,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          tooltip: 'Back',
          onPressed: () => Navigator.of(context).maybePop(),
        ),
        title: Text(
          'Transaction Details',
          style: textTheme.titleMedium?.copyWith(
            fontWeight: FontWeight.w600,
          ),
        ),
        centerTitle: true,
      ),
      body: SafeArea(
        child: Column(
          children: [
            Expanded(
              child: SingleChildScrollView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding:
                    const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const SizedBox(height: 8),

                    // --- Prominent Warning / Under Review Icon Badge ---
                    Center(
                      child: Container(
                        width: 76,
                        height: 76,
                        decoration: BoxDecoration(
                          color: warningAmber.withValues(alpha: 0.12),
                          shape: BoxShape.circle,
                        ),
                        child: Center(
                          child: Container(
                            width: 56,
                            height: 56,
                            decoration: BoxDecoration(
                              color: warningAmber.withValues(alpha: 0.22),
                              shape: BoxShape.circle,
                            ),
                            child: const Icon(
                              Icons.pending_actions_rounded,
                              size: 32,
                              color: warningAmber,
                            ),
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(height: 14),

                    // --- Status Badge ---
                    Center(
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 14, vertical: 5),
                        decoration: BoxDecoration(
                          color: warningAmber.withValues(alpha: 0.14),
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Container(
                              width: 8,
                              height: 8,
                              decoration: const BoxDecoration(
                                color: warningAmber,
                                shape: BoxShape.circle,
                              ),
                            ),
                            const SizedBox(width: 8),
                            Text(
                              'UNDER REVIEW',
                              style: textTheme.labelSmall?.copyWith(
                                color: warningAmber,
                                fontWeight: FontWeight.bold,
                                letterSpacing: 0.8,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 12),

                    // --- Large Formatted Amount ---
                    Center(
                      child: Text(
                        formattedAmount,
                        style: textTheme.headlineMedium?.copyWith(
                          fontWeight: FontWeight.bold,
                          color: colorScheme.onSurface,
                          letterSpacing: -0.5,
                        ),
                      ),
                    ),
                    const SizedBox(height: 4),
                    Center(
                      child: Text(
                        'Held for Automated Fraud Verification',
                        style: textTheme.bodySmall?.copyWith(
                          color: colorScheme.onSurfaceVariant,
                        ),
                      ),
                    ),
                    const SizedBox(height: 24),

                    // --- Exact Pale Yellow/Amber SHAP Explanation Container ---
                    Container(
                      decoration: BoxDecoration(
                        color: const Color(0xFFFFF8E1), // Pale yellow/amber background
                        borderRadius: BorderRadius.circular(12), // Rounded corners
                        border: Border.all(
                          color: const Color(0xFFF9A825).withValues(alpha: 0.4), // Thin amber border
                          width: 1.0,
                        ),
                      ),
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          // Top row: Icons.warning_amber_rounded and bold text "Why is my transfer on hold?" in dark orange
                          Row(
                            children: const [
                              Icon(
                                Icons.warning_amber_rounded,
                                color: Color(0xFFE65100),
                                size: 18,
                              ),
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

                          // Middle: Dynamic text with amount and funds status in bold
                          RichText(
                            text: _buildExplanationSpan(formattedAmount),
                          ),
                          const SizedBox(height: 10),

                          // Bottom: Italicized "Expected review time: 15–30 minutes"
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
                    const SizedBox(height: 16),

                    // --- Why Was This Transaction Held (Explicit Reasons Card) ---
                    _buildTriggeredReasonsCard(context, colorScheme, textTheme),

                    const SizedBox(height: 16),

                    // --- Transaction Hold Details Card ---
                    Container(
                      decoration: BoxDecoration(
                        color: colorScheme.surface,
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(
                          color: colorScheme.outlineVariant.withValues(alpha: 0.45),
                        ),
                      ),
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Verification Summary',
                            style: textTheme.titleSmall?.copyWith(
                              fontWeight: FontWeight.bold,
                              color: colorScheme.onSurface,
                            ),
                          ),
                          const SizedBox(height: 12),
                          _buildDetailRow(
                            context,
                            label: 'Transaction ID',
                            value: transactionId,
                            isCopyable: true,
                          ),
                          const Divider(height: 20),
                          _buildDetailRow(
                            context,
                            label: 'Primary Signal',
                            value: _featureDisplayLabel,
                            valueColor: const Color(0xFFB45309),
                          ),
                          if (referenceCode != null && referenceCode!.isNotEmpty) ...[
                            _buildDetailRow(
                              context,
                              label: 'Reference Code',
                              value: referenceCode!,
                              isMonospace: true,
                              isCopyable: true,
                            ),
                            const Divider(height: 20),
                          ],
                          _buildDetailRow(
                            context,
                            label: 'SHAP Code',
                            value: primaryShapFeature,
                            isMonospace: true,
                          ),
                          const Divider(height: 20),
                          _buildDetailRow(
                            context,
                            label: 'Protection Status',
                            value: 'Funds Held Securely',
                            valueColor: colorScheme.primary,
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 16),

                    // --- Security Assurance Note ---
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 14, vertical: 12),
                      decoration: BoxDecoration(
                        color: colorScheme.surfaceContainerHighest
                            .withValues(alpha: 0.35),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Row(
                        children: [
                          Icon(
                            Icons.shield_outlined,
                            size: 18,
                            color: colorScheme.onSurfaceVariant,
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Text(
                              'FinCore automated verification runs continuously. You will receive a push notification as soon as review finishes.',
                              style: textTheme.bodySmall?.copyWith(
                                color: colorScheme.onSurfaceVariant,
                                height: 1.35,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 24),
                  ],
                ),
              ),
            ),

            // --- Sticky Bottom Actions ---
            Container(
              padding: const EdgeInsets.fromLTRB(20, 12, 20, 16),
              decoration: BoxDecoration(
                color: colorScheme.surface,
                border: Border(
                  top: BorderSide(
                    color: colorScheme.outlineVariant.withValues(alpha: 0.4),
                  ),
                ),
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  // Secondary Action: Contact Support
                  OutlinedButton.icon(
                    onPressed: () => _showContactSupportSheet(context),
                    icon: const Icon(Icons.support_agent_rounded, size: 20),
                    label: const Text('Contact Support'),
                    style: OutlinedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                  ),
                  const SizedBox(height: 10),

                  // Disabled Action: Cancel Transaction
                  Tooltip(
                    message:
                        'Transactions currently in fraud review cannot be canceled directly.',
                    child: ElevatedButton(
                      onPressed: null, // Disabled per requirements
                      style: ElevatedButton.styleFrom(
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                      child: const Text('Cancel Transaction (Disabled)'),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildTriggeredReasonsCard(
    BuildContext context,
    ColorScheme colorScheme,
    TextTheme textTheme,
  ) {
    final effectiveReasons = (holdReasons != null && holdReasons!.isNotEmpty)
        ? holdReasons!
        : [_featureDisplayLabel];

    final effectiveRiskScore = riskScore ?? 87.0;

    return Container(
      decoration: BoxDecoration(
        color: colorScheme.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: const Color(0xFFF9A825).withValues(alpha: 0.35),
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.03),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  const Icon(Icons.security_rounded, color: Color(0xFFD97706), size: 20),
                  const SizedBox(width: 8),
                  Text(
                    'Why Was This Transfer Held?',
                    style: textTheme.titleSmall?.copyWith(
                      fontWeight: FontWeight.bold,
                      color: colorScheme.onSurface,
                    ),
                  ),
                ],
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: effectiveRiskScore >= 70
                      ? const Color(0xFFFEE2E2)
                      : const Color(0xFFFEF3C7),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(
                    color: effectiveRiskScore >= 70
                        ? const Color(0xFFEF4444).withValues(alpha: 0.4)
                        : const Color(0xFFF59E0B).withValues(alpha: 0.4),
                  ),
                ),
                child: Text(
                  'Risk Score: ${effectiveRiskScore.toInt()}/100',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.bold,
                    color: effectiveRiskScore >= 70
                        ? const Color(0xFFDC2626)
                        : const Color(0xFFD97706),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Text(
            'FinCore AI risk pipeline paused this transaction based on the following specific indicators:',
            style: textTheme.bodySmall?.copyWith(
              color: colorScheme.onSurfaceVariant,
            ),
          ),
          const SizedBox(height: 12),
          ...effectiveReasons.map((reason) => _buildReasonItem(reason, colorScheme, textTheme)),
        ],
      ),
    );
  }

  Widget _buildReasonItem(
    String reason,
    ColorScheme colorScheme,
    TextTheme textTheme,
  ) {
    final lower = reason.toLowerCase();
    IconData icon = Icons.warning_rounded;
    String detail = 'Activity diverged from your normal profile baseline.';

    if (lower.contains('velocity') || lower.contains('frequency') || lower.contains('burst')) {
      icon = Icons.speed_rounded;
      detail = 'Multiple transfers initiated in rapid succession today. Paused to prevent unauthorized fund depletion.';
    } else if (lower.contains('amount') || lower.contains('baseline') || lower.contains('high')) {
      icon = Icons.trending_up_rounded;
      detail = 'Transfer amount is significantly higher than your typical 30-day spending pattern.';
    } else if (lower.contains('device') || lower.contains('location') || lower.contains('ip')) {
      icon = Icons.devices_other_rounded;
      detail = 'Initiated from an unrecognized device or network IP not previously recorded on your account.';
    } else if (lower.contains('statutory') || lower.contains('dual') || lower.contains('75')) {
      icon = Icons.gavel_rounded;
      detail = 'Statutory dual maker-checker threshold (>= 75,000 LKR) requires secondary supervisory release.';
    } else if (lower.contains('pattern') || lower.contains('anomaly')) {
      icon = Icons.psychology_alt_rounded;
      detail = 'Transaction pattern deviated from established user baseline history.';
    }

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFFFFF7ED),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: const Color(0xFFFED7AA)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 18, color: const Color(0xFFEA580C)),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  reason,
                  style: const TextStyle(
                    fontWeight: FontWeight.bold,
                    fontSize: 13,
                    color: Color(0xFF9A3412),
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  detail,
                  style: const TextStyle(
                    fontSize: 11.5,
                    color: Color(0xFFC2410C),
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

  Widget _buildDetailRow(
    BuildContext context, {
    required String label,
    required String value,
    Color? valueColor,
    bool isMonospace = false,
    bool isCopyable = false,
  }) {
    final theme = Theme.of(context);
    final textTheme = theme.textTheme;
    final colorScheme = theme.colorScheme;

    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          label,
          style: textTheme.bodyMedium?.copyWith(
            color: colorScheme.onSurfaceVariant,
          ),
        ),
        const SizedBox(width: 12),
        Flexible(
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Flexible(
                child: Text(
                  value,
                  textAlign: TextAlign.end,
                  overflow: TextOverflow.ellipsis,
                  style: textTheme.bodyMedium?.copyWith(
                    fontWeight: FontWeight.w600,
                    color: valueColor ?? colorScheme.onSurface,
                    fontFamily: isMonospace ? 'monospace' : null,
                  ),
                ),
              ),
              if (isCopyable) ...[
                const SizedBox(width: 4),
                InkWell(
                  onTap: () {
                    Clipboard.setData(ClipboardData(text: value));
                    ScaffoldMessenger.of(context).hideCurrentSnackBar();
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(
                        content: Text('$label copied to clipboard'),
                        behavior: SnackBarBehavior.floating,
                        duration: const Duration(seconds: 2),
                      ),
                    );
                  },
                  borderRadius: BorderRadius.circular(4),
                  child: Padding(
                    padding: const EdgeInsets.all(4.0),
                    child: Icon(
                      Icons.copy_rounded,
                      size: 16,
                      color: colorScheme.primary,
                    ),
                  ),
                ),
              ],
            ],
          ),
        ),
      ],
    );
  }

  void _showContactSupportSheet(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;
    final textTheme = theme.textTheme;

    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (ctx) {
        return Container(
          decoration: BoxDecoration(
            color: colorScheme.surface,
            borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
          ),
          padding: const EdgeInsets.fromLTRB(24, 16, 24, 32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Center(
                child: Container(
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(
                    color: colorScheme.outlineVariant,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              const SizedBox(height: 20),
              Text(
                'FinCore Security Support',
                style: textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                'If this transfer of ${_formatAmount(amount)} was initiated by you and you need immediate clearance, please quote Transaction ID ($transactionId) to our fraud desk.',
                style: textTheme.bodyMedium?.copyWith(
                  color: colorScheme.onSurfaceVariant,
                  height: 1.4,
                ),
              ),
              const SizedBox(height: 20),
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: CircleAvatar(
                  backgroundColor: colorScheme.primaryContainer,
                  child: Icon(Icons.chat_bubble_outline_rounded,
                      color: colorScheme.onPrimaryContainer),
                ),
                title: const Text('Live Security Chat'),
                subtitle: const Text('Connect with a fraud analyst (24/7)'),
                trailing: const Icon(Icons.chevron_right),
                onTap: () {
                  Navigator.pop(ctx);
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text('Connecting to FinCore Security Chat...'),
                      behavior: SnackBarBehavior.floating,
                    ),
                  );
                },
              ),
              const Divider(),
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: CircleAvatar(
                  backgroundColor: colorScheme.secondaryContainer,
                  child: Icon(Icons.phone_in_talk_outlined,
                      color: colorScheme.onSecondaryContainer),
                ),
                title: const Text('Call Security Hotline'),
                subtitle: const Text('+94 11 234 5678 (Toll Free)'),
                trailing: const Icon(Icons.chevron_right),
                onTap: () {
                  Navigator.pop(ctx);
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text('Calling Security Hotline...'),
                      behavior: SnackBarBehavior.floating,
                    ),
                  );
                },
              ),
            ],
          ),
        );
      },
    );
  }
}
