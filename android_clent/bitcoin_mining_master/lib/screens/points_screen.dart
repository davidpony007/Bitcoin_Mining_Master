import 'package:flutter/material.dart';
import '../constants/app_constants.dart';
import '../models/points_model.dart';
import '../services/points_api_service.dart';
import '../services/api_service.dart';
import '../services/storage_service.dart';

/// 积分中心页面
class PointsScreen extends StatefulWidget {
  const PointsScreen({super.key});

  @override
  State<PointsScreen> createState() => _PointsScreenState();
}

class _PointsScreenState extends State<PointsScreen> {
  final PointsApiService _apiService = PointsApiService();
  final ApiService _levelApiService = ApiService();
  final StorageService _storageService = StorageService();
  
  PointsBalance? _balance;
  List<PointsTransaction> _transactions = [];
  PointsStatistics? _statistics;
  
  // 等级相关
  int _userLevel = 1;
  String _levelName = 'LV.1';
  int _maxPoints = 20;
  
  bool _isLoading = true;
  String? _error;
  int _currentPage = 1;
  String? _filterType;

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  @override
  void dispose() {
    super.dispose();
  }

  Future<void> _loadData() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      // 并行加载数据以提高速度
      final results = await Future.wait([
        _apiService.getPointsBalance(),
        _apiService.getPointsTransactions(page: _currentPage),
      ]);
      
      setState(() {
        _balance = results[0] as PointsBalance;
        _transactions = results[1] as List<PointsTransaction>;
        _isLoading = false;
      });
      
