import 'package:flutter/material.dart';
import '../constants/app_constants.dart';
import '../services/storage_service.dart';

/// 首次进入APP欢迎弹窗
class WelcomeDialog extends StatelessWidget {
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
  Widget build(BuildContext context) {
    final codeController = TextEditingController();
    
    return AlertDialog(
      backgroundColor: AppColors.cardDark,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      title: Column(
        children: [
          Icon(
            Icons.celebration,
            color: AppColors.primary,
            size: 48,
          ),
          const SizedBox(height: 12),
          const Text(
            'Welcome to Bitcoin Mining Master!',
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
          ),
        ],
      ),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
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
            controller: codeController,
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
          ),
          const SizedBox(height: 12),
          Text(
            'You can add it later in the Referral page',
            style: TextStyle(
              fontSize: 11,
              color: AppColors.textSecondary.withOpacity(0.7),
            ),
          ),
        ],
      ),
      actions: [
        TextButton(
          onPressed: () {
            Navigator.pop(context);
            onComplete(null);
          },
          child: const Text('Skip'),
        ),
        ElevatedButton(
          onPressed: () {
            final code = codeController.text.trim();
            Navigator.pop(context);
            onComplete(code.isEmpty ? null : code);
          },
          style: ElevatedButton.styleFrom(
            backgroundColor: AppColors.primary,
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
          ),
          child: const Text('Continue'),
        ),
      ],
    );
  }
}
