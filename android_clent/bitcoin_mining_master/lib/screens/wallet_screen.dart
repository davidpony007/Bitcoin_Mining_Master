import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/user_provider.dart';
import '../constants/app_constants.dart';
import '../models/user_model.dart';

/// 钱包屏幕 - 对应WalletFragment.kt
class WalletScreen extends StatefulWidget {
  const WalletScreen({super.key});

  @override
  State<WalletScreen> createState() => _WalletScreenState();
}

class _WalletScreenState extends State<WalletScreen> {
  @override
  void initState() {
    super.initState();
    // 加载交易记录
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<UserProvider>().fetchTransactions();
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Wallet'),
      ),
      body: Consumer<UserProvider>(
        builder: (context, userProvider, child) {
          return RefreshIndicator(
            onRefresh: () async {
              await userProvider.fetchBitcoinBalance();
              await userProvider.fetchTransactions();
            },
            child: SingleChildScrollView(
              child: Column(
                children: [
                  const SizedBox(height: 16),
                  
                  // Balance Card
                  _buildBalanceSection(userProvider),
                  
                  const SizedBox(height: 20),
                  
                  // Action Buttons
                  _buildActionButtons(),
                  
                  const SizedBox(height: 24),
                  
                  // Transaction History
                  _buildTransactionHistory(userProvider),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  /// 构建余额区域
  Widget _buildBalanceSection(UserProvider provider) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            AppColors.primary,
            AppColors.secondary,
          ],
        ),
        borderRadius: BorderRadius.circular(16),
      ),
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'Total Assets',
                style: TextStyle(
                  color: Colors.white70,
                  fontSize: 14,
                ),
              ),
              Icon(
                Icons.remove_red_eye_outlined,
                color: Colors.white70,
                size: 20,
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            '${double.tryParse(provider.bitcoinBalance)?.toStringAsFixed(8) ?? '0.00000000'} BTC',
            style: const TextStyle(
              color: Colors.white,
              fontSize: 32,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            '≈ \$${((double.tryParse(provider.bitcoinBalance) ?? 0) * 50000).toStringAsFixed(2)} USD',
            style: const TextStyle(
              color: Colors.white70,
              fontSize: 16,
            ),
          ),
        ],
      ),
    );
  }

  /// 构建操作按钮
  Widget _buildActionButtons() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Row(
        children: [
          Expanded(
            child: _buildActionButton(
              icon: Icons.arrow_upward,
              label: 'Withdraw',
              color: const Color(0xFF4CAF50),
              onTap: () {},
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: _buildActionButton(
              icon: Icons.swap_horiz,
              label: 'Exchange',
              color: AppColors.secondary,
              onTap: () {},
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: _buildActionButton(
              icon: Icons.arrow_downward,
              label: 'Deposit',
              color: const Color(0xFFFFC107),
              onTap: () {},
            ),
          ),
        ],
      ),
    );
  }

  /// 构建单个操作按钮
  Widget _buildActionButton({
    required IconData icon,
    required String label,
    required Color color,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 16),
        decoration: BoxDecoration(
          color: AppColors.cardDark,
          borderRadius: BorderRadius.circular(12),
        ),
        child: Column(
          children: [
            Icon(icon, color: color, size: 28),
            const SizedBox(height: 8),
            Text(
              label,
              style: TextStyle(
                color: AppColors.textPrimary,
                fontSize: 14,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildTransactionHistory(UserProvider provider) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Transaction History',
                style: TextStyle(
                  color: AppColors.textPrimary,
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                ),
              ),
              TextButton(
                onPressed: () {},
                child: Text(
                  'View All',
                  style: TextStyle(color: AppColors.primary),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.all(32),
            decoration: BoxDecoration(
              color: AppColors.cardDark,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Center(
              child: Column(
                children: [
                  Icon(
                    Icons.receipt_long_outlined,
                    size: 48,
                    color: AppColors.textSecondary,
                  ),
                  const SizedBox(height: 12),
                  Text(
                    'No Transaction History',
                    style: TextStyle(
                      color: AppColors.textSecondary,
                      fontSize: 14,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  String _formatDate(DateTime date) {
    return '${date.year}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')} '
        '${date.hour.toString().padLeft(2, '0')}:${date.minute.toString().padLeft(2, '0')}';
  }
}
