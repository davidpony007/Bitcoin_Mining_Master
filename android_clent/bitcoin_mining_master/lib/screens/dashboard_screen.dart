import 'dart:async';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/user_provider.dart';
import '../constants/app_constants.dart';
import '../services/points_api_service.dart';
import '../models/points_model.dart';
import 'points_screen.dart';
import 'checkin_screen.dart';
import 'paid_contracts_screen.dart';

/// 仪表盘屏幕 - Dashboard with 48-slot hashrate pool
class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> with TickerProviderStateMixin {
  final PointsApiService _pointsApi = PointsApiService();
  PointsBalance? _pointsBalance;
  Map<String, dynamic>? _todayAdInfo;
  bool _isLoadingPoints = true;
  
  // Battery management
  late List<BatteryState> _batteries;
  Timer? _miningTimer;
  late AnimationController _breathingController;
  
  @override
  void initState() {
    super.initState();
    _initializeBatteries();
    _startMiningTimer();
    _breathingController = AnimationController(
      duration: const Duration(milliseconds: 1500),
      vsync: this,
    )..repeat(reverse: true);
    _loadPointsData();
  }
  
  void _initializeBatteries() {
    _batteries = List.generate(48, (index) {
      // Mock data: first 12 batteries are in use
      if (index < 12) {
        final level = 4 - (index % 4); // Varying levels for demo
        final isMining = index == 0; // First battery is currently mining
        return BatteryState(
          level: level,
          isMining: isMining,
          totalSeconds: level * 15 * 60, // 15 minutes per level
          remainingSeconds: level * 15 * 60,
        );
      }
      return BatteryState(level: 4, isMining: false, totalSeconds: 0, remainingSeconds: 0);
    });
  }
  
