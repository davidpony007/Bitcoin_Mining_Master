import 'dart:math' as math;
import 'package:flutter/material.dart';
import '../constants/app_constants.dart';

/// 付费合约订阅成功庆祝弹窗
///
/// 用法：
///   await PaidContractSuccessDialog.show(
///     context,
///     planName: 'Standard Plan',
///     price: 6.99,
///     durationDays: 30,
///   );
class PaidContractSuccessDialog extends StatefulWidget {
  final String planName;
  final double price;
  final int durationDays;

  const PaidContractSuccessDialog({
    super.key,
    required this.planName,
    required this.price,
    required this.durationDays,
  });

  static Future<void> show(
    BuildContext context, {
    required String planName,
    double price = 0,
    int durationDays = 30,
  }) {
    return showDialog(
      context: context,
      barrierDismissible: false,
      barrierColor: Colors.black87,
      builder: (_) => PaidContractSuccessDialog(
        planName: planName,
        price: price,
        durationDays: durationDays,
      ),
    );
  }

  @override
  State<PaidContractSuccessDialog> createState() =>
      _PaidContractSuccessDialogState();
}

class _PaidContractSuccessDialogState extends State<PaidContractSuccessDialog>
    with TickerProviderStateMixin {
  late final AnimationController _confettiCtrl;
  late final AnimationController _scaleCtrl;
  late final AnimationController _bounceCtrl;
  late final AnimationController _glowCtrl;
  late final AnimationController _shimmerCtrl;

  late final Animation<double> _scaleAnim;
  late final Animation<double> _bounceAnim;
  late final Animation<double> _glowAnim;
  late final Animation<double> _shimmerAnim;

  final List<_Particle> _particles = [];
  static const _particleCount = 80;

  // 暖金色 + 橙色 + 白色彩纸，突出豪华感
  static const _colors = [
    Color(0xFFFFD700),
    Color(0xFFFF9800),
    Color(0xFFFFF0A0),
    Color(0xFFFFB347),
    Color(0xFFFF6B35),
    Color(0xFFFFFFFF),
    Color(0xFFF7931A),
    Color(0xFFFFE066),
    Color(0xFF4CAF50),
    Color(0xFF00BCD4),
  ];

  @override
  void initState() {
    super.initState();

    final rand = math.Random();
    for (var i = 0; i < _particleCount; i++) {
      _particles.add(_Particle(
        x: rand.nextDouble(),
        delay: rand.nextDouble() * 0.3,
        speed: 0.4 + rand.nextDouble() * 0.6,
        size: 5.0 + rand.nextDouble() * 11.0,
        color: _colors[rand.nextInt(_colors.length)],
        rotation: rand.nextDouble() * math.pi * 2,
        rotSpeed: (rand.nextDouble() - 0.5) * 6,
        wobble: 0.02 + rand.nextDouble() * 0.06,
        wobbleFreq: 1.5 + rand.nextDouble() * 2.5,
        shape: rand.nextInt(4),
      ));
    }

    _confettiCtrl = AnimationController(
      duration: const Duration(milliseconds: 4000),
      vsync: this,
    )..forward();

    _scaleCtrl = AnimationController(
      duration: const Duration(milliseconds: 550),
      vsync: this,
    );
    _scaleAnim =
        CurvedAnimation(parent: _scaleCtrl, curve: Curves.elasticOut);
    _scaleCtrl.forward();

    _bounceCtrl = AnimationController(
      duration: const Duration(milliseconds: 1000),
      vsync: this,
    )..repeat(reverse: true);
    _bounceAnim = Tween<double>(begin: 1.0, end: 1.18)
        .animate(CurvedAnimation(parent: _bounceCtrl, curve: Curves.easeInOut));

    _glowCtrl = AnimationController(
      duration: const Duration(milliseconds: 1600),
      vsync: this,
    )..repeat(reverse: true);
    _glowAnim = Tween<double>(begin: 0.25, end: 0.75)
        .animate(CurvedAnimation(parent: _glowCtrl, curve: Curves.easeInOut));

    _shimmerCtrl = AnimationController(
      duration: const Duration(milliseconds: 2000),
      vsync: this,
    )..repeat();
    _shimmerAnim =
        CurvedAnimation(parent: _shimmerCtrl, curve: Curves.linear);
  }

  @override
  void dispose() {
    _confettiCtrl.dispose();
    _scaleCtrl.dispose();
    _bounceCtrl.dispose();
    _glowCtrl.dispose();
    _shimmerCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final size = MediaQuery.of(context).size;
    return Dialog(
      backgroundColor: Colors.transparent,
      insetPadding: EdgeInsets.zero,
      child: SizedBox(
        width: size.width,
        height: size.height,
        child: Stack(
          children: [
            // 彩纸层
            AnimatedBuilder(
              animation: _confettiCtrl,
              builder: (_, __) => CustomPaint(
                size: size,
                painter: _ConfettiPainter(
                  particles: _particles,
                  progress: _confettiCtrl.value,
                ),
              ),
            ),
            // 弹窗卡片
            Center(
              child: ScaleTransition(
                scale: _scaleAnim,
                child: _buildCard(),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildCard() {
    final cardWidth =
        math.min(MediaQuery.of(context).size.width * 0.88, 370.0);
    return Container(
      width: cardWidth,
      decoration: BoxDecoration(
        color: const Color(0xFF1A1A1A),
        borderRadius: BorderRadius.circular(24),
        border: Border.all(
          color: const Color(0xFFFFD700).withValues(alpha: 0.5),
          width: 1.5,
        ),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFFFFD700).withValues(alpha: 0.3),
            blurRadius: 40,
            spreadRadius: 6,
          ),
          BoxShadow(
            color: AppColors.primary.withValues(alpha: 0.25),
            blurRadius: 20,
          ),
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.6),
            blurRadius: 20,
          ),
        ],
      ),
      padding: const EdgeInsets.fromLTRB(26, 32, 26, 26),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // 主图标
          ScaleTransition(
            scale: _bounceAnim,
            child: Container(
              width: 88,
              height: 88,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: const RadialGradient(
                  colors: [Color(0xFFFFD700), Color(0xFFFF9800)],
                  radius: 0.85,
                ),
                boxShadow: [
                  BoxShadow(
                    color: const Color(0xFFFFD700).withValues(alpha: 0.7),
                    blurRadius: 28,
                    spreadRadius: 6,
                  ),
                ],
              ),
              child: const Center(
                child: Text('⛏️', style: TextStyle(fontSize: 42)),
              ),
            ),
          ),
          const SizedBox(height: 18),

          // 标题
          const Text(
            '🎉 Subscription Activated!',
            style: TextStyle(
              color: Colors.white,
              fontSize: 20,
              fontWeight: FontWeight.bold,
              letterSpacing: 0.3,
            ),
          ),
          const SizedBox(height: 8),

          // 闪光产品名卡片
          AnimatedBuilder(
            animation: _shimmerAnim,
            builder: (_, __) {
              return ShaderMask(
                shaderCallback: (bounds) {
                  final progress = _shimmerAnim.value;
                  return LinearGradient(
                    begin: Alignment(progress * 3 - 2, 0),
                    end: Alignment(progress * 3 - 1, 0),
                    colors: const [
                      Color(0xFFFFD700),
                      Colors.white,
                      Color(0xFFFFD700),
                    ],
                    stops: const [0.0, 0.5, 1.0],
                  ).createShader(bounds);
                },
                child: Text(
                  widget.planName,
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0.5,
                  ),
                ),
              );
            },
          ),
          const SizedBox(height: 20),

          // 合约详情卡片
          Container(
            width: double.infinity,
            padding:
                const EdgeInsets.symmetric(horizontal: 18, vertical: 16),
            decoration: BoxDecoration(
              color: const Color(0xFFFFD700).withValues(alpha: 0.08),
              borderRadius: BorderRadius.circular(14),
              border: Border.all(
                color: const Color(0xFFFFD700).withValues(alpha: 0.25),
              ),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Row(
                  children: [
                    Text('✅', style: TextStyle(fontSize: 15)),
                    SizedBox(width: 6),
                    Text(
                      'Contract Details',
                      style: TextStyle(
                        color: Color(0xFFFFD700),
                        fontWeight: FontWeight.bold,
                        fontSize: 13,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 13),
                _detailRow('⏱  Duration', '${(widget.durationDays / 30).round()} Month'),
                const SizedBox(height: 8),
                _detailRow(
                  '💰  Amount Paid',
                  widget.price > 0
                      ? '\$${widget.price.toStringAsFixed(2)}'
                      : 'Subscribed',
                ),
                const SizedBox(height: 8),
                _detailRow('⚡  Status', 'Mining Now'),
                const SizedBox(height: 8),
                _detailRow('📈  Earnings', 'Starting immediately'),
              ],
            ),
          ),
          const SizedBox(height: 18),

          // 提示文字
          Text(
            'Your mining contract is now active!\nBitcoin earnings are accumulating.',
            textAlign: TextAlign.center,
            style: TextStyle(
              color: Colors.white.withValues(alpha: 0.6),
              fontSize: 12.5,
              height: 1.55,
            ),
          ),
          const SizedBox(height: 22),

          // 确认按钮（光晕动画）
          AnimatedBuilder(
            animation: _glowAnim,
            builder: (_, child) => Container(
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(13),
                boxShadow: [
                  BoxShadow(
                    color: const Color(0xFFFFD700)
                        .withValues(alpha: _glowAnim.value),
                    blurRadius: 22,
                    spreadRadius: 2,
                  ),
                ],
              ),
              child: child,
            ),
            child: SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: () => Navigator.of(context).pop(),
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFFFFD700),
                  foregroundColor: Colors.black,
                  padding: const EdgeInsets.symmetric(vertical: 15),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(13),
                  ),
                  elevation: 0,
                ),
                child: const Text(
                  '🚀  Start Earning Bitcoin!',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                    color: Colors.black,
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _detailRow(String label, String value) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          label,
          style: TextStyle(
            color: Colors.white.withValues(alpha: 0.6),
            fontSize: 13,
          ),
        ),
        Text(
          value,
          style: const TextStyle(
            color: Colors.white,
            fontSize: 13,
            fontWeight: FontWeight.w600,
          ),
        ),
      ],
    );
  }
}

