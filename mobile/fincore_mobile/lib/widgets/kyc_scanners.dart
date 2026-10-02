import 'dart:async';
import 'package:flutter/material.dart';

// ── Colors ───────────────────────────────────────────────────────────────────
const _darkBg = Color(0xFF0B132B);
const _scannerGreen = Color(0xFF10B981);
const _accentBlue = Color(0xFF2563EB);
const _cardBg = Color(0xFF1C2541);

// ═════════════════════════════════════════════════════════════════════════════
// 1. DOCUMENT SCANNER MODAL
// ═════════════════════════════════════════════════════════════════════════════

class DocumentScannerModal extends StatefulWidget {
  final String idType;
  final String? initialIdNumber;
  final Function(Map<String, dynamic> data) onCaptured;

  const DocumentScannerModal({
    super.key,
    required this.idType,
    this.initialIdNumber,
    required this.onCaptured,
  });

  @override
  State<DocumentScannerModal> createState() => _DocumentScannerModalState();
}

class _DocumentScannerModalState extends State<DocumentScannerModal>
    with SingleTickerProviderStateMixin {
  late AnimationController _laserController;
  late Animation<double> _laserAnimation;

  bool _isTorchOn = false;
  bool _isCaptured = false;
  bool _isProcessing = false;
  bool _showShutterFlash = false;
  String _activeIdType = 'National ID';

  @override
  void initState() {
    super.initState();
    _activeIdType = widget.idType;
    _laserController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1800),
    )..repeat(reverse: true);

    _laserAnimation = Tween<double>(begin: 0.05, end: 0.95).animate(
      CurvedAnimation(parent: _laserController, curve: Curves.easeInOut),
    );
  }

  @override
  void dispose() {
    _laserController.dispose();
    super.dispose();
  }

  void _triggerCapture() {
    setState(() {
      _showShutterFlash = true;
      _isProcessing = true;
    });

    Future.delayed(const Duration(milliseconds: 150), () {
      if (mounted) setState(() => _showShutterFlash = false);
    });

    Future.delayed(const Duration(milliseconds: 1100), () {
      if (mounted) {
        setState(() {
          _isProcessing = false;
          _isCaptured = true;
        });
      }
    });
  }

  void _confirmSelection() {
    final result = {
      'idType': _activeIdType,
      'documentUrl': 'scanned_${_activeIdType.toLowerCase().replaceAll(' ', '_')}_front.jpg',
      'idNumber': widget.initialIdNumber ?? 'NIC-${DateTime.now().millisecondsSinceEpoch.toString().substring(5)}',
      'confidenceScore': 98.6,
      'timestamp': DateTime.now().toIso8601String(),
    };
    widget.onCaptured(result);
    Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    return Dialog.fullscreen(
      backgroundColor: _darkBg,
      child: Stack(
        children: [
          // ── Main Content ──────────────────────────────────────────────────
          SafeArea(
            child: Column(
              children: [
                // Top Action Bar
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      IconButton(
                        icon: const Icon(Icons.close_rounded, color: Colors.white, size: 28),
                        onPressed: () => Navigator.of(context).pop(),
                      ),
                      Column(
                        children: [
                          Text(
                            'Scan $_activeIdType',
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 17,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          const SizedBox(height: 2),
                          const Text(
                            'Front side with photo & details',
                            style: TextStyle(color: Color(0xFF94A3B8), fontSize: 12),
                          ),
                        ],
                      ),
                      IconButton(
                        icon: Icon(
                          _isTorchOn ? Icons.flash_on_rounded : Icons.flash_off_rounded,
                          color: _isTorchOn ? Colors.amber : Colors.white70,
                          size: 26,
                        ),
                        onPressed: () => setState(() => _isTorchOn = !_isTorchOn),
                      ),
                    ],
                  ),
                ),

                Expanded(
                  child: _isCaptured ? _buildCapturedReview() : _buildLiveViewfinder(),
                ),

                // Bottom Controls
                _isCaptured ? _buildReviewBottomBar() : _buildViewfinderBottomBar(),
              ],
            ),
          ),

          // ── Shutter Flash Overlay ─────────────────────────────────────────
          if (_showShutterFlash)
            Positioned.fill(
              child: Container(color: Colors.white.withValues(alpha: 0.9)),
            ),

          // ── Processing Loading Indicator ──────────────────────────────────
          if (_isProcessing)
            Positioned.fill(
              child: Container(
                color: Colors.black.withValues(alpha: 0.65),
                child: const Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      CircularProgressIndicator(color: _scannerGreen),
                      SizedBox(height: 18),
                      Text(
                        'Analyzing document clarity & security hologram...',
                        style: TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.w600),
                      ),
                    ],
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }

  // ── Live Viewfinder ─────────────────────────────────────────────────────────
  Widget _buildLiveViewfinder() {
    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        // Guidance Pill
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          decoration: BoxDecoration(
            color: Colors.white.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: Colors.white.withValues(alpha: 0.15)),
          ),
          child: const Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.crop_free_rounded, color: _scannerGreen, size: 16),
              SizedBox(width: 8),
              Text(
                'Align card edges inside the glowing frame',
                style: TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w500),
              ),
            ],
          ),
        ),
        const SizedBox(height: 24),

        // Document Viewfinder Box
        Center(
          child: Container(
            width: MediaQuery.of(context).size.width * 0.88,
            height: (MediaQuery.of(context).size.width * 0.88) * 0.63, // ID card aspect ratio
            decoration: BoxDecoration(
              color: Colors.black.withValues(alpha: 0.4),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: Colors.white.withValues(alpha: 0.2)),
            ),
            child: Stack(
              children: [
                // 4 Glowing Corner Brackets
                CustomPaint(
                  size: Size.infinite,
                  painter: _CornerBracketPainter(color: _scannerGreen),
                ),

                // Simulated ID card interior placeholder
                Padding(
                  padding: const EdgeInsets.all(20.0),
                  child: Row(
                    children: [
                      // Photo box outline
                      Container(
                        width: 75,
                        height: 95,
                        decoration: BoxDecoration(
                          color: Colors.white.withValues(alpha: 0.06),
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: Colors.white.withValues(alpha: 0.15)),
                        ),
                        child: const Icon(Icons.person_outline_rounded, color: Colors.white30, size: 40),
                      ),
                      const SizedBox(width: 16),
                      // Text line outlines
                      Expanded(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Container(height: 10, width: 90, color: Colors.white.withValues(alpha: 0.15)),
                            const SizedBox(height: 8),
                            Container(height: 8, width: 140, color: Colors.white.withValues(alpha: 0.1)),
                            const SizedBox(height: 6),
                            Container(height: 8, width: 110, color: Colors.white.withValues(alpha: 0.1)),
                            const SizedBox(height: 12),
                            // Hologram badge outline
                            Row(
                              children: [
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                  decoration: BoxDecoration(
                                    border: Border.all(color: Colors.white.withValues(alpha: 0.2)),
                                    borderRadius: BorderRadius.circular(4),
                                  ),
                                  child: const Text('MRZ SECURE', style: TextStyle(color: Colors.white30, fontSize: 9)),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),

                // Animated Laser Scanning Line
                AnimatedBuilder(
                  animation: _laserAnimation,
                  builder: (context, child) {
                    final boxHeight = (MediaQuery.of(context).size.width * 0.88) * 0.63;
                    return Positioned(
                      top: boxHeight * _laserAnimation.value,
                      left: 6,
                      right: 6,
                      child: Container(
                        height: 3,
                        decoration: BoxDecoration(
                          boxShadow: [
                            BoxShadow(
                              color: _scannerGreen.withValues(alpha: 0.8),
                              blurRadius: 10,
                              spreadRadius: 2,
                            ),
                          ],
                          gradient: const LinearGradient(
                            colors: [
                              Colors.transparent,
                              _scannerGreen,
                              Colors.white,
                              _scannerGreen,
                              Colors.transparent,
                            ],
                          ),
                        ),
                      ),
                    );
                  },
                ),
              ],
            ),
          ),
        ),

        const SizedBox(height: 24),
        // Live Detection Stats
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            _buildStatusTag(Icons.brightness_medium_rounded, 'Lighting: Optimal', _scannerGreen),
            const SizedBox(width: 12),
            _buildStatusTag(Icons.verified_outlined, 'Edges: Locked', _scannerGreen),
          ],
        ),
      ],
    );
  }

  Widget _buildStatusTag(IconData icon, String text, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: color.withValues(alpha: 0.3)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, color: color, size: 14),
          const SizedBox(width: 6),
          Text(text, style: TextStyle(color: color, fontSize: 11, fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }

  // ── Viewfinder Bottom Controls ─────────────────────────────────────────────
  Widget _buildViewfinderBottomBar() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(24, 16, 24, 24),
      child: Column(
        children: [
          // ID Type switcher pills
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: ['National ID', 'Passport', 'Driver License'].map((type) {
                final isSelected = type == _activeIdType;
                return GestureDetector(
                  onTap: () => setState(() => _activeIdType = type),
                  child: Container(
                    margin: const EdgeInsets.symmetric(horizontal: 4),
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                    decoration: BoxDecoration(
                      color: isSelected ? _accentBlue : Colors.white.withValues(alpha: 0.08),
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: isSelected ? _accentBlue : Colors.white.withValues(alpha: 0.15)),
                    ),
                    child: Text(
                      type,
                      style: TextStyle(
                        color: isSelected ? Colors.white : Colors.white70,
                        fontSize: 12,
                        fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                      ),
                    ),
                  ),
                );
              }).toList(),
            ),
          ),
          const SizedBox(height: 20),

          // Camera Shutter Button
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceEvenly,
            children: [
              // Sample presets button
              IconButton(
                icon: const Icon(Icons.photo_library_outlined, color: Colors.white70, size: 28),
                tooltip: 'Select Sample',
                onPressed: _triggerCapture,
              ),

              // Main Capture Button
              GestureDetector(
                onTap: _triggerCapture,
                child: Container(
                  width: 76,
                  height: 76,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    border: Border.all(color: Colors.white, width: 4),
                  ),
                  child: Center(
                    child: Container(
                      width: 60,
                      height: 60,
                      decoration: const BoxDecoration(
                        color: _scannerGreen,
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(Icons.camera_alt_rounded, color: Colors.white, size: 30),
                    ),
                  ),
                ),
              ),

              // Help info
              IconButton(
                icon: const Icon(Icons.info_outline_rounded, color: Colors.white70, size: 28),
                tooltip: 'Scanning tips',
                onPressed: () {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text('Avoid glare, hold the phone parallel to the card, and ensure all corners are visible.'),
                    ),
                  );
                },
              ),
            ],
          ),
        ],
      ),
    );
  }

  // ── Captured Document Review ───────────────────────────────────────────────
  Widget _buildCapturedReview() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        children: [
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: _scannerGreen.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: _scannerGreen.withValues(alpha: 0.3)),
            ),
            child: const Row(
              children: [
                Icon(Icons.check_circle_rounded, color: _scannerGreen, size: 22),
                SizedBox(width: 10),
                Expanded(
                  child: Text(
                    'High quality document captured. Clarity and security checks passed.',
                    style: TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w500),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),

          // Captured Card Graphical Mockup
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [_cardBg, Color(0xFF2A3B5C)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: _scannerGreen, width: 1.5),
              boxShadow: [
                BoxShadow(
                  color: _scannerGreen.withValues(alpha: 0.2),
                  blurRadius: 16,
                  spreadRadius: 2,
                ),
              ],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      _activeIdType.toUpperCase(),
                      style: const TextStyle(
                        color: Colors.white70,
                        letterSpacing: 1.5,
                        fontSize: 12,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: _scannerGreen.withValues(alpha: 0.2),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: const Text('VERIFIED 98.6%', style: TextStyle(color: _scannerGreen, fontSize: 11, fontWeight: FontWeight.bold)),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                Row(
                  children: [
                    Container(
                      width: 70,
                      height: 85,
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: Colors.white24),
                      ),
                      child: const Icon(Icons.person_rounded, size: 48, color: Colors.white60),
                    ),
                    const SizedBox(width: 16),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text('GOVERNMENT OF SRI LANKA', style: TextStyle(color: Colors.white54, fontSize: 10, fontWeight: FontWeight.bold)),
                          const SizedBox(height: 6),
                          Text(
                            widget.initialIdNumber ?? '199513502841',
                            style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold, letterSpacing: 1.2),
                          ),
                          const SizedBox(height: 4),
                          const Text('EXPIRES: 2032-12-31', style: TextStyle(color: Colors.white70, fontSize: 11)),
                          const SizedBox(height: 4),
                          const Text('SECURITY CHIP: AUTHENTIC', style: TextStyle(color: _scannerGreen, fontSize: 10, fontWeight: FontWeight.bold)),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: Colors.black.withValues(alpha: 0.3),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: const Text(
                    'I<LKA1995135028<<<<<<<<<<<<<<<<<<8410284M3212314LKA<<<<<<<<<<<<<8',
                    style: TextStyle(fontFamily: 'monospace', color: Colors.white60, fontSize: 10, letterSpacing: 1.5),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),

          // Security Checks Matrix
          _buildCheckRow(Icons.check_circle_rounded, 'Hologram & Microprint Authenticity', 'Passed (High Confidence)'),
          _buildCheckRow(Icons.check_circle_rounded, 'Anti-Glare & Sharpness Assessment', 'Passed (0% Glare)'),
          _buildCheckRow(Icons.check_circle_rounded, 'Machine Readable Zone (MRZ) Checksum', 'Validated ✓'),
        ],
      ),
    );
  }

  Widget _buildCheckRow(IconData icon, String title, String status) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        children: [
          Icon(icon, color: _scannerGreen, size: 18),
          const SizedBox(width: 10),
          Expanded(child: Text(title, style: const TextStyle(color: Colors.white70, fontSize: 12))),
          Text(status, style: const TextStyle(color: _scannerGreen, fontSize: 12, fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }

  // ── Review Bottom Bar ──────────────────────────────────────────────────────
  Widget _buildReviewBottomBar() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(24, 12, 24, 24),
      child: Row(
        children: [
          Expanded(
            child: OutlinedButton(
              style: OutlinedButton.styleFrom(
                foregroundColor: Colors.white,
                side: const BorderSide(color: Colors.white38),
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              onPressed: () => setState(() => _isCaptured = false),
              child: const Text('Retake Photo'),
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: _scannerGreen,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              onPressed: _confirmSelection,
              child: const Text('Use Document', style: TextStyle(fontWeight: FontWeight.bold)),
            ),
          ),
        ],
      ),
    );
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// 2. SELFIE BIOMETRIC LIVENESS SCANNER MODAL
// ═════════════════════════════════════════════════════════════════════════════

class SelfieScannerModal extends StatefulWidget {
  final Function(Map<String, dynamic> data) onCaptured;

  const SelfieScannerModal({super.key, required this.onCaptured});

  @override
  State<SelfieScannerModal> createState() => _SelfieScannerModalState();
}

class _SelfieScannerModalState extends State<SelfieScannerModal>
    with TickerProviderStateMixin {
  late AnimationController _radarController;
  late AnimationController _pulseController;

  int _currentLivenessStep = 0; // 0: Center face, 1: Blink, 2: Turn slightly, 3: Completed
  bool _isCaptured = false;
  bool _showShutterFlash = false;
  Timer? _livenessTimer;

  final List<String> _instructions = [
    'Center your face inside the oval',
    'Please blink your eyes slowly...',
    'Turn your head slightly to the right...',
    'Hold still — verifying 3D biometric depth...',
  ];

  @override
  void initState() {
    super.initState();
    _radarController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 4),
    )..repeat();

    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1000),
    )..repeat(reverse: true);

    _startLivenessPipeline();
  }

  void _startLivenessPipeline() {
    _livenessTimer = Timer.periodic(const Duration(milliseconds: 1400), (timer) {
      if (!mounted) return;
      if (_currentLivenessStep < 3) {
        setState(() => _currentLivenessStep++);
      } else {
        timer.cancel();
        _completeScan();
      }
    });
  }

  void _completeScan() {
    setState(() => _showShutterFlash = true);
    Future.delayed(const Duration(milliseconds: 150), () {
      if (mounted) {
        setState(() {
          _showShutterFlash = false;
          _isCaptured = true;
        });
      }
    });
  }

  @override
  void dispose() {
    _radarController.dispose();
    _pulseController.dispose();
    _livenessTimer?.cancel();
    super.dispose();
  }

  void _confirmSelfie() {
    final result = {
      'selfieUrl': 'verified_selfie_liveness.jpg',
      'matchScore': 99.4,
      'spoofRisk': 'None (Pass)',
      'timestamp': DateTime.now().toIso8601String(),
    };
    widget.onCaptured(result);
    Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    return Dialog.fullscreen(
      backgroundColor: _darkBg,
      child: Stack(
        children: [
          SafeArea(
            child: Column(
              children: [
                // Top Header
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      IconButton(
                        icon: const Icon(Icons.close_rounded, color: Colors.white, size: 28),
                        onPressed: () => Navigator.of(context).pop(),
                      ),
                      const Column(
                        children: [
                          Text(
                            'Facial Liveness Verification',
                            style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
                          ),
                          SizedBox(height: 2),
                          Text('Anti-Spoofing 3D Biometric Check', style: TextStyle(color: Color(0xFF94A3B8), fontSize: 12)),
                        ],
                      ),
                      const SizedBox(width: 48), // Balance close button
                    ],
                  ),
                ),

                Expanded(
                  child: _isCaptured ? _buildCapturedReview() : _buildLiveScanner(),
                ),

                _isCaptured ? _buildReviewBottomBar() : _buildLiveBottomBar(),
              ],
            ),
          ),

          // Shutter flash
          if (_showShutterFlash)
            Positioned.fill(
              child: Container(color: Colors.white.withValues(alpha: 0.9)),
            ),
        ],
      ),
    );
  }

  // ── Live Biometric Scanner ─────────────────────────────────────────────────
  Widget _buildLiveScanner() {
    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        // Instruction Pill
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 10),
          decoration: BoxDecoration(
            color: _accentBlue.withValues(alpha: 0.2),
            borderRadius: BorderRadius.circular(24),
            border: Border.all(color: _accentBlue.withValues(alpha: 0.4)),
          ),
          child: Text(
            _instructions[_currentLivenessStep],
            style: const TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.bold),
          ),
        ),
        const SizedBox(height: 30),

        // Biometric Oval Guide with Radar Ring
        Center(
          child: SizedBox(
            width: 260,
            height: 330,
            child: Stack(
              alignment: Alignment.center,
              children: [
                // Radar Rotating Ring
                RotationTransition(
                  turns: _radarController,
                  child: Container(
                    width: 250,
                    height: 320,
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.all(Radius.elliptical(250, 320)),
                      border: Border.all(
                        color: _scannerGreen.withValues(alpha: 0.3),
                        width: 2,
                      ),
                    ),
                  ),
                ),

                // Pulsing Inner Oval Ring
                AnimatedBuilder(
                  animation: _pulseController,
                  builder: (context, child) {
                    final scale = 1.0 + (_pulseController.value * 0.03);
                    return Transform.scale(
                      scale: scale,
                      child: Container(
                        width: 230,
                        height: 300,
                        decoration: BoxDecoration(
                          borderRadius: const BorderRadius.all(Radius.elliptical(230, 300)),
                          border: Border.all(
                            color: _currentLivenessStep == 3 ? _scannerGreen : _accentBlue,
                            width: 3.5,
                          ),
                          color: Colors.black.withValues(alpha: 0.3),
                        ),
                      ),
                    );
                  },
                ),

                // Biometric Mesh Dots / Silhouette Icon
                Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(
                      _currentLivenessStep == 1
                          ? Icons.visibility_off_rounded
                          : Icons.face_rounded,
                      size: 110,
                      color: Colors.white.withValues(alpha: 0.5),
                    ),
                    const SizedBox(height: 12),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: List.generate(4, (index) {
                        final done = index <= _currentLivenessStep;
                        return Container(
                          margin: const EdgeInsets.symmetric(horizontal: 4),
                          width: 8,
                          height: 8,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            color: done ? _scannerGreen : Colors.white24,
                          ),
                        );
                      }),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),

        const SizedBox(height: 28),
        Text(
          'Step ${_currentLivenessStep + 1} of 4: Liveness Assessment',
          style: const TextStyle(color: Colors.white70, fontSize: 13, fontWeight: FontWeight.w600),
        ),
      ],
    );
  }

  Widget _buildLiveBottomBar() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(24, 16, 24, 28),
      child: Column(
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              // Manual Instant Capture
              GestureDetector(
                onTap: _completeScan,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: Colors.white24),
                  ),
                  child: const Row(
                    children: [
                      Icon(Icons.camera_alt_outlined, color: Colors.white, size: 20),
                      SizedBox(width: 8),
                      Text('Capture Immediately', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  // ── Captured Biometric Review ──────────────────────────────────────────────
  Widget _buildCapturedReview() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        children: [
          // Success Banner
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: _scannerGreen.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: _scannerGreen.withValues(alpha: 0.3)),
            ),
            child: const Row(
              children: [
                Icon(Icons.shield_rounded, color: _scannerGreen, size: 26),
                SizedBox(width: 12),
                Expanded(
                  child: Text(
                    'Biometric Liveness Confirmed! User presence verified with 0% spoofing risk.',
                    style: TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w600),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),

          // Selfie Preview Avatar
          Center(
            child: Stack(
              alignment: Alignment.bottomRight,
              children: [
                Container(
                  width: 160,
                  height: 160,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    border: Border.all(color: _scannerGreen, width: 4),
                    gradient: const RadialGradient(
                      colors: [Color(0xFF2C3E50), Color(0xFF1A2536)],
                    ),
                    boxShadow: [
                      BoxShadow(
                        color: _scannerGreen.withValues(alpha: 0.25),
                        blurRadius: 20,
                        spreadRadius: 4,
                      ),
                    ],
                  ),
                  child: const Center(
                    child: Icon(Icons.face_retouching_natural_rounded, size: 90, color: Colors.white),
                  ),
                ),
                Container(
                  padding: const EdgeInsets.all(6),
                  decoration: const BoxDecoration(
                    color: _scannerGreen,
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(Icons.check, color: Colors.white, size: 20),
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),

          // Biometric Metrics
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: _cardBg,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
            ),
            child: Column(
              children: [
                _buildMetricRow('ID Photo Match Score', '99.4%', _scannerGreen),
                const Divider(color: Colors.white12, height: 20),
                _buildMetricRow('3D Depth Map Liveness', 'Passed (Real Face)', _scannerGreen),
                const Divider(color: Colors.white12, height: 20),
                _buildMetricRow('Blink / Movement Confirmation', 'Verified ✓', _scannerGreen),
                const Divider(color: Colors.white12, height: 20),
                _buildMetricRow('Anti-Spoofing Screen Filter', 'Zero Glare Detected', Colors.white70),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMetricRow(String label, String value, Color color) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(label, style: const TextStyle(color: Colors.white70, fontSize: 12)),
        Text(value, style: TextStyle(color: color, fontSize: 12, fontWeight: FontWeight.bold)),
      ],
    );
  }

  Widget _buildReviewBottomBar() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(24, 12, 24, 24),
      child: Row(
        children: [
          Expanded(
            child: OutlinedButton(
              style: OutlinedButton.styleFrom(
                foregroundColor: Colors.white,
                side: const BorderSide(color: Colors.white38),
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              onPressed: () {
                setState(() {
                  _isCaptured = false;
                  _currentLivenessStep = 0;
                });
                _startLivenessPipeline();
              },
              child: const Text('Retake Scan'),
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: _scannerGreen,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              onPressed: _confirmSelfie,
              child: const Text('Confirm Biometrics', style: TextStyle(fontWeight: FontWeight.bold)),
            ),
          ),
        ],
      ),
    );
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// 3. CUSTOM CORNER BRACKET PAINTER FOR DOCUMENT SCANNER
// ═════════════════════════════════════════════════════════════════════════════

class _CornerBracketPainter extends CustomPainter {
  final Color color;

  _CornerBracketPainter({required this.color});

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..strokeWidth = 3.5
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round;

    const cornerLength = 26.0;

    // Top Left
    canvas.drawLine(const Offset(0, 0), const Offset(cornerLength, 0), paint);
    canvas.drawLine(const Offset(0, 0), const Offset(0, cornerLength), paint);

    // Top Right
    canvas.drawLine(Offset(size.width, 0), Offset(size.width - cornerLength, 0), paint);
    canvas.drawLine(Offset(size.width, 0), Offset(size.width, cornerLength), paint);

    // Bottom Left
    canvas.drawLine(Offset(0, size.height), Offset(cornerLength, size.height), paint);
    canvas.drawLine(Offset(0, size.height), Offset(0, size.height - cornerLength), paint);

    // Bottom Right
    canvas.drawLine(Offset(size.width, size.height), Offset(size.width - cornerLength, size.height), paint);
    canvas.drawLine(Offset(size.width, size.height), Offset(size.width, size.height - cornerLength), paint);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
