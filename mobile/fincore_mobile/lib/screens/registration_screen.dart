import 'package:flutter/material.dart';
import '../services/auth_service.dart';
import '../widgets/kyc_scanners.dart';
import 'wallet_home_screen.dart';

class RegistrationScreen extends StatefulWidget {
  const RegistrationScreen({super.key});

  @override
  State<RegistrationScreen> createState() => _RegistrationScreenState();
}

class _RegistrationScreenState extends State<RegistrationScreen> {
  int _currentStep = 0;
  bool _isLoading = false;
  String? _errorMessage;

  // Colors aligned with FinCore Design System
  static const Color _navyBlue = Color(0xFF0F1E36);
  static const Color _accentBlue = Color(0xFF2563EB);
  static const Color _lightBg = Color(0xFFF8FAFC);
  static const Color _cardBg = Colors.white;
  static const Color _textPrimary = Color(0xFF0F172A);
  static const Color _textSecondary = Color(0xFF64748B);
  static const Color _successGreen = Color(0xFF10B981);

  // ── Step 1: Credentials & Security Controllers ───────────────────────────
  final _nameController = TextEditingController();
  final _emailController = TextEditingController();
  final _phoneController = TextEditingController(text: '+94 77 123 4567');
  final _passwordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();
  final _pinController = TextEditingController();
  bool _obscurePassword = true;
  bool _obscureConfirmPassword = true;
  bool _biometricOptIn = true;
  bool _phoneVerified = false;

  // ── Step 2: Personal Info & KYC Controllers ─────────────────────────────
  DateTime? _dateOfBirth = DateTime(1998, 6, 15);
  final _addressController = TextEditingController(text: '45/2 Galle Road');
  final _cityController = TextEditingController(text: 'Colombo');
  final _postalCodeController = TextEditingController(text: '00300');
  String _selectedIdType = 'National ID';
  final _idNumberController = TextEditingController(text: '199816703921');
  bool _idDocumentUploaded = false;
  String? _idDocumentUrl;
  double? _idConfidenceScore;
  bool _selfieVerified = false;
  String? _selfieUrl;
  double? _selfieMatchScore;

  // ── Step 3: Financial Linking Controllers ────────────────────────────────
  final _bankAccountController = TextEditingController();
  final _bankRoutingController = TextEditingController();
  final _cardNumberController = TextEditingController();
  final _cardExpiryController = TextEditingController();
  final _cardCvvController = TextEditingController();
  bool _skipFinancialLinking = false;

  // ── Step 4: Legal & Preferences ──────────────────────────────────────────
  bool _agreedToTerms = false;
  bool _marketingOptIn = true;

  @override
  void dispose() {
    _nameController.dispose();
    _emailController.dispose();
    _phoneController.dispose();
    _passwordController.dispose();
    _confirmPasswordController.dispose();
    _pinController.dispose();
    _addressController.dispose();
    _cityController.dispose();
    _postalCodeController.dispose();
    _idNumberController.dispose();
    _bankAccountController.dispose();
    _bankRoutingController.dispose();
    _cardNumberController.dispose();
    _cardExpiryController.dispose();
    _cardCvvController.dispose();
    super.dispose();
  }

