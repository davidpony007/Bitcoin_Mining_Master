import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../constants/app_constants.dart';
import '../models/checkin_model.dart';
import '../services/points_api_service.dart';

/// 签到页面
class CheckInScreen extends StatefulWidget {
  const CheckInScreen({super.key});

  @override
  State<CheckInScreen> createState() => _CheckInScreenState();
}

class _CheckInScreenState extends State<CheckInScreen> with SingleTickerProviderStateMixin {
  final PointsApiService _apiService = PointsApiService();
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
    _animationController = AnimationController(
      duration: const Duration(milliseconds: 500),
      vsync: this,
    );
    _scaleAnimation = Tween<double>(begin: 1.0, end: 1.2).animate(
      CurvedAnimation(parent: _animationController, curve: Curves.easeInOut),
    );
    _loadData();
  }

  @override
  void dispose() {
    _animationController.dispose();
    super.dispose();
  }

  Future<void> _loadData() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      // 使用模拟数据进行测试
      final status = await _apiService.getCheckInStatus().catchError((_) => CheckInStatus(
        checkedInToday: false,
        consecutiveDays: 3,
        lastCheckInDate: DateTime.now().subtract(const Duration(days: 1)),
        nextMilestone: '7 days',
        daysUntilMilestone: 4,
      ));
      
      final history = await _apiService.getCheckInHistory(days: 30).catchError((_) => <CheckInRecord>[]);
      final milestones = await _apiService.getCheckInMilestones().catchError((_) => <CheckInMilestone>[]);
      
      // 使用模拟日历数据
      final calendar = await _apiService.get30DayCalendar().catchError((_) => _createMockCalendar());
      final config = await _apiService.getCheckInConfig().catchError((_) => _createMockConfig());

      setState(() {
        _status = status;
        _history = history;
        _milestones = milestones;
        _calendarData = calendar;
        _config = config;
        _isLoading = false;
      });
    } catch (e) {
      // 使用完整的模拟数据
      setState(() {
        _status = CheckInStatus(
          checkedInToday: false,
          consecutiveDays: 3,
          lastCheckInDate: DateTime.now().subtract(const Duration(days: 1)),
          nextMilestone: '7 days',
          daysUntilMilestone: 4,
        );
        _calendarData = _createMockCalendar();
        _config = _createMockConfig();
        _isLoading = false;
      });
    }
  }
  
  Map<String, dynamic> _createMockCalendar() {
    // 创建30天日历，前5天已签到
    final calendar = List.generate(30, (index) {
      final day = index + 1;
      return {
        'day': day,
        'isChecked': day <= 5, // 前5天已签到
        'isToday': day == 6, // 第6天是今天
        'date': DateTime.now().subtract(Duration(days: 5 - day)),
      };
    });
    
    return {
      'success': true,
      'calendar': calendar,
    };
  }
  
  Map<String, dynamic> _createMockConfig() {
    // 每日奖励配置
    final dailyRewards = <String, int>{};
    for (int i = 1; i <= 30; i++) {
      dailyRewards[i.toString()] = i <= 7 ? i + 3 : (i <= 14 ? 12 : (i <= 21 ? 15 : 20));
    }
    
    return {
      'success': true,
      'dailyRewards': dailyRewards,
      'milestones': [
        {'day': 7, 'bonus': 50},
        {'day': 14, 'bonus': 100},
        {'day': 21, 'bonus': 200},
        {'day': 30, 'bonus': 500},
      ],
    };
  }

  Future<void> _performCheckIn() async {
    if (_status?.checkedInToday == true || _isCheckingIn) return;

    setState(() => _isCheckingIn = true);

    try {
      _animationController.forward().then((_) => _animationController.reverse());
      
      final result = await _apiService.performCheckIn();
      
      if (result.success) {
        await _loadData();
        
        if (mounted) {
          showDialog(
            context: context,
            builder: (context) => _buildSuccessDialog(result),
          );
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Check-in failed: $e'),
            backgroundColor: AppColors.error,
          ),
        );
      }
    } finally {
      setState(() => _isCheckingIn = false);
    }
  }

  Future<void> _claimMilestone(int days) async {
    try {
      final result = await _apiService.claimMilestone(days);
      
      if (result['success'] == true) {
        await _loadData();
        
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('Successfully claimed ${result['bonus_points']} points reward!'),
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
                        const SizedBox(height: 16),
                        _buildMilestonesSection(),
                        const SizedBox(height: 16),
                      ],
                    ),
                  ),
                ),
    );
  }

  Widget _buildCheckInCard() {
    final checkedIn = _status?.checkedInToday ?? false;
    final consecutiveDays = _status?.consecutiveDays ?? 0;

    return Container(
      margin: const EdgeInsets.all(16),
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            AppColors.primary,
            AppColors.secondary,
          ],
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
            'Consecutive Days',
            style: TextStyle(
              color: Colors.white70,
              fontSize: 16,
            ),
          ),
          const SizedBox(height: 8),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                '$consecutiveDays',
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
          const SizedBox(height: 16),
          ScaleTransition(
            scale: _scaleAnimation,
            child: ElevatedButton(
              onPressed: checkedIn || _isCheckingIn ? null : _performCheckIn,
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.white,
                disabledBackgroundColor: Colors.white.withOpacity(0.5),
                foregroundColor: AppColors.primary,
                padding: const EdgeInsets.symmetric(horizontal: 48, vertical: 16),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(30),
                ),
                elevation: 0,
              ),
              child: _isCheckingIn
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(
                          checkedIn ? Icons.check_circle : Icons.touch_app,
                          size: 24,
                        ),
                        const SizedBox(width: 8),
                        Text(
                          checkedIn ? 'Checked In' : 'Check In Now',
                          style: const TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ],
                    ),
            ),
          ),
          if (_status?.nextMilestone != null) ...[
            const SizedBox(height: 16),
            Text(
              '${_status!.daysUntilMilestone} days until next milestone',
              style: const TextStyle(
                color: Colors.white70,
                fontSize: 12,
              ),
            ),
          ],
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
            style: TextStyle(
              color: AppColors.textSecondary,
              fontSize: 12,
            ),
          ),
          if (isClaimable) ...[
            const SizedBox(height: 8),
            ElevatedButton(
              onPressed: () => _claimMilestone(milestone.days),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary,
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
                minimumSize: Size.zero,
              ),
              child: const Text(
                'Claim',
                style: TextStyle(fontSize: 12),
              ),
            ),
          ],
          if (isClaimed)
            const Text(
              'Claimed',
              style: TextStyle(
                color: AppColors.success,
                fontSize: 10,
              ),
            ),
        ],
      ),
    );
  }

  Widget _build30DayCalendar() {
    if (_calendarData == null || _config == null) {
      return const SizedBox.shrink();
    }

    final calendar = _calendarData!['calendar'] as List<dynamic>;
    final dailyRewards = _config!['dailyRewards'] as Map<String, dynamic>;
    final milestones = _config!['milestones'] as List<dynamic>;

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
            style: TextStyle(
              color: AppColors.textSecondary,
              fontSize: 14,
            ),
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
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                      decoration: BoxDecoration(
                        color: AppColors.primary.withOpacity(0.2),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(
                          color: AppColors.primary.withOpacity(0.5),
                          width: 1,
                        ),
                      ),
                      child: Text(
                        '${(_status?.consecutiveDays ?? 0)}/30',
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
        boxShadow: isChecked ? [
          BoxShadow(
            color: AppColors.success.withOpacity(0.3),
            blurRadius: 8,
            spreadRadius: 0,
          ),
        ] : null,
      ),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          if (isChecked)
            Icon(
              Icons.check_circle,
              color: Colors.white,
              size: 24,
            )
          else if (isMilestone)
            Icon(
              Icons.emoji_events,
              color: Colors.amber,
              size: 22,
            )
          else if (isToday)
            Icon(
              Icons.today,
              color: AppColors.primary,
              size: 20,
            )
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
                  : (isToday ? AppColors.primary.withOpacity(0.2) : Colors.transparent),
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
          _buildLegendItem(Icons.today, 'Today', AppColors.primary),
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
              .map((day) => SizedBox(
                    width: 40,
                    child: Text(
                      day,
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                        color: AppColors.textSecondary,
                        fontSize: 12,
                      ),
                    ),
                  ))
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
                            fontWeight: isToday ? FontWeight.bold : FontWeight.normal,
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
                        'Consecutive:',
                        style: TextStyle(color: AppColors.textPrimary),
                      ),
                      Text(
                        '${result.consecutiveDays} Days',
                        style: const TextStyle(
                          color: AppColors.primary,
                          fontSize: 20,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ],
                  ),
                  if (result.milestoneReached && result.milestoneBonus != null) ...[
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
                padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 12),
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
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.primary,
            ),
            child: const Text('Retry'),
          ),
        ],
      ),
    );
  }
}
