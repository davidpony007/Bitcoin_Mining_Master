import 'package:flutter/material.dart';
import 'dart:math' as math;

/// 3D风格比特币矿机动画组件
/// 有合约挖矿时显示动画，无合约时静止
class MiningMachineAnimation extends StatefulWidget {
  final bool isActive; // 是否有活跃合约
  final double size;
  final int userLevel; // 用户矿工等级 (1-9)
  
  const MiningMachineAnimation({
    super.key,
    required this.isActive,
    this.size = 200, // 增大默认尺寸
    this.userLevel = 1, // 默认等级1
  });

  @override
  State<MiningMachineAnimation> createState() => _MiningMachineAnimationState();
}

class _MiningMachineAnimationState extends State<MiningMachineAnimation> 
    with TickerProviderStateMixin {
  late AnimationController _fanController;
  late AnimationController _ledController;
  late AnimationController _glowController;
  
  @override
  void initState() {
    super.initState();
    
    // 风扇旋转动画
    _fanController = AnimationController(
      duration: const Duration(milliseconds: 600),
      vsync: this,
    );
    
    // LED闪烁动画
    _ledController = AnimationController(
      duration: const Duration(milliseconds: 800),
      vsync: this,
    );
    
    // 光晕脉冲动画
    _glowController = AnimationController(
      duration: const Duration(milliseconds: 2000),
      vsync: this,
    );
    
    if (widget.isActive) {
      _startAnimations();
    }
  }
  
  @override
  void didUpdateWidget(MiningMachineAnimation oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.isActive != oldWidget.isActive) {
      if (widget.isActive) {
        _startAnimations();
      } else {
        _stopAnimations();
      }
    }
  }
  
  void _startAnimations() {
    _fanController.repeat();
    _ledController.repeat(reverse: true);
    _glowController.repeat(reverse: true);
  }
  
  void _stopAnimations() {
    _fanController.stop();
    _ledController.stop();
    _glowController.stop();
  }
  
  @override
  void dispose() {
    _fanController.dispose();
    _ledController.dispose();
    _glowController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: widget.size,
      height: widget.size,
      child: Stack(
        alignment: Alignment.center,
        children: [
          // 外部发光效果（挖矿时脉冲）- 增强版
          if (widget.isActive)
            AnimatedBuilder(
              animation: _glowController,
              builder: (context, child) {
                return Container(
                  width: widget.size * 1.2,
                  height: widget.size * 1.2,
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(20),
                    boxShadow: [
                      BoxShadow(
                        color: const Color(0xFF00D9FF).withOpacity(
                          0.5 * _glowController.value,
                        ),
                        blurRadius: 40,
                        spreadRadius: 10,
                      ),
                      BoxShadow(
                        color: const Color(0xFF00FFFF).withOpacity(
                          0.3 * _glowController.value,
                        ),
                        blurRadius: 60,
                        spreadRadius: 15,
                      ),
                    ],
                  ),
                );
              },
            ),
          
          // 3D矿机主体
          AnimatedBuilder(
            animation: Listenable.merge([_fanController, _ledController]),
            builder: (context, child) {
              return CustomPaint(
                size: Size(widget.size, widget.size),
                painter: MiningMachine3DPainter(
                  isActive: widget.isActive,
                  fanRotation: _fanController.value,
                  ledOpacity: _ledController.value,
                  userLevel: widget.userLevel,
                ),
              );
            },
          ),
        ],
      ),
    );
  }
}

/// 3D矿机绘制器 - 参照ATI矿机图片设计
class MiningMachine3DPainter extends CustomPainter {
  final bool isActive;
  final double fanRotation;
  final double ledOpacity;
  final int userLevel;
  
  MiningMachine3DPainter({
    required this.isActive,
    required this.fanRotation,
    required this.ledOpacity,
    required this.userLevel,
  });
  
