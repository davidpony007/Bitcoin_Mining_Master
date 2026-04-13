import 'dart:math' as math;
import 'package:flutter/material.dart';
import '../constants/app_constants.dart';

/// 矿工等级升级庆祝弹窗
///
/// 用法：
///   LevelUpDialog.show(context, newLevel: 3, levelName: 'LV.3 高级矿工');
class LevelUpDialog extends StatefulWidget {
  final int newLevel;
  final String levelName;
  final VoidCallback? onClose;

  const LevelUpDialog({
    super.key,
    required this.newLevel,
    required this.levelName,
    this.onClose,
  });

  static Future<void> show(
    BuildContext context, {
    required int newLevel,
    required String levelName,
    VoidCallback? onClose,
  }) {
    return showDialog(
      context: context,
      barrierDismissible: false,
      barrierColor: Colors.black87,
      builder: (_) => LevelUpDialog(
        newLevel: newLevel,
        levelName: levelName,
        onClose: onClose,
      ),
    );
  }

  @override
  State<LevelUpDialog> createState() => _LevelUpDialogState();
}

class _LevelUpDialogState extends State<LevelUpDialog>
    with TickerProviderStateMixin {
  late final AnimationController _confettiCtrl;
  late final AnimationController _scaleCtrl;
  late final AnimationController _bounceCtrl;
  late final AnimationController _glowCtrl;
  late final AnimationController _shineCtrl;

  late final Animation<double> _scaleAnim;
  late final Animation<double> _bounceAnim;
  late final Animation<double> _glowAnim;
  late final Animation<double> _shineAnim;

  final List<_Particle> _particles = [];
  static const _particleCount = 80;

  static const _colors = [
    Color(0xFFFF9800),
    Color(0xFFFFD700),
    Color(0xFF4CAF50),
    Color(0xFF2196F3),
    Color(0xFFE91E63),
    Color(0xFF9C27B0),
    Color(0xFFFFFFFF),
    Color(0xFFFF5722),
    Color(0xFF00BCD4),
    Color(0xFFFF6B35),
  ];

  @override
  void initState() {
    super.initState();

    final rand = math.Random();
    for (var i = 0; i < _particleCount; i++) {
      _particles.add(_Particle(
        x: rand.nextDouble(),
        delay: rand.nextDouble() * 0.3,
        speed: 0.35 + rand.nextDouble() * 0.65,
        size: 5.0 + rand.nextDouble() * 10.0,
        color: _colors[rand.nextInt(_colors.length)],
        rotation: rand.nextDouble() * math.pi * 2,
        rotSpeed: (rand.nextDouble() - 0.5) * 5,
        wobble: 0.02 + rand.nextDouble() * 0.06,
        wobbleFreq: 1.5 + rand.nextDouble() * 2.5,
        shape: rand.nextInt(3),
      ));
    }

    // 彩纸动画 4 秒
    _confettiCtrl = AnimationController(
      duration: const Duration(milliseconds: 4000),
      vsync: this,
    )..forward();

    // 弹窗弹入
    _scaleCtrl = AnimationController(
      duration: const Duration(milliseconds: 550),
      vsync: this,
    );
    _scaleAnim = CurvedAnimation(parent: _scaleCtrl, curve: Curves.elasticOut);
    _scaleCtrl.forward();

    // 等级数字弹跳循环
    _bounceCtrl = AnimationController(
      duration: const Duration(milliseconds: 800),
      vsync: this,
    )..repeat(reverse: true);
    _bounceAnim = Tween<double>(begin: 1.0, end: 1.18)
        .animate(CurvedAnimation(parent: _bounceCtrl, curve: Curves.easeInOut));

    // 按钮光晕脉动
    _glowCtrl = AnimationController(
      duration: const Duration(milliseconds: 1400),
      vsync: this,
    )..repeat(reverse: true);
    _glowAnim = Tween<double>(begin: 0.3, end: 0.75)
        .animate(CurvedAnimation(parent: _glowCtrl, curve: Curves.easeInOut));

    // 星光扫过动画
    _shineCtrl = AnimationController(
      duration: const Duration(milliseconds: 2000),
      vsync: this,
    )..repeat();
    _shineAnim = Tween<double>(begin: -1.0, end: 2.0).animate(
      CurvedAnimation(parent: _shineCtrl, curve: Curves.easeInOut),
    );
  }

  @override
  void dispose() {
    _confettiCtrl.dispose();
    _scaleCtrl.dispose();
    _bounceCtrl.dispose();
    _glowCtrl.dispose();
    _shineCtrl.dispose();
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
            // 彩纸全屏层
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

            // 居中弹窗卡片
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
    return Container(
      width: math.min(MediaQuery.of(context).size.width * 0.88, 360),
      decoration: BoxDecoration(
        color: const Color(0xFF1A1A1A),
        borderRadius: BorderRadius.circular(24),
        border: Border.all(
          color: const Color(0xFFFFD700).withValues(alpha: 0.6),
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
            blurRadius: 25,
            spreadRadius: 2,
          ),
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.6),
            blurRadius: 20,
          ),
        ],
      ),
      padding: const EdgeInsets.fromLTRB(28, 32, 28, 28),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // 顶部 LEVEL UP 标签
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [Color(0xFFFF6B35), Color(0xFFFFD700)],
              ),
              borderRadius: BorderRadius.circular(20),
            ),
            child: const Text(
              '⬆  LEVEL UP!',
              style: TextStyle(
                color: Colors.white,
                fontSize: 13,
                fontWeight: FontWeight.bold,
                letterSpacing: 1.2,
              ),
            ),
          ),
          const SizedBox(height: 22),

          // 等级数字主图标（弹跳 + 星光扫过）
          ScaleTransition(
            scale: _bounceAnim,
            child: AnimatedBuilder(
              animation: _shineAnim,
              builder: (_, child) {
                return ShaderMask(
                  shaderCallback: (bounds) {
                    return LinearGradient(
                      begin: Alignment(_shineAnim.value - 0.4, -0.5),
                      end: Alignment(_shineAnim.value + 0.4, 0.5),
                      colors: [
                        Colors.transparent,
                        Colors.white.withValues(alpha: 0.35),
                        Colors.transparent,
                      ],
                    ).createShader(bounds);
                  },
                  blendMode: BlendMode.srcATop,
                  child: child,
                );
              },
              child: Container(
                width: 90,
                height: 90,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: const RadialGradient(
                    colors: [Color(0xFFFFD700), Color(0xFFFF6B35)],
                    radius: 0.85,
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: const Color(0xFFFFD700).withValues(alpha: 0.55),
                      blurRadius: 28,
                      spreadRadius: 5,
                    ),
                  ],
                ),
                child: Center(
                  child: Text(
                    'LV.${widget.newLevel}',
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 28,
                      fontWeight: FontWeight.w900,
                      height: 1.0,
                    ),
                  ),
                ),
              ),
            ),
          ),
          const SizedBox(height: 18),

          // 标题
          const Text(
            '🎉 Congratulations!',
            style: TextStyle(
              color: Colors.white,
              fontSize: 22,
              fontWeight: FontWeight.bold,
              letterSpacing: 0.3,
            ),
          ),
          const SizedBox(height: 8),

          // 副标题：等级名
          Text(
            widget.levelName,
            textAlign: TextAlign.center,
            style: const TextStyle(
              color: Color(0xFFFFD700),
              fontSize: 16,
              fontWeight: FontWeight.w600,
              letterSpacing: 0.5,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            'You\'ve unlocked a new miner rank!',
            textAlign: TextAlign.center,
            style: TextStyle(
              color: Colors.white.withValues(alpha: 0.6),
              fontSize: 13,
              height: 1.4,
            ),
          ),
          const SizedBox(height: 22),

          // 奖励信息卡
          Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 16),
            decoration: BoxDecoration(
              color: const Color(0xFFFFD700).withValues(alpha: 0.07),
              borderRadius: BorderRadius.circular(14),
              border: Border.all(
                color: const Color(0xFFFFD700).withValues(alpha: 0.3),
              ),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Row(
                  children: [
                    Text('🏆', style: TextStyle(fontSize: 16)),
                    SizedBox(width: 6),
                    Text(
                      'New Rank Benefits',
                      style: TextStyle(
                        color: Color(0xFFFFD700),
                        fontWeight: FontWeight.bold,
                        fontSize: 14,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                _benefitItem('⚡  Higher mining speed multiplier'),
                const SizedBox(height: 7),
                _benefitItem('💎  Increased passive earnings'),
                const SizedBox(height: 7),
                _benefitItem('🚀  Keep mining to reach the next level!'),
              ],
            ),
          ),
          const SizedBox(height: 26),

          // 确认按钮（带光晕）
          AnimatedBuilder(
            animation: _glowAnim,
            builder: (_, child) => Container(
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(12),
                boxShadow: [
                  BoxShadow(
                    color: const Color(0xFFFFD700).withValues(alpha: _glowAnim.value),
                    blurRadius: 20,
                    spreadRadius: 2,
                  ),
                ],
              ),
              child: child,
            ),
            child: SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: () {
                  Navigator.of(context).pop();
                  widget.onClose?.call();
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFFFFD700),
                  foregroundColor: Colors.black,
                  padding: const EdgeInsets.symmetric(vertical: 15),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                  elevation: 0,
                ),
                child: const Text(
                  '⚡  Keep Mining!',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _benefitItem(String text) {
    return Text(
      text,
      style: TextStyle(
        color: Colors.white.withValues(alpha: 0.82),
        fontSize: 13,
        height: 1.4,
      ),
    );
  }
}

// ── 粒子模型 ────────────────────────────────────────────────────
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

// ── 彩纸绘制器 ──────────────────────────────────────────────────
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

      final opacity = t < 0.75 ? 1.0 : (1.0 - t) / 0.25;
      final x =
          (p.x + math.sin(t * math.pi * 2 * p.wobbleFreq) * p.wobble) *
          size.width;
      final y = t * p.speed * size.height * 1.25;
      final rot = p.rotation + t * p.rotSpeed * math.pi;

      paint.color = p.color.withValues(alpha: opacity.clamp(0.0, 1.0));

      canvas.save();
      canvas.translate(x, y);
      canvas.rotate(rot);

      switch (p.shape) {
        case 0:
          canvas.drawRect(
            Rect.fromCenter(
                center: Offset.zero, width: p.size, height: p.size * 0.45),
            paint,
          );
        case 1:
          canvas.drawCircle(Offset.zero, p.size * 0.38, paint);
        default:
          final path = Path()
            ..moveTo(0, -p.size * 0.5)
            ..lineTo(p.size * 0.38, 0)
            ..lineTo(0, p.size * 0.5)
            ..lineTo(-p.size * 0.38, 0)
            ..close();
          canvas.drawPath(path, paint);
      }

      canvas.restore();
    }
  }

  @override
  bool shouldRepaint(covariant _ConfettiPainter old) =>
      old.progress != progress;
}
