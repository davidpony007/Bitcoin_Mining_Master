import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../constants/app_constants.dart';
import '../models/checkin_model.dart';
import '../services/points_api_service.dart';
import '../services/storage_service.dart';
import '../services/admob_service.dart';
import '../services/user_repository.dart';
import '../services/api_service.dart';
import 'ad_reward_screen.dart';

/// 签到页面
class CheckInScreen extends StatefulWidget {
  final bool shouldRefresh; // 是否需要延迟刷新（签到后跳转过来）
  
  const CheckInScreen({super.key, this.shouldRefresh = false});

  @override
  State<CheckInScreen> createState() => _CheckInScreenState();
}

class _CheckInScreenState extends State<CheckInScreen>
    with SingleTickerProviderStateMixin, WidgetsBindingObserver {
  final PointsApiService _apiService = PointsApiService();
  final StorageService _storageService = StorageService();
  final AdMobService _adMobService = AdMobService();
  final UserRepository _userRepository = UserRepository();
  final ApiService _checkInApiService = ApiService();
  late AnimationController _animationController;
  late Animation<double> _scaleAnimation;

  CheckInStatus? _status;
  List<CheckInRecord> _history = [];
  List<CheckInMilestone> _milestones = [];
  Map<String, dynamic>? _calendarData;
  Map<String, dynamic>? _config;

  bool _isLoading = true;
  bool _isCheckingIn = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this); // 添加生命周期观察者
    _animationController = AnimationController(
      duration: const Duration(milliseconds: 500),
      vsync: this,
    );
    _scaleAnimation = Tween<double>(begin: 1.0, end: 1.2).animate(
      CurvedAnimation(parent: _animationController, curve: Curves.easeInOut),
    );
    _initLoadData();
  }
  
  /// 初始化数据加载（支持延迟）
  Future<void> _initLoadData() async {
    if (widget.shouldRefresh) {
      print('⏳ [CheckIn Screen] 签到后跳转，等待2秒确保后端数据写入...');
      await Future.delayed(const Duration(seconds: 2));
      print('✅ [CheckIn Screen] 等待完成，开始加载数据');
    }
    await _loadData();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this); // 移除生命周期观察者
    _animationController.dispose();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    super.didChangeAppLifecycleState(state);
    // 当应用从后台返回时重新加载数据（例如从广告页面返回）
    if (state == AppLifecycleState.resumed) {
      _loadData();
    }
  }

  Future<void> _loadData() async {
    print('🔄 [CheckIn Screen] 开始加载签到数据...');
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      // 使用模拟数据进行测试
      final status = await _apiService.getCheckInStatus().catchError(
        (e) {
          print('❌ [CheckIn Screen] API获取签到状态失败: $e');
          return CheckInStatus(
            checkedInToday: false,
            totalDays: 0,
            lastCheckInDate: null,
            nextMilestone: '3 days',
            daysUntilMilestone: 3,
          );
        },
      );
      
      print('📊 [CheckIn Screen] API返回签到状态: totalDays=${status.totalDays}, checkedInToday=${status.checkedInToday}');

      final history = await _apiService
          .getCheckInHistory(days: 30)
          .catchError((_) => <CheckInRecord>[]);
      final milestones = await _apiService.getCheckInMilestones().catchError(
        (_) => <CheckInMilestone>[],
      );

      // 直接使用模拟日历数据(API暂未实现)
      final calendar = _createMockCalendar(totalDays: status.totalDays);
      final config = _createMockConfig();
      print('✅ [CheckIn Screen] 使用模拟日历数据: calendar keys=${calendar.keys}, config keys=${config.keys}, totalDays=${status.totalDays}');
      print('📅 [CheckIn Screen] 日历数据: ${calendar['calendar']?.length} days');

      setState(() {
        _status = status;
        _history = history;
        _milestones = milestones;
        _calendarData = calendar;
        _config = config;
        _isLoading = false;
      });
      
      print('✅ [CheckIn Screen] 数据加载完成: totalDays=${_status?.totalDays}, checkedInToday=${_status?.checkedInToday}');
    } catch (e) {
      // 使用完整的模拟数据
      setState(() {
        _status = CheckInStatus(
          checkedInToday: false,
          totalDays: 0,
          lastCheckInDate: null,
          nextMilestone: '3 days',
          daysUntilMilestone: 3,
        );
        _calendarData = _createMockCalendar();
        _config = _createMockConfig();
        _isLoading = false;
      });
    }
  }

  /// 播放签到广告并执行签到
  Future<void> _playCheckInAd() async {
    // 首先检查今日是否已签到
    final lastCheckInDate = _storageService.getLastCheckInDate();
    final today = DateTime.now().toIso8601String().split('T')[0];
    
    print('🔍 [CheckIn Screen] 签到检查: lastCheckInDate=$lastCheckInDate, today=$today');

    if (lastCheckInDate == today) {
      // 今日已签到，显示提示
      print('⚠️ [CheckIn Screen] 今日已签到，阻止播放广告');
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
    
    print('✅ [CheckIn Screen] 未签到，准备播放广告');

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
        // 用户看完广告，执行签到
        setState(() => _isCheckingIn = true);
        
        final success = await _performCheckIn();
        
        setState(() => _isCheckingIn = false);
        
        if (!mounted) return;

        if (success) {
          // 签到成功，手动增加totalDays并重新创建日历
          final newTotalDays = (_status?.totalDays ?? 0) + 1;
          print('✅ 签到成功! 旧天数: ${_status?.totalDays}, 新天数: $newTotalDays');
          
          // 先更新状态显示新天数
          if (_status != null) {
            setState(() {
              _status = CheckInStatus(
                checkedInToday: true,
                totalDays: newTotalDays,
                lastCheckInDate: DateTime.now(),
                nextMilestone: _status!.nextMilestone,
                daysUntilMilestone: _status!.daysUntilMilestone,
              );
              // 立即重新创建日历数据，使用新的totalDays
              _calendarData = _createMockCalendar(totalDays: newTotalDays);
            });
          }
          
          // 再重新加载服务器数据（可能需要一点时间同步）
          await Future.delayed(Duration(milliseconds: 500));
          await _loadData();
          
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(
                content: Text('✅ Check-in successful!'),
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
      setState(() => _isCheckingIn = false);
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
      final response = await _checkInApiService.performCheckIn(userId: userId);

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
        final saved = await _storageService.saveLastCheckInDate(today);
        print('✅ 签到成功! 保存日期: $today, saved=$saved');
        // 验证是否真的保存成功
        final verified = _storageService.getLastCheckInDate();
        print('🔍 验证保存结果: $verified');
      } else {
        print('❌ 签到失败');
      }
      
      return success;
    } catch (e) {
      print('❌ 签到失败: $e');
      return false;
    }
  }

  Map<String, dynamic> _createMockCalendar({int? totalDays}) {
    // 获取用户已签到的总天数
    final checkedDays = totalDays ?? _status?.totalDays ?? 0;
    print('📅 [CheckIn Screen] 创建日历数据: checkedDays=$checkedDays');
    
    // 创建30天日历，根据totalDays标记已签到的天
    final calendar = List.generate(30, (index) {
      final day = index + 1;
      final isChecked = day <= checkedDays; // 已签到天数内的都标记为已签到
      final isToday = day == checkedDays + 1; // 下一个要签到的天是"今天"
      
      if (day <= 3) {
        print('  Day $day: isChecked=$isChecked, isToday=$isToday');
      }
      
      return {
        'day': day,
        'isChecked': isChecked,
        'isToday': isToday,
        'date': DateTime.now().add(Duration(days: day - 1)),
      };
    });

    return {'success': true, 'calendar': calendar};
  }

  Map<String, dynamic> _createMockConfig() {
    // 每日奖励配置：基础4积分 + 里程碑日期的额外奖励
    final dailyRewards = <String, int>{};
    for (int i = 1; i <= 30; i++) {
      int points = 4; // 基础奖励

      // 里程碑日期加上额外奖励
      if (i == 3) {
        points += 6; // Day 3: 4 + 6 = 10
      } else if (i == 7) {
        points += 15; // Day 7: 4 + 15 = 19
      } else if (i == 15) {
        points += 30; // Day 15: 4 + 30 = 34
      } else if (i == 30) {
        points += 60; // Day 30: 4 + 60 = 64
      }

      dailyRewards[i.toString()] = points;
    }

    return {
      'success': true,
      'dailyRewards': dailyRewards,
      'milestones': [
        {'day': 3, 'bonus': 6}, // 累计3天
        {'day': 7, 'bonus': 15}, // 累计7天
        {'day': 15, 'bonus': 30}, // 累计15天
        {'day': 30, 'bonus': 60}, // 累计30天
      ],
    };
  }

  Future<void> _claimMilestone(int days) async {
    try {
      final result = await _apiService.claimMilestone(days);

      if (result['success'] == true) {
        await _loadData();

        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(
                'Successfully claimed ${result['bonus_points']} points reward!',
              ),
              backgroundColor: AppColors.success,
            ),
          );
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Claim failed: $e'),
            backgroundColor: AppColors.error,
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Daily Check-in'),
        backgroundColor: AppColors.cardDark,
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
          ? _buildErrorWidget()
          : RefreshIndicator(
              onRefresh: _loadData,
              child: SingleChildScrollView(
                physics: const AlwaysScrollableScrollPhysics(),
                child: Column(
                  children: [
                    _buildCheckInCard(),
                    const SizedBox(height: 16),
                    _build30DayCalendar(),
                    SizedBox(height: MediaQuery.of(context).padding.bottom + 32),
                  ],
                ),
              ),
            ),
    );
  }

  Widget _buildCheckInCard() {
    final checkedIn = _status?.checkedInToday ?? false;
    final totalDays = _status?.totalDays ?? 0;

    return Container(
      margin: const EdgeInsets.all(16),
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [AppColors.primary, AppColors.secondary],
        ),
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: AppColors.primary.withOpacity(0.3),
            blurRadius: 15,
            offset: const Offset(0, 5),
          ),
        ],
      ),
      child: Column(
        children: [
          const Text(
            'Total Check-in Days',
            style: TextStyle(color: Colors.white70, fontSize: 16),
          ),
          const SizedBox(height: 8),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                '$totalDays',
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 56,
                  fontWeight: FontWeight.bold,
                  height: 1.0,
                ),
              ),
              const Padding(
                padding: EdgeInsets.only(bottom: 8, left: 4),
                child: Text(
                  'Days',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 20,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildMilestonesSection() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Check-in Milestones',
            style: TextStyle(
              color: AppColors.textPrimary,
              fontSize: 18,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 12),
          SizedBox(
            height: 120,
            child: ListView.builder(
              scrollDirection: Axis.horizontal,
              itemCount: _milestones.length,
              itemBuilder: (context, index) {
                final milestone = _milestones[index];
                return _buildMilestoneCard(milestone);
              },
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMilestoneCard(CheckInMilestone milestone) {
    final isClaimable = milestone.claimable && !milestone.claimed;
    final isClaimed = milestone.claimed;

    return Container(
      width: 140,
      margin: const EdgeInsets.only(right: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.cardDark,
        borderRadius: BorderRadius.circular(16),
        border: isClaimable
            ? Border.all(color: AppColors.primary, width: 2)
            : null,
      ),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            isClaimed ? Icons.check_circle : Icons.emoji_events,
            color: isClaimed
                ? AppColors.success
                : isClaimable
                ? AppColors.primary
                : AppColors.textSecondary,
            size: 32,
          ),
          const SizedBox(height: 8),
          Text(
            '${milestone.days} Days',
            style: TextStyle(
              color: AppColors.textPrimary,
              fontSize: 16,
              fontWeight: FontWeight.bold,
            ),
          ),
          Text(
            '${milestone.bonusPoints} Points',
            style: TextStyle(color: AppColors.textSecondary, fontSize: 12),
          ),
          if (isClaimable) ...[
            const SizedBox(height: 8),
            ElevatedButton(
              onPressed: () => _claimMilestone(milestone.days),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary,
                padding: const EdgeInsets.symmetric(
                  horizontal: 16,
                  vertical: 6,
                ),
                minimumSize: Size.zero,
              ),
              child: const Text('Claim', style: TextStyle(fontSize: 12)),
            ),
          ],
          if (isClaimed)
            const Text(
              'Claimed',
              style: TextStyle(color: AppColors.success, fontSize: 10),
            ),
        ],
      ),
    );
  }

  Widget _build30DayCalendar() {
    if (_calendarData == null || _config == null) {
      print('⚠️ 日历数据或配置为空');
      return const SizedBox.shrink();
    }

    try {
      final calendar = _calendarData!['calendar'] as List<dynamic>?;
      final dailyRewards = _config!['dailyRewards'] as Map<String, dynamic>?;
      final milestones = _config!['milestones'] as List<dynamic>?;

      if (calendar == null || dailyRewards == null || milestones == null) {
        print('⚠️ 日历数据结构不完整: calendar=${calendar != null}, dailyRewards=${dailyRewards != null}, milestones=${milestones != null}');
        return const SizedBox.shrink();
      }

      return Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              '30-Day Check-in Challenge',
              style: TextStyle(
                color: AppColors.textPrimary,
                fontSize: 20,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'Complete daily check-ins to unlock special rewards!',
              style: TextStyle(color: AppColors.textSecondary, fontSize: 14),
            ),
            const SizedBox(height: 16),
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [
                    AppColors.cardDark,
                    AppColors.cardDark.withOpacity(0.8),
                  ],
                ),
                borderRadius: BorderRadius.circular(20),
                border: Border.all(
                  color: AppColors.primary.withOpacity(0.2),
                  width: 1,
                ),
              ),
              child: Column(
                children: [
                  // 标题
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text(
                        '30-Day Challenge',
                        style: TextStyle(
                          color: AppColors.textPrimary,
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 12,
                          vertical: 6,
                        ),
                        decoration: BoxDecoration(
                          color: AppColors.primary.withOpacity(0.2),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(
                            color: AppColors.primary.withOpacity(0.5),
                            width: 1,
                          ),
                        ),
                        child: Text(
                          '${(_status?.totalDays ?? 0)}/30',
                          style: TextStyle(
                            color: AppColors.primary,
                            fontSize: 14,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 20),
                  // 构建5行6列的30天网格
                  for (int row = 0; row < 5; row++)
                    Padding(
                      padding: EdgeInsets.only(bottom: row < 4 ? 12 : 0),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          for (int col = 0; col < 6; col++)
                            _build30DayCell(
                              row * 6 + col + 1,
                              calendar,
                              dailyRewards,
                              milestones,
                            ),
                        ],
                      ),
                    ),
                  const SizedBox(height: 20),
                  _buildLegend(),
                ],
              ),
            ),
          ],
        ),
      );
    } catch (e, stackTrace) {
      print('❌ 构建30天日历失败: $e');
      print('堆栈: $stackTrace');
      return const SizedBox.shrink();
    }
  }

  Widget _build30DayCell(
    int day,
    List<dynamic> calendar,
    Map<String, dynamic> dailyRewards,
    List<dynamic> milestones,
  ) {
    if (day > 30) {
      return const SizedBox(width: 50, height: 64);
    }

    final dayData = calendar.firstWhere(
      (d) => d['day'] == day,
      orElse: () => <String, Object>{},
    );

    final isChecked = dayData['isChecked'] ?? false;
    final isToday = dayData['isToday'] ?? false;
    final isMilestone = milestones.any((m) => m['day'] == day);
    final points = dailyRewards[day.toString()] ?? 4;

    Color cellColor;
    Color textColor;
    Color borderColor;

    if (isChecked) {
      cellColor = AppColors.success;
      textColor = Colors.white;
      borderColor = AppColors.success;
    } else if (isToday) {
      cellColor = AppColors.primary.withOpacity(0.2);
      textColor = AppColors.primary;
      borderColor = AppColors.primary;
    } else {
      cellColor = AppColors.surface.withOpacity(0.3);
      textColor = AppColors.textSecondary;
      borderColor = AppColors.divider;
    }

    if (isMilestone && !isChecked) {
      borderColor = Colors.amber;
      cellColor = Colors.amber.withOpacity(0.1);
    }

    return Container(
      width: 50,
      height: 64,
      decoration: BoxDecoration(
        color: cellColor,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: borderColor,
          width: isToday || isMilestone ? 2 : 1,
        ),
        boxShadow: isChecked
            ? [
                BoxShadow(
                  color: AppColors.success.withOpacity(0.3),
                  blurRadius: 8,
                  spreadRadius: 0,
                ),
              ]
            : null,
      ),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          if (isChecked)
            Icon(Icons.check_circle, color: Colors.white, size: 24)
          else if (isMilestone)
            Icon(Icons.emoji_events, color: Colors.amber, size: 22)
          else if (isToday)
            Icon(Icons.today, color: AppColors.primary, size: 20)
          else
            const SizedBox(height: 24),
          const SizedBox(height: 4),
          Text(
            'Day $day',
            style: TextStyle(
              color: textColor,
              fontSize: 10,
              fontWeight: isChecked ? FontWeight.bold : FontWeight.normal,
            ),
          ),
          const SizedBox(height: 2),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
            decoration: BoxDecoration(
              color: isChecked
                  ? Colors.white.withOpacity(0.2)
                  : (isToday
                        ? AppColors.primary.withOpacity(0.2)
                        : Colors.transparent),
              borderRadius: BorderRadius.circular(4),
            ),
            child: Text(
              '+$points',
              style: TextStyle(
                color: textColor,
                fontSize: 9,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildLegend() {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.surface.withOpacity(0.3),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceAround,
        children: [
          _buildLegendItem(Icons.check_circle, 'Completed', AppColors.success),
          _buildLegendItem(Icons.emoji_events, 'Bonus', Colors.amber),
        ],
      ),
    );
  }

  Widget _buildLegendItem(IconData icon, String label, Color color) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, color: color, size: 18),
        const SizedBox(width: 6),
        Text(
          label,
          style: TextStyle(
            color: AppColors.textPrimary,
            fontSize: 12,
            fontWeight: FontWeight.w500,
          ),
        ),
      ],
    );
  }

  Widget _buildMonthlyCalendar() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Check-in History',
            style: TextStyle(
              color: AppColors.textPrimary,
              fontSize: 18,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: AppColors.cardDark,
              borderRadius: BorderRadius.circular(16),
            ),
            child: _buildCalendar(),
          ),
        ],
      ),
    );
  }

  Widget _buildCalendar() {
    final now = DateTime.now();
    final firstDayOfMonth = DateTime(now.year, now.month, 1);
    final lastDayOfMonth = DateTime(now.year, now.month + 1, 0);
    final daysInMonth = lastDayOfMonth.day;
    final startWeekday = firstDayOfMonth.weekday % 7;

    final checkedDates = _history
        .map((record) => DateFormat('yyyy-MM-dd').format(record.checkInDate))
        .toSet();

    return Column(
      children: [
        // 星期标题
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceAround,
          children: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
              .map(
                (day) => SizedBox(
                  width: 40,
                  child: Text(
                    day,
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      color: AppColors.textSecondary,
                      fontSize: 12,
                    ),
                  ),
                ),
              )
              .toList(),
        ),
        const SizedBox(height: 8),
        // 日期格子
        ...List.generate((daysInMonth + startWeekday) ~/ 7 + 1, (weekIndex) {
          return Padding(
            padding: const EdgeInsets.symmetric(vertical: 4),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceAround,
              children: List.generate(7, (dayIndex) {
                final dayNumber = weekIndex * 7 + dayIndex - startWeekday + 1;
                if (dayNumber < 1 || dayNumber > daysInMonth) {
                  return const SizedBox(width: 40, height: 40);
                }

                final date = DateTime(now.year, now.month, dayNumber);
                final dateStr = DateFormat('yyyy-MM-dd').format(date);
                final isChecked = checkedDates.contains(dateStr);
                final isToday = date.day == now.day;

                return Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    color: isChecked
                        ? AppColors.primary.withOpacity(0.3)
                        : Colors.transparent,
                    borderRadius: BorderRadius.circular(8),
                    border: isToday
                        ? Border.all(color: AppColors.primary, width: 2)
                        : null,
                  ),
                  child: Stack(
                    children: [
                      Center(
                        child: Text(
                          '$dayNumber',
                          style: TextStyle(
                            color: isChecked
                                ? AppColors.primary
                                : AppColors.textPrimary,
                            fontSize: 14,
                            fontWeight: isToday
                                ? FontWeight.bold
                                : FontWeight.normal,
                          ),
                        ),
                      ),
                      if (isChecked)
                        Positioned(
                          bottom: 4,
                          right: 4,
                          child: Icon(
                            Icons.check_circle,
                            color: AppColors.primary,
                            size: 12,
                          ),
                        ),
                    ],
                  ),
                );
              }),
            ),
          );
        }),
      ],
    );
  }

  Widget _buildSuccessDialog(CheckInResult result) {
    return Dialog(
      backgroundColor: Colors.transparent,
      child: Container(
        padding: const EdgeInsets.all(24),
        decoration: BoxDecoration(
          color: AppColors.cardDark,
          borderRadius: BorderRadius.circular(20),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: AppColors.success.withOpacity(0.2),
                shape: BoxShape.circle,
              ),
              child: const Icon(
                Icons.check_circle,
                color: AppColors.success,
                size: 64,
              ),
            ),
            const SizedBox(height: 16),
            const Text(
              'Check-in Success!',
              style: TextStyle(
                color: AppColors.textPrimary,
                fontSize: 24,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              result.message,
              style: const TextStyle(
                color: AppColors.textSecondary,
                fontSize: 14,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 16),
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: AppColors.primary.withOpacity(0.2),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Column(
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text(
                        'Points Earned:',
                        style: TextStyle(color: AppColors.textPrimary),
                      ),
                      Text(
                        '+${result.pointsAwarded}',
                        style: const TextStyle(
                          color: AppColors.primary,
                          fontSize: 20,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text(
                        'Total Days:',
                        style: TextStyle(color: AppColors.textPrimary),
                      ),
                      Text(
                        '${result.totalDays} Days',
                        style: const TextStyle(
                          color: AppColors.primary,
                          fontSize: 20,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ],
                  ),
                  if (result.milestoneReached &&
                      result.milestoneBonus != null) ...[
                    const SizedBox(height: 8),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text(
                          'Milestone Bonus:',
                          style: TextStyle(color: AppColors.textPrimary),
                        ),
                        Text(
                          '+${result.milestoneBonus}',
                          style: const TextStyle(
                            color: AppColors.success,
                            fontSize: 20,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ],
                    ),
                  ],
                ],
              ),
            ),
            const SizedBox(height: 16),
            ElevatedButton(
              onPressed: () => Navigator.of(context).pop(),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary,
                padding: const EdgeInsets.symmetric(
                  horizontal: 32,
                  vertical: 12,
                ),
              ),
              child: const Text('Awesome!'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildErrorWidget() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(Icons.error_outline, size: 64, color: AppColors.error),
          const SizedBox(height: 16),
          Text(
            _error ?? 'Failed to load',
            style: const TextStyle(color: AppColors.textSecondary),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 16),
          ElevatedButton(
            onPressed: _loadData,
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary),
            child: const Text('Retry'),
          ),
        ],
      ),
    );
  }
}