  void _startMiningTimer() {
    _miningTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (!mounted) return;
      
      bool hasChanges = false;
      for (int i = 0; i < _batteries.length; i++) {
        if (_batteries[i].isMining && _batteries[i].remainingSeconds > 0) {
          _batteries[i].remainingSeconds--;
          hasChanges = true;
          
          // Check if current level is depleted (15 minutes = 900 seconds)
          final secondsPerLevel = 15 * 60;
          final currentLevel = (_batteries[i].remainingSeconds / secondsPerLevel).ceil();
          
          if (currentLevel != _batteries[i].level) {
            _batteries[i].level = currentLevel;
            
            // If battery is depleted, start next battery
            if (_batteries[i].level == 0) {
              _batteries[i].isMining = false;
              // Find next full battery to start mining
              for (int j = 0; j < _batteries.length; j++) {
                if (_batteries[j].level == 4 && !_batteries[j].isMining) {
                  _batteries[j].isMining = true;
                  _batteries[j].totalSeconds = 4 * 15 * 60;
                  _batteries[j].remainingSeconds = 4 * 15 * 60;
                  break;
                }
              }
            }
          }
        }
      }
      
      if (hasChanges && mounted) {
        setState(() {});
      }
    });
  }
  
  @override
  void dispose() {
    _miningTimer?.cancel();
    _breathingController.dispose();
    super.dispose();
  }

  Future<void> _loadPointsData() async {
    try {
      final balance = await _pointsApi.getPointsBalance();
      final adInfo = await _pointsApi.getTodayAdInfo();
      
      if (mounted) {
        setState(() {
          _pointsBalance = balance;
          _todayAdInfo = adInfo;
          _isLoadingPoints = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isLoadingPoints = false);
      }
    }
  }

  void _navigateToCheckIn() {
    Navigator.push(
      context,
      MaterialPageRoute(builder: (context) => const CheckInScreen()),
    ).then((_) => _loadPointsData());
  }

  void _navigateToPoints() {
    Navigator.push(
      context,
      MaterialPageRoute(builder: (context) => const PointsScreen()),
    ).then((_) => _loadPointsData());
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Mining Dashboard'),
        backgroundColor: AppColors.cardDark,
        actions: [
          IconButton(
            icon: const Icon(Icons.event_available),
            tooltip: 'Daily Check-in',
            onPressed: _navigateToCheckIn,
          ),
          IconButton(
            icon: const Icon(Icons.stars),
            tooltip: 'Points Center',
            onPressed: _navigateToPoints,
          ),
        ],
      ),
      body: Consumer<UserProvider>(
        builder: (context, userProvider, child) {
          return RefreshIndicator(
            onRefresh: () async {
              await _loadPointsData();
            },
            child: SingleChildScrollView(
              physics: const AlwaysScrollableScrollPhysics(),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const SizedBox(height: 16),
                  
                  // Balance Card with gradient
                  _buildBalanceCard(userProvider),
                  
                  const SizedBox(height: 16),
                  
                  // Level Card
                  _buildLevelCard(),
                  
                  const SizedBox(height: 20),
                  
                  // Hashrate Pool Section
                  _buildHashratePoolSection(),
                  
                  const SizedBox(height: 20),
                  
                  // Quick Actions
                  _buildQuickActions(),
                  
                  const SizedBox(height: 20),
                  
                  // Active Contracts
                  _buildActiveContracts(),
                  
                  const SizedBox(height: 20),
                ],
              ),
            ),
          );
        },
      ),
    );
  }



  Widget _buildBalanceCard(UserProvider provider) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            AppColors.primary,
            AppColors.secondary,
          ],
        ),
        borderRadius: BorderRadius.circular(16),
      ),
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Total Balance',
            style: TextStyle(
              color: Colors.white70,
              fontSize: 14,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            '${double.tryParse(provider.bitcoinBalance)?.toStringAsFixed(15) ?? '0.000000000000000'} BTC',
            style: const TextStyle(
              color: Colors.white,
              fontSize: 20,
              fontWeight: FontWeight.bold,
            ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
          const SizedBox(height: 4),
          const Text(
            '1 BTC = \$50,000.00 USD',
            style: TextStyle(
              color: Colors.white70,
              fontSize: 16,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildLevelCard() {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.cardDark,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            decoration: BoxDecoration(
              color: AppColors.primary.withOpacity(0.2),
              borderRadius: BorderRadius.circular(8),
              border: Border.all(
                color: AppColors.primary,
                width: 2,
              ),
            ),
            child: Text(
              'Lv.1',
              style: TextStyle(
                color: AppColors.primary,
                fontSize: 18,
                fontWeight: FontWeight.bold,
              ),
            ),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Row(
                      children: [
                        Text(
                          'Experience',
                          style: TextStyle(
                            color: AppColors.textPrimary,
                            fontSize: 14,
                          ),
                        ),
                        const SizedBox(width: 4),
                        GestureDetector(
                          onTap: () => _showLevelInfoDialog(context),
                          child: Icon(
                            Icons.help_outline,
                            size: 16,
                            color: AppColors.textSecondary,
                          ),
                        ),
                      ],
                    ),
                    Text(
                      '0 / 20',
                      style: TextStyle(
                        color: AppColors.textSecondary,
                        fontSize: 12,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                ClipRRect(
                  borderRadius: BorderRadius.circular(4),
                  child: LinearProgressIndicator(
                    value: 0.0,
                    backgroundColor: AppColors.surface,
                    valueColor: AlwaysStoppedAnimation<Color>(AppColors.primary),
                    minHeight: 8,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildHashratePoolSection() {
    final activeBatteries = _batteries.where((b) => b.level > 0 || b.isMining).length;
    
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Mining Pool',
                style: TextStyle(
                  color: AppColors.textPrimary,
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                ),
              ),
              Text(
                '$activeBatteries / 48',
                style: TextStyle(
                  color: AppColors.textSecondary,
                  fontSize: 14,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: AppColors.cardDark,
              borderRadius: BorderRadius.circular(12),
            ),
            child: GridView.builder(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 8,
                mainAxisSpacing: 10,
                crossAxisSpacing: 10,
                childAspectRatio: 0.75,
              ),
              itemCount: 48,
              itemBuilder: (context, index) {
                return _buildBatteryCell(index);
              },
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBatteryCell(int index) {
    final battery = _batteries[index];
    final isActive = battery.level > 0;
    final isMining = battery.isMining;
    
    return AnimatedBuilder(
      animation: _breathingController,
      builder: (context, child) {
        final opacity = isMining 
            ? 0.4 + (_breathingController.value * 0.6) 
            : 1.0;
        
        return Container(
          decoration: BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.circular(8),
            border: Border.all(
              color: isMining 
                  ? AppColors.primary.withOpacity(opacity)
                  : (isActive ? AppColors.primary.withOpacity(0.3) : AppColors.divider),
              width: isMining ? 2.5 : (isActive ? 2 : 1),
            ),
            boxShadow: isMining ? [
              BoxShadow(
                color: AppColors.primary.withOpacity(opacity * 0.5),
                blurRadius: 8,
                spreadRadius: 1,
              ),
            ] : null,
          ),
          child: Stack(
            children: [
              // Battery body
              Center(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    // Battery top cap
                    Container(
                      width: 12,
                      height: 3,
                      decoration: BoxDecoration(
                        color: isMining 
                            ? AppColors.primary.withOpacity(opacity)
                            : (isActive ? AppColors.primary : AppColors.textSecondary.withOpacity(0.3)),
                        borderRadius: const BorderRadius.only(
                          topLeft: Radius.circular(2),
                          topRight: Radius.circular(2),
                        ),
                      ),
                    ),
                    // Battery main body with 4 levels
                    Container(
                      width: 20,
                      height: 32,
                      decoration: BoxDecoration(
                        color: Colors.transparent,
                        borderRadius: BorderRadius.circular(3),
                        border: Border.all(
                          color: isMining 
                              ? AppColors.primary.withOpacity(opacity)
                              : (isActive ? AppColors.primary : AppColors.textSecondary.withOpacity(0.3)),
                          width: 2,
                        ),
                      ),
                      child: Column(
                        children: [
                          // Level 4 (top)
                          _buildBatteryLevel(battery.level >= 4, isMining, opacity),
                          const SizedBox(height: 1),
                          // Level 3
                          _buildBatteryLevel(battery.level >= 3, isMining, opacity),
                          const SizedBox(height: 1),
                          // Level 2
                          _buildBatteryLevel(battery.level >= 2, isMining, opacity),
                          const SizedBox(height: 1),
                          // Level 1 (bottom)
                          _buildBatteryLevel(battery.level >= 1, isMining, opacity),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildBatteryLevel(bool isFilled, bool isMining, double opacity) {
    return Expanded(
      child: Container(
        margin: const EdgeInsets.symmetric(horizontal: 2),
        decoration: BoxDecoration(
          color: isFilled
              ? (isMining 
                  ? AppColors.primary.withOpacity(opacity)
                  : AppColors.primary.withOpacity(0.5))
              : Colors.transparent,
          borderRadius: BorderRadius.circular(1),
        ),
      ),
    );
  }

  Widget _buildQuickActions() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Quick Actions',
            style: TextStyle(
              color: AppColors.textPrimary,
              fontSize: 18,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: ElevatedButton(
                  onPressed: () {},
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Icon(Icons.play_arrow, size: 20),
                      const SizedBox(width: 8),
                      Column(
                        mainAxisSize: MainAxisSize.min,
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'Free Ad Mining',
                            style: TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          Text(
                            '5.5Gh/s',
                            style: TextStyle(
                              fontSize: 11,
                              color: Colors.white.withOpacity(0.8),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: ElevatedButton(
                  onPressed: () {
                    Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (context) => const PaidContractsScreen(),
                      ),
                    );
                  },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFFFFC107),
                    foregroundColor: Colors.black87,
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Icon(Icons.card_giftcard, size: 20),
                      const SizedBox(width: 8),
                      Column(
                        mainAxisSize: MainAxisSize.min,
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'Daily Check-in Reward',
                            style: TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          Text(
                            '7.5Gh/s',
                            style: TextStyle(
                              fontSize: 11,
                              color: Colors.black.withOpacity(0.7),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildActiveContracts() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Active Contracts',
            style: TextStyle(
              color: AppColors.textPrimary,
              fontSize: 18,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.all(32),
            decoration: BoxDecoration(
              color: AppColors.cardDark,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Center(
              child: Column(
                children: [
                  Icon(
                    Icons.inbox_outlined,
                    size: 48,
                    color: AppColors.textSecondary,
                  ),
                  const SizedBox(height: 12),
                  Text(
                    'No active contracts',
                    style: TextStyle(
                      color: AppColors.textSecondary,
                      fontSize: 14,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  void _showLevelInfoDialog(BuildContext context) {
    showDialog(
      context: context,
      builder: (BuildContext context) {
        return AlertDialog(
          backgroundColor: AppColors.cardDark,
          title: Row(
            children: [
              Icon(Icons.stars, color: AppColors.primary, size: 24),
              const SizedBox(width: 8),
              Text(
                'Miner Level System',
                style: TextStyle(
                  color: AppColors.textPrimary,
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ],
          ),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                _buildLevelRow('LV.1', '0~20 Points', 'Base Mining Rate'),
                _buildLevelRow('LV.2', '21~50 Points', 'Mining Rate +10%'),
                _buildLevelRow('LV.3', '51~100 Points', 'Mining Rate +20%'),
                _buildLevelRow('LV.4', '101~200 Points', 'Mining Rate +35%'),
                _buildLevelRow('LV.5', '201~400 Points', 'Mining Rate +50%'),
                _buildLevelRow('LV.6', '401~800 Points', 'Mining Rate +70%'),
                _buildLevelRow('LV.7', '801~1600 Points', 'Mining Rate +100%'),
                _buildLevelRow('LV.8', '1601~3000 Points', 'Mining Rate +140%'),
                _buildLevelRow('LV.9', '3001+ Points', 'Mining Rate +200%'),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(),
              child: Text(
                'Got it',
                style: TextStyle(color: AppColors.primary),
              ),
            ),
          ],
        );
      },
    );
  }

  Widget _buildLevelRow(String level, String points, String reward) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        children: [
          Container(
            width: 50,
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(
              color: AppColors.primary.withOpacity(0.15),
              borderRadius: BorderRadius.circular(6),
              border: Border.all(
                color: AppColors.primary.withOpacity(0.3),
                width: 1,
              ),
            ),
            child: Text(
              level,
              textAlign: TextAlign.center,
              style: TextStyle(
                color: AppColors.primary,
                fontSize: 12,
                fontWeight: FontWeight.bold,
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  points,
                  style: TextStyle(
                    color: AppColors.textPrimary,
                    fontSize: 13,
                    fontWeight: FontWeight.w500,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  reward,
                  style: TextStyle(
                    color: AppColors.textSecondary,
                    fontSize: 11,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Battery state model for mining pool
class BatteryState {
  int level; // 0-4, each level = 15 minutes
  bool isMining; // Currently mining (breathing animation)
  int totalSeconds; // Total seconds for this battery
  int remainingSeconds; // Remaining seconds
  
  BatteryState({
    required this.level,
    required this.isMining,
    required this.totalSeconds,
    required this.remainingSeconds,
  });
}