import 'dart:async';
import 'package:flutter/material.dart';
import '../constants/app_constants.dart';
import '../services/storage_service.dart';
import '../services/api_service.dart';
import '../services/admob_service.dart';
import '../widgets/welcome_dialog.dart';
import 'dashboard_screen.dart';
import 'wallet_screen.dart';
import 'referral_screen.dart';
import 'contracts_screen.dart';
import 'settings_screen.dart';

/// 主屏幕 - 对应MainActivity.kt
class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  int _currentIndex = 0;
  final _storageService = StorageService();
  final _apiService = ApiService();

  // 账户封禁状态（全局轮询）
  bool _isBanned = false;
  Timer? _banPollTimer;

  // ContractsScreen 的 GlobalKey，用于在奖励领取后立即触发刷新
  final _contractsKey = GlobalKey<ContractsScreenState>();

  // ReferralScreen 的 GlobalKey，用于切换到 tab 时刷新邀请列表
  final _referralKey = GlobalKey<ReferralScreenState>();

  // 稳定的页面列表，避免每次 build 重建实例导致 GlobalKey 失效
  late final List<Widget> _screens;

  @override
  void initState() {
    super.initState();
    // 稳定建立页面列表（必须在 initState 中，不能用 getter）
    _screens = [
      DashboardScreen(
        onSwitchTab: switchToTab,
        onContractRefreshNeeded: () =>
            _contractsKey.currentState?.refreshContracts(),
        onAdRewardClaimed: () =>
            _contractsKey.currentState?.activateAdRewardImmediately(),
      ),
      ContractsScreen(key: _contractsKey),
      ReferralScreen(
        key: _referralKey,
        onContractRefreshNeeded: () =>
            _contractsKey.currentState?.refreshContracts(),
      ),
      const WalletScreen(),
      const SettingsScreen(),
    ];
    // 预加载广告
    AdMobService().loadRewardedAd();
    // 启动封禁状态全局轮询
    _startBanPolling();
    // 延迟显示欢迎弹窗，确保界面已加载
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _showWelcomeDialogIfNeeded();
    });
  }

  /// 启动封禁状态全局轮询（每 30 秒检查一次）
  void _startBanPolling() {
    final userId = _storageService.getUserId();
    if (userId == null || userId.isEmpty) return;
    _checkBanStatus(userId);
    _banPollTimer = Timer.periodic(const Duration(seconds: 30), (_) {
      _checkBanStatus(userId);
    });
  }

  Future<void> _checkBanStatus(String userId) async {
    try {
      final response = await _apiService.checkBanStatus(userId);
      if (response['success'] == true && response['data'] != null) {
        final isBanned = response['data']['isBanned'] == true;
        await _storageService.saveBanStatus(isBanned);
        if (mounted && isBanned != _isBanned) {
          setState(() {
            _isBanned = isBanned;
          });
        }
      }
    } catch (_) {
      // 网络失败时静默忽略，使用上次缓存值
    }
  }

  Future<void> _showWelcomeDialogIfNeeded() async {
    final isFirstLaunch = _storageService.isFirstLaunch();
    if (isFirstLaunch) {
      await _storageService.setLaunched();
      if (mounted) {
        WelcomeDialog.showIfFirstTime(context, _handleReferrerCode);
      }
    }
  }

  Future<void> _handleReferrerCode(String? referrerCode) async {
    if (referrerCode == null || referrerCode.isEmpty) {
      return;
    }

    try {
      final userId = _storageService.getUserId();
      if (userId == null || userId.isEmpty) {
        // 用户ID还未生成，等待Settings页面生成后再处理
        // 可以保存到临时存储，在用户ID生成后再绑定
        return;
      }

      // 绑定推荐人
      final response = await _apiService.addReferrer(
        userId: userId,
        referrerInvitationCode: referrerCode,
      );

      if (response['success'] == true) {
        // 创建免费广告合约
        final contractResponse = await _apiService.createAdFreeContract(
          userId: userId,
        );

        if (mounted && contractResponse['success'] == true) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Referrer added! You got a free mining contract!'),
              backgroundColor: Colors.green,
            ),
          );
        }
      }
    } catch (e) {
      print('Error handling referrer code: $e');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to add referrer: $e'),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }

  @override
  void dispose() {
    _banPollTimer?.cancel();
    super.dispose();
  }

  // 所有屏幕页面已在 initState 中初始化
  // 底部导航栏项目
  final List<BottomNavigationBarItem> _navigationItems = const [
    BottomNavigationBarItem(
      icon: Icon(Icons.dashboard),
      label: 'Mining',
    ),
    BottomNavigationBarItem(
      icon: Icon(Icons.assignment),
      label: 'Contracts',
    ),
    BottomNavigationBarItem(
      icon: Icon(Icons.share),
      label: 'Referral',
    ),
    BottomNavigationBarItem(
      icon: Icon(Icons.account_balance_wallet),
      label: 'Wallet',
    ),
    BottomNavigationBarItem(
      icon: Icon(Icons.settings),
      label: 'Settings',
    ),
  ];
  // 📌 切换到指定标签的方法（供子页面调用）
  void switchToTab(int index) {
    if (index >= 0 && index < _screens.length && mounted) {
      setState(() {
        _currentIndex = index;
      });
      // 切换到 Referral tab (index=2) 时刷新邀请好友列表
      if (index == 2) {
        _referralKey.currentState?.refreshInvitedFriends();
      }
    }
  }
  /// 封禁横幅覆盖层（显示在所有页面顶部）
  Widget _buildBanOverlay() {
    return Positioned(
      top: 0,
      left: 0,
      right: 0,
      child: SafeArea(
        child: Container(
          margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          decoration: BoxDecoration(
            color: const Color(0xFFB71C1C),
            borderRadius: BorderRadius.circular(12),
            boxShadow: const [
              BoxShadow(color: Colors.black45, blurRadius: 8, offset: Offset(0, 2)),
            ],
          ),
          child: const Row(
            children: [
              Icon(Icons.block, color: Colors.white, size: 18),
              SizedBox(width: 8),
              Expanded(
                child: Text(
                  'Account Disabled — Withdrawals are suspended. Go to Settings for details.',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    height: 1.4,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
    Scaffold(
      body: IndexedStack(
        index: _currentIndex,
        children: _screens,
      ),
      bottomNavigationBar: Container(
        decoration: BoxDecoration(
          color: AppColors.surface,
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.3),
              blurRadius: 10,
              offset: const Offset(0, -2),
            ),
          ],
        ),
        child: BottomNavigationBar(
          currentIndex: _currentIndex,
          onTap: (index) {
            setState(() {
              _currentIndex = index;
            });
            // 切换到 Referral tab (index=2) 时刷新邀请好友列表
            if (index == 2) {
              _referralKey.currentState?.refreshInvitedFriends();
            }
          },
          items: _navigationItems,
          backgroundColor: Colors.transparent,
          selectedItemColor: AppColors.primary,
          unselectedItemColor: AppColors.textSecondary,
          type: BottomNavigationBarType.fixed,
          elevation: 0,
        ),
      ),
    ),
        if (_isBanned) _buildBanOverlay(),
      ],
    );
  }
}
