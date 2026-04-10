import 'dart:math' as math;
import 'package:flutter/material.dart';
import '../constants/app_constants.dart';

/// 邀请关系绑定成功庆祝弹窗
///
/// [role] 区分被邀请方（referree）和邀请方（referrer）：
///   - ReferralRole.referree  : 被邀请人绑定成功时使用
///   - ReferralRole.referrer  : 邀请人收到新好友绑定通知时使用
enum ReferralRole { referree, referrer }

class ReferralSuccessDialog extends StatefulWidget {
  final ReferralRole role;
  final VoidCallback? onClose;

  const ReferralSuccessDialog({
    super.key,
    required this.role,
    this.onClose,
  });

  /// 弹出庆祝窗口（静态工厂方法）
  static Future<void> show(
    BuildContext context, {
    required ReferralRole role,
    VoidCallback? onClose,
  }) {
    return showDialog(
      context: context,
      barrierDismissible: false,
      barrierColor: Colors.black87,
      builder: (_) => ReferralSuccessDialog(role: role, onClose: onClose),
    );
  }

  @override
  State<ReferralSuccessDialog> createState() => _ReferralSuccessDialogState();
}

class _ReferralSuccessDialogState extends State<ReferralSuccessDialog>
    with TickerProviderStateMixin {
  late final AnimationController _confettiCtrl;
  late final AnimationController _scaleCtrl;
  late final AnimationController _bounceCtrl;
  late final AnimationController _glowCtrl;

  late final Animation<double> _scaleAnim;
  late final Animation<double> _bounceAnim;
  late final Animation<double> _glowAnim;

  final List<_Particle> _particles = [];
  static const _particleCount = 70;

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
  ];

  @override
  void initState() {
    super.initState();

    // ── 生成彩纸粒子 ───────────────────────────────────────
    final rand = math.Random();
    for (var i = 0; i < _particleCount; i++) {
      _particles.add(_Particle(
        x: rand.nextDouble(),
        delay: rand.nextDouble() * 0.35,
        speed: 0.35 + rand.nextDouble() * 0.65,
        size: 5.0 + rand.nextDouble() * 9.0,
        color: _colors[rand.nextInt(_colors.length)],
        rotation: rand.nextDouble() * math.pi * 2,
        rotSpeed: (rand.nextDouble() - 0.5) * 5,
        wobble: 0.02 + rand.nextDouble() * 0.06,
        wobbleFreq: 1.5 + rand.nextDouble() * 2.5,
        shape: rand.nextInt(3),
      ));
    }

    // 彩纸：3.5 秒后停止
    _confettiCtrl = AnimationController(
      duration: const Duration(milliseconds: 3500),
      vsync: this,
    )..forward();

    // 弹窗入场 Scale
    _scaleCtrl = AnimationController(
      duration: const Duration(milliseconds: 500),
      vsync: this,
    );
    _scaleAnim = CurvedAnimation(parent: _scaleCtrl, curve: Curves.elasticOut);
    _scaleCtrl.forward();

    // 图标弹跳（循环）
    _bounceCtrl = AnimationController(
      duration: const Duration(milliseconds: 900),
      vsync: this,
    )..repeat(reverse: true);
    _bounceAnim = Tween<double>(begin: 1.0, end: 1.15)
        .animate(CurvedAnimation(parent: _bounceCtrl, curve: Curves.easeInOut));

    // 按钮光晕脉动
    _glowCtrl = AnimationController(
      duration: const Duration(milliseconds: 1400),
      vsync: this,
    )..repeat(reverse: true);
    _glowAnim = Tween<double>(begin: 0.3, end: 0.7)
        .animate(CurvedAnimation(parent: _glowCtrl, curve: Curves.easeInOut));
  }

  @override
  void dispose() {
    _confettiCtrl.dispose();
    _scaleCtrl.dispose();
    _bounceCtrl.dispose();
    _glowCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isReferree = widget.role == ReferralRole.referree;
    final size = MediaQuery.of(context).size;

    return Dialog(
      backgroundColor: Colors.transparent,
      insetPadding: EdgeInsets.zero,
      child: SizedBox(
        width: size.width,
        height: size.height,
        child: Stack(
          children: [
            // ── 彩纸层（全屏） ─────────────────────────
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

            // ── 弹窗卡片 ───────────────────────────────
            Center(
              child: ScaleTransition(
                scale: _scaleAnim,
                child: _buildCard(isReferree),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildCard(bool isReferree) {
    return Container(
      width: math.min(
        MediaQuery.of(context).size.width * 0.88,
        360,
      ),
      decoration: BoxDecoration(
        color: const Color(0xFF1A1A1A),
        borderRadius: BorderRadius.circular(24),
        border: Border.all(
          color: AppColors.primary.withValues(alpha: 0.55),
          width: 1.5,
        ),
        boxShadow: [
          BoxShadow(
            color: AppColors.primary.withValues(alpha: 0.35),
            blurRadius: 35,
            spreadRadius: 4,
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
          // ── 主图标 ────────────────────────────────
          ScaleTransition(
            scale: _bounceAnim,
            child: Container(
              width: 84,
              height: 84,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: RadialGradient(
                  colors: [
                    AppColors.primary,
                    AppColors.primary.withValues(alpha: 0.3),
                  ],
                  radius: 0.85,
                ),
                boxShadow: [
                  BoxShadow(
                    color: AppColors.primary.withValues(alpha: 0.55),
                    blurRadius: 22,
                    spreadRadius: 4,
                  ),
                ],
              ),
              child: const Center(
                child: Text('🤝', style: TextStyle(fontSize: 40)),
              ),
            ),
          ),
          const SizedBox(height: 20),

          // ── 标题 ──────────────────────────────────
          const Text(
            '🎉 Invitation Bound!',
            style: TextStyle(
              color: Colors.white,
              fontSize: 22,
              fontWeight: FontWeight.bold,
              letterSpacing: 0.3,
            ),
          ),
          const SizedBox(height: 10),

          // ── 副标题 ────────────────────────────────
          Text(
            isReferree
                ? 'You\'ve successfully linked\nwith your inviter!'
                : 'Great news! A friend just\naccepted your invitation!',
            textAlign: TextAlign.center,
            style: TextStyle(
              color: Colors.white.withValues(alpha: 0.7),
              fontSize: 14,
              height: 1.5,
            ),
          ),
          const SizedBox(height: 22),

          // ── 奖励卡片 ──────────────────────────────
          Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 16),
            decoration: BoxDecoration(
              color: AppColors.primary.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(14),
              border: Border.all(
                color: AppColors.primary.withValues(alpha: 0.3),
              ),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Row(
                  children: [
                    Text(
                      '🎁',
                      style: TextStyle(fontSize: 16),
                    ),
                    SizedBox(width: 6),
                    Text(
                      'Rewards Unlocked',
                      style: TextStyle(
                        color: Color(0xFFFFD700),
                        fontWeight: FontWeight.bold,
                        fontSize: 14,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                _rewardItem(
                  isReferree
                      ? '⛏️  Received a 2-hour free mining contract'
                      : '⛏️  Your invitation mining contract extended +2h',
                ),
                const SizedBox(height: 7),
                _rewardItem(
                  isReferree
                      ? '🚀  Mining speed boost activated'
                      : '💰  Earn passive rewards from friend\'s activity',
                ),
                const SizedBox(height: 7),
                _rewardItem(
                  isReferree
                      ? '💎  Level XP bonus unlocked'
                      : '🏆  Referral milestone progress updated',
                ),
              ],
            ),
          ),
          const SizedBox(height: 26),

          // ── 按钮 ──────────────────────────────────
          AnimatedBuilder(
            animation: _glowAnim,
            builder: (_, child) => Container(
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(12),
                boxShadow: [
                  BoxShadow(
                    color: AppColors.primary.withValues(alpha: _glowAnim.value),
                    blurRadius: 18,
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
                  backgroundColor: AppColors.primary,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 15),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                  elevation: 0,
                ),
                child: Text(
                  isReferree ? '🚀  Start Mining Now!' : '🎊  Awesome, Thank You!',
                  style: const TextStyle(
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

  Widget _rewardItem(String text) {
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
  final int shape; // 0=rect 1=circle 2=diamond

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

      // 到底部后淡出
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
        case 0: // 矩形彩纸片
          canvas.drawRect(
            Rect.fromCenter(
              center: Offset.zero,
              width: p.size,
              height: p.size * 0.45,
            ),
            paint,
          );
        case 1: // 圆形
          canvas.drawCircle(Offset.zero, p.size * 0.38, paint);
        default: // 菱形
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
