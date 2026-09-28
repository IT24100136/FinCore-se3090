import 'package:flutter/material.dart';
import '../services/auth_service.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  String? _jwtToken;
  String? _statusMessage;
  bool _isLoading = false;
  bool _isRegisterMode = false;

  @override
  void initState() {
    super.initState();
    _checkExistingToken();
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

  Future<void> _handleAuth() async {
    final email = _emailController.text.trim();
    final password = _passwordController.text.trim();

    if (email.isEmpty || password.isEmpty) {
      setState(() {
        _statusMessage = 'Please enter email and password';
      });
      return;
    }

    setState(() {
      _isLoading = true;
      _statusMessage = null;
    });

    try {
      if (_isRegisterMode) {
        final result = await AuthService.register(email: email, password: password);
        if (result['success']) {
          setState(() {
            _statusMessage = 'Registered successfully! You can now log in.';
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

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(_isRegisterMode ? 'FinCore Register' : 'FinCore Login'),
      ),
      body: Padding(
        padding: const EdgeInsets.all(16.0),
        child: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (_statusMessage != null) ...[
                Text(
                  _statusMessage!,
                  style: TextStyle(
                    color: _statusMessage!.contains('successful') || _statusMessage!.contains('Registered')
                        ? Colors.green
                        : Colors.red,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 16),
              ],
              if (_jwtToken != null) ...[
                const Text(
                  'Authenticated! Grabbed JWT Token:',
                  style: TextStyle(fontWeight: FontWeight.bold, color: Colors.green),
                ),
                if (_deviceVerification != null) ...[
                  const SizedBox(height: 12),
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: Colors.blue.shade50,
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: Colors.blue.shade200),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'Device Verification Status:',
                          style: TextStyle(fontWeight: FontWeight.bold),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          'Status: ${_deviceVerification!['status'] ?? 'Unknown'}',
                          style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.blue),
                        ),
                        Text(
                          'Fingerprint: ${_deviceVerification!['deviceFingerprint'] ?? ''}',
                          style: const TextStyle(fontSize: 12),
                        ),
                        Text(
                          'New Device: ${_deviceVerification!['isNewDevice'] == true ? 'Yes' : 'No'}',
                          style: const TextStyle(fontSize: 12),
                        ),
                      ],
                    ),
                  ),
                ],
                const SizedBox(height: 8),
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.grey.shade200,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: SelectableText(
                    _jwtToken!,
                    style: const TextStyle(fontSize: 12, fontFamily: 'monospace'),
                  ),
                ),
                const SizedBox(height: 16),
                ElevatedButton(
                  onPressed: _handleLogout,
                  style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
                  child: const Text('Logout', style: TextStyle(color: Colors.white)),
                ),
              ] else ...[
                TextField(
                  controller: _emailController,
                  decoration: const InputDecoration(
                    labelText: 'Email',
                    border: OutlineInputBorder(),
                  ),
                  keyboardType: TextInputType.emailAddress,
                ),
                const SizedBox(height: 16),
                TextField(
                  controller: _passwordController,
                  decoration: const InputDecoration(
                    labelText: 'Password',
                    border: OutlineInputBorder(),
                  ),
                  obscureText: true,
                ),
                const SizedBox(height: 24),
                ElevatedButton(
                  onPressed: _isLoading ? null : _handleAuth,
                  style: ElevatedButton.styleFrom(padding: const EdgeInsets.symmetric(vertical: 16)),
                  child: _isLoading
                      ? const CircularProgressIndicator()
                      : Text(_isRegisterMode ? 'Register' : 'Login & Grab Token'),
                ),
                const SizedBox(height: 12),
                TextButton(
                  onPressed: () {
                    setState(() {
                      _isRegisterMode = !_isRegisterMode;
                      _statusMessage = null;
                    });
                  },
                  child: Text(_isRegisterMode
                      ? 'Already have an account? Login'
                      : "Don't have an account? Register"),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
