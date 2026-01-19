import 'package:flutter/material.dart';
import 'dart:async';
import '../constants/app_constants.dart';
import '../services/storage_service.dart';
import '../services/api_service.dart';
import 'paid_contracts_screen.dart';

/// 合约屏幕 - Contracts with tabs 
class ContractsScreen extends StatefulWidget {
  const ContractsScreen({super.key});

  @override
  State<ContractsScreen> createState() => _ContractsScreenState();
}

class _ContractsScreenState extends State<ContractsScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;
  final _storageService = StorageService();
  final _apiService = ApiService();
  
  // 合约状态
  bool _isLoadingContracts = true;
  bool _isDailyCheckInActive = false;
  bool _isAdRewardActive = false;
  int _dailyCheckInRemainingSeconds = 0;
  int _adRewardRemainingSeconds = 0;
  Timer? _contractTimer;
  Timer? _refreshTimer;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _loadContracts();
    
    // 每秒更新倒计时
    _contractTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      setState(() {
        if (_dailyCheckInRemainingSeconds > 0) {
          _dailyCheckInRemainingSeconds--;
        } else {
          _isDailyCheckInActive = false;
        }
        
        if (_adRewardRemainingSeconds > 0) {
          _adRewardRemainingSeconds--;
        } else {
          _isAdRewardActive = false;
        }
      });
    });
    
    // 每30秒刷新一次合约数据（防止时间漂移）
    _refreshTimer = Timer.periodic(const Duration(seconds: 30), (timer) {
      _loadContracts();
    });
  }

  @override
  void dispose() {
    _tabController.dispose();
    _contractTimer?.cancel();
    _refreshTimer?.cancel();
    super.dispose();
  }
  
  Future<void> _loadContracts() async {
    try {
      final userId = _storageService.getUserId();
      if (userId == null || userId.isEmpty) {
        setState(() {
          _isLoadingContracts = false;
        });
        return;
      }

      print('📝 加载合约数据 - userId: $userId');
      final response = await _apiService.getMyContracts(userId);
      print('📦 API响应: $response');
      
      if (response['success'] == true && response['data'] != null) {
        final data = response['data'];
        
        print('✅ Daily Check-in: ${data['dailyCheckIn']}');
        print('✅ Ad Reward: ${data['adReward']}');
        
        setState(() {
          // Daily Check-in状态
          _isDailyCheckInActive = data['dailyCheckIn']['isActive'] == true;
          _dailyCheckInRemainingSeconds = data['dailyCheckIn']['remainingSeconds'] ?? 0;
          
          // Ad Reward状态
          _isAdRewardActive = data['adReward']['isActive'] == true;
          _adRewardRemainingSeconds = data['adReward']['remainingSeconds'] ?? 0;
          
          _isLoadingContracts = false;
        });
        
        print('🔄 状态更新: Daily=${_isDailyCheckInActive}, Ad=${_isAdRewardActive}');
      } else {
        print('❌ API响应失败或数据为空');
        setState(() {
          _isLoadingContracts = false;
        });
      }
    } catch (e) {
      print('❌ 加载合约失败: $e');
      setState(() {
        _isLoadingContracts = false;
      });
    }
  }
  
  String _formatDuration(int totalSeconds) {
    if (totalSeconds <= 0) return '00h 00m 00s';
    
    final hours = totalSeconds ~/ 3600;
    final minutes = (totalSeconds % 3600) ~/ 60;
    final seconds = totalSeconds % 60;
    
    return '${hours.toString().padLeft(2, '0')}h ${minutes.toString().padLeft(2, '0')}m ${seconds.toString().padLeft(2, '0')}s';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Contracts'),
        actions: [
          TextButton.icon(
            onPressed: () {
              Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (context) => const PaidContractsScreen(),
                ),
              );
            },
            icon: Icon(
              Icons.add_shopping_cart,
              color: AppColors.primary,
              size: 20,
            ),
            label: Text(
              'Buy Contract',
              style: TextStyle(
                color: AppColors.primary,
                fontSize: 14,
                fontWeight: FontWeight.w600,
              ),
            ),
            style: TextButton.styleFrom(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            ),
          ),
          const SizedBox(width: 8),
        ],
        bottom: TabBar(
          controller: _tabController,
          indicatorColor: AppColors.primary,
          labelColor: AppColors.primary,
          unselectedLabelColor: AppColors.textSecondary,
          tabs: const [
            Tab(text: 'All'),
            Tab(text: 'Expired'),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: [
          _buildAllTab(),
          _buildExpiredTab(),
        ],
      ),
    );
  }

  Widget _buildExpiredTab() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              Icons.inventory_2_outlined,
              size: 64,
              color: AppColors.textSecondary,
            ),
            const SizedBox(height: 16),
            Text(
              'No expired contracts',
              style: TextStyle(
                color: AppColors.textPrimary,
                fontSize: 18,
                fontWeight: FontWeight.w500,
              ),
            ),
          ],
        ),
      ),
    );
  }
  
  Widget _buildDailyCheckinCard() {
    final isActive = _isDailyCheckInActive && _dailyCheckInRemainingSeconds > 0;
    
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.cardDark,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: AppColors.primary.withOpacity(0.3),
          width: 1.5,
        ),
      ),
      child: Row(
        children: [
          // Bitcoin Icon
          Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(
              color: AppColors.primary.withOpacity(0.1),
              shape: BoxShape.circle,
            ),
            child: Icon(
              Icons.currency_bitcoin,
              color: AppColors.primary,
              size: 28,
            ),
          ),
          
          const SizedBox(width: 16),
          
          // Contract Info
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '7.5Gh/s',
                  style: TextStyle(
                    color: AppColors.textPrimary,
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  'Daily Check-in Reward',
                  style: TextStyle(
                    color: AppColors.textSecondary,
                    fontSize: 14,
                  ),
                ),
              ],
            ),
          ),
          
          // Status and Countdown
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              // Status Dot and Countdown
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    width: 10,
                    height: 10,
                    decoration: BoxDecoration(
                      color: isActive ? const Color(0xFF4CAF50) : const Color(0xFFF44336),
                      shape: BoxShape.circle,
                    ),
                  ),
                  if (isActive) ...[
                    const SizedBox(width: 8),
                    Text(
                      _formatDuration(_dailyCheckInRemainingSeconds),
                      style: const TextStyle(
                        color: Color(0xFF4CAF50),
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ],
              ),
              
              // Not Active Status (only show when not active)
              if (!isActive) ...[
                const SizedBox(height: 4),
                Text(
                  'Not Active',
                  style: TextStyle(
                    color: AppColors.textSecondary,
                    fontSize: 12,
                  ),
                ),
              ],
            ],
          ),
        ],
      ),
    );
  }
  
  Widget _buildAdMiningCard() {
    final isActive = _isAdRewardActive && _adRewardRemainingSeconds > 0;
    
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.cardDark,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: AppColors.primary.withOpacity(0.3),
          width: 1.5,
        ),
      ),
      child: Row(
        children: [
          // Bitcoin Icon
          Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(
              color: AppColors.primary.withOpacity(0.1),
              shape: BoxShape.circle,
            ),
            child: Icon(
              Icons.currency_bitcoin,
              color: AppColors.primary,
              size: 28,
            ),
          ),
          
          const SizedBox(width: 16),
          
          // Contract Info
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '5.5Gh/s',
                  style: TextStyle(
                    color: AppColors.textPrimary,
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  'Free Ad Reward',
                  style: TextStyle(
                    color: AppColors.textSecondary,
                    fontSize: 14,
                  ),
                ),
              ],
            ),
          ),
          
          // Status Indicator and Countdown
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              // Status Dot and Countdown
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    width: 10,
                    height: 10,
                    decoration: BoxDecoration(
                      color: isActive ? const Color(0xFF4CAF50) : const Color(0xFFF44336),
                      shape: BoxShape.circle,
                    ),
                  ),
                  if (isActive) ...[
                    const SizedBox(width: 8),
                    Text(
                      _formatDuration(_adRewardRemainingSeconds),
                      style: const TextStyle(
                        color: Color(0xFF4CAF50),
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ],
              ),
              
              // Not Active Status (only show when not active)
              if (!isActive) ...[
                const SizedBox(height: 4),
                Text(
                  'Not Active',
                  style: TextStyle(
                    color: AppColors.textSecondary,
                    fontSize: 12,
                  ),
                ),
              ],
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildAllTab() {
    if (_isLoadingContracts) {
      return const Center(
        child: CircularProgressIndicator(),
      );
    }
    
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // My Contract Section
          Text(
            'My Contract',
            style: TextStyle(
              color: AppColors.textPrimary,
              fontSize: 18,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 16),
          
          // Daily Check-in Contract Card (Top Priority - 7.5Gh/s)
          _buildDailyCheckinCard(),
          
          const SizedBox(height: 12),
          
          // Ad Mining Contract Card (5.5Gh/s)
          _buildAdMiningCard(),
        ],
      ),
    );
  }
}
