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

    // 初始化余额数字递增动画控制器
    _animationController = AnimationController(
      duration: const Duration(milliseconds: 1500),
      vsync: this,
    );

    // 初始化为0，稍后会在_triggerBalanceBounce中设置正确的Tween
    _scaleAnimation = Tween<double>(begin: 0.0, end: 0.0)
        .animate(CurvedAnimation(
          parent: _animationController,
          curve: Curves.easeOutCubic,
        ));

    // 加载交易记录和检查活跃合约
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      await context.read<UserProvider>().fetchTransactions();
      await _checkActiveContracts();
      await _loadBitcoinPrice();
      _startPriceUpdateTimer();
    });

    // 监听余额变化
    _previousBalance = context.read<UserProvider>().bitcoinBalance;
  }

  /// 公共方法：手动刷新余额（由HomeScreen调用）
  Future<void> refreshBalance() async {
    if (!mounted) return;
    final prevBalance = context.read<UserProvider>().bitcoinBalance;
    await context.read<UserProvider>().fetchBitcoinBalance();
    final newBalance = context.read<UserProvider>().bitcoinBalance;
    if (prevBalance != newBalance) {
      _triggerBalanceBounce();
    }
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

  /// 触发余额数字递增动画
  void _triggerBalanceBounce() {
    if (!mounted) return;
    final currentBalanceStr = context.read<UserProvider>().bitcoinBalance;
    final currentBalance = double.tryParse(currentBalanceStr) ?? 0.0;
    final previousBalance = double.tryParse(_previousBalance) ?? 0.0;
    
    if (currentBalance != previousBalance) {
      // 创建从旧值到新值的数字递增动画
      _scaleAnimation = Tween<double>(
        begin: previousBalance,
        end: currentBalance,
      ).animate(CurvedAnimation(
        parent: _animationController,
        curve: Curves.easeOutCubic,
      ));
      
      _previousBalance = currentBalanceStr;
      _animationController.forward(from: 0.0);
      print('💰 Wallet: 余额从 ${previousBalance.toStringAsFixed(15)} 递增到 ${currentBalance.toStringAsFixed(15)}');
    } else if (_previousBalance == '0.000000000000000') {
      // 首次加载，直接显示当前值
      _scaleAnimation = Tween<double>(
        begin: currentBalance,
        end: currentBalance,
      ).animate(CurvedAnimation(
        parent: _animationController,
        curve: Curves.easeOutCubic,
      ));
      _previousBalance = currentBalanceStr;
      _animationController.value = 1.0;
      print('💰 Wallet: 首次加载余额 ${currentBalance.toStringAsFixed(15)}');
    }
  }

  /// 检查用户是否有活跃的挖矿合约
  Future<void> _checkActiveContracts() async {
    try {
      final userId = _storageService.getUserId();
      if (userId == null || userId.isEmpty) return;

      final response = await _apiService.checkActiveContracts(userId);
      if (response['success'] == true && response['data'] != null) {
        final hasActiveContract = response['data']['hasActiveContract'] ?? false;
        if (mounted) {
          setState(() {
            _hasActiveContract = hasActiveContract;
          });
        }
      }
    } catch (e) {
      print('Failed to check active contracts: $e');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(title: const Text('Wallet')),
      body: Consumer<UserProvider>(
        builder: (context, userProvider, child) {
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
    // 直接使用provider的余额，不依赖动画
    final balance = double.tryParse(provider.bitcoinBalance) ?? 0.0;
    
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
          Text(
            '${balance.toStringAsFixed(15)} BTC',
            style: const TextStyle(
              color: Colors.white,
              fontSize: 20,
              fontWeight: FontWeight.bold,
            ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
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
      case 'Free Ad Reward':
      case 'Daily Check-in Reward':
      case 'Invite Friend Reward':
      case 'Bind Referrer Reward':
        icon = Icons.card_giftcard;
        iconColor = Colors.blue;
        break;
      case 'contract_4.99':
      case 'contract_6.99':
      case 'contract_9.99':
      case 'contract_19.99':
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
