import 'package:flutter/material.dart';
import '../constants/app_constants.dart';
import '../services/storage_service.dart';
import '../services/api_service.dart';
import '../services/admob_service.dart';
import '../services/push_notification_service.dart';
import '../widgets/referral_success_dialog.dart';
import 'dashboard_screen.dart';
import 'wallet_screen.dart';
import 'referral_screen.dart';
import 'contracts_screen.dart';
import 'settings_screen.dart';
import 'guide_screen.dart';

/// 主屏幕 - 对应MainActivity.kt
class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> with WidgetsBindingObserver {
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

    // 登录后补传 FCM token（initialize() 在用户未登录时可能跳过了上报）
    PushNotificationService.reUploadToken();

    // 注册推送回调：收到「好友接受邀请」前台推送时弹出邀请方庆祝弹窗
    PushNotificationService.onInvitationAccepted = () {
      if (mounted) {
        // 同步累加本地已见数量，防止后台恢复时重复弹窗
        final current = _storageService.getSeenInviteRewardCount();
        _storageService.setSeenInviteRewardCount(current + 1);
        _showReferrerCelebration();
      }
    };

    // 登录时绑定邀请码成功：延迟弹出被邀请方庆祝弹窗
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_storageService.consumePendingReferralSuccessDialog()) {
        _showRefereeCelebration();
      } else if (_storageService.isFirstLaunch()) {
        // 首次打开 App：延迟 300ms 待页面渲染完成后弹出使用指南
        Future.delayed(const Duration(milliseconds: 300), () {
          if (!mounted) return;
          _storageService.setLaunched();
          Navigator.of(context).push(MaterialPageRoute(
            builder: (_) => const GuideScreen(autoShow: true),
            fullscreenDialog: true,
          ));
        });
      } else {
        // 冷启动兜底检测：FCM 推送未触发时（App 被杀死、通知权限关闭等），
        // 仍能在打开 App 时检测到新邀请绑定并弹出邀请方庆祝弹窗。
        // 延迟 1s 确保页面渲染完成、网络就绪后再查询。
        Future.delayed(const Duration(milliseconds: 1000), () {
          if (!mounted) return;
          _checkPendingInviteCelebration();
        });
      }
    });

    // 注册生命周期观察，用于后台恢复时检测新邀请绑定
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  /// 生命周期回调：App 从后台恢复到前台时检测是否有新邀请绑定
  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      // 延迟 1.5s 再检测：手机从后台唤醒时网络接口需要约 1-2s 才能就绪，
      // 若立即请求极易因连接错误而静默失败，且此后没有重试入口，导致庆祝弹窗永远不出现。
      // （冷启动路径已有 1s 延迟，这里与其保持同等保护级别）
      Future.delayed(const Duration(milliseconds: 1500), () {
        if (!mounted) return;
        _checkPendingInviteCelebration();
      });
    }
  }

  /// 查询服务端累计邀请数，若多于本地已记录数则弹推荐人庆祝弹窗
  /// [_retry]：是否已经是第一次重试（内部使用，避免无限递归）
  Future<void> _checkPendingInviteCelebration({bool isRetry = false}) async {
    try {
      final userId = _storageService.getUserId();
      if (userId == null || userId.isEmpty) return;

      final response = await _apiService.getMyContracts(userId);
      if (response['success'] != true) return;

      final inviteFriendReward = response['data']?['inviteFriendReward'];
      if (inviteFriendReward == null) return;

      final serverCount = (inviteFriendReward['count'] as num?)?.toInt() ?? 0;
      final seenCount = _storageService.getSeenInviteRewardCount();

      if (serverCount > seenCount) {
        // 先检查 mounted 再更新 seenCount 并弹窗。
        // 旧逻辑先 setSeenInviteRewardCount 再检查 mounted，若 mounted=false 则
        // seenCount 已更新为最新值但弹窗从未显示，导致下次检测时 serverCount==seenCount
        // 而永远不再触发庆祝弹窗（race condition bug）。
        if (mounted) {
          await _storageService.setSeenInviteRewardCount(serverCount);
          _showReferrerCelebration();
        }
      }
    } catch (_) {
      // 网络错误时重试一次（3s 后）：手机从后台恢复时网络可能短暂不可用，
      // 首次检测失败后若不重试，庆祝弹窗将永远不会出现。
      if (!isRetry) {
        await Future.delayed(const Duration(seconds: 3));
        if (mounted) _checkPendingInviteCelebration(isRetry: true);
      }
    }
  }

  /// 被邀请方庆祝弹窗（登录时绑定邀请码接入）
  void _showRefereeCelebration() {
    if (!mounted) return;
    ReferralSuccessDialog.show(
      context,
      role: ReferralRole.referree,
      onClose: () {
        // 自动切换到 Contracts 页面让用户看到新合约
        switchToTab(1);
      },
    );
  }

  /// 邀请方庆祝弹窗（前台收到 FCM 推送）
  void _showReferrerCelebration() {
    if (!mounted) return;
    ReferralSuccessDialog.show(
      context,
      role: ReferralRole.referrer,
    );
  }
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
