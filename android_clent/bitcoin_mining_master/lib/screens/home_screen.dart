import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../constants/app_constants.dart';
import '../services/storage_service.dart';
import '../services/api_service.dart';
import '../widgets/welcome_dialog.dart';
import '../providers/user_provider.dart';
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

  @override
  void initState() {
    super.initState();
    // 延迟显示欢迎弹窗，确保界面已加载
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _showWelcomeDialogIfNeeded();
    });
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

  // 所有屏幕页面
  final List<Widget> _screens = [
    const DashboardScreen(),
    const ContractsScreen(),
    const ReferralScreen(),
    const WalletScreen(),
    const SettingsScreen(),
  ];

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
            
            // 当切换到Mining页面(index=0)或钱包页面(index=3)时，刷新余额
            if ((index == 0 || index == 3) && mounted) {
              context.read<UserProvider>().fetchBitcoinBalance();
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