// ── 粒子模型 ─────────────────────────────────────────────────────
class _Particle {
  final double x;
  final double delay;
  final double speed;
  final double size;
  final Color color;
  final double rotation;
  final double rotSpeed;
  final double wobble;
  final double wobbleFreq;
  final int shape;

  const _Particle({
    required this.x,
    required this.delay,
    required this.speed,
    required this.size,
    required this.color,
    required this.rotation,
    required this.rotSpeed,
    required this.wobble,
    required this.wobbleFreq,
    required this.shape,
  });
}

// ── 彩纸绘制器 ───────────────────────────────────────────────────
class _ConfettiPainter extends CustomPainter {
  final List<_Particle> particles;
  final double progress;

  const _ConfettiPainter({required this.particles, required this.progress});

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()..isAntiAlias = true;

    for (final p in particles) {
      final t = ((progress - p.delay) / (1.0 - p.delay)).clamp(0.0, 1.0);
      if (t <= 0) continue;

      final opacity = t < 0.72 ? 1.0 : (1.0 - t) / 0.28;
      final x =
          (p.x + math.sin(t * math.pi * 2 * p.wobbleFreq) * p.wobble) *
          size.width;
      final y = t * p.speed * size.height * 1.3;
      final rot = p.rotation + t * p.rotSpeed * math.pi;

      paint.color = p.color.withValues(alpha: opacity.clamp(0.0, 1.0));

      canvas.save();
      canvas.translate(x, y);
      canvas.rotate(rot);

      switch (p.shape) {
        case 0:
          canvas.drawRect(
            Rect.fromCenter(
              center: Offset.zero,
              width: p.size,
              height: p.size * 0.42,
            ),
            paint,
          );
        case 1:
          canvas.drawCircle(Offset.zero, p.size * 0.36, paint);
        case 2:
          final path = Path()
            ..moveTo(0, -p.size * 0.5)
            ..lineTo(p.size * 0.38, 0)
            ..lineTo(0, p.size * 0.5)
            ..lineTo(-p.size * 0.38, 0)
            ..close();
          canvas.drawPath(path, paint);
        default: // 星形
          _drawStar(canvas, paint, p.size * 0.45);
      }

      canvas.restore();
    }
  }

  void _drawStar(Canvas canvas, Paint paint, double r) {
    final path = Path();
    for (var i = 0; i < 5; i++) {
      final outerAngle = -math.pi / 2 + i * 2 * math.pi / 5;
      final innerAngle = outerAngle + math.pi / 5;
      final ox = math.cos(outerAngle) * r;
      final oy = math.sin(outerAngle) * r;
      final ix = math.cos(innerAngle) * r * 0.45;
      final iy = math.sin(innerAngle) * r * 0.45;
      if (i == 0) {
        path.moveTo(ox, oy);
      } else {
        path.lineTo(ox, oy);
      }
      path.lineTo(ix, iy);
    }
    path.close();
    canvas.drawPath(path, paint);
  }

  @override
  bool shouldRepaint(covariant _ConfettiPainter old) =>
      old.progress != progress;
}