  void _nextStep() {
    setState(() => _errorMessage = null);

    if (_currentStep == 0) {
      if (_nameController.text.trim().isEmpty) {
        setState(() => _errorMessage = 'Please enter your full legal name.');
        return;
      }
      if (_emailController.text.trim().isEmpty || !_emailController.text.contains('@')) {
        setState(() => _errorMessage = 'Please enter a valid email address.');
        return;
      }
      if (_phoneController.text.trim().isEmpty) {
        setState(() => _errorMessage = 'Please enter your mobile phone number.');
        return;
      }
      if (_passwordController.text.length < 6) {
        setState(() => _errorMessage = 'Password must be at least 6 characters.');
        return;
      }
      if (_passwordController.text != _confirmPasswordController.text) {
        setState(() => _errorMessage = 'Passwords do not match.');
        return;
      }
      if (_pinController.text.length < 4) {
        setState(() => _errorMessage = 'Please enter a 4-to-6 digit security PIN.');
        return;
      }
    } else if (_currentStep == 1) {
      if (_dateOfBirth == null) {
        setState(() => _errorMessage = 'Please select your date of birth.');
        return;
      }
      final age = DateTime.now().year - _dateOfBirth!.year;
      if (age < 18) {
        setState(() => _errorMessage = 'You must be at least 18 years of age to open a wallet.');
        return;
      }
      if (_addressController.text.trim().isEmpty || _cityController.text.trim().isEmpty) {
        setState(() => _errorMessage = 'Please provide your home address and city.');
        return;
      }
      if (_idNumberController.text.trim().isEmpty) {
        setState(() => _errorMessage = 'Please provide your Government ID number.');
        return;
      }
      if (!_idDocumentUploaded) {
        setState(() => _errorMessage = 'Please capture or upload your Government ID document.');
        return;
      }
      if (!_selfieVerified) {
        setState(() => _errorMessage = 'Please complete the live facial selfie verification.');
        return;
      }
    }

    if (_currentStep < 3) {
      setState(() => _currentStep++);
    } else {
      _submitRegistration();
    }
  }

  void _previousStep() {
    if (_currentStep > 0) {
      setState(() {
        _errorMessage = null;
        _currentStep--;
      });
    } else {
      Navigator.pop(context);
    }
  }

