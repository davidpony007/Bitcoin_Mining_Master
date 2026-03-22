import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'dart:async';
import '../providers/user_provider.dart';
import '../constants/app_constants.dart';
import '../services/api_service.dart';
import '../services/storage_service.dart';
import '../models/user_model.dart';
import 'withdrawal_screen.dart';
import 'transaction_history_screen.dart';

/// 钱包屏幕 - 对应WalletFragment.kt
class WalletScreen extends StatefulWidget {
  const WalletScreen({super.key});

  @override
  State<WalletScreen> createState() => WalletScreenState();
}

class WalletScreenState extends State<WalletScreen>
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

  /// 公共方法：切换到 Wallet tab 时刷新数据（由HomeScreen调用）
  Future<void> refreshData() async {
    if (!mounted) return;
    await Future.wait([
      context.read<UserProvider>().fetchTransactions(),
      _checkActiveContracts(),
    ]);
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
      appBar: AppBar(title: const Text('Wallet'), centerTitle: false),
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
        onPressed: () async {
          // 封禁用户不允许进入提现页面
          if (StorageService().isBanned()) {
            if (!mounted) return;
            showDialog(
              context: context,
              builder: (ctx) => AlertDialog(
                backgroundColor: AppColors.cardDark,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                title: const Row(
                  children: [
                    Icon(Icons.block, color: Color(0xFFB71C1C), size: 22),
                    SizedBox(width: 8),
                    Text(
                      'Account Disabled',
                      style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 18),
                    ),
                  ],
                ),
                content: const Text(
                  'Your account has been disabled. Please contact support to reactivate your account before making a withdrawal.',
                  style: TextStyle(color: Color(0xFFB0B0B0), fontSize: 14, height: 1.5),
                ),
                actions: [
                  ElevatedButton(
                    onPressed: () => Navigator.pop(ctx),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.primary,
                      foregroundColor: Colors.black,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                    ),
                    child: const Text('OK', style: TextStyle(fontWeight: FontWeight.bold)),
                  ),
                ],
              ),
            );
            return;
          }
          await Navigator.push(
            context,
            MaterialPageRoute(builder: (context) => const WithdrawalScreen()),
          );
          if (mounted) {
            context.read<UserProvider>().fetchTransactions();
          }
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
              const SizedBox(width: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: AppColors.primary.withOpacity(0.15),
                  borderRadius: BorderRadius.circular(4),
                ),
                child: Text(
                  'Last 3 Days',
                  style: TextStyle(
                    color: AppColors.primary,
                    fontSize: 11,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ),
              GestureDetector(
                behavior: HitTestBehavior.opaque,
                onTap: () {
                  Navigator.of(context).push(
                    MaterialPageRoute(
                      builder: (_) => const TransactionHistoryScreen(),
                    ),
                  );
                },
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  child: Text(
                    'View All',
                    style: const TextStyle(
                      color: Color(0xFFFF9800),
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Container(
                height: 320,
                decoration: BoxDecoration(
                  color: AppColors.cardDark,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(
                    color: AppColors.textSecondary.withOpacity(0.1),
                    width: 1,
                  ),
                ),
                child: transactions.isEmpty
                    ? Center(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
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
                      )
                    : ClipRRect(
                        borderRadius: BorderRadius.circular(16),
                        child: ListView.separated(
                          padding: EdgeInsets.zero,
                          itemCount: transactions.take(5).length,
                          separatorBuilder: (_, __) => Divider(
                            height: 1,
                            thickness: 0.5,
                            color: AppColors.textSecondary.withOpacity(0.15),
                            indent: 68,
                            endIndent: 16,
                          ),
                          itemBuilder: (context, i) {
                            final items = transactions.take(5).toList();
                            return _buildTransactionItem(items[i],
                                isFirst: i == 0,
                                isLast: i == items.length - 1);
                          },
                        ),
                      ),
              ),
        ],
      ),
    );
  }

  Widget _buildTransactionItem(Transaction tx, {bool isFirst = false, bool isLast = false}) {
    // 根据交易类型确定图标和颜色
    IconData icon;
    Color iconColor;
    Color iconBgColor;
    bool isPositive = true;

    switch (tx.type) {
      case 'withdrawal':
        icon = Icons.arrow_upward;
        iconColor = Colors.white;
        iconBgColor = const Color(0xFF4CAF50);
        isPositive = false;
        break;
      case 'subordinate rebate':
        icon = Icons.people;
        iconColor = Colors.green;
        iconBgColor = Colors.orange;
        break;
      case 'Free Ad Reward':
        icon = Icons.play_arrow;
        iconColor = Colors.white;
        iconBgColor = Colors.orange;
        break;
      case 'Daily Check-in Reward':
        icon = Icons.card_giftcard;
        iconColor = Colors.black;
        iconBgColor = Colors.yellow;
        break;
      case 'Invite Friend Reward':
      case 'Bind Referrer Reward':
        icon = Icons.card_giftcard;
        iconColor = Colors.blue;
        iconBgColor = Colors.blue.withOpacity(0.1);
        break;
      case 'contract_4.99':
      case 'contract_6.99':
      case 'contract_9.99':
      case 'contract_19.99':
        icon = Icons.monetization_on;
        iconColor = Colors.amber;
        iconBgColor = Colors.amber.withOpacity(0.1);
        break;
      default:
        icon = Icons.attach_money;
        iconColor = AppColors.primary;
        iconBgColor = AppColors.primary.withOpacity(0.1);
    }

    return Padding(
      padding: EdgeInsets.fromLTRB(16, isFirst ? 14 : 12, 16, isLast ? 14 : 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Icon
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: iconBgColor,
              borderRadius: BorderRadius.circular(8),
            ),
            child: Icon(icon, color: iconColor, size: 20),
          ),
          const SizedBox(width: 12),
          // Details: 全宽多行布局
          Expanded(
            child: tx.type == 'subordinate rebate'
                // subordinate rebate: 4行（标签/From:userId/时间戳/BTC）
                ? Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        tx.typeLabel,
                        style: const TextStyle(
                          color: AppColors.textPrimary,
                          fontSize: 14,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                      if (tx.description != null &&
                          tx.description!.startsWith('From: ')) ...[
                        const SizedBox(height: 4),
                        Text(
                          'From: ${tx.description!.substring(6)}',
                          style: const TextStyle(
                            color: Color(0xFF64B5F6),
                            fontSize: 12,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ],
                      const SizedBox(height: 4),
                      Text(
                        _formatDate(tx.createdAt),
                        style: const TextStyle(
                          color: AppColors.textSecondary,
                          fontSize: 12,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        '${isPositive ? '+' : '-'}${tx.amount.toStringAsFixed(18)} BTC',
                        style: TextStyle(
                          color: isPositive ? AppColors.primary : Colors.red,
                          fontSize: 12,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ],
                  )
                // 其他类型: 3行（标签/时间戳/BTC）
                : Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        tx.typeLabel,
                        style: const TextStyle(
                          color: AppColors.textPrimary,
                          fontSize: 14,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        _formatDate(tx.createdAt),
                        style: const TextStyle(
                          color: AppColors.textSecondary,
                          fontSize: 12,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        '${isPositive ? '+' : '-'}${tx.amount.toStringAsFixed(18)} BTC',
                        style: TextStyle(
                          color: isPositive ? AppColors.primary : Colors.red,
                          fontSize: 12,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ],
                  ),
          ),
        ],
      ),
    );
  }

  String _formatDate(DateTime date) {
    final utcDate = date.toUtc();
    return '${utcDate.year}-${utcDate.month.toString().padLeft(2, '0')}-${utcDate.day.toString().padLeft(2, '0')} '
        '${utcDate.hour.toString().padLeft(2, '0')}:${utcDate.minute.toString().padLeft(2, '0')} UTC';
  }
}
