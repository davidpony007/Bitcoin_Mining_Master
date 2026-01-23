import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'dart:async';
import '../providers/user_provider.dart';
import '../constants/app_constants.dart';
import '../services/api_service.dart';
import '../services/storage_service.dart';
import '../models/user_model.dart';
import 'withdrawal_screen.dart';

/// 钱包屏幕 - 对应WalletFragment.kt
class WalletScreen extends StatefulWidget {
  const WalletScreen({super.key});

  @override
  State<WalletScreen> createState() => _WalletScreenState();
}

class _WalletScreenState extends State<WalletScreen>
    with SingleTickerProviderStateMixin {
  late AnimationController _animationController;
  late Animation<double> _scaleAnimation;
  final _apiService = ApiService();
  final _storageService = StorageService();
  bool _hasActiveContract = false;
  String _previousBalance = '0.000000000000000';
  String _bitcoinPrice = '\$88,911.78 USD';
  Timer? _priceUpdateTimer;

  @override
  void initState() {
    super.initState();

    // 初始化跳动动画控制器
    _animationController = AnimationController(
      duration: const Duration(milliseconds: 800),
      vsync: this,
    );

    _scaleAnimation = TweenSequence<double>([
      TweenSequenceItem(
        tween: Tween<double>(
          begin: 1.0,
          end: 1.15,
        ).chain(CurveTween(curve: Curves.easeOut)),
        weight: 50,
      ),
      TweenSequenceItem(
        tween: Tween<double>(
          begin: 1.15,
          end: 1.0,
        ).chain(CurveTween(curve: Curves.easeIn)),
        weight: 50,
      ),
    ]).animate(_animationController);

    // 加载交易记录和检查活跃合约
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<UserProvider>().fetchTransactions();
      _checkActiveContracts();
      _loadBitcoinPrice();
      _startPriceUpdateTimer();
    });

    // 监听余额变化
    _previousBalance = context.read<UserProvider>().bitcoinBalance;
  }

  @override
  void dispose() {
    _animationController.dispose();
    _priceUpdateTimer?.cancel();
    super.dispose();
  }

  /// 加载比特币价格
  Future<void> _loadBitcoinPrice() async {
    try {
      final response = await _apiService.getBitcoinPrice();
      if (response['success'] == true && response['data'] != null) {
        setState(() {
          _bitcoinPrice = response['data']['formatted'] ?? '\$88,911.78 USD';
        });
        print('💰 钱包: 比特币价格更新: $_bitcoinPrice');
      }
    } catch (e) {
      print('❌ 钱包: 加载比特币价格失败: $e');
    }
  }

  /// 启动价格定时更新（每60分钟）
  void _startPriceUpdateTimer() {
    _priceUpdateTimer = Timer.periodic(const Duration(minutes: 60), (timer) {
      _loadBitcoinPrice();
    });
  }

  /// 检查用户是否有活跃的挖矿合约
  Future<void> _checkActiveContracts() async {
    try {
      final userId = _storageService.getUserId();
      if (userId == null || userId.isEmpty) return;

      final response = await _apiService.checkActiveContracts(userId);
      if (response['success'] == true && response['data'] != null) {
        setState(() {
          _hasActiveContract = response['data']['hasActiveContract'] ?? false;
        });
      }
    } catch (e) {
      print('检查活跃合约失败: $e');
    }
  }

  /// 触发余额跳动动画
  void _triggerBalanceAnimation(String newBalance) {
    // 仅在有活跃合约且余额发生变化时触发动画
    if (_hasActiveContract && newBalance != _previousBalance) {
      _animationController.forward(from: 0.0);
      _previousBalance = newBalance;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(title: const Text('Wallet')),
      body: Consumer<UserProvider>(
        builder: (context, userProvider, child) {
          // 检查余额变化并触发动画
          WidgetsBinding.instance.addPostFrameCallback((_) {
            _triggerBalanceAnimation(userProvider.bitcoinBalance);
          });

          return RefreshIndicator(
            onRefresh: () async {
              await userProvider.fetchBitcoinBalance();
              await userProvider.fetchTransactions();
              await _checkActiveContracts();
            },
            child: SingleChildScrollView(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const SizedBox(height: 16),

                  // Balance Card
                  _buildBalanceSection(userProvider),

                  const SizedBox(height: 20),

                  // Action Buttons
                  _buildActionButtons(),

                  const SizedBox(height: 24),

                  // Transaction Records
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
          colors: [AppColors.primary, AppColors.secondary],
        ),
        borderRadius: BorderRadius.circular(16),
      ),
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Total Balance',
            style: TextStyle(color: Colors.white70, fontSize: 14),
          ),
          const SizedBox(height: 8),
          AnimatedBuilder(
            animation: _scaleAnimation,
            builder: (context, child) {
              return Transform.scale(
                scale: _scaleAnimation.value,
                child: Text(
                  '${double.tryParse(provider.bitcoinBalance)?.toStringAsFixed(15) ?? '0.000000000000000'} BTC',
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 20,
                    fontWeight: FontWeight.bold,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              );
            },
          ),
          const SizedBox(height: 4),
          Text(
            '1 BTC = $_bitcoinPrice',
            style: const TextStyle(color: Colors.white70, fontSize: 16),
          ),
        ],
      ),
    );
  }

  /// 构建操作按钮
  Widget _buildActionButtons() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: ElevatedButton(
        onPressed: () {
          Navigator.push(
            context,
            MaterialPageRoute(builder: (context) => const WithdrawalScreen()),
          );
        },
        style: ElevatedButton.styleFrom(
          backgroundColor: const Color(0xFF4CAF50),
          foregroundColor: Colors.white,
          padding: const EdgeInsets.symmetric(vertical: 16),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
          elevation: 0,
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: const [
            Icon(Icons.arrow_upward, size: 20),
            SizedBox(width: 8),
            Text(
              'Withdraw',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildTransactionHistory(UserProvider provider) {
    final transactions = provider.transactions;
    
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Transaction Records',
                style: TextStyle(
                  color: AppColors.textPrimary,
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                ),
              ),
              TextButton(
                onPressed: transactions.isEmpty ? null : () {
                  // TODO: Navigate to full transaction history
                },
                child: Text(
                  'View All',
                  style: TextStyle(
                    color: transactions.isEmpty 
                        ? AppColors.textSecondary 
                        : AppColors.primary
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          transactions.isEmpty
              ? Container(
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
                          'No Transaction Records',
                          style: TextStyle(
                            color: AppColors.textSecondary,
                            fontSize: 14,
                          ),
                        ),
                      ],
                    ),
                  ),
                )
              : Column(
                  children: transactions.take(5).map((tx) {
                    return _buildTransactionItem(tx);
                  }).toList(),
                ),
        ],
      ),
    );
  }

  Widget _buildTransactionItem(Transaction tx) {
    // 根据交易类型确定图标和颜色
    IconData icon;
    Color iconColor;
    bool isPositive = true;

    switch (tx.type) {
      case 'withdrawal':
        icon = Icons.arrow_upward;
        iconColor = Colors.red;
        isPositive = false;
        break;
      case 'subordinate rebate':
        icon = Icons.people;
        iconColor = Colors.purple;
        break;
      case 'ad free contract':
      case 'daily sign-in free contract':
      case 'invitation free contract':
        icon = Icons.card_giftcard;
        iconColor = Colors.blue;
        break;
      case 'paid contract':
        icon = Icons.monetization_on;
        iconColor = Colors.amber;
        break;
      default:
        icon = Icons.attach_money;
        iconColor = AppColors.primary;
    }

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.cardDark,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: AppColors.textSecondary.withOpacity(0.1),
          width: 1,
        ),
      ),
      child: Row(
        children: [
          // Icon
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: iconColor.withOpacity(0.1),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Icon(
              icon,
              color: iconColor,
              size: 20,
            ),
          ),
          const SizedBox(width: 12),
          // Details
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  tx.typeLabel,
                  style: TextStyle(
                    color: AppColors.textPrimary,
                    fontSize: 14,
                    fontWeight: FontWeight.w500,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  _formatDate(tx.createdAt),
                  style: TextStyle(
                    color: AppColors.textSecondary,
                    fontSize: 12,
                  ),
                ),
              ],
            ),
          ),
          // Amount
          Text(
            '${isPositive ? '+' : '-'}${tx.amount.toStringAsFixed(8)} BTC',
            style: TextStyle(
              color: isPositive ? AppColors.primary : Colors.red,
              fontSize: 14,
              fontWeight: FontWeight.bold,
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
