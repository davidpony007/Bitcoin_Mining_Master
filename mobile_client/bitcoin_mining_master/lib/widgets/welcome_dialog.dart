import 'package:flutter/material.dart';
import '../constants/app_constants.dart';
import '../services/storage_service.dart';

/// 首次进入APP欢迎弹窗
class WelcomeDialog extends StatefulWidget {
  final Function(String?) onComplete;

  const WelcomeDialog({
    super.key,
    required this.onComplete,
  });

  static Future<void> showIfFirstTime(BuildContext context, Function(String?) onComplete) async {
    final storage = StorageService();
    final isFirstLaunch = storage.isFirstLaunch();

    if (isFirstLaunch) {
      await storage.setLaunched();
      if (context.mounted) {
        showDialog(
          context: context,
          barrierDismissible: false,
          builder: (context) => WelcomeDialog(onComplete: onComplete),
        );
      }
    }
  }

  @override
  State<WelcomeDialog> createState() => _WelcomeDialogState();
}

class _WelcomeDialogState extends State<WelcomeDialog> {
  final _codeController = TextEditingController();

  @override
  void dispose() {
    _codeController.dispose();
    super.dispose();
  }

  void _confirm() {
    final code = _codeController.text.trim();
    Navigator.pop(context);
    widget.onComplete(code.isEmpty ? null : code);
  }

  void _skip() {
    Navigator.pop(context);
    widget.onComplete(null);
  }

  @override
  Widget build(BuildContext context) {
    // 键盘高度：Dialog 的 insetPadding.bottom 设为键盘高度，
    // 使整个对话框随键盘上移，按钮始终保持在键盘上方可见。
    final keyboardHeight = MediaQuery.of(context).viewInsets.bottom;
    return Dialog(
      backgroundColor: AppColors.cardDark,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      insetPadding: EdgeInsets.only(
        left: 24,
        right: 24,
        top: 40,
        bottom: keyboardHeight > 0 ? keyboardHeight + 8 : 40,
      ),
      child: SingleChildScrollView(
        padding: const EdgeInsets.only(
          left: 24,
          right: 24,
          top: 28,
          bottom: 24,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.celebration, color: AppColors.primary, size: 48),
            const SizedBox(height: 12),
            const Text(
              'Welcome to Bitcoin Mining Master!',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 16),
            const Text(
              'Do you have a referrer\'s invitation code?',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 14, color: AppColors.textSecondary),
            ),
            const SizedBox(height: 8),
            const Text(
              '🎁 Enter it now to get a FREE 2-hour mining contract!',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 13,
                color: AppColors.primary,
                fontWeight: FontWeight.w500,
              ),
            ),
            const SizedBox(height: 20),
            TextField(
              controller: _codeController,
              decoration: InputDecoration(
                hintText: 'Enter invitation code (Optional)',
                hintStyle: const TextStyle(fontSize: 14),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(8),
                ),
                prefixIcon: const Icon(Icons.card_giftcard, size: 20),
                filled: true,
                fillColor: AppColors.background,
              ),
              textCapitalization: TextCapitalization.characters,
              // 点击键盘"完成"时，不关闭键盘，让用户决定是否提交
              textInputAction: TextInputAction.done,
              onSubmitted: (_) => _confirm(),
            ),
            const SizedBox(height: 8),
            Text(
              'You can add it later in the Referral page',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 11,
                color: AppColors.textSecondary.withOpacity(0.7),
              ),
            ),
            const SizedBox(height: 20),
            // 按钮放在内容区内部，随内容一起滚动，不会被键盘遮挡
            Row(
              children: [
                Expanded(
                  child: TextButton(
                    onPressed: _skip,
                    child: const Text('Skip'),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  flex: 2,
                  child: ElevatedButton(
                    onPressed: _confirm,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.primary,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(10),
                      ),
                    ),
                    child: const Text(
                      'Continue',
                      style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold),
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
