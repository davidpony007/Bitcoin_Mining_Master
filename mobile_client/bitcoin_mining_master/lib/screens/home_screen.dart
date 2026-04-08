import 'package:flutter/material.dart';
import '../constants/app_constants.dart';
import '../services/storage_service.dart';
import '../services/api_service.dart';
import '../services/admob_service.dart';
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

  // ContractsScreen 的 GlobalKey，用于在奖励领取后立即触发刷新
  final _contractsKey = GlobalKey<ContractsScreenState>();

  // ReferralScreen 的 GlobalKey，用于切换到 tab 时刷新邀请列表
  final _referralKey = GlobalKey<ReferralScreenState>();

  // WalletScreen 的 GlobalKey，用于切换到 tab 时刷新交易记录
  final _walletKey = GlobalKey<WalletScreenState>();

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
      WalletScreen(key: _walletKey),
      const SettingsScreen(),
    ];
    // 预加载广告
    AdMobService().loadRewardedAd();
  }
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
      // 切换到 Wallet tab (index=3) 时刷新交易记录和合约状态
      if (index == 3) {
        _walletKey.currentState?.refreshData();
      }
      // 切换到 Contracts tab (index=1) 时刷新合约数据
      if (index == 1) {
        _contractsKey.currentState?.refreshContracts();
      }
    }
  }
  @override
  Widget build(BuildContext context) {
    return Scaffold(
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
            // 切换到 Wallet tab (index=3) 时刷新交易记录和合约状态
            if (index == 3) {
              _walletKey.currentState?.refreshData();
            }
            // 切换到 Contracts tab (index=1) 时刷新合约数据
            if (index == 1) {
              _contractsKey.currentState?.refreshContracts();
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
    );
  }
}
