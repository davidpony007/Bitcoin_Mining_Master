import 'dart:async';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/user_provider.dart';
import '../constants/app_constants.dart';
import '../services/points_api_service.dart';
import '../services/api_service.dart';
import '../services/storage_service.dart';
import '../models/points_model.dart';
import 'points_screen.dart';
import 'checkin_screen.dart';
import 'paid_contracts_screen.dart';
import 'ad_reward_screen.dart';

/// 仪表盘屏幕 - Dashboard with 48-slot hashrate pool
class DashboardScreen extends StatefulWidget {
  final Function(int)? onSwitchTab; // 切换标签的回调函数

  const DashboardScreen({super.key, this.onSwitchTab});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen>
    with TickerProviderStateMixin, WidgetsBindingObserver {
  final PointsApiService _pointsApi = PointsApiService();
  final ApiService _apiService = ApiService();
  final StorageService _storageService = StorageService();
  PointsBalance? _pointsBalance;
  Map<String, dynamic>? _todayAdInfo;
  bool _isLoadingPoints = true;

  // 用户等级相关状态
  int _userLevel = 1;
  int _userPoints = 0;
  int _maxPoints = 20;
  String _levelName = 'LV.1 新手矿工';
  double _progressPercentage = 0.0;
  bool _isLoadingLevel = true;

  // 比特币价格
  String _bitcoinPrice = '\$88,911.78 USD';
  Timer? _priceUpdateTimer;

  // Battery management
  late List<BatteryState> _batteries;
  Timer? _miningTimer;
  late AnimationController _breathingController;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this); // 监听应用生命周期
    _initializeBatteries();
    _loadBitcoinPrice(); // 加载比特币价格
    _startPriceUpdateTimer(); // 启动定时更新
    _startMiningTimer();
    _breathingController = AnimationController(
      duration: const Duration(milliseconds: 1500),
      vsync: this,
    )..repeat(reverse: true);
    _loadPointsData();
    _loadUserLevel(); // 加载用户等级
    _loadContractAndUpdateBatteries();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    super.didChangeAppLifecycleState(state);
    // 当应用从后台恢复到前台时，立即刷新数据
    if (state == AppLifecycleState.resumed) {
      print('📱 Dashboard: 应用恢复前台，立即刷新数据');
      _loadContractAndUpdateBatteries();
      _loadPointsData();
      _loadUserLevel();
    }
  }

  void _initializeBatteries() {
    _batteries = List.generate(48, (index) {
      // Initial state: all batteries are empty (no batteries at start)
      // Batteries will only be added after watching ads and clicking continue
      return BatteryState(
        level: 0,
        isMining: false,
        totalSeconds: 0,
        remainingSeconds: 0,
      );
    });
  }

  void _startMiningTimer() {
    _miningTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (!mounted) return;

      bool hasChanges = false;
      bool needsResort = false;

      for (int i = 0; i < _batteries.length; i++) {
        if (_batteries[i].isMining && _batteries[i].remainingSeconds > 0) {
          _batteries[i].remainingSeconds--;
          hasChanges = true;

          // Check if current level is depleted (15 minutes = 900 seconds)
          final secondsPerLevel = 15 * 60;
          final currentLevel =
              (_batteries[i].remainingSeconds / secondsPerLevel).ceil();

          if (currentLevel != _batteries[i].level) {
            _batteries[i].level = currentLevel;

            // If battery is depleted, start next battery
            if (_batteries[i].level == 0) {
              _batteries[i].isMining = false;
              needsResort = true; // 需要重新排序

              // Find next full battery to start mining (search from right to left - consume batteries from right)
              for (int j = _batteries.length - 1; j >= 0; j--) {
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

      // 如果有电池状态变化需要重新排序
      if (needsResort) {
        _sortBatteries();
      }

      if (hasChanges && mounted) {
        setState(() {});
      }
    });
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this); // 移除observer
    _miningTimer?.cancel();
    _priceUpdateTimer?.cancel(); // 取消价格更新定时器
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

  // 根据合约剩余时间更新电池状态
  // 📌 重要：只有Free Ad Reward合约的时间会显示为电池
  // Daily Check-in合约是独立的，不会增加电池数量
  Future<void> _loadContractAndUpdateBatteries() async {
    try {
      var userId = _storageService.getUserId();

      // 临时解决方案：如果userId为空，使用默认测试用户ID
      if (userId == null || userId.isEmpty) {
        userId = 'U2026011910532521846';
        print('⚠️ Dashboard: 用户ID为空，使用默认测试用户ID');
      }

      print('📊 Dashboard: 加载合约状态 - userId: $userId');
      final response = await _apiService.getMyContracts(userId);
      final data = response['data'];

      // 📌 只读取adReward合约来更新电池（不包含dailyCheckIn）
      if (data != null && data['adReward'] != null) {
        final isActive = data['adReward']['isActive'] == true;
        final remainingSeconds = data['adReward']['remainingSeconds'] ?? 0;

        print(
          '📊 Dashboard: 合约状态 - isActive: $isActive, remainingSeconds: $remainingSeconds',
        );

        if (isActive && remainingSeconds > 0 && mounted) {
          setState(() {
            _updateBatteriesFromRemainingTime(remainingSeconds);
          });
          print('✅ Dashboard: 电池状态已更新');
        }
      }
    } catch (e) {
      print('❌ Dashboard: 加载合约状态失败: $e');
    }
  }

  // 根据剩余秒数设置电池状态
  void _updateBatteriesFromRemainingTime(int remainingSeconds) {
    // 每小时 = 3600秒 = 1个电池
    // 每15分钟 = 900秒 = 电池的1格（共4格）
    // 📌 最大48小时（48个电池槽）
    const int MAX_HOURS = 48;
    const int MAX_SECONDS = MAX_HOURS * 3600;

    // 限制为48小时上限
    if (remainingSeconds > MAX_SECONDS) {
      print('⚠️ 剩余时间超过48小时上限，限制为48小时');
      remainingSeconds = MAX_SECONDS;
    }

    final totalHours = remainingSeconds ~/ 3600; // 完整小时数
    final remainingSecondsAfterHours = remainingSeconds % 3600; // 剩余的秒数

    print(
      '🔋 更新电池状态 - 总秒数: $remainingSeconds, 完整小时: $totalHours, 剩余秒数: $remainingSecondsAfterHours',
    );

    // 清空所有电池
    for (var battery in _batteries) {
      battery.level = 0;
      battery.isMining = false;
      battery.totalSeconds = 0;
      battery.remainingSeconds = 0;
    }

    int batteryIndex = 0;

    // 设置完整小时对应的满电池（每个满电池 = 4格 = 60分钟）
    for (int i = 0; i < totalHours && batteryIndex < _batteries.length; i++) {
      _batteries[batteryIndex].level = 4;
      _batteries[batteryIndex].isMining = false;
      _batteries[batteryIndex].totalSeconds = 3600;
      _batteries[batteryIndex].remainingSeconds = 3600;
      batteryIndex++;
    }

    print('🔋 已设置 $batteryIndex 个满电池');

    // 如果还有剩余时间（不足1小时的部分），设置为正在挖矿的电池
    if (remainingSecondsAfterHours > 0 && batteryIndex < _batteries.length) {
      // 计算这个电池应该显示几格（每15分钟1格）
      final level = (remainingSecondsAfterHours / 900).ceil().clamp(1, 4);

      _batteries[batteryIndex].level = level;
      _batteries[batteryIndex].isMining = true;
      _batteries[batteryIndex].totalSeconds = 3600; // 一个完整电池的总时间
      _batteries[batteryIndex].remainingSeconds = remainingSecondsAfterHours;
      batteryIndex++;

      print(
        '🔋 已设置正在挖矿的电池 - level: $level, remainingSeconds: $remainingSecondsAfterHours',
      );
    }

    print('🔋 电池总数: $batteryIndex');

    // 重新排序：空电池 -> 满电 -> 挖矿中（最右边）
    _sortBatteries();
  }

  // 增加电池的方法 - 改为从API重新加载合约状态
  void _addBatteries(int count) {
    // 观看广告后，重新从API加载最新的合约剩余时间
    _loadContractAndUpdateBatteries();
  }

  // 电池排序：满电电池在前（从左往右填充），空电池在中间，正在挖矿的电池排在最右边
  void _sortBatteries() {
    // 分离出三类电池
    final miningBatteries = <BatteryState>[];
    final fullBatteries = <BatteryState>[];
    final emptyBatteries = <BatteryState>[];

    for (var battery in _batteries) {
      if (battery.isMining) {
        miningBatteries.add(battery);
      } else if (battery.level > 0) {
        fullBatteries.add(battery);
      } else {
        emptyBatteries.add(battery);
      }
    }

    // 重新组合：满电池（左侧）-> 挖矿中（中间）-> 空电池（最右边）
    // 填充顺序：从左往右、从上至下（满电池优先填充左边位置）
    // 消耗顺序：从右往左（空电池在最右边，挖矿中的在中间）
    _batteries.clear();
    _batteries.addAll(fullBatteries);
    _batteries.addAll(miningBatteries);
    _batteries.addAll(emptyBatteries);
    print(
      '🔋 电池排序完成 - 满电:${fullBatteries.length}, 空:${emptyBatteries.length}, 挖矿中:${miningBatteries.length}',
    );
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
              await _loadUserLevel(); // 刷新等级信息
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

                  // Quick Actions
                  _buildQuickActions(),

                  const SizedBox(height: 20),

                  // Hashrate Pool Section
                  _buildHashratePoolSection(),

                  const SizedBox(height: 20),
                  
                  // 底部安全区域，避开底部导航栏
                  SizedBox(height: MediaQuery.of(context).padding.bottom + 80),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  // 加载用户等级信息
  Future<void> _loadUserLevel() async {
    try {
      final userId = _storageService.getUserId();
      if (userId == null || userId.isEmpty) {
        print('❌ 用户ID不存在，无法加载等级');
        setState(() {
          _isLoadingLevel = false;
        });
        return;
      }

      print('📊 开始加载用户等级 - userId: $userId');
      final response = await _apiService.getUserLevel(userId);

      if (response['success'] == true && response['data'] != null) {
        final data = response['data'];
        setState(() {
          _userLevel = data['level'] ?? 1;
          _userPoints = data['points'] ?? 0;
          _maxPoints = data['maxPoints'] ?? 20;
          _levelName = data['levelName'] ?? 'LV.1 新手矿工';
          _progressPercentage = (data['progressPercentage'] ?? 0.0).toDouble();
          _isLoadingLevel = false;
        });

        // 同步到本地存储
        await _storageService.saveUserLevel(_userLevel);

        print('✅ 等级加载成功: Lv.$_userLevel ($_userPoints/$_maxPoints)');
      } else {
        print('⚠️ API返回失败，使用本地缓存');
        _loadUserLevelFromCache();
      }
    } catch (e) {
      print('❌ 加载等级失败: $e');
      _loadUserLevelFromCache();
    }
  }

  // 从本地缓存加载等级（降级方案）
  void _loadUserLevelFromCache() {
    setState(() {
      _userLevel = _storageService.getUserLevel();
      _userPoints = 0;
      _maxPoints = 20;
      _levelName = 'LV.$_userLevel';
      _progressPercentage = 0.0;
      _isLoadingLevel = false;
    });
  }

  Widget _buildBalanceCard(UserProvider provider) {
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
          Text(
            '1 BTC = $_bitcoinPrice',
            style: const TextStyle(color: Colors.white70, fontSize: 16),
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
      child: _isLoadingLevel
          ? const Center(
              child: SizedBox(
                height: 40,
                child: CircularProgressIndicator(strokeWidth: 2),
              ),
            )
          : Row(
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 6,
                  ),
                  decoration: BoxDecoration(
                    color: AppColors.primary.withOpacity(0.2),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: AppColors.primary, width: 2),
                  ),
                  child: Text(
                    'Lv.$_userLevel',
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
                            '$_userPoints / $_maxPoints',
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
                          value: _maxPoints > 0
                              ? (_userPoints / _maxPoints).clamp(0.0, 1.0)
                              : 0.0,
                          backgroundColor: AppColors.surface,
                          valueColor: AlwaysStoppedAnimation<Color>(
                            AppColors.primary,
                          ),
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
    final activeBatteries = _batteries
        .where((b) => b.level > 0 || b.isMining)
        .length;

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
                style: TextStyle(color: AppColors.textSecondary, fontSize: 14),
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
                  : (isActive
                        ? AppColors.primary.withOpacity(0.3)
                        : AppColors.divider),
              width: isMining ? 2.5 : (isActive ? 2 : 1),
            ),
            boxShadow: isMining
                ? [
                    BoxShadow(
                      color: AppColors.primary.withOpacity(opacity * 0.5),
                      blurRadius: 8,
                      spreadRadius: 1,
                    ),
                  ]
                : null,
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
                            : (isActive
                                  ? AppColors.primary
                                  : AppColors.textSecondary.withOpacity(0.3)),
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
                              : (isActive
                                    ? AppColors.primary
                                    : AppColors.textSecondary.withOpacity(0.3)),
                          width: 2,
                        ),
                      ),
                      child: Column(
                        children: [
                          // Level 4 (top)
                          _buildBatteryLevel(
                            battery.level >= 4,
                            isMining,
                            opacity,
                          ),
                          const SizedBox(height: 1),
                          // Level 3
                          _buildBatteryLevel(
                            battery.level >= 3,
                            isMining,
                            opacity,
                          ),
                          const SizedBox(height: 1),
                          // Level 2
                          _buildBatteryLevel(
                            battery.level >= 2,
                            isMining,
                            opacity,
                          ),
                          const SizedBox(height: 1),
                          // Level 1 (bottom)
                          _buildBatteryLevel(
                            battery.level >= 1,
                            isMining,
                            opacity,
                          ),
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
    // 📌 检查电池槽是否已满（48个槽位）
    final activeBatteries = _batteries
        .where((b) => b.level > 0 || b.isMining)
        .length;
    final isMiningPoolFull = activeBatteries >= 48;

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
                  onPressed: isMiningPoolFull
                      ? () {
                          // 电池槽已满，显示提示
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(
                              content: Text('⚠️ The mining pool is full.'),
                              backgroundColor: Colors.orange,
                              duration: Duration(seconds: 3),
                            ),
                          );
                        }
                      : () async {
                          final result = await Navigator.push(
                            context,
                            MaterialPageRoute(
                              builder: (context) => const AdRewardScreen(),
                            ),
                          );

                          // 如果返回true（延长成功），立即刷新所有数据
                          if (result == true && mounted) {
                            // 立即刷新电池、等级和积分，无延迟
                            await _loadContractAndUpdateBatteries();
                            await _loadUserLevel();
                            await _loadPointsData();
                            
                            // 显示成功提示
                            if (mounted) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(
                                  content: Text('✅ Reward claimed! Mining Pool and Experience updated!'),
                                  backgroundColor: Colors.green,
                                  duration: Duration(seconds: 2),
                                ),
                              );
                            }
                          } else if (result == false && mounted) {
                            // 显示失败提示
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(
                                content: Text('❌ Failed to claim reward, please try again'),
                                backgroundColor: Colors.red,
                                duration: Duration(seconds: 2),
                              ),
                            );
                          }
                        },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: isMiningPoolFull
                        ? AppColors.textSecondary.withOpacity(0.3)
                        : AppColors.primary,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(
                        Icons.play_arrow,
                        size: 20,
                        color: isMiningPoolFull
                            ? Colors.white.withOpacity(0.5)
                            : Colors.white,
                      ),
                      const SizedBox(width: 8),
                      Column(
                        mainAxisSize: MainAxisSize.min,
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Free Ad Mining',
                            style: TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.bold,
                              color: isMiningPoolFull
                                  ? Colors.white.withOpacity(0.5)
                                  : Colors.white,
                            ),
                          ),
                          Text(
                            '5.5Gh/s',
                            style: TextStyle(
                              fontSize: 11,
                              color: isMiningPoolFull
                                  ? Colors.white.withOpacity(0.3)
                                  : Colors.white.withOpacity(0.8),
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
                  onPressed: () async {
                    // 检查今日是否已签到
                    final lastCheckInDate = _storageService
                        .getLastCheckInDate();
                    final today = DateTime.now().toIso8601String().split(
                      'T',
                    )[0];

                    if (lastCheckInDate == today) {
                      // 今日已签到，显示提示
                      if (mounted) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(
                            content: Text(
                              '⚠️ You have already checked in today',
                            ),
                            backgroundColor: Colors.orange,
                            duration: Duration(seconds: 3),
                          ),
                        );
                      }
                      return;
                    }

                    // 未签到，跳转到签到页面
                    final result = await Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (context) =>
                            const AdRewardScreen(isDailyCheckIn: true),
                      ),
                    );

                    // 📌 处理签到返回值
                    if (result is Map &&
                        result['action'] == 'switchToContracts' &&
                        mounted) {
                      // 通知父组件（HomeScreen）切换到Contracts标签
                      widget.onSwitchTab?.call(1); // 切换到Contracts标签（索引1）
                    } else if (result == true && mounted) {
                      // 签到成功，立即刷新所有数据
                      await _loadContractAndUpdateBatteries();
                      await _loadUserLevel();
                      await _loadPointsData();
                      
                      // 显示成功提示
                      if (mounted) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(
                            content: Text('✅ Check-in successful! Daily contract activated!'),
                            backgroundColor: Colors.green,
                            duration: Duration(seconds: 2),
                          ),
                        );
                      }
                    } else if (result == false && mounted) {
                      // 显示失败提示
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(
                          content: Text('❌ Check-in failed, please try again'),
                          backgroundColor: Colors.red,
                          duration: Duration(seconds: 2),
                        ),
                      );
                    }
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
                const SizedBox(height: 4),
                _buildLevelRow('LV.2', 'Need 30 Points', 'Mining Rate +10%'),
                const SizedBox(height: 4),
                _buildLevelRow('LV.3', 'Need 50 Points', 'Mining Rate +20%'),
                const SizedBox(height: 4),
                _buildLevelRow('LV.4', 'Need 100 Points', 'Mining Rate +35%'),
                const SizedBox(height: 4),
                _buildLevelRow('LV.5', 'Need 200 Points', 'Mining Rate +50%'),
                const SizedBox(height: 4),
                _buildLevelRow('LV.6', 'Need 400 Points', 'Mining Rate +70%'),
                const SizedBox(height: 4),
                _buildLevelRow('LV.7', 'Need 800 Points', 'Mining Rate +100%'),
                const SizedBox(height: 4),
                _buildLevelRow('LV.8', 'Need 1600 Points', 'Mining Rate +140%'),
                const SizedBox(height: 4),
                _buildLevelRow('LV.9', 'Max Level', 'Mining Rate +200%'),
                const SizedBox(height: 12),
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: AppColors.primary.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    'Note: Points reset to 0 after each level up',
                    style: TextStyle(
                      color: AppColors.textSecondary,
                      fontSize: 12,
                      fontStyle: FontStyle.italic,
                    ),
                    textAlign: TextAlign.center,
                  ),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(),
              child: Text('Got it', style: TextStyle(color: AppColors.primary)),
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

  /// 加载比特币价格
  Future<void> _loadBitcoinPrice() async {
    try {
      final response = await _apiService.getBitcoinPrice();
      if (response['success'] == true && response['data'] != null) {
        setState(() {
          _bitcoinPrice = response['data']['formatted'] ?? '\$88,911.78 USD';
        });
        print('💰 比特币价格更新: $_bitcoinPrice');
      }
    } catch (e) {
      print('❌ 加载比特币价格失败: $e');
      // 保持默认价格
    }
  }

  /// 启动价格定时更新（每60分钟）
  void _startPriceUpdateTimer() {
    _priceUpdateTimer = Timer.periodic(const Duration(minutes: 60), (timer) {
      _loadBitcoinPrice();
    });
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