  Future<void> _submitRegistration() async {
    if (!_agreedToTerms) {
      setState(() => _errorMessage = 'You must agree to the Terms of Service & Privacy Policy.');
      return;
    }

    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final result = await AuthService.register(
        email: _emailController.text.trim(),
        password: _passwordController.text,
        name: _nameController.text.trim(),
        phoneNumber: _phoneController.text.trim(),
        pin: _pinController.text.trim(),
        biometricEnabled: _biometricOptIn,
        dateOfBirth: _dateOfBirth,
        address: _addressController.text.trim(),
        city: _cityController.text.trim(),
        postalCode: _postalCodeController.text.trim(),
        idType: _selectedIdType,
        idNumber: _idNumberController.text.trim(),
        idDocumentUrl: _idDocumentUploaded ? (_idDocumentUrl ?? 'verified_id_doc.png') : null,
        selfieUrl: _selfieVerified ? (_selfieUrl ?? 'verified_selfie_scan.png') : null,
        bankAccountNumber: _skipFinancialLinking ? null : _bankAccountController.text.trim(),
        bankRoutingCode: _skipFinancialLinking ? null : _bankRoutingController.text.trim(),
        cardNumber: _skipFinancialLinking ? null : _cardNumberController.text.trim(),
        agreedToTerms: _agreedToTerms,
        marketingOptIn: _marketingOptIn,
      );

      if (result['success']) {
        if (!mounted) return;
        _showSuccessDialog();
      } else {
        setState(() => _errorMessage = result['message'] ?? 'Registration failed.');
      }
    } catch (e) {
      setState(() => _errorMessage = 'Connection error. Please try again.');
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  void _showSuccessDialog() {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        contentPadding: const EdgeInsets.all(24),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 64,
              height: 64,
              decoration: const BoxDecoration(
                color: Color(0xFFDCFCE7),
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.check_circle_rounded, color: _successGreen, size: 40),
            ),
            const SizedBox(height: 18),
            const Text(
              'KYC Verified & Registered!',
              style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: _textPrimary),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 8),
            Text(
              'Welcome, ${_nameController.text.trim()}! Your FinCore digital wallet is now active with starter balance.',
              style: const TextStyle(fontSize: 14, color: _textSecondary),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 24),
            SizedBox(
              width: double.infinity,
              height: 48,
              child: ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: _accentBlue,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
                onPressed: () {
                  Navigator.pop(ctx);
                  Navigator.pushReplacement(
                    context,
                    MaterialPageRoute(builder: (_) => const WalletHomeScreen()),
                  );
                },
                child: const Text('Go to Wallet Dashboard', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _simulateOtpVerification() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (ctx) => Padding(
        padding: EdgeInsets.only(
          left: 24,
          right: 24,
          top: 24,
          bottom: MediaQuery.of(ctx).viewInsets.bottom + 24,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text('Verify Phone Number', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                IconButton(icon: const Icon(Icons.close), onPressed: () => Navigator.pop(ctx)),
              ],
            ),
            const SizedBox(height: 8),
            Text('We sent a 6-digit OTP code to ${_phoneController.text}.', style: const TextStyle(color: _textSecondary)),
            const SizedBox(height: 20),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(color: const Color(0xFFEFF6FF), borderRadius: BorderRadius.circular(12)),
              child: const Center(
                child: Text('Simulated OTP Code: 849201', style: TextStyle(fontWeight: FontWeight.bold, color: _accentBlue, fontSize: 16)),
              ),
            ),
            const SizedBox(height: 20),
            ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: _accentBlue,
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              onPressed: () {
                Navigator.pop(ctx);
                setState(() => _phoneVerified = true);
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('✓ Phone number verified successfully!'), backgroundColor: _successGreen),
                );
              },
              child: const Text('Confirm & Verify OTP', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
            ),
          ],
        ),
      ),
    );
  }

  void _openIdScanner() {
    showDialog(
      context: context,
      useSafeArea: false,
      builder: (ctx) => DocumentScannerModal(
        idType: _selectedIdType,
        initialIdNumber: _idNumberController.text.trim().isNotEmpty
            ? _idNumberController.text.trim()
            : null,
        onCaptured: (data) {
          setState(() {
            _idDocumentUploaded = true;
            _idDocumentUrl = data['documentUrl'];
            _selectedIdType = data['idType'] ?? _selectedIdType;
            if (_idNumberController.text.trim().isEmpty && data['idNumber'] != null) {
              _idNumberController.text = data['idNumber'];
            }
            _idConfidenceScore = (data['confidenceScore'] as num?)?.toDouble() ?? 98.6;
          });
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('✓ $_selectedIdType scanned & security checked!'),
              backgroundColor: _successGreen,
            ),
          );
        },
      ),
    );
  }

  void _openSelfieScanner() {
    showDialog(
      context: context,
      useSafeArea: false,
      builder: (ctx) => SelfieScannerModal(
        onCaptured: (data) {
          setState(() {
            _selfieVerified = true;
            _selfieUrl = data['selfieUrl'];
            _selfieMatchScore = (data['matchScore'] as num?)?.toDouble() ?? 99.4;
          });
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('✓ 3D Facial liveness verified (0% spoof risk)!'),
              backgroundColor: _successGreen,
            ),
          );
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final stepTitles = ['Security', 'Identity (KYC)', 'Financial', 'Agreements'];

    return Scaffold(
      backgroundColor: _navyBlue,
      body: SafeArea(
        child: Column(
          children: [
            // ── Top Navigation Bar ──────────────────────────────────────────
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              child: Row(
                children: [
                  IconButton(
                    icon: const Icon(Icons.arrow_back_ios_new_rounded, color: Colors.white, size: 20),
                    onPressed: _previousStep,
                  ),
                  const SizedBox(width: 8),
                  Text(
                    'Create Wallet Account',
                    style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold),
                  ),
                  const Spacer(),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Text(
                      'Step ${_currentStep + 1} of 4',
                      style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w600),
                    ),
                  ),
                ],
              ),
            ),

            // ── Stepper Indicator ───────────────────────────────────────────
            Padding(
              padding: const EdgeInsets.fromLTRB(24, 4, 24, 16),
              child: Row(
                children: List.generate(4, (index) {
                  final isDone = index < _currentStep;
                  final isCurrent = index == _currentStep;
                  return Expanded(
                    child: Row(
                      children: [
                        Expanded(
                          child: Container(
                            height: 4,
                            decoration: BoxDecoration(
                              color: isDone || isCurrent ? _accentBlue : Colors.white.withValues(alpha: 0.2),
                              borderRadius: BorderRadius.circular(2),
                            ),
                          ),
                        ),
                        if (index < 3) const SizedBox(width: 6),
                      ],
                    ),
                  );
                }),
              ),
            ),

            // ── Main Card Body ──────────────────────────────────────────────
            Expanded(
              child: Container(
                width: double.infinity,
                decoration: const BoxDecoration(
                  color: _lightBg,
                  borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
                ),
                child: SingleChildScrollView(
                  padding: const EdgeInsets.fromLTRB(24, 24, 24, 32),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        stepTitles[_currentStep],
                        style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold, color: _textPrimary),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        _getStepSubtitle(_currentStep),
                        style: const TextStyle(fontSize: 13, color: _textSecondary),
                      ),
                      const SizedBox(height: 20),

                      if (_errorMessage != null) ...[
                        Container(
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: const Color(0xFFFEE2E2),
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(color: const Color(0xFFF87171)),
                          ),
                          child: Row(
                            children: [
                              const Icon(Icons.error_outline_rounded, color: Color(0xFFDC2626), size: 20),
                              const SizedBox(width: 8),
                              Expanded(
                                child: Text(_errorMessage!, style: const TextStyle(color: Color(0xFF991B1B), fontSize: 13)),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 16),
                      ],

                      // Active Step View
                      if (_currentStep == 0) _buildStep1Credentials(),
                      if (_currentStep == 1) _buildStep2Kyc(),
                      if (_currentStep == 2) _buildStep3Financial(),
                      if (_currentStep == 3) _buildStep4Legal(),

                      const SizedBox(height: 28),

                      // Continue / Finish Button
                      SizedBox(
                        width: double.infinity,
                        height: 52,
                        child: ElevatedButton(
                          style: ElevatedButton.styleFrom(
                            backgroundColor: _accentBlue,
                            elevation: 0,
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                          ),
                          onPressed: _isLoading ? null : _nextStep,
                          child: _isLoading
                              ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2.5))
                              : Text(
                                  _currentStep == 3 ? 'Complete & Open Wallet' : 'Continue to Next Step',
                                  style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
                                ),
                        ),
                      ),

                      if (_currentStep == 2) ...[
                        const SizedBox(height: 12),
                        Center(
                          child: TextButton(
                            onPressed: () {
                              setState(() {
                                _skipFinancialLinking = true;
                                _currentStep = 3;
                              });
                            },
                            child: const Text('Skip financial linking for now', style: TextStyle(color: _textSecondary)),
                          ),
                        ),
                      ],
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

  String _getStepSubtitle(int step) {
    switch (step) {
      case 0:
        return 'Set up mobile credentials, secure password, and biometric lock.';
      case 1:
        return 'Verify your identity for financial regulatory compliance (KYC).';
      case 2:
        return 'Link your bank or debit card to fund your digital wallet (Optional).';
      case 3:
        return 'Review user agreements, terms of service, and preferences.';
      default:
        return '';
    }
  }

  // ── STEP 1: CREDENTIALS & SECURITY ─────────────────────────────────────────
  Widget _buildStep1Credentials() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _buildFieldLabel('Full Legal Name'),
        _buildTextField(_nameController, hint: 'e.g. Kamal Perera', icon: Icons.person_outline_rounded),
        const SizedBox(height: 16),

        _buildFieldLabel('Email Address (Receipts & Security Alerts)'),
        _buildTextField(_emailController, hint: 'e.g. kamal@example.com', icon: Icons.email_outlined, keyboardType: TextInputType.emailAddress),
        const SizedBox(height: 16),

        _buildFieldLabel('Mobile Phone Number (Primary Wallet ID)'),
        Row(
          children: [
            Expanded(
              child: _buildTextField(_phoneController, hint: '+94 77 123 4567', icon: Icons.phone_android_rounded, keyboardType: TextInputType.phone),
            ),
            const SizedBox(width: 8),
            ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: _phoneVerified ? _successGreen : _navyBlue,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
              ),
              onPressed: _simulateOtpVerification,
              child: Text(
                _phoneVerified ? 'Verified ✓' : 'Verify OTP',
                style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.bold),
              ),
            ),
          ],
        ),
        const SizedBox(height: 16),

        _buildFieldLabel('Account Password'),
        _buildTextField(
          _passwordController,
          hint: 'At least 6 characters',
          icon: Icons.lock_outline_rounded,
          obscureText: _obscurePassword,
          suffixIcon: IconButton(
            icon: Icon(_obscurePassword ? Icons.visibility_outlined : Icons.visibility_off_outlined, color: _textSecondary),
            onPressed: () => setState(() => _obscurePassword = !_obscurePassword),
          ),
        ),
        const SizedBox(height: 16),

        _buildFieldLabel('Confirm Password'),
        _buildTextField(
          _confirmPasswordController,
          hint: 'Re-enter password',
          icon: Icons.lock_outline_rounded,
          obscureText: _obscureConfirmPassword,
          suffixIcon: IconButton(
            icon: Icon(_obscureConfirmPassword ? Icons.visibility_outlined : Icons.visibility_off_outlined, color: _textSecondary),
            onPressed: () => setState(() => _obscureConfirmPassword = !_obscureConfirmPassword),
          ),
        ),
        const SizedBox(height: 16),

        _buildFieldLabel('4-to-6 Digit Security PIN (Fast Authorizations)'),
        _buildTextField(_pinController, hint: 'e.g. 1234', icon: Icons.pin_rounded, keyboardType: TextInputType.number, obscureText: true),
        const SizedBox(height: 20),

        // Biometric Switch
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: _cardBg,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: const Color(0xFFE2E8F0)),
          ),
          child: Row(
            children: [
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(color: const Color(0xFFEFF6FF), borderRadius: BorderRadius.circular(12)),
                child: const Icon(Icons.fingerprint_rounded, color: _accentBlue, size: 28),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: const [
                    Text('Enable Biometrics (Face / Fingerprint)', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                    SizedBox(height: 2),
                    Text('Instantly unlock wallet & authorize transfers', style: TextStyle(color: _textSecondary, fontSize: 12)),
                  ],
                ),
              ),
              Switch.adaptive(
                value: _biometricOptIn,
                activeTrackColor: _accentBlue,
                onChanged: (val) => setState(() => _biometricOptIn = val),
              ),
            ],
          ),
        ),
      ],
    );
  }

  // ── STEP 2: PERSONAL INFO & KYC ───────────────────────────────────────────
  Widget _buildStep2Kyc() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _buildFieldLabel('Date of Birth (Must be 18+)'),
        GestureDetector(
          onTap: () async {
            final picked = await showDatePicker(
              context: context,
              initialDate: _dateOfBirth ?? DateTime(2000, 1, 1),
              firstDate: DateTime(1930),
              lastDate: DateTime.now(),
            );
            if (picked != null) setState(() => _dateOfBirth = picked);
          },
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
            decoration: BoxDecoration(
              color: _cardBg,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: const Color(0xFFCBD5E1)),
            ),
            child: Row(
              children: [
                const Icon(Icons.calendar_month_rounded, color: _textSecondary, size: 20),
                const SizedBox(width: 10),
                Text(
                  _dateOfBirth == null ? 'Select Date of Birth' : '${_dateOfBirth!.year}-${_dateOfBirth!.month.toString().padLeft(2, '0')}-${_dateOfBirth!.day.toString().padLeft(2, '0')}',
                  style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w500),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 16),

        _buildFieldLabel('Residential Street Address'),
        _buildTextField(_addressController, hint: 'e.g. 45/2 Galle Road', icon: Icons.home_outlined),
        const SizedBox(height: 16),

        Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _buildFieldLabel('City / Province'),
                  _buildTextField(_cityController, hint: 'Colombo', icon: Icons.location_city_rounded),
                ],
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _buildFieldLabel('Postal / ZIP Code'),
                  _buildTextField(_postalCodeController, hint: '00300', icon: Icons.markunread_mailbox_outlined, keyboardType: TextInputType.number),
                ],
              ),
            ),
          ],
        ),
        const SizedBox(height: 16),

        _buildFieldLabel('Government Identification Type'),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 14),
          decoration: BoxDecoration(
            color: _cardBg,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: const Color(0xFFCBD5E1)),
          ),
          child: DropdownButtonHideUnderline(
            child: DropdownButton<String>(
              value: _selectedIdType,
              isExpanded: true,
              items: ['National ID', 'Passport', 'Driver License'].map((t) => DropdownMenuItem(value: t, child: Text(t))).toList(),
              onChanged: (v) => setState(() => _selectedIdType = v!),
            ),
          ),
        ),
        const SizedBox(height: 16),

        _buildFieldLabel('$_selectedIdType Number'),
        _buildTextField(_idNumberController, hint: 'e.g. 199816703921', icon: Icons.badge_outlined),
        const SizedBox(height: 20),

        // ID Upload Card
        _buildVerificationCard(
          title: '$_selectedIdType Camera Scanner',
          subtitle: 'Position front side inside the live scanner frame',
          icon: Icons.camera_alt_outlined,
          isCompleted: _idDocumentUploaded,
          extraTag: 'Scanned ✓ Quality ${_idConfidenceScore ?? 98.6}% • Anti-Glare Pass',
          onTap: _openIdScanner,
        ),
        const SizedBox(height: 12),

        // Live Selfie Scan Card
        _buildVerificationCard(
          title: 'Live 3D Facial Liveness Scan',
          subtitle: 'Real-time anti-spoofing depth & blink verification',
          icon: Icons.face_rounded,
          isCompleted: _selfieVerified,
          extraTag: 'Verified ✓ 3D Depth & Blink Matched (${_selfieMatchScore ?? 99.4}%)',
          onTap: _openSelfieScanner,
        ),
      ],
    );
  }

  // ── STEP 3: FINANCIAL LINKING ─────────────────────────────────────────────
  Widget _buildStep3Financial() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: const Color(0xFFEFF6FF),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: const Color(0xFFBFDBFE)),
          ),
          child: Row(
            children: const [
              Icon(Icons.info_outline_rounded, color: _accentBlue, size: 20),
              SizedBox(width: 10),
              Expanded(
                child: Text(
                  'Linking a bank or card allows seamless funding and instant wallet top-ups. You can also skip and link later.',
                  style: TextStyle(fontSize: 12, color: Color(0xFF1E40AF)),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 20),

        const Text('Bank Account Linking', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: _textPrimary)),
        const SizedBox(height: 12),
        _buildFieldLabel('Bank Account Number'),
        _buildTextField(_bankAccountController, hint: 'e.g. 8001928374', icon: Icons.account_balance_outlined, keyboardType: TextInputType.number),
        const SizedBox(height: 12),
        _buildFieldLabel('Branch / Routing Code'),
        _buildTextField(_bankRoutingController, hint: 'e.g. 7010-001', icon: Icons.share_location_rounded),

        const SizedBox(height: 24),
        const Divider(),
        const SizedBox(height: 16),

        const Text('Debit or Credit Card', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: _textPrimary)),
        const SizedBox(height: 12),
        _buildFieldLabel('16-Digit Card Number'),
        _buildTextField(_cardNumberController, hint: '4532 •••• •••• 6789', icon: Icons.credit_card_rounded, keyboardType: TextInputType.number),
        const SizedBox(height: 12),

        Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _buildFieldLabel('Expiry (MM/YY)'),
                  _buildTextField(_cardExpiryController, hint: '08/29', icon: Icons.date_range_rounded),
                ],
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _buildFieldLabel('CVV Security Code'),
                  _buildTextField(_cardCvvController, hint: '•••', icon: Icons.security_rounded, keyboardType: TextInputType.number, obscureText: true),
                ],
              ),
            ),
          ],
        ),
      ],
    );
  }

  // ── STEP 4: LEGAL & PREFERENCES ───────────────────────────────────────────
  Widget _buildStep4Legal() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Summary KYC Review
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: _cardBg,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: const Color(0xFFE2E8F0)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: const [
                  Icon(Icons.verified_user_rounded, color: _successGreen, size: 20),
                  SizedBox(width: 8),
                  Text('KYC Verification Summary', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
                ],
              ),
              const Divider(height: 20),
              _buildSummaryRow('Legal Name', _nameController.text),
              _buildSummaryRow('Mobile ID', _phoneController.text),
              _buildSummaryRow('Government ID', '$_selectedIdType (${_idNumberController.text})'),
              _buildSummaryRow('Biometric Security', _biometricOptIn ? 'Enabled (Touch / Face ID)' : 'Disabled'),
              _buildSummaryRow('ID & Selfie Verification', 'Matched & Compliant ✓'),
            ],
          ),
        ),
        const SizedBox(height: 20),

        // Terms of Service Checkbox
        CheckboxListTile(
          value: _agreedToTerms,
          activeColor: _accentBlue,
          contentPadding: EdgeInsets.zero,
          controlAffinity: ListTileControlAffinity.leading,
          onChanged: (v) => setState(() => _agreedToTerms = v ?? false),
          title: const Text(
            'I agree to the FinCore Terms of Service, Privacy Policy, and Electronic Fund Transfer Disclosure (Mandatory).',
            style: TextStyle(fontSize: 13, color: _textPrimary, height: 1.4),
          ),
        ),
        const SizedBox(height: 8),

        // Marketing Toggle
        SwitchListTile.adaptive(
          value: _marketingOptIn,
          activeTrackColor: _accentBlue,
          contentPadding: EdgeInsets.zero,
          onChanged: (v) => setState(() => _marketingOptIn = v),
          title: const Text(
            'Receive monthly statements, interest rate updates, and exclusive wallet promotions via email.',
            style: TextStyle(fontSize: 13, color: _textSecondary),
          ),
        ),
      ],
    );
  }

  Widget _buildSummaryRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: const TextStyle(fontSize: 12, color: _textSecondary)),
          Text(value, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: _textPrimary)),
        ],
      ),
    );
  }

  Widget _buildVerificationCard({
    required String title,
    required String subtitle,
    required IconData icon,
    required bool isCompleted,
    required VoidCallback onTap,
    String? extraTag,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: isCompleted ? const Color(0xFFF0FDF4) : _cardBg,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: isCompleted ? _successGreen : const Color(0xFFE2E8F0),
            width: isCompleted ? 1.5 : 1,
          ),
          boxShadow: [
            BoxShadow(
              color: isCompleted
                  ? _successGreen.withValues(alpha: 0.08)
                  : Colors.black.withValues(alpha: 0.02),
              blurRadius: 8,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: isCompleted ? const Color(0xFFDCFCE7) : const Color(0xFFEFF6FF),
                borderRadius: BorderRadius.circular(14),
              ),
              child: Icon(
                isCompleted ? Icons.check_circle_rounded : icon,
                color: isCompleted ? _successGreen : _accentBlue,
                size: 26,
              ),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: TextStyle(
                      fontWeight: FontWeight.bold,
                      fontSize: 14,
                      color: isCompleted ? const Color(0xFF166534) : _textPrimary,
                    ),
                  ),
                  const SizedBox(height: 3),
                  Text(
                    isCompleted && extraTag != null ? extraTag : subtitle,
                    style: TextStyle(
                      color: isCompleted ? const Color(0xFF15803D) : _textSecondary,
                      fontSize: 12,
                      fontWeight: isCompleted ? FontWeight.w500 : FontWeight.normal,
                    ),
                  ),
                ],
              ),
            ),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              decoration: BoxDecoration(
                color: isCompleted ? const Color(0xFFDCFCE7) : const Color(0xFFEFF6FF),
                borderRadius: BorderRadius.circular(20),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(
                    isCompleted ? Icons.check_rounded : Icons.camera_alt_outlined,
                    size: 13,
                    color: isCompleted ? _successGreen : _accentBlue,
                  ),
                  const SizedBox(width: 4),
                  Text(
                    isCompleted ? 'Retake' : 'Open Camera',
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.bold,
                      color: isCompleted ? _successGreen : _accentBlue,
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

  Widget _buildFieldLabel(String label) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Text(
        label,
        style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: _textPrimary),
      ),
    );
  }

  Widget _buildTextField(
    TextEditingController controller, {
    required String hint,
    required IconData icon,
    bool obscureText = false,
    TextInputType keyboardType = TextInputType.text,
    Widget? suffixIcon,
  }) {
    return Container(
      decoration: BoxDecoration(
        color: _cardBg,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFCBD5E1)),
      ),
      child: TextField(
        controller: controller,
        obscureText: obscureText,
        keyboardType: keyboardType,
        style: const TextStyle(fontSize: 15, color: _textPrimary),
        decoration: InputDecoration(
          hintText: hint,
          hintStyle: const TextStyle(color: Color(0xFF94A3B8), fontSize: 14),
          prefixIcon: Icon(icon, color: _textSecondary, size: 20),
          suffixIcon: suffixIcon,
          border: InputBorder.none,
          contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
        ),
      ),
    );
  }
}
