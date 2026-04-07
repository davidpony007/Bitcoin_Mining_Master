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
    // 延迟显示欢迎弹窗，确保界面已加载
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _showWelcomeDialogIfNeeded();
    });
  }

  Future<void> _showWelcomeDialogIfNeeded() async {
    // 注意：不要在这里调用 setLaunched()，让 WelcomeDialog.showIfFirstTime 内部处理。
    // 若先调用 setLaunched() 再调 showIfFirstTime，后者检查 isFirstLaunch()=false 会直接跳过，
    // 导致欢迎弹窗永远不显示。
    if (mounted) {
      WelcomeDialog.showIfFirstTime(context, _handleReferrerCode);
    }
  }

  Future<void> _handleReferrerCode(String? referrerCode) async {
    if (referrerCode == null || referrerCode.isEmpty) {
      return;
    }

    try {
      final userId = _storageService.getUserId();
      if (userId == null || userId.isEmpty) {
        // 用户ID还未生成，将邀请码暂存到本地，待用户ID生成后在 Referral 页面可手动绑定
        // 同时持久化邀请码，避免丢失
        await _storageService.saveInvitationCode(referrerCode);
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Invitation code saved. Please go to the Referral page to complete binding.'),
              backgroundColor: Colors.orange,
              duration: Duration(seconds: 5),
            ),
          );
        }
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