      // 加载用户等级
      await _loadUserLevel();
    } catch (e) {
      print('❌ Points数据加载失败: $e');
      setState(() {
        _error = _formatError(e.toString());
        _isLoading = false;
      });
    }
  }
  
  Future<void> _loadUserLevel() async {
    try {
      final userId = _storageService.getUserId();
      if (userId != null && userId.isNotEmpty) {
        final response = await _levelApiService.getUserLevel(userId);
        print('🔍 等级API响应: $response');
        if (response['success'] == true && response['data'] != null) {
          final data = response['data'];
          print('📊 等级数据: level=${data['level']}, levelName=${data['levelName']}, maxPoints=${data['maxPoints']}');
          setState(() {
            _userLevel = data['level'] ?? 1;
            _levelName = data['levelName'] ?? 'LV.1';
            // maxPoints是当前等级需要达到的最大积分（下一级所需积分）
            _maxPoints = data['maxPoints'] ?? 20;
          });
          print('✅ 等级更新成功: $_userLevel, $_levelName, 下一级需要: $_maxPoints 积分');
        }
      }
    } catch (e) {
      print('⚠️ 加载等级失败: $e');
      // 使用本地缓存
      setState(() {
        _userLevel = _storageService.getUserLevel();
        _levelName = 'LV.$_userLevel';
      });
    }
  }

  String _formatError(String error) {
    if (error.contains('SocketException') || error.contains('Network error')) {
      return 'Network connection failed\nPlease check your internet connection';
    } else if (error.contains('TimeoutException')) {
      return 'Request timeout\nPlease try again later';
    } else if (error.contains('User ID not found')) {
      return 'Please login first';
    }
    return 'Failed to load data\n${error.split(':').last}';
  }

  void _showPointsGuide() {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: Colors.white,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(20),
        ),
        title: Column(
          children: [
            Icon(
              Icons.lightbulb_outline,
              color: AppColors.primary,
              size: 36,
            ),
            const SizedBox(height: 8),
            const Text(
              'Points Guide',
              style: TextStyle(
                fontWeight: FontWeight.bold,
                fontSize: 22,
                color: Colors.black87,
              ),
            ),
          ],
        ),
        contentPadding: const EdgeInsets.fromLTRB(24, 20, 24, 0),
        content: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              _buildGuideSection(
                'Free Ad Reward',
                Icons.play_circle_outline,
                [
                  _buildGuideItem('Watch one ad', '+1 point, daily cap 20 points, resets at UTC+00:00'),
                ],
              ),
              const Divider(height: 32, thickness: 1),
              _buildGuideSection(
                'Referral Rewards',
                Icons.people_outline,
                [
                  _buildGuideItem('Invite 1 friend\n(must complete 5 ad views)', '+6 points, unlimited'),
                  _buildGuideItem('Invite 10 friends\n(each must complete 5 ad views)', 'Extra +30 points, unlimited'),
                  _buildGuideItem('Each referred friend completes\n10 ad views', 'You get +1 point, unlimited'),
                ],
              ),
              const Divider(height: 32, thickness: 1),
              _buildGuideSection(
                'Daily Check-in Reward',
                Icons.calendar_today,
                [
                  _buildGuideItem('Complete daily check-in', '+4 points, daily'),
                  _buildGuideItem('Check in for 3 days\n(cumulative)', 'Extra +6 points, one-time'),
                  _buildGuideItem('Check in for 7 days\n(cumulative)', 'Extra +15 points, one-time'),
                  _buildGuideItem('Check in for 15 days\n(cumulative)', 'Extra +30 points, one-time'),
                  _buildGuideItem('Check in for 30 days\n(cumulative)', 'Extra +60 points, one-time'),
                ],
              ),
              const SizedBox(height: 16),
            ],
          ),
        ),
        actions: [
          Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
            child: ElevatedButton(
              onPressed: () => Navigator.of(context).pop(),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
                elevation: 0,
              ),
              child: const Text(
                'Got it!',
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
          ),
        ],
        actionsPadding: EdgeInsets.zero,
      ),
    );
  }

  Widget _buildGuideSection(String title, IconData icon, List<Widget> items) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Icon(icon, color: AppColors.primary, size: 22),
            const SizedBox(width: 8),
            Text(
              title,
              style: const TextStyle(
                fontWeight: FontWeight.bold,
                fontSize: 17,
                color: Colors.black87,
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        ...items,
      ],
    );
  }

  Widget _buildGuideItem(String action, String reward) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            margin: const EdgeInsets.only(top: 4),
            width: 6,
            height: 6,
            decoration: BoxDecoration(
              color: AppColors.primary,
              shape: BoxShape.circle,
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  action,
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w500,
                    color: Colors.black87,
                    height: 1.4,
                  ),
                ),
                const SizedBox(height: 4),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: AppColors.primary.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    reward,
                    style: TextStyle(
                      fontSize: 13,
                      color: AppColors.primary.withOpacity(0.9),
                      fontWeight: FontWeight.w600,
                      height: 1.3,
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

  Future<void> _loadTransactions() async {
    try {
      final transactions = await _apiService.getPointsTransactions(
        page: _currentPage,
        type: _filterType,
      );
      setState(() {
        _transactions = transactions;
      });
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Loading failed: $e')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Points Center'),
        backgroundColor: AppColors.cardDark,
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? _buildErrorWidget()
              : SingleChildScrollView(
                  child: _buildBalanceHeader(),
                ),
    );
  }

  Widget _buildBalanceHeader() {
    final totalPoints = _balance?.totalPoints ?? 0;
    final availablePoints = _balance?.availablePoints ?? totalPoints;
    final frozenPoints = totalPoints - availablePoints;
    
    return Container(
      margin: const EdgeInsets.all(16),
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            AppColors.primary,
            AppColors.primary.withOpacity(0.7),
          ],
        ),
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: AppColors.primary.withOpacity(0.4),
            blurRadius: 20,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Column(
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'Current Level Points',
                style: TextStyle(
                  color: Colors.white70,
                  fontSize: 14,
                  fontWeight: FontWeight.w500,
                ),
              ),
              IconButton(
                icon: const Icon(
                  Icons.help_outline,
                  color: Colors.white,
                  size: 24,
                ),
                onPressed: _showPointsGuide,
                padding: EdgeInsets.zero,
                constraints: const BoxConstraints(),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                '$totalPoints',
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 48,
                  fontWeight: FontWeight.bold,
                  height: 1,
                ),
              ),
              const SizedBox(width: 8),
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Text(
                  'PTS',
                  style: TextStyle(
                    color: Colors.white.withOpacity(0.7),
                    fontSize: 16,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Divider(color: Colors.white.withOpacity(0.2), height: 1),
          const SizedBox(height: 16),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceAround,
            children: [
              _buildPointsStat('Level', _levelName, Icons.military_tech),
              Container(
                width: 1,
                height: 30,
                color: Colors.white.withOpacity(0.2),
              ),
              _buildPointsStat('Next Level', '$_maxPoints PTS', Icons.arrow_upward),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildPointsStat(String label, String value, IconData icon) {
    return Column(
      children: [
        Icon(icon, color: Colors.white70, size: 20),
        const SizedBox(height: 4),
        Text(
          value,
          style: const TextStyle(
            color: Colors.white,
            fontSize: 18,
            fontWeight: FontWeight.bold,
          ),
        ),
        Text(
          label,
          style: const TextStyle(
            color: Colors.white70,
            fontSize: 12,
          ),
        ),
      ],
    );
  }

  String _formatTime(DateTime? date) {
    if (date == null) return '--:--';
    final now = DateTime.now();
    final diff = now.difference(date);
    
    if (diff.inMinutes < 1) return 'Just now';
    if (diff.inHours < 1) return '${diff.inMinutes}m ago';
    if (diff.inDays < 1) return '${diff.inHours}h ago';
    return '${diff.inDays}d ago';
  }

  Widget _buildTransactionsTab() {
    return RefreshIndicator(
      onRefresh: _loadData,
      child: Column(
        children: [
          // 筛选器
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: Row(
              children: [
                const Text('Filter: ', style: TextStyle(color: AppColors.textPrimary)),
                Expanded(
                  child: SingleChildScrollView(
                    scrollDirection: Axis.horizontal,
                    child: Row(
                      children: [
                        _buildFilterChip('All', null),
                        _buildFilterChip('Ads', 'AD_VIEW'),
                        _buildFilterChip('Check-in', 'DAILY_CHECKIN'),
                        _buildFilterChip('Referral', 'REFERRAL_1'),
                        _buildFilterChip('Milestone', 'REFERRAL_10'),
                        _buildFilterChip('Cumulative', 'CUMULATIVE_CHECKIN_7'),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
          Expanded(
            child: _transactions.isEmpty
                ? Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(
                          Icons.receipt_long_outlined,
                          size: 80,
                          color: AppColors.textSecondary.withOpacity(0.5),
                        ),
                        const SizedBox(height: 16),
                        const Text(
                          'No Transaction Records',
                          style: TextStyle(
                            color: AppColors.textPrimary,
                            fontSize: 16,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          'Start earning points by:\n• Watching ads\n• Daily check-ins\n• Inviting friends',
                          style: TextStyle(
                            color: AppColors.textSecondary,
                            fontSize: 14,
                          ),
                          textAlign: TextAlign.center,
                        ),
                      ],
                    ),
                  )
                : ListView.builder(
                    padding: const EdgeInsets.only(bottom: 16),
                    itemCount: _transactions.length,
                    itemBuilder: (context, index) {
                      final transaction = _transactions[index];
                      return _buildTransactionItem(transaction);
                    },
                  ),
          ),
        ],
      ),
    );
  }

  Widget _buildFilterChip(String label, String? type) {
    final isSelected = _filterType == type;
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: FilterChip(
        label: Text(label),
        selected: isSelected,
        onSelected: (selected) {
          setState(() {
            _filterType = type;
            _currentPage = 1;
          });
          _loadTransactions();
        },
        selectedColor: AppColors.primary,
        backgroundColor: AppColors.surface,
        labelStyle: TextStyle(
          color: isSelected ? Colors.white : AppColors.textPrimary,
        ),
      ),
    );
  }

  Widget _buildTransactionItem(PointsTransaction transaction) {
    final isPositive = transaction.points > 0;
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      decoration: BoxDecoration(
        color: AppColors.cardDark,
        borderRadius: BorderRadius.circular(12),
      ),
      child: ListTile(
        leading: Container(
          padding: const EdgeInsets.all(8),
          decoration: BoxDecoration(
            color: isPositive 
                ? AppColors.success.withOpacity(0.2)
                : AppColors.error.withOpacity(0.2),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Icon(
            isPositive ? Icons.add : Icons.remove,
            color: isPositive ? AppColors.success : AppColors.error,
          ),
        ),
        title: Text(
          transaction.typeDisplay,
          style: const TextStyle(
            color: AppColors.textPrimary,
            fontWeight: FontWeight.bold,
          ),
        ),
        subtitle: Text(
          transaction.description ?? '',
          style: const TextStyle(
            color: AppColors.textSecondary,
            fontSize: 12,
          ),
        ),
        trailing: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Text(
              '${isPositive ? '+' : ''}${transaction.points}',
              style: TextStyle(
                color: isPositive ? AppColors.success : AppColors.error,
                fontSize: 16,
                fontWeight: FontWeight.bold,
              ),
            ),
            Text(
              _formatDate(transaction.createdAt),
              style: const TextStyle(
                color: AppColors.textSecondary,
                fontSize: 10,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildStatisticsTab() {
    if (_statistics == null) {
      return const Center(child: Text('No Statistics Available', style: TextStyle(color: AppColors.textSecondary)));
    }

    return RefreshIndicator(
      onRefresh: _loadData,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          _buildStatCard(
            'Current Points',
            '${_statistics!.currentPoints}',
            Icons.stars,
            AppColors.primary,
          ),
          const SizedBox(height: 16),
          _buildStatCard(
            'Available Points',
            '${_statistics!.availablePoints}',
            Icons.wallet,
            AppColors.success,
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: _buildStatCard(
                  'Total Earned',
                  '${_statistics!.totalEarned}',
                  Icons.trending_up,
                  AppColors.primary,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _buildStatCard(
                  'Total Spent',
                  '${_statistics!.totalSpent}',
                  Icons.trending_down,
                  AppColors.error,
                ),
              ),
            ],
          ),
          const SizedBox(height: 20),
          const Text(
            'Points Source Distribution',
            style: TextStyle(
              color: AppColors.textPrimary,
              fontSize: 18,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 12),
          ..._statistics!.items.map((item) {
            return _buildTypeStatItem(item);
          }),
        ],
      ),
    );
  }

  Widget _buildStatCard(String label, String value, IconData icon, Color color) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: AppColors.cardDark,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: color.withOpacity(0.2),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(icon, color: color, size: 32),
          ),
          const SizedBox(width: 16),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label,
                style: const TextStyle(
                  color: AppColors.textSecondary,
                  fontSize: 14,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                value,
                style: const TextStyle(
                  color: AppColors.textPrimary,
                  fontSize: 28,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildTypeStatItem(PointsTypeStat stat) {
    final typeNames = {
      'AD_VIEW': 'Watch Ads',
      'DAILY_CHECKIN': 'Daily Check-in',
      'REFERRAL_1': 'Referral Reward',
      'REFERRAL_10': 'Referral Milestone',
      'SUBORDINATE_AD_VIEW': 'Subordinate Ads',
      'CUMULATIVE_CHECKIN_3': '3-Day Cumulative',
      'CUMULATIVE_CHECKIN_7': '7-Day Cumulative',
      'CUMULATIVE_CHECKIN_15': '15-Day Cumulative',
      'CUMULATIVE_CHECKIN_30': '30-Day Cumulative',
      'MANUAL_ADD': 'Manual Add',
      'MANUAL_DEDUCT': 'Manual Deduct',
    };

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.cardDark,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            typeNames[stat.type] ?? stat.type,
            style: const TextStyle(
              color: AppColors.textPrimary,
              fontSize: 14,
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                '+${stat.totalEarned}',
                style: const TextStyle(
                  color: AppColors.success,
                  fontSize: 14,
                  fontWeight: FontWeight.bold,
                ),
              ),
              if (stat.totalSpent > 0)
                Text(
                  '-${stat.totalSpent}',
                  style: const TextStyle(
                    color: AppColors.error,
                    fontSize: 12,
                  ),
                ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildErrorWidget() {
    final isNetworkError = _error?.contains('Network') ?? false;
    final isLoginError = _error?.contains('login') ?? false;
    
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            // 错误图标
            Container(
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                color: AppColors.error.withOpacity(0.1),
                shape: BoxShape.circle,
              ),
              child: Icon(
                isNetworkError 
                    ? Icons.wifi_off 
                    : isLoginError
                        ? Icons.person_off
                        : Icons.error_outline,
                size: 64,
                color: AppColors.error,
              ),
            ),
            const SizedBox(height: 24),
            // 错误标题
            Text(
              isNetworkError 
                  ? 'Connection Failed' 
                  : isLoginError
                      ? 'Login Required'
                      : 'Something Went Wrong',
              style: const TextStyle(
                color: AppColors.textPrimary,
                fontSize: 20,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 12),
            // 错误详情
            Text(
              _error ?? 'Unknown error occurred',
              style: const TextStyle(
                color: AppColors.textSecondary,
                fontSize: 14,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 32),
            // 重试按钮
            ElevatedButton.icon(
              onPressed: _loadData,
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 16),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
              icon: const Icon(Icons.refresh),
              label: const Text(
                'Retry',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
              ),
            ),
            if (isNetworkError) ...[
              const SizedBox(height: 16),
              TextButton(
                onPressed: () {
                  // 显示网络故障排除提示
                  showDialog(
                    context: context,
                    builder: (context) => AlertDialog(
                      backgroundColor: AppColors.cardDark,
                      title: const Text(
                        'Network Troubleshooting',
                        style: TextStyle(color: AppColors.textPrimary),
                      ),
                      content: const Text(
                        '1. Check your WiFi or mobile data\n'
                        '2. Ensure backend server is running\n'
                        '3. Verify the API URL is correct\n'
                        '4. Try restarting the app',
                        style: TextStyle(color: AppColors.textSecondary),
                      ),
                      actions: [
                        TextButton(
                          onPressed: () => Navigator.pop(context),
                          child: const Text('OK'),
                        ),
                      ],
                    ),
                  );
                },
                child: const Text(
                  'Troubleshooting Tips',
                  style: TextStyle(color: AppColors.primary),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  String _formatDate(DateTime date) {
    return '${date.month}/${date.day}';
  }

  String _formatDateTime(DateTime? date) {
    if (date == null) return '--';
    return '${date.month}/${date.day} ${date.hour}:${date.minute.toString().padLeft(2, '0')}';
  }
}
