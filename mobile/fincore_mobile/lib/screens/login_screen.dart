import 'package:flutter/material.dart';
import '../services/auth_service.dart';
import 'wallet_home_screen.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  // --- Controllers ---
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();

  // --- State ---
  bool _isSignInMode = true;
  bool _rememberDevice = false;
  bool _isPasswordObscured = true;
  bool _isLoading = false;
  String? _errorMessage;
  String? _successMessage;

  // --- Colors ---
  static const _navyBlue = Color(0xFF132047);
  static const _accentBlue = Color(0xFF3B6FE8);

  @override
  void initState() {
    super.initState();
    _checkExistingToken();
  }

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _checkExistingToken() async {
    final token = await AuthService.getToken();
    if (token != null && token.isNotEmpty && mounted) {
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(builder: (_) => const WalletHomeScreen()),
      );
    }
  }

  Future<void> _handleAuth() async {
    final email = _emailController.text.trim();
    final password = _passwordController.text.trim();

    if (email.isEmpty || password.isEmpty) {
      setState(() => _errorMessage = 'Please enter your email and password.');
      return;
    }

    setState(() {
      _isLoading = true;
      _errorMessage = null;
      _successMessage = null;
    });

    try {
      if (_isSignInMode) {
        final result = await AuthService.login(email: email, password: password);
        if (result['success']) {
          // Check for unverified device
          if (result['deviceVerification'] != null &&
              result['deviceVerification']['status'] == 'Unverified') {
            final rawSessionId = result['deviceVerification']['sessionId'];
            final sessionId = rawSessionId is int
                ? rawSessionId
                : int.tryParse(rawSessionId.toString());
            if (sessionId != null && mounted) {
              _showUnverifiedDeviceDialog(sessionId);
            }
          } else if (mounted) {
            Navigator.pushReplacement(
              context,
              MaterialPageRoute(builder: (_) => const WalletHomeScreen()),
            );
          }
        } else {
          setState(() => _errorMessage = result['message'] ?? 'Login failed.');
        }
      } else {
        final result = await AuthService.register(email: email, password: password);
        if (result['success']) {
          setState(() {
            _successMessage = 'Registered! You can now sign in.';
            _isSignInMode = true;
          });
        } else {
          setState(() => _errorMessage = result['message'] ?? 'Registration failed.');
        }
      }
    } catch (e) {
      setState(() => _errorMessage = 'Connection error. Is the server running?');
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _showUnverifiedDeviceDialog(int sessionId) async {
    return showDialog<void>(
      context: context,
      barrierDismissible: false,
      builder: (dialogContext) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text('New Device Detected',
            style: TextStyle(fontWeight: FontWeight.bold)),
        content: const Text("We don't recognize this device. Is this you?"),
        actions: [
          TextButton(
            child: const Text('No'),
            onPressed: () => Navigator.of(dialogContext).pop(),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: _accentBlue),
            child: const Text("Yes, it's me", style: TextStyle(color: Colors.white)),
            onPressed: () async {
              Navigator.of(dialogContext).pop();
              await AuthService.updateDeviceStatus(
                  sessionId: sessionId, status: 'Verified');
              if (mounted) {
                Navigator.pushReplacement(
                  context,
                  MaterialPageRoute(builder: (_) => const WalletHomeScreen()),
                );
              }
            },
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: _navyBlue,
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // ── Blue Header ──────────────────────────────────
            _buildHeader(),
            // ── White Bottom Sheet ───────────────────────────
            Expanded(
              child: Container(
                width: double.infinity,
                decoration: const BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.only(
                    topLeft: Radius.circular(28),
                    topRight: Radius.circular(28),
                  ),
                ),
                child: SingleChildScrollView(
                  padding: const EdgeInsets.fromLTRB(24, 28, 24, 16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      _buildTabToggle(),
                      const SizedBox(height: 28),
                      // Error / Success messages
                      if (_errorMessage != null) ...[
                        _buildMessage(_errorMessage!, isError: true),
                        const SizedBox(height: 12),
                      ],
                      if (_successMessage != null) ...[
                        _buildMessage(_successMessage!, isError: false),
                        const SizedBox(height: 12),
                      ],
                      // Email field
                      _buildFieldLabel('Email Address'),
                      const SizedBox(height: 6),
                      _buildEmailField(),
                      const SizedBox(height: 16),
                      // Password field
                      _buildFieldLabel('Password'),
                      const SizedBox(height: 6),
                      _buildPasswordField(),
                      const SizedBox(height: 14),
                      // Remember device
                      _buildRememberRow(),
                      const SizedBox(height: 24),
                      // Primary button
                      _buildPrimaryButton(),
                      const SizedBox(height: 14),
                      // Forgot / Switch
                      Center(
                        child: TextButton(
                          onPressed: () {
                            setState(() {
                              _isSignInMode = !_isSignInMode;
                              _errorMessage = null;
                              _successMessage = null;
                            });
                          },
                          child: Text(
                            _isSignInMode
                                ? 'Forgot password?'
                                : 'Already have an account? Sign In',
                            style: const TextStyle(
                              color: _accentBlue,
                              fontWeight: FontWeight.w600,
                              fontSize: 14,
                            ),
                          ),
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
    );
  }

  // ── Header Section ─────────────────────────────────────────────────────────
  Widget _buildHeader() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(24, 20, 24, 28),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Logo row
          Row(
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: _accentBlue,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: const Center(
                  child: Text(
                    'FC',
                    style: TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.bold,
                      fontSize: 16,
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: const [
                  Text(
                    'FinCore',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  Text(
                    'SECURE DIGITAL WALLET',
                    style: TextStyle(
                      color: Color(0xFF5B8FE8),
                      fontSize: 10,
                      letterSpacing: 1.0,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
            ],
          ),
          const SizedBox(height: 24),
          const Text(
            'Welcome back',
            style: TextStyle(
              color: Colors.white,
              fontSize: 30,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 6),
          RichText(
            text: const TextSpan(
              style: TextStyle(fontSize: 14, color: Color(0xFF8DA3CC)),
              children: [
                TextSpan(
                  text: 'Sign in',
                  style: TextStyle(
                    color: Color(0xFF5B8FE8),
                    fontWeight: FontWeight.w600,
                  ),
                ),
                TextSpan(text: ' to manage your wallet'),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // ── Tab Toggle ─────────────────────────────────────────────────────────────
  Widget _buildTabToggle() {
    return Container(
      height: 46,
      decoration: BoxDecoration(
        color: const Color(0xFFF0F2F7),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        children: [
          _buildTab('Sign In', isActive: _isSignInMode, onTap: () {
            setState(() {
              _isSignInMode = true;
              _errorMessage = null;
              _successMessage = null;
            });
          }),
          _buildTab('Register', isActive: !_isSignInMode, onTap: () {
            setState(() {
              _isSignInMode = false;
              _errorMessage = null;
              _successMessage = null;
            });
          }),
        ],
      ),
    );
  }

  Widget _buildTab(String label,
      {required bool isActive, required VoidCallback onTap}) {
    return Expanded(
      child: GestureDetector(
        onTap: onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          margin: const EdgeInsets.all(4),
          decoration: BoxDecoration(
            color: isActive ? Colors.white : Colors.transparent,
            borderRadius: BorderRadius.circular(9),
            boxShadow: isActive
                ? [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.1),
                      blurRadius: 6,
                      offset: const Offset(0, 2),
                    )
                  ]
                : [],
          ),
          child: Center(
            child: Text(
              label,
              style: TextStyle(
                color: isActive
                    ? const Color(0xFF1A2340)
                    : const Color(0xFF8A94A6),
                fontWeight:
                    isActive ? FontWeight.bold : FontWeight.w500,
                fontSize: 14,
              ),
            ),
          ),
        ),
      ),
    );
  }

  // ── Form Helpers ───────────────────────────────────────────────────────────
  Widget _buildFieldLabel(String label) {
    return Text(
      label,
      style: const TextStyle(
        color: Color(0xFF4A5568),
        fontSize: 13,
        fontWeight: FontWeight.w600,
      ),
    );
  }

  Widget _buildEmailField() {
    return TextField(
      controller: _emailController,
      keyboardType: TextInputType.emailAddress,
      style: const TextStyle(fontSize: 14, color: Color(0xFF1A2340)),
      decoration: _inputDecoration('you@example.com'),
    );
  }

  Widget _buildPasswordField() {
    return TextField(
      controller: _passwordController,
      obscureText: _isPasswordObscured,
      style: const TextStyle(fontSize: 14, color: Color(0xFF1A2340)),
      decoration: _inputDecoration('••••••••').copyWith(
        suffixIcon: IconButton(
          icon: Icon(
            _isPasswordObscured
                ? Icons.visibility_off_outlined
                : Icons.visibility_outlined,
            color: const Color(0xFFB0B8C6),
            size: 20,
          ),
          onPressed: () =>
              setState(() => _isPasswordObscured = !_isPasswordObscured),
        ),
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
        borderSide: const BorderSide(color: _accentBlue, width: 1.5),
      ),
    );
  }

  Widget _buildRememberRow() {
    return Row(
      children: [
        SizedBox(
          width: 20,
          height: 20,
          child: Checkbox(
            value: _rememberDevice,
            onChanged: (v) => setState(() => _rememberDevice = v ?? false),
            activeColor: _accentBlue,
            shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(4)),
            side: const BorderSide(color: Color(0xFFDDE1EA), width: 1.5),
          ),
        ),
        const SizedBox(width: 10),
        const Text(
          'Remember this device',
          style: TextStyle(
            color: Color(0xFF4A5568),
            fontSize: 13,
            fontWeight: FontWeight.w500,
          ),
        ),
      ],
    );
  }

  Widget _buildPrimaryButton() {
    return SizedBox(
      height: 52,
      child: ElevatedButton(
        onPressed: _isLoading ? null : _handleAuth,
        style: ElevatedButton.styleFrom(
          backgroundColor: _accentBlue,
          disabledBackgroundColor: _accentBlue.withValues(alpha: 0.7),
          shape:
              RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          elevation: 3,
          shadowColor: _accentBlue.withValues(alpha: 0.4),
        ),
        child: _isLoading
            ? const SizedBox(
                height: 22,
                width: 22,
                child: CircularProgressIndicator(
                    color: Colors.white, strokeWidth: 2.5),
              )
            : Text(
                _isSignInMode ? 'Sign In' : 'Create Account',
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                ),
              ),
      ),
    );
  }

  Widget _buildMessage(String message, {required bool isError}) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: isError
            ? const Color(0xFFFFEBEE)
            : const Color(0xFFE8F5E9),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(
          color: isError ? const Color(0xFFEF9A9A) : const Color(0xFFA5D6A7),
        ),
      ),
      child: Row(
        children: [
          Icon(
            isError ? Icons.error_outline : Icons.check_circle_outline,
            color: isError ? Colors.red : Colors.green,
            size: 16,
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              message,
              style: TextStyle(
                color: isError
                    ? const Color(0xFFB71C1C)
                    : const Color(0xFF1B5E20),
                fontSize: 13,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