  @override
  void paint(Canvas canvas, Size size) {
    // === 1. 绘制电路板背景和边框 ===
    _drawCircuitBoardBase(canvas, size);
    
    // === 2. 绘制电路走线 ===
    _drawCircuitLines(canvas, size);
    
    // === 3. 绘制中央比特币芯片 ===
    _drawCentralChip(canvas, size);
    
    // === 4. 绘制左右两侧风扇（各3个）===
    _drawSideFans(canvas, size);
    
    // === 5. 绘制LED指示灯和底部金手指 ===
    _drawLEDsAndConnectors(canvas, size);
  }
  
  // ===== 1. 绘制电路板背景和边框 =====
  void _drawCircuitBoardBase(Canvas canvas, Size size) {
    // 电路板主体（长方形）
    final boardRect = RRect.fromRectAndRadius(
      Rect.fromLTWH(0, 0, size.width, size.height),
      const Radius.circular(8),
    );
    
    // 电路板基色渐变
    final boardPaint = Paint()
      ..shader = LinearGradient(
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
        colors: isActive ? [
          const Color(0xFF0F2840),
          const Color(0xFF0A1929),
          const Color(0xFF061220),
        ] : [
          const Color(0xFF1A2332),
          const Color(0xFF0F1821),
          const Color(0xFF0A1218),
        ],
      ).createShader(Rect.fromLTWH(0, 0, size.width, size.height));
    
    canvas.drawRRect(boardRect, boardPaint);
    
    // 电路板边框（金色边缘）
    final borderPaint = Paint()
      ..color = isActive 
          ? const Color(0xFFF7931A).withOpacity(0.6)
          : const Color(0xFF4A5568).withOpacity(0.5)
      ..strokeWidth = 3
      ..style = PaintingStyle.stroke;
    
    canvas.drawRRect(boardRect, borderPaint);
    
    // 发光边框
    if (isActive) {
      final glowPaint = Paint()
        ..color = const Color(0xFFF7931A).withOpacity(0.3)
        ..strokeWidth = 5
        ..style = PaintingStyle.stroke
        ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 8);
      
      canvas.drawRRect(boardRect, glowPaint);
    }
    
    // 四角螺丝孔
    final screwPaint = Paint()
      ..color = isActive 
          ? const Color(0xFF2E4A6F)
          : const Color(0xFF1A2332)
      ..style = PaintingStyle.fill;
    
    final screwBorderPaint = Paint()
      ..color = isActive 
          ? const Color(0xFF4A5568)
          : const Color(0xFF2E3A4F)
      ..strokeWidth = 1.5
      ..style = PaintingStyle.stroke;
    
    final screwRadius = 4.0;
    final screwOffset = 10.0;
    
    // 左上
    canvas.drawCircle(Offset(screwOffset, screwOffset), screwRadius, screwPaint);
    canvas.drawCircle(Offset(screwOffset, screwOffset), screwRadius, screwBorderPaint);
    
    // 右上
    canvas.drawCircle(Offset(size.width - screwOffset, screwOffset), screwRadius, screwPaint);
    canvas.drawCircle(Offset(size.width - screwOffset, screwOffset), screwRadius, screwBorderPaint);
    
    // 左下
    canvas.drawCircle(Offset(screwOffset, size.height - screwOffset), screwRadius, screwPaint);
    canvas.drawCircle(Offset(screwOffset, size.height - screwOffset), screwRadius, screwBorderPaint);
    
