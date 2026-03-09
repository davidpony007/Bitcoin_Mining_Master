import 'dart:async';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/user_provider.dart';
import '../constants/app_constants.dart';
import '../services/points_api_service.dart';
import '../services/api_service.dart';
import '../services/storage_service.dart';
import '../services/admob_service.dart';
import '../services/user_repository.dart';
import '../models/points_model.dart';
import 'points_screen.dart';
import 'checkin_screen.dart';
import 'paid_contracts_screen.dart';
import 'ad_reward_screen.dart';


/// 仪表盘屏幕 - Dashboard with 48-slot hashrate pool
class DashboardScreen extends StatefulWidget {
  final Function(int)? onSwitchTab; // 切换标签的回调函数
  final VoidCallback? onContractRefreshNeeded; // 奖励领取后通知 Contracts 页到噟刷新
  final VoidCallback? onAdRewardClaimed;       // 广告奖励成功：立即乐观更新 Contracts UI

  const DashboardScreen({
    super.key,
    this.onSwitchTab,
    this.onContractRefreshNeeded,
    this.onAdRewardClaimed,
  });

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen>
    with TickerProviderStateMixin, WidgetsBindingObserver {
  final PointsApiService _pointsApi = PointsApiService();
  final ApiService _apiService = ApiService();
  final StorageService _storageService = StorageService();
  final AdMobService _adMobService = AdMobService();
  final UserRepository _userRepository = UserRepository();
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
  Timer? _uiRefreshTimer; // 100ms 轻量UI刷新，让余额数字平滑递增
  int _syncCounter = 9; // 提升为类字段，便于激活挖矿后立即触发同步
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

    // 启动 100ms UI刷新定时器：直接读取 provider.bitcoinBalance（毫秒精度实时计算值）
    // 无需 Tween/动画，数字每 100ms 刷新一次，视觉极其平滑
    _uiRefreshTimer = Timer.periodic(const Duration(milliseconds: 100), (_) {
      if (mounted) setState(() {});
    });
    
    _loadPointsData();
    _loadUserLevel(); // 加载用户等级
    _loadContractAndUpdateBatteries();

    // 立即同步一次余额和挖矿速率，避免等待10秒计时器才更新
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) {
        context.read<UserProvider>().fetchBitcoinBalance();
      }
    });
  }

  /// 公共方法：手动刷新余额（由HomeScreen调用）
  Future<void> refreshBalance() async {
    if (!mounted) return;
    await context.read<UserProvider>().fetchBitcoinBalance();
    if (mounted) setState(() {});
  }

  /// 合约激活后立即同步余额与挖矿速率，确保 100ms 计时器即将开始平滑递增显示
  Future<void> _refreshBalanceAfterMiningStart() async {
    if (!mounted) return;
    await context.read<UserProvider>().fetchBitcoinBalance();
    // 若速率仍为0（后端缓存路径还未清除），每 800ms 重试，最多 8 次（≈6.4秒）
    for (int _r = 0;
        _r < 8 &&
            mounted &&
            context.read<UserProvider>().miningSpeedPerSecond == 0;
        _r++) {
      await Future.delayed(const Duration(milliseconds: 800));
      if (mounted) await context.read<UserProvider>().fetchBitcoinBalance();
    }
    // 若重试结束仍为0，将计数器重置为9，确保 _miningTimer 在下一个tick（≤1秒）
    // 立即再同步一次，避免用户等待最长10秒的空档期
    if (mounted && context.read<UserProvider>().miningSpeedPerSecond == 0) {
      _syncCounter = 9;
    }
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
      // 恢复前台后立即从后端同步基准余额，消除后台期间的时间漂移
      context.read<UserProvider>().fetchBitcoinBalance();
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

  /// 直接播放广告并领取奖励（无中间页）
  Future<void> _playAdAndClaimReward() async {
    // 检查广告是否已准备好
    if (!_adMobService.isAdReady) {
      // 显示加载提示
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('📺 Loading ad, please wait...'),
            duration: Duration(seconds: 3),
          ),
        );
      }

      // 开始加载广告
      await _adMobService.loadRewardedAd();
      
      // 等待广告加载完成（最多10秒）
      final startTime = DateTime.now();
      while (!_adMobService.isAdReady && DateTime.now().difference(startTime).inSeconds < 10) {
        await Future.delayed(const Duration(milliseconds: 500));
      }

      if (!_adMobService.isAdReady) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('❌ Ad not available. Please check your network connection and try again later.'),
              backgroundColor: Colors.red,
              duration: Duration(seconds: 4),
            ),
          );
        }
        return;
      }
    }

    // 播放广告
    try {
      final earnedReward = await _adMobService.showRewardedAd();
      
      if (!mounted) return;

      if (earnedReward) {
        // 用户看完广告，发放奖励
        final success = await _extendContract();
        
        if (!mounted) return;

        if (success) {
          // 立即刷新所有数据（包括余额和挖矿速率，确保计数器立即启动）
          await context.read<UserProvider>().fetchBitcoinBalance();
          // 若速率仍为0（后端缓存残留），循环重试，确保 0.1s UI 平滑递增立即启动
          for (int _retry = 0;
              _retry < 5 &&
                  mounted &&
                  context.read<UserProvider>().miningSpeedPerSecond == 0;
              _retry++) {
            await Future.delayed(const Duration(milliseconds: 800));
            if (mounted) await context.read<UserProvider>().fetchBitcoinBalance();
          }
          await _loadContractAndUpdateBatteries();
          await _loadUserLevel();
          await _loadPointsData();
          // 立即通知 Contracts 页面刷新，无需等待 30 秒轮询
          widget.onContractRefreshNeeded?.call();
          
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(
                content: Text('✅ Reward claimed! Mining Pool and Experience updated!'),
                backgroundColor: Colors.green,
                duration: Duration(seconds: 2),
              ),
            );
          }
        } else {
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(
                content: Text('❌ Failed to claim reward, please try again'),
                backgroundColor: Colors.red,
                duration: Duration(seconds: 2),
              ),
            );
          }
        }
      } else {
        // 用户未看完广告
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('⚠️ Please watch the complete ad to claim reward'),
              backgroundColor: Colors.orange,
              duration: Duration(seconds: 2),
            ),
          );
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('❌ Error: $e'),
            backgroundColor: Colors.red,
            duration: const Duration(seconds: 3),
          ),
        );
      }
    }
  }

  /// 延长Free Ad Reward合约（调用后端API）
  Future<bool> _extendContract() async {
    try {
      print('📡 开始延长Free Ad Reward合约...');
      final userIdResult = await _userRepository.fetchUserId();
      if (!userIdResult.isSuccess || userIdResult.data == null || userIdResult.data!.isEmpty) {
        print('❌ 获取用户ID失败');
        return false;
      }
      final userId = userIdResult.data!;
      print('✅ 用户ID: $userId, 准备延长2小时');

      final response = await _apiService.extendAdRewardContract(
        userId: userId,
        hours: 2,
      );

      print('📦 延长合约API响应: $response');
      final success = response['success'] == true;
      print(success ? '✅ 合约延长成功!' : '❌ 合约延长失败');
      return success;
    } catch (e) {
      print('❌ 延长合约失败: $e');
      return false;
    }
  }

  /// 播放每日签到广告并领取奖励
  Future<void> _playDailyCheckInAd() async {
    // 检查今日是否已签到
    final lastCheckInDate = _storageService.getLastCheckInDate();
    final today = DateTime.now().toIso8601String().split('T')[0];
    
    print('🔍 [Dashboard] 签到检查: lastCheckInDate=$lastCheckInDate, today=$today');

    if (lastCheckInDate == today) {
      // 今日已签到，显示提示
      print('⚠️ [Dashboard] 今日已签到，阻止播放广告');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('⚠️ You have already checked in today! Please try again after UTC 00:00'),
            backgroundColor: Colors.orange,
            duration: Duration(seconds: 3),
          ),
        );
      }
      return;
    }
    
    print('✅ [Dashboard] 未签到，准备播放广告');

    // 检查广告是否已准备好
    if (!_adMobService.isAdReady) {
      // 显示加载提示
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('📺 Loading ad, please wait...'),
            duration: Duration(seconds: 3),
          ),
        );
      }

      // 开始加载广告
      await _adMobService.loadRewardedAd();
      
      // 等待广告加载完成（最多10秒）
      final startTime = DateTime.now();
      while (!_adMobService.isAdReady && DateTime.now().difference(startTime).inSeconds < 10) {
        await Future.delayed(const Duration(milliseconds: 500));
      }

      if (!mounted) return;

      // 检查广告是否加载成功
      if (!_adMobService.isAdReady) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('❌ Ad not available. Please check your network connection and try again later.'),
            backgroundColor: Colors.red,
            duration: Duration(seconds: 4),
          ),
        );
        return;
      }
    }

    if (!mounted) return;

    // 播放广告
    try {
      final earnedReward = await _adMobService.showRewardedAd();
      
      if (!mounted) return;

      if (earnedReward) {
        // 用户看完广告，调用签到接口
        final success = await _performCheckIn();
        
        if (!mounted) return;

        if (success) {
          // 立即刷新所有数据（包括余额和挖矿速率，确保计数器立即启动）
          await context.read<UserProvider>().fetchBitcoinBalance();
          // 若速率仍为0，循环重试，确保 0.1s UI 平滑递增立即启动
          for (int _retry = 0;
              _retry < 5 &&
                  mounted &&
                  context.read<UserProvider>().miningSpeedPerSecond == 0;
              _retry++) {
            await Future.delayed(const Duration(milliseconds: 800));
            if (mounted) await context.read<UserProvider>().fetchBitcoinBalance();
          }
          await _loadContractAndUpdateBatteries();
          await _loadUserLevel();
          await _loadPointsData();
          
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(
                content: Text('✅ Check-in successful! Daily contract activated!'),
                backgroundColor: Colors.green,
                duration: Duration(seconds: 2),
              ),
            );
          }
        } else {
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(
                content: Text('❌ Check-in failed, please try again'),
                backgroundColor: Colors.red,
                duration: Duration(seconds: 2),
              ),
            );
          }
        }
      } else {
        // 用户未看完广告
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('⚠️ Please watch the complete ad to check in'),
              backgroundColor: Colors.orange,
              duration: Duration(seconds: 2),
            ),
          );
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('❌ Error: $e'),
            backgroundColor: Colors.red,
            duration: const Duration(seconds: 3),
          ),
        );
      }
    }
  }

  /// 执行签到（调用后端API）
  Future<bool> _performCheckIn() async {
    try {
      print('📡 开始执行每日签到...');
      final userIdResult = await _userRepository.fetchUserId();
      if (!userIdResult.isSuccess || userIdResult.data == null || userIdResult.data!.isEmpty) {
        print('❌ 获取用户ID失败');
        return false;
      }
      final userId = userIdResult.data!;
      print('✅ 用户ID: $userId, 准备调用签到API');

      // 调用签到接口
      final response = await _apiService.performCheckIn(userId: userId);

      print('📦 签到API响应: $response');
      
      // 检查是否是"今日已签到"的特殊情况
      if (response['alreadyCheckedIn'] == true) {
        print('ℹ️ 检测到后端返回已签到标记，保存今日日期到本地');
        final today = DateTime.now().toIso8601String().split('T')[0];
        await _storageService.saveLastCheckInDate(today);
        final verified = _storageService.getLastCheckInDate();
        print('🔍 保存已签到日期: $today, 验证结果: $verified');
        
        // 虽然后端说已签到，但仍然返回true让调用方知道应该显示成功消息
        return true;
      }
      
      final success = response['success'] == true;
      
      if (success) {
        // 签到成功,保存今日日期到本地存储
        final today = DateTime.now().toIso8601String().split('T')[0];
        await _storageService.saveLastCheckInDate(today);
        final verified = _storageService.getLastCheckInDate();
        print('✅ 签到成功! 保存日期: $today, 验证结果: $verified');
      } else {
        print('❌ 签到失败');
      }
      
      return success;
    } catch (e) {
      print('❌ 签到失败: $e');
      return false;
    }
  }

  void _startMiningTimer() {
    _syncCounter = 9; // 从9开始，使第1秒就触发一次余额同步，之后每10秒同步一次
    
    _miningTimer = Timer.periodic(const Duration(seconds: 1), (timer) async {
      if (!mounted) return;

      bool hasChanges = false;
      bool needsResort = false;
      bool hasMiningBatteries = false;

      for (int i = 0; i < _batteries.length; i++) {
        if (_batteries[i].isMining && _batteries[i].remainingSeconds > 0) {
          hasMiningBatteries = true;
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
                  hasMiningBatteries = true;
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

      // 每10秒从后端同步一次真实余额和挖矿速率（校准基准值）
      _syncCounter++;
      if (mounted && _syncCounter >= 10) {
        await context.read<UserProvider>().fetchBitcoinBalance();
        _syncCounter = 0;
      }
    });
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this); // 移除observer
    _miningTimer?.cancel();
    _uiRefreshTimer?.cancel();
    _priceUpdateTimer?.cancel();
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
    const int maxHours = 48;
    const int maxSeconds = maxHours * 3600;

    // 限制为48小时上限
    if (remainingSeconds > maxSeconds) {
      print('⚠️ 剩余时间超过48小时上限，限制为48小时');
      remainingSeconds = maxSeconds;
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
      body: RefreshIndicator(
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
              // 直接读取 UserProvider（不经过 Consumer），确保 100ms _uiRefreshTimer 的
              // setState 能实时触发重新计算 bitcoinBalance getter
              _buildBalanceCard(context.read<UserProvider>()),

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
  
  /// 获取挖矿速率加成文本
  String _getMiningRateBonus() {
    // LV.1: +0%, LV.2: +10%, LV.3: +30%, LV.4: +50%, LV.5: +75%,
    // LV.6: +100%, LV.7: +130%, LV.8: +160%, LV.9: +200%
    final bonusPercentages = {
      1: 0,
      2: 10,
      3: 30,
      4: 50,
      5: 75,
      6: 100,
      7: 130,
      8: 160,
      9: 200,
    };
    
    final bonus = bonusPercentages[_userLevel] ?? 0;
    return '+$bonus%';
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
            '${provider.bitcoinBalance} BTC',
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
                          Row(
                            children: [
                              Text(
                                _getMiningRateBonus(),
                                style: TextStyle(
                                  color: AppColors.success,
                                  fontSize: 12,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                              const SizedBox(width: 16),
                              Text(
                                '$_userPoints / $_maxPoints',
                                style: TextStyle(
                                  color: AppColors.textSecondary,
                                  fontSize: 12,
                                ),
                              ),
                            ],
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
              Row(
                children: [
                  _buildMiniFullBattery(),
                  const SizedBox(width: 4),
                  Text(
                    '= mine 1 hour',
                    style: TextStyle(
                      color: AppColors.textSecondary,
                      fontSize: 12,
                    ),
                  ),
                  const SizedBox(width: 40),
                  Text(
                    '$activeBatteries / 48',
                    style: const TextStyle(
                      color: AppColors.primary,
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
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

  // Mining Pool 标题旁的迷你满电四格电池图标
  Widget _buildMiniFullBattery() {
    const color = AppColors.textSecondary;
    return SizedBox(
      width: 13,
      height: 18,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          // 电池顶部凸起
          Container(
            width: 7,
            height: 2,
            decoration: const BoxDecoration(
              color: color,
              borderRadius: BorderRadius.only(
                topLeft: Radius.circular(1),
                topRight: Radius.circular(1),
              ),
            ),
          ),
          // 电池主体（四格充满）
          Container(
            width: 13,
            height: 16,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(2),
              border: Border.all(color: color, width: 1.5),
            ),
            child: Padding(
              padding: const EdgeInsets.all(1.5),
              child: Column(
                children: [
                  Expanded(child: _buildMiniBatteryBar(color)),
                  const SizedBox(height: 1),
                  Expanded(child: _buildMiniBatteryBar(color)),
                  const SizedBox(height: 1),
                  Expanded(child: _buildMiniBatteryBar(color)),
                  const SizedBox(height: 1),
                  Expanded(child: _buildMiniBatteryBar(color)),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMiniBatteryBar(Color color) {
    return Container(
      decoration: BoxDecoration(
        color: color,
        borderRadius: BorderRadius.circular(1),
      ),
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
          IntrinsicHeight(
            child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Expanded(
                child: ElevatedButton(
                  onPressed: isMiningPoolFull
                      ? () {
                          print('⚠️ Free Ad Mining 点击 - 电池槽已满');
                          // 电池槽已满，显示提示
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(
                              content: Text('⚠️ The mining pool is full.'),
                              backgroundColor: Colors.orange,
                              duration: Duration(seconds: 3),
                            ),
                          );
                        }
                      : () {
                          print('✅ Free Ad Mining 点击 - 准备导航到AdRewardScreen');
                          // 跳转到广告奖励页面（非签到模式）
                          Navigator.push(
                            context,
                            MaterialPageRoute(
                              builder: (context) => const AdRewardScreen(isDailyCheckIn: false),
                            ),
                          ).then((result) {
                            print('✅ 从AdRewardScreen返回, result=$result');
                            if (result == true) {
                              // 立即乐观更新 Contracts 页 UI，无需等待 API
                              widget.onAdRewardClaimed?.call();
                              // 异步刷新余额与挖矿速率，确保 0.1s 递增立即启动
                              _refreshBalanceAfterMiningStart();
                            }
                            // 后台刷新本页数据
                            _loadContractAndUpdateBatteries();
                            _loadUserLevel();
                            _loadPointsData();
                          });
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
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
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
                      const SizedBox(height: 4),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(
                            Icons.play_arrow,
                            size: 18,
                            color: isMiningPoolFull
                                ? Colors.white.withOpacity(0.5)
                                : Colors.white,
                          ),
                          const SizedBox(width: 4),
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
                              '⚠️ You have already checked in today! Please try again after UTC 00:00',
                            ),
                            backgroundColor: Colors.orange,
                            duration: Duration(seconds: 3),
                          ),
                        );
                      }
                      return;
                    }

                    // 未签到，跳转到广告奖励页面（签到模式）
                    // AdRewardScreen 会在签到成功后自动跳转到 CheckInScreen
                    final result = await Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (context) => const AdRewardScreen(isDailyCheckIn: true),
                      ),
                    );
                    
                    // 签到成功后刷新数据（不需要跳转，AdRewardScreen已经处理）
                    if (result == true && mounted) {
                      print('✅ [Dashboard] 签到成功，刷新数据');
                      // 刷新余额和挖矿速率，确保 0.1s 递增立即启动
                      await _refreshBalanceAfterMiningStart();
                      await _loadContractAndUpdateBatteries();
                      await _loadUserLevel();
                      await _loadPointsData();
                      // 立即通知 Contracts 页刷新
                      widget.onContractRefreshNeeded?.call();
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
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Text(
                        'Daily Check-in Reward',
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.bold,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.visible,
                      ),
                      const SizedBox(height: 4),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          const Icon(Icons.card_giftcard, size: 18),
                          const SizedBox(width: 4),
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
