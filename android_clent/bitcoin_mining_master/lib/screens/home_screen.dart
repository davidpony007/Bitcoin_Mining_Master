import 'package:flutter/material.dart';
import '../constants/app_constants.dart';
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

  // 所有屏幕页面
  final List<Widget> _screens = [
    const DashboardScreen(),
    const WalletScreen(),
    const ReferralScreen(),
    const ContractsScreen(),
    const SettingsScreen(),
  ];

  // 底部导航栏项目
  final List<BottomNavigationBarItem> _navigationItems = const [
    BottomNavigationBarItem(
      icon: Icon(Icons.dashboard),
      label: '挖矿',
    ),
    BottomNavigationBarItem(
      icon: Icon(Icons.account_balance_wallet),
      label: '钱包',
    ),
    BottomNavigationBarItem(
      icon: Icon(Icons.share),
      label: '推荐',
    ),
    BottomNavigationBarItem(
      icon: Icon(Icons.assignment),
      label: '合约',
    ),
    BottomNavigationBarItem(
      icon: Icon(Icons.settings),
      label: '设置',
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