    // 右下
    canvas.drawCircle(Offset(size.width - screwOffset, size.height - screwOffset), screwRadius, screwPaint);
    canvas.drawCircle(Offset(size.width - screwOffset, size.height - screwOffset), screwRadius, screwBorderPaint);
  }
  
  // ===== 2. 绘制电路走线和焊点 =====
  void _drawCircuitLines(Canvas canvas, Size size) {
    final linePaint = Paint()
      ..color = isActive 
          ? const Color(0xFFF7931A).withOpacity(0.3)
          : const Color(0xFF2E4A6F).withOpacity(0.3)
      ..strokeWidth = 2
      ..style = PaintingStyle.stroke;
    
    // 横向走线
    for (int i = 1; i <= 8; i++) {
      final y = size.height * i / 9;
      canvas.drawLine(
        Offset(20, y),
        Offset(size.width - 20, y),
        linePaint,
      );
    }
    
    // 纵向走线
    for (int i = 1; i <= 6; i++) {
      final x = size.width * i / 7;
      canvas.drawLine(
        Offset(x, 20),
        Offset(x, size.height - 20),
        linePaint,
      );
    }
    
    // 焊点
    final dotPaint = Paint()
      ..color = isActive 
          ? const Color(0xFFF7931A).withOpacity(0.6)
          : const Color(0xFF2E4A6F).withOpacity(0.5)
      ..style = PaintingStyle.fill;
    
    for (int i = 1; i <= 8; i++) {
      for (int j = 1; j <= 6; j++) {
        if ((i + j) % 3 == 0) {
          canvas.drawCircle(
            Offset(size.width * j / 7, size.height * i / 9),
            2,
            dotPaint,
          );
        }
      }
    }
  }
  
  // ===== 3. 绘制中央比特币芯片（正方形）=====
  void _drawCentralChip(Canvas canvas, Size size) {
    final centerX = size.width / 2;
    final centerY = size.height / 2;
    final chipSize = size.width * 0.35; // 较大的正方形芯片
    
    // 芯片主体（深色正方形）
    final chipRect = RRect.fromRectAndRadius(
      Rect.fromCenter(
        center: Offset(centerX, centerY),
        width: chipSize,
        height: chipSize,
      ),
      const Radius.circular(6),
    );
    
    // 芯片渐变背景
    final chipPaint = Paint()
      ..shader = LinearGradient(
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
        colors: isActive ? [
          const Color(0xFF2E3A4F),
          const Color(0xFF1A2332),
          const Color(0xFF0D1621),
        ] : [
          const Color(0xFF1A2332),
          const Color(0xFF0F1821),
          const Color(0xFF0A1218),
        ],
      ).createShader(chipRect.outerRect);
    
    canvas.drawRRect(chipRect, chipPaint);
    
    // 芯片边框
    final borderPaint = Paint()
      ..color = isActive 
          ? const Color(0xFF4A5568).withOpacity(0.8)
          : const Color(0xFF2E3A4F).withOpacity(0.6)
      ..strokeWidth = 2
      ..style = PaintingStyle.stroke;
    
    canvas.drawRRect(chipRect, borderPaint);
    
    // 左侧引脚（7个）
    final pinPaint = Paint()
      ..color = isActive 
          ? const Color(0xFF8899AA)
          : const Color(0xFF4A5568)
      ..strokeWidth = 3
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round;
    
    for (int i = 0; i < 7; i++) {
      final y = centerY - chipSize * 0.35 + i * chipSize * 0.12;
      canvas.drawLine(
        Offset(centerX - chipSize * 0.5, y),
        Offset(centerX - chipSize * 0.62, y),
        pinPaint,
      );
    }
    
    // 右侧引脚（7个）
    for (int i = 0; i < 7; i++) {
      final y = centerY - chipSize * 0.35 + i * chipSize * 0.12;
      canvas.drawLine(
        Offset(centerX + chipSize * 0.5, y),
        Offset(centerX + chipSize * 0.62, y),
        pinPaint,
      );
    }
    
    // 比特币符号（金色）
    final bitcoinSize = chipSize * 0.5;
    final textPainter = TextPainter(
      text: TextSpan(
        text: '₿',
        style: TextStyle(
          color: isActive 
              ? const Color(0xFFF7931A)
              : const Color(0xFF8899AA),
          fontSize: bitcoinSize,
          fontWeight: FontWeight.bold,
          shadows: isActive ? [
            const Shadow(
              color: Color(0xFF0A1218),
              blurRadius: 3,
              offset: Offset(1, 1),
            ),
          ] : [],
        ),
      ),
      textDirection: TextDirection.ltr,
    );
    textPainter.layout();
    textPainter.paint(
      canvas,
      Offset(
        centerX - textPainter.width / 2,
        centerY - textPainter.height / 2,
      ),
    );
    
    // 右上角状态指示灯（绿色）
    final ledX = centerX + chipSize * 0.35;
    final ledY = centerY - chipSize * 0.35;
    
    final ledPaint = Paint()
      ..color = isActive 
          ? const Color(0xFF00FF7F).withOpacity(ledOpacity) // 春绿色
          : const Color(0xFF4A5568).withOpacity(0.5)
      ..style = PaintingStyle.fill;
    
    canvas.drawCircle(Offset(ledX, ledY), 3, ledPaint); // 从Final 5减小到3
    
    // LED发光效果
    if (isActive) {
      final ledGlowPaint = Paint()
        ..color = const Color(0xFF00FF7F).withOpacity(ledOpacity * 0.6) // 绿色发光
        ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 4); // 从6减小到4
      
      canvas.drawCircle(Offset(ledX, ledY), 5, ledGlowPaint); // 从8减小到5
    }
    
    // 芯片上方显示用户等级 (LV.1 - LV.9)
    final levelText = 'LV.${userLevel.clamp(1, 9)}';
    final levelTextPainter = TextPainter(
      text: TextSpan(
        text: levelText,
        style: TextStyle(
          color: isActive 
              ? const Color(0xFF00D9FF) // 活跃时青蓝色
              : const Color(0xFF6B7280), // 非活跃时灰色
          fontSize: chipSize * 0.18,
          fontWeight: FontWeight.bold,
          letterSpacing: 1.5,
          shadows: isActive ? [
            const Shadow(
              color: Color(0xFF00D9FF),
              blurRadius: 8,
            ),
            const Shadow(
              color: Color(0xFF00FFFF),
              blurRadius: 4,
            ),
          ] : [],
        ),
      ),
      textDirection: TextDirection.ltr,
    );
    levelTextPainter.layout();
    levelTextPainter.paint(
      canvas,
      Offset(
        centerX - levelTextPainter.width / 2,
        centerY - chipSize * 0.65, // 芯片上方
      ),
    );
  }
  

  
  // ===== 4. 绘制两侧风扇（每侧3个）=====
  void _drawSideFans(Canvas canvas, Size size) {
    final fanSize = size.width * 0.08;
    
    // 左侧3个风扇
    _drawFan(canvas, Offset(size.width * 0.12, size.height * 0.25), fanSize);
    _drawFan(canvas, Offset(size.width * 0.12, size.height * 0.5), fanSize);
    _drawFan(canvas, Offset(size.width * 0.12, size.height * 0.75), fanSize);
    
    // 右侧3个风扇
    _drawFan(canvas, Offset(size.width * 0.88, size.height * 0.25), fanSize);
    _drawFan(canvas, Offset(size.width * 0.88, size.height * 0.5), fanSize);
    _drawFan(canvas, Offset(size.width * 0.88, size.height * 0.75), fanSize);
  }
  
  void _drawFan(Canvas canvas, Offset center, double fanSize) {
    // 风扇外框
    final framePaint = Paint()
      ..color = isActive 
          ? const Color(0xFF2E4A6F)
          : const Color(0xFF1A2332)
      ..strokeWidth = 2.5
      ..style = PaintingStyle.stroke;
    
    canvas.drawCircle(center, fanSize, framePaint);
    
    // 风扇网格（十字）
    final gridPaint = Paint()
      ..color = isActive 
          ? const Color(0xFF2E4A6F).withOpacity(0.5)
          : const Color(0xFF1A2332).withOpacity(0.5)
      ..strokeWidth = 1
      ..style = PaintingStyle.stroke;
    
    canvas.drawLine(
      Offset(center.dx - fanSize, center.dy),
      Offset(center.dx + fanSize, center.dy),
      gridPaint,
    );
    
    canvas.drawLine(
      Offset(center.dx, center.dy - fanSize),
      Offset(center.dx, center.dy + fanSize),
      gridPaint,
    );
    
    // 旋转风扇叶片（只有活跃时才旋转）
    if (isActive) {
      canvas.save();
      canvas.translate(center.dx, center.dy);
      canvas.rotate(fanRotation * 2 * math.pi);
      
      final bladePaint = Paint()
        ..shader = RadialGradient(
          colors: [
            const Color(0xFF00D9FF).withOpacity(0.9),
            const Color(0xFF00D9FF).withOpacity(0.4),
          ],
        ).createShader(Rect.fromCircle(
          center: Offset.zero,
          radius: fanSize * 0.85,
        ))
        ..style = PaintingStyle.fill;
      
      // 6叶椭圆形风扇
      for (int i = 0; i < 6; i++) {
        final angle = (i * math.pi / 3);
        
        canvas.save();
        canvas.rotate(angle);
        
        // 绘制圆润的水滴形叶片
        final bladePath = Path();
        final bladeWidth = fanSize * 0.5;   // 叶片宽度（增大）
        final bladeLength = fanSize * 0.75; // 叶片长度
        final tipRadius = bladeWidth * 0.5;  // 末端圆角半径
        
        // 使用圆角矩形创建更圆润的叶片
        final bladeRect = RRect.fromRectAndCorners(
          Rect.fromCenter(
            center: Offset(0, -bladeLength * 0.5),
            width: bladeWidth,
            height: bladeLength,
          ),
          topLeft: Radius.circular(tipRadius),
          topRight: Radius.circular(tipRadius),
          bottomLeft: Radius.circular(bladeWidth * 0.3),
          bottomRight: Radius.circular(bladeWidth * 0.3),
        );
        
        bladePath.addRRect(bladeRect);
        canvas.drawPath(bladePath, bladePaint);
        canvas.restore();
      }
      
      canvas.restore();
    } else {
      // 非活跃时绘制静止的风扇叶片
      final bladePaint = Paint()
        ..color = const Color(0xFF2E4A6F).withOpacity(0.5)
        ..style = PaintingStyle.fill;
      
      canvas.save();
      canvas.translate(center.dx, center.dy);
      
      for (int i = 0; i < 6; i++) {
        final angle = (i * math.pi / 3);
        
        canvas.save();
        canvas.rotate(angle);
        
        // 绘制圆润的水滴形叶片
        final bladePath = Path();
        final bladeWidth = fanSize * 0.5;   // 叶片宽度（增大）
        final bladeLength = fanSize * 0.75; // 叶片长度
        final tipRadius = bladeWidth * 0.5;  // 末端圆角半径
        
        // 使用圆角矩形创建更圆润的叶片
        final bladeRect = RRect.fromRectAndCorners(
          Rect.fromCenter(
            center: Offset(0, -bladeLength * 0.5),
            width: bladeWidth,
            height: bladeLength,
          ),
          topLeft: Radius.circular(tipRadius),
          topRight: Radius.circular(tipRadius),
          bottomLeft: Radius.circular(bladeWidth * 0.3),
          bottomRight: Radius.circular(bladeWidth * 0.3),
        );
        
        bladePath.addRRect(bladeRect);
        canvas.drawPath(bladePath, bladePaint);
        canvas.restore();
      }
      
      canvas.restore();
    }
    
    // 中心轴
    final centerPaint = Paint()
      ..shader = RadialGradient(
        colors: isActive ? [
          const Color(0xFF00D9FF),
          const Color(0xFF0D1F2D),
        ] : [
          const Color(0xFF2E4A6F),
          const Color(0xFF0A1218),
        ],
      ).createShader(Rect.fromCircle(
        center: center,
        radius: fanSize * 0.25,
      ))
      ..style = PaintingStyle.fill;
    
    canvas.drawCircle(center, fanSize * 0.25, centerPaint);
    
    // 中心轴边框
    final centerBorderPaint = Paint()
      ..color = isActive 
          ? const Color(0xFF00D9FF).withOpacity(0.8)
          : const Color(0xFF2E4A6F).withOpacity(0.6)
      ..strokeWidth = 1.5
      ..style = PaintingStyle.stroke;
    
    canvas.drawCircle(center, fanSize * 0.25, centerBorderPaint);
    
    // 风扇发光效果（只有活跃时）
    if (isActive) {
      final glowPaint = Paint()
        ..color = const Color(0xFF00D9FF).withOpacity(0.4)
        ..strokeWidth = 2
        ..style = PaintingStyle.stroke
        ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 6);
      
      canvas.drawCircle(center, fanSize * 1.05, glowPaint);
    }
  }
  
  // ===== 5. 绘制LED指示灯和底部金手指 =====
  void _drawLEDsAndConnectors(Canvas canvas, Size size) {
    // 顶部LED指示灯阵列
    final topLedY = size.height * 0.08;
    final topLedCount = 8;
    final topLedSpacing = (size.width * 0.5) / (topLedCount - 1);
    final topLedStartX = size.width * 0.25;
    
    for (int i = 0; i < topLedCount; i++) {
      final ledX = topLedStartX + i * topLedSpacing;
      
      final ledPaint = Paint()
        ..color = isActive 
            ? const Color(0xFF00D9FF).withOpacity(ledOpacity * 0.8)
            : const Color(0xFF2E4A6F).withOpacity(0.4)
        ..style = PaintingStyle.fill;
      
      canvas.drawCircle(Offset(ledX, topLedY), 2, ledPaint);
    }
    
    // 底部LED指示灯阵列
    final ledY = size.height * 0.88;
    final ledCount = 16;
    final ledSpacing = (size.width - 40) / (ledCount - 1);
    
    for (int i = 0; i < ledCount; i++) {
      final ledX = 20 + i * ledSpacing;
      
      final ledPaint = Paint()
        ..color = isActive 
            ? (i % 2 == 0 
                ? const Color(0xFFF7931A).withOpacity(ledOpacity * 0.9)
                : const Color(0xFF00D9FF).withOpacity(ledOpacity * 0.9))
            : const Color(0xFF2E4A6F).withOpacity(0.4)
        ..style = PaintingStyle.fill;
      
      canvas.drawCircle(Offset(ledX, ledY), 2.5, ledPaint);
      
      // LED发光
      if (isActive) {
        final ledGlowPaint = Paint()
          ..color = (i % 2 == 0 
              ? const Color(0xFFF7931A)
              : const Color(0xFF00D9FF)).withOpacity(ledOpacity * 0.5)
          ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 3);
        
        canvas.drawCircle(Offset(ledX, ledY), 3.5, ledGlowPaint);
      }
    }
    
    // 底部金手指连接器
    final connectorPaint = Paint()
      ..color = isActive 
          ? const Color(0xFFF7931A).withOpacity(0.8)
          : const Color(0xFF8899AA).withOpacity(0.6)
      ..style = PaintingStyle.fill;
    
    final connectorCount = 12;
    final connectorWidth = 4.0;
    final connectorHeight = 8.0;
    final connectorSpacing = (size.width * 0.6) / (connectorCount - 1);
    final connectorStartX = size.width * 0.2;
    final connectorY = size.height - 15;
    
    for (int i = 0; i < connectorCount; i++) {
      final connectorX = connectorStartX + i * connectorSpacing;
      
      canvas.drawRRect(
        RRect.fromRectAndRadius(
          Rect.fromLTWH(
            connectorX - connectorWidth / 2,
            connectorY,
            connectorWidth,
            connectorHeight,
          ),
          const Radius.circular(1),
        ),
        connectorPaint,
      );
    }
  }
  
  @override
  bool shouldRepaint(MiningMachine3DPainter oldDelegate) {
    return oldDelegate.isActive != isActive ||
           oldDelegate.fanRotation != fanRotation ||
           oldDelegate.ledOpacity != ledOpacity;
  }
}