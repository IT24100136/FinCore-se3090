import 'package:flutter/material.dart';
import '../services/auth_service.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  // Sign In & General Controllers
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();

  // Register KYC Controllers
  final _fullNameController = TextEditingController();
  final _mobileController = TextEditingController();
  final _nicController = TextEditingController();
  final _dobController = TextEditingController();
  final _addressController = TextEditingController();

  String? _jwtToken;
  String? _statusMessage;
  bool _isLoading = false;
  bool _isRegisterMode = false;
  bool _rememberDevice = true;

  @override
  void initState() {
    super.initState();
    _checkExistingToken();
  }

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    _fullNameController.dispose();
    _mobileController.dispose();
    _nicController.dispose();
    _dobController.dispose();
    _addressController.dispose();
    super.dispose();
  }

  Future<void> _checkExistingToken() async {
    final token = await AuthService.getToken();
    if (token != null && token.isNotEmpty) {
      setState(() {
        _jwtToken = token;
      });
    }
  }

  Map<String, dynamic>? _deviceVerification;

  Future<void> _selectDob() async {
    final now = DateTime.now();
    final pickedDate = await showDatePicker(
      context: context,
      initialDate: DateTime(2000, 1, 1),
      firstDate: DateTime(1920),
      lastDate: now,
      builder: (context, child) {
        return Theme(
          data: Theme.of(context).copyWith(
            colorScheme: const ColorScheme.light(
              primary: Color(0xFF0066FF),
            ),
          ),
          child: child!,
        );
      },
    );

    if (pickedDate != null) {
      final formattedDate =
          "${pickedDate.year}-${pickedDate.month.toString().padLeft(2, '0')}-${pickedDate.day.toString().padLeft(2, '0')}";
      setState(() {
        _dobController.text = formattedDate;
      });
    }
  }

  Future<void> _handleAuth() async {
    final email = _emailController.text.trim();
    final password = _passwordController.text.trim();

    if (email.isEmpty || password.isEmpty) {
      setState(() {
        _statusMessage = 'Please fill in required fields (Email & Password)';
      });
      return;
    }

    setState(() {
      _isLoading = true;
      _statusMessage = null;
    });

    try {
      if (_isRegisterMode) {
        final result = await AuthService.register(
          email: email,
          password: password,
          role: 'Customer',
        );

        if (result['success']) {
          setState(() {
            _statusMessage = 'Registered successfully! You can now sign in.';
            _isRegisterMode = false;
          });
        } else {
          setState(() {
            _statusMessage = result['message'];
          });
        }
      } else {
        final result = await AuthService.login(email: email, password: password);
        if (result['success']) {
          setState(() {
            _jwtToken = result['token'];
            _deviceVerification = result['deviceVerification'];
            _statusMessage = 'Login successful!';
          });

          if (result['deviceVerification'] != null &&
              result['deviceVerification']['status'] == 'Unverified') {
            final rawSessionId = result['deviceVerification']['sessionId'];
            final sessionId = rawSessionId is int
                ? rawSessionId
                : int.tryParse(rawSessionId.toString());
            if (sessionId != null) {
              _showUnverifiedDeviceDialog(sessionId);
            }
          }
        } else {
          setState(() {
            _statusMessage = result['message'];
          });
        }
      }
    } catch (e) {
      setState(() {
        _statusMessage = 'Error: $e';
      });
    } finally {
      setState(() {
        _isLoading = false;
      });
    }
  }

  Future<void> _showUnverifiedDeviceDialog(int sessionId) async {
    return showDialog<void>(
      context: context,
      barrierDismissible: false,
      builder: (BuildContext dialogContext) {
        return AlertDialog(
          title: const Text('New Device Detected'),
          content: const Text("We don't recognize this device. Is this you?"),
          actions: <Widget>[
            TextButton(
              child: const Text('No'),
              onPressed: () {
                Navigator.of(dialogContext).pop();
              },
            ),
            ElevatedButton(
              child: const Text('Yes'),
              onPressed: () async {
                Navigator.of(dialogContext).pop();
                try {
                  final res = await AuthService.updateDeviceStatus(
                    sessionId: sessionId,
                    status: 'Verified',
                  );
                  if (res['status'] != null) {
                    setState(() {
                      if (_deviceVerification != null) {
                        _deviceVerification!['status'] = res['status'];
                      }
                      _statusMessage = 'Device verified successfully!';
                    });
                  }
                } catch (e) {
                  setState(() {
                    _statusMessage = 'Error updating device status: $e';
                  });
                }
              },
            ),
          ],
        );
      },
    );
  }

  Future<void> _handleLogout() async {
    await AuthService.logout();
    setState(() {
      _jwtToken = null;
      _deviceVerification = null;
      _statusMessage = 'Logged out';
    });
  }

  Widget _buildFieldLabel(String label) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8.0),
      child: Text(
        label,
        style: const TextStyle(
          color: Color(0xFF334155),
          fontSize: 13,
          fontWeight: FontWeight.bold,
        ),
      ),
    );
  }

  InputDecoration _buildInputDecoration({
    required String hintText,
    Widget? prefixIcon,
    Widget? suffixIcon,
  }) {
    const brandBlue = Color(0xFF0066FF);
    return InputDecoration(
      hintText: hintText,
      hintStyle: TextStyle(color: Colors.grey.shade400, fontSize: 14),
      prefixIcon: prefixIcon,
      suffixIcon: suffixIcon,
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: brandBlue, width: 2),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    const brandBlue = Color(0xFF0066FF);
    const darkNavy = Color(0xFF0A1128);

    return Scaffold(
      backgroundColor: darkNavy,
      body: Column(
        children: [
          // Top Header (Dark Navy Background)
          SafeArea(
            bottom: false,
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 24.0, vertical: 20.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Brand Row
                  Row(
                    children: [
                      Container(
                        width: 44,
                        height: 44,
                        decoration: BoxDecoration(
                          color: brandBlue,
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: const Center(
                          child: Text(
                            'FC',
                            style: TextStyle(
                              color: Colors.white,
                              fontWeight: FontWeight.bold,
                              fontSize: 18,
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      const Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'FinCore',
                            style: TextStyle(
                              color: Colors.white,
                              fontWeight: FontWeight.bold,
                              fontSize: 20,
                            ),
                          ),
                          Text(
                            'SECURE DIGITAL WALLET',
                            style: TextStyle(
                              color: Color(0xFF82ACFF),
                              fontSize: 10,
                              fontWeight: FontWeight.w600,
                              letterSpacing: 1.2,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                  const SizedBox(height: 32),
                  // Dynamic Greeting Header
                  Text(
                    _isRegisterMode ? 'Create an Account' : 'Welcome back',
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 28,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    _isRegisterMode
                        ? 'Join FinCore today'
                        : 'Sign in to manage your wallet',
                    style: TextStyle(
                      color: Colors.grey.shade400,
                      fontSize: 14,
                      fontWeight: FontWeight.normal,
                    ),
                  ),
                  const SizedBox(height: 12),
                ],
              ),
            ),
          ),

          // Bottom Form Area (White Background)
          Expanded(
            child: Container(
              width: double.infinity,
              decoration: const BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.only(
                  topLeft: Radius.circular(32),
                  topRight: Radius.circular(32),
                ),
              ),
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(28.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Status Banner
                    if (_statusMessage != null) ...[
                      Container(
                        padding: const EdgeInsets.all(12),
                        margin: const EdgeInsets.only(bottom: 20),
                        decoration: BoxDecoration(
                          color: _statusMessage!.contains('successful') ||
                                  _statusMessage!.contains('Registered') ||
                                  _statusMessage!.contains('verified')
                              ? Colors.green.shade50
                              : Colors.red.shade50,
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(
                            color: _statusMessage!.contains('successful') ||
                                    _statusMessage!.contains('Registered') ||
                                    _statusMessage!.contains('verified')
                                ? Colors.green.shade200
                                : Colors.red.shade200,
                          ),
                        ),
                        child: Row(
                          children: [
                            Icon(
                              _statusMessage!.contains('successful') ||
                                      _statusMessage!.contains('Registered') ||
                                      _statusMessage!.contains('verified')
                                  ? Icons.check_circle_outline
                                  : Icons.error_outline,
                              color: _statusMessage!.contains('successful') ||
                                      _statusMessage!.contains('Registered') ||
                                      _statusMessage!.contains('verified')
                                  ? Colors.green.shade700
                                  : Colors.red.shade700,
                              size: 20,
                            ),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                _statusMessage!,
                                style: TextStyle(
                                  color: _statusMessage!.contains('successful') ||
                                          _statusMessage!.contains('Registered') ||
                                          _statusMessage!.contains('verified')
                                      ? Colors.green.shade800
                                      : Colors.red.shade800,
                                  fontWeight: FontWeight.w600,
                                  fontSize: 13,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],

                    if (_jwtToken != null) ...[
                      // Authenticated Session Card
                      Container(
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          color: const Color(0xFFF8FAFC),
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(color: const Color(0xFFE2E8F0)),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text(
                              'Authenticated Session',
                              style: TextStyle(
                                fontWeight: FontWeight.bold,
                                fontSize: 16,
                                color: Color(0xFF1E293B),
                              ),
                            ),
                            const SizedBox(height: 12),
                            if (_deviceVerification != null) ...[
                              Row(
                                children: [
                                  const Text('Device Status: ',
                                      style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                    decoration: BoxDecoration(
                                      color: _deviceVerification!['status'] == 'Trusted'
                                          ? Colors.green.shade100
                                          : _deviceVerification!['status'] == 'Verified'
                                              ? Colors.blue.shade100
                                              : Colors.orange.shade100,
                                      borderRadius: BorderRadius.circular(6),
                                    ),
                                    child: Text(
                                      '${_deviceVerification!['status'] ?? 'Unknown'}',
                                      style: TextStyle(
                                        fontWeight: FontWeight.bold,
                                        fontSize: 12,
                                        color: _deviceVerification!['status'] == 'Trusted'
                                            ? Colors.green.shade800
                                            : _deviceVerification!['status'] == 'Verified'
                                                ? Colors.blue.shade800
                                                : Colors.orange.shade800,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 4),
                              Text(
                                'Fingerprint: ${_deviceVerification!['deviceFingerprint'] ?? ''}',
                                style: TextStyle(fontSize: 11, color: Colors.grey.shade600),
                              ),
                              const SizedBox(height: 12),
                            ],
                            const Text(
                              'JWT Token:',
                              style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12),
                            ),
                            const SizedBox(height: 4),
                            Container(
                              padding: const EdgeInsets.all(10),
                              decoration: BoxDecoration(
                                color: Colors.grey.shade200,
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: SelectableText(
                                _jwtToken!,
                                style: const TextStyle(fontSize: 11, fontFamily: 'monospace'),
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 20),
                      SizedBox(
                        width: double.infinity,
                        height: 48,
                        child: OutlinedButton(
                          onPressed: _handleLogout,
                          style: OutlinedButton.styleFrom(
                            side: const BorderSide(color: Colors.red),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                          ),
                          child: const Text(
                            'Logout',
                            style: TextStyle(color: Colors.red, fontWeight: FontWeight.bold),
                          ),
                        ),
                      ),
                    ] else ...[
                      // Tab Toggle (Custom Segmented Control)
                      Container(
                        padding: const EdgeInsets.all(4),
                        decoration: BoxDecoration(
                          color: const Color(0xFFF1F3F9),
                          borderRadius: BorderRadius.circular(14),
                        ),
                        child: Row(
                          children: [
                            Expanded(
                              child: GestureDetector(
                                onTap: () => setState(() {
                                  _isRegisterMode = false;
                                  _statusMessage = null;
                                }),
                                child: Container(
                                  padding: const EdgeInsets.symmetric(vertical: 12),
                                  decoration: BoxDecoration(
                                    color: !_isRegisterMode ? Colors.white : Colors.transparent,
                                    borderRadius: BorderRadius.circular(10),
                                    boxShadow: !_isRegisterMode
                                        ? [
                                            BoxShadow(
                                              color: Colors.black.withAlpha(15),
                                              blurRadius: 4,
                                              offset: const Offset(0, 2),
                                            ),
                                          ]
                                        : [],
                                  ),
                                  child: Center(
                                    child: Text(
                                      'Sign In',
                                      style: TextStyle(
                                        fontWeight:
                                            !_isRegisterMode ? FontWeight.bold : FontWeight.normal,
                                        color: !_isRegisterMode
                                            ? const Color(0xFF1E293B)
                                            : Colors.grey.shade600,
                                        fontSize: 14,
                                      ),
                                    ),
                                  ),
                                ),
                              ),
                            ),
                            Expanded(
                              child: GestureDetector(
                                onTap: () => setState(() {
                                  _isRegisterMode = true;
                                  _statusMessage = null;
                                }),
                                child: Container(
                                  padding: const EdgeInsets.symmetric(vertical: 12),
                                  decoration: BoxDecoration(
                                    color: _isRegisterMode ? Colors.white : Colors.transparent,
                                    borderRadius: BorderRadius.circular(10),
                                    boxShadow: _isRegisterMode
                                        ? [
                                            BoxShadow(
                                              color: Colors.black.withAlpha(15),
                                              blurRadius: 4,
                                              offset: const Offset(0, 2),
                                            ),
                                          ]
                                        : [],
                                  ),
                                  child: Center(
                                    child: Text(
                                      'Register',
                                      style: TextStyle(
                                        fontWeight:
                                            _isRegisterMode ? FontWeight.bold : FontWeight.normal,
                                        color: _isRegisterMode
                                            ? const Color(0xFF1E293B)
                                            : Colors.grey.shade600,
                                        fontSize: 14,
                                      ),
                                    ),
                                  ),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 24),

                      // State 1: Sign In View vs State 2: Register View
                      if (!_isRegisterMode) ...[
                        // SIGN IN VIEW
                        _buildFieldLabel('Email Address'),
                        TextFormField(
                          controller: _emailController,
                          keyboardType: TextInputType.emailAddress,
                          style: const TextStyle(fontSize: 15, color: Color(0xFF0F172A)),
                          decoration: _buildInputDecoration(hintText: 'you@example.com'),
                        ),
                        const SizedBox(height: 20),

                        _buildFieldLabel('Password'),
                        TextFormField(
                          controller: _passwordController,
                          obscureText: true,
                          obscuringCharacter: '•',
                          style: const TextStyle(fontSize: 15, color: Color(0xFF0F172A)),
                          decoration: _buildInputDecoration(hintText: '••••••••'),
                        ),
                        const SizedBox(height: 16),

                        // Checkbox Row
                        Row(
                          children: [
                            SizedBox(
                              width: 24,
                              height: 24,
                              child: Checkbox(
                                value: _rememberDevice,
                                activeColor: brandBlue,
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(4),
                                ),
                                onChanged: (val) {
                                  setState(() {
                                    _rememberDevice = val ?? true;
                                  });
                                },
                              ),
                            ),
                            const SizedBox(width: 8),
                            Text(
                              'Remember this device',
                              style: TextStyle(
                                color: Colors.grey.shade600,
                                fontSize: 14,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 24),

                        // Submit Button (Sign In)
                        Container(
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(12),
                            boxShadow: [
                              BoxShadow(
                                color: brandBlue.withAlpha(89),
                                blurRadius: 16,
                                offset: const Offset(0, 6),
                              ),
                            ],
                          ),
                          child: SizedBox(
                            width: double.infinity,
                            height: 50,
                            child: ElevatedButton(
                              onPressed: _isLoading ? null : _handleAuth,
                              style: ElevatedButton.styleFrom(
                                backgroundColor: brandBlue,
                                foregroundColor: Colors.white,
                                elevation: 0,
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(12),
                                ),
                              ),
                              child: _isLoading
                                  ? const SizedBox(
                                      width: 24,
                                      height: 24,
                                      child: CircularProgressIndicator(
                                        color: Colors.white,
                                        strokeWidth: 2.5,
                                      ),
                                    )
                                  : const Text(
                                      'Sign In',
                                      style: TextStyle(
                                        fontSize: 16,
                                        fontWeight: FontWeight.bold,
                                        color: Colors.white,
                                      ),
                                    ),
                            ),
                          ),
                        ),
                        const SizedBox(height: 16),

                        // Forgot Password
                        Center(
                          child: TextButton(
                            onPressed: () {},
                            child: const Text(
                              'Forgot password?',
                              style: TextStyle(
                                color: brandBlue,
                                fontWeight: FontWeight.bold,
                                fontSize: 14,
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(height: 24),

                        // Biometrics Section
                        Row(
                          children: [
                            Expanded(child: Divider(color: Colors.grey.shade300)),
                            Padding(
                              padding: const EdgeInsets.symmetric(horizontal: 12.0),
                              child: Text(
                                'OR',
                                style: TextStyle(
                                  color: Colors.grey.shade500,
                                  fontSize: 12,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                            ),
                            Expanded(child: Divider(color: Colors.grey.shade300)),
                          ],
                        ),
                        const SizedBox(height: 20),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Container(
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                border: Border.all(color: const Color(0xFFE2E8F0), width: 1.5),
                              ),
                              child: IconButton(
                                iconSize: 28,
                                icon: const Icon(Icons.fingerprint, color: brandBlue),
                                onPressed: () {},
                              ),
                            ),
                            const SizedBox(width: 20),
                            Container(
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                border: Border.all(color: const Color(0xFFE2E8F0), width: 1.5),
                              ),
                              child: IconButton(
                                iconSize: 28,
                                icon: const Icon(Icons.face_retouching_natural, color: brandBlue),
                                onPressed: () {},
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 8),
                        Center(
                          child: Text(
                            'Sign in with Biometrics',
                            style: TextStyle(
                              fontSize: 12,
                              color: Colors.grey.shade600,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ),
                      ] else ...[
                        // REGISTER VIEW (KYC Compliance Fields)
                        _buildFieldLabel('Full Name'),
                        TextFormField(
                          controller: _fullNameController,
                          style: const TextStyle(fontSize: 15, color: Color(0xFF0F172A)),
                          decoration: _buildInputDecoration(hintText: 'John Doe'),
                        ),
                        const SizedBox(height: 18),

                        _buildFieldLabel('Email Address'),
                        TextFormField(
                          controller: _emailController,
                          keyboardType: TextInputType.emailAddress,
                          style: const TextStyle(fontSize: 15, color: Color(0xFF0F172A)),
                          decoration: _buildInputDecoration(hintText: 'you@example.com'),
                        ),
                        const SizedBox(height: 18),

                        _buildFieldLabel('Mobile Number'),
                        TextFormField(
                          controller: _mobileController,
                          keyboardType: TextInputType.phone,
                          style: const TextStyle(fontSize: 15, color: Color(0xFF0F172A)),
                          decoration: _buildInputDecoration(
                            hintText: '555-0199',
                            prefixIcon: const Padding(
                              padding: EdgeInsets.symmetric(horizontal: 14, vertical: 14),
                              child: Text(
                                '+1 ',
                                style: TextStyle(
                                  fontWeight: FontWeight.bold,
                                  color: Color(0xFF334155),
                                  fontSize: 14,
                                ),
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(height: 18),

                        _buildFieldLabel('NIC Number'),
                        TextFormField(
                          controller: _nicController,
                          style: const TextStyle(fontSize: 15, color: Color(0xFF0F172A)),
                          decoration: _buildInputDecoration(hintText: 'National Identity Card No.'),
                        ),
                        const SizedBox(height: 18),

                        _buildFieldLabel('Date of Birth'),
                        TextFormField(
                          controller: _dobController,
                          readOnly: true,
                          onTap: _selectDob,
                          style: const TextStyle(fontSize: 15, color: Color(0xFF0F172A)),
                          decoration: _buildInputDecoration(
                            hintText: 'YYYY-MM-DD',
                            suffixIcon: IconButton(
                              icon: const Icon(Icons.calendar_today, color: brandBlue, size: 20),
                              onPressed: _selectDob,
                            ),
                          ),
                        ),
                        const SizedBox(height: 18),

                        _buildFieldLabel('Residential Address'),
                        TextFormField(
                          controller: _addressController,
                          maxLines: 3,
                          style: const TextStyle(fontSize: 15, color: Color(0xFF0F172A)),
                          decoration: _buildInputDecoration(
                            hintText: '123 Financial St, Suite 400\nNew York, NY 10001',
                          ),
                        ),
                        const SizedBox(height: 18),

                        _buildFieldLabel('Password'),
                        TextFormField(
                          controller: _passwordController,
                          obscureText: true,
                          obscuringCharacter: '•',
                          style: const TextStyle(fontSize: 15, color: Color(0xFF0F172A)),
                          decoration: _buildInputDecoration(hintText: '••••••••'),
                        ),
                        const SizedBox(height: 24),

                        // Submit Button (Create Account)
                        Container(
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(12),
                            boxShadow: [
                              BoxShadow(
                                color: brandBlue.withAlpha(89),
                                blurRadius: 16,
                                offset: const Offset(0, 6),
                              ),
                            ],
                          ),
                          child: SizedBox(
                            width: double.infinity,
                            height: 50,
                            child: ElevatedButton(
                              onPressed: _isLoading ? null : _handleAuth,
                              style: ElevatedButton.styleFrom(
                                backgroundColor: brandBlue,
                                foregroundColor: Colors.white,
                                elevation: 0,
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(12),
                                ),
                              ),
                              child: _isLoading
                                  ? const SizedBox(
                                      width: 24,
                                      height: 24,
                                      child: CircularProgressIndicator(
                                        color: Colors.white,
                                        strokeWidth: 2.5,
                                      ),
                                    )
                                  : const Text(
                                      'Create Account',
                                      style: TextStyle(
                                        fontSize: 16,
                                        fontWeight: FontWeight.bold,
                                        color: Colors.white,
                                      ),
                                    ),
                            ),
                          ),
                        ),
                        const SizedBox(height: 16),
                      ],
                    ],
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
