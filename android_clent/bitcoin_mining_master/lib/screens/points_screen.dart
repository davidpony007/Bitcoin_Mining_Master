import 'package:flutter/material.dart';
import '../constants/app_constants.dart';
import '../models/points_model.dart';
import '../services/points_api_service.dart';

/// 积分中心页面
class PointsScreen extends StatefulWidget {
  const PointsScreen({super.key});

  @override
  State<PointsScreen> createState() => _PointsScreenState();
}

class _PointsScreenState extends State<PointsScreen> with SingleTickerProviderStateMixin {
  final PointsApiService _apiService = PointsApiService();
  late TabController _tabController;
  
  PointsBalance? _balance;
  List<PointsTransaction> _transactions = [];
  PointsStatistics? _statistics;
  
  bool _isLoading = true;
  String? _error;
  int _currentPage = 1;
  String? _filterType;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _loadData();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _loadData() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final balance = await _apiService.getPointsBalance();
      final transactions = await _apiService.getPointsTransactions(page: _currentPage);
      final statistics = await _apiService.getPointsStatistics();
      setState(() {
        _balance = balance;
        _transactions = transactions;
        _statistics = statistics;
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _error = e.toString();
        _isLoading = false;
      });
    }
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
        bottom: TabBar(
          controller: _tabController,
          indicatorColor: AppColors.primary,
          labelColor: AppColors.primary,
          unselectedLabelColor: AppColors.textSecondary,
          tabs: const [
            Tab(text: 'Details'),
            Tab(text: 'Statistics'),
          ],
        ),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? _buildErrorWidget()
              : Column(
                  children: [
                    _buildBalanceHeader(),
                    Expanded(
                      child: TabBarView(
                        controller: _tabController,
                        children: [
                          _buildTransactionsTab(),
                          _buildStatisticsTab(),
                        ],
                      ),
                    ),
                  ],
                ),
    );
  }

  Widget _buildBalanceHeader() {
    final totalPoints = _balance?.totalPoints ?? 0;
    final availablePoints = _balance?.availablePoints ?? totalPoints;
    return Container(
      margin: const EdgeInsets.all(16),
      padding: const EdgeInsets.all(20),
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
        boxShadow: [
          BoxShadow(
            color: AppColors.primary.withOpacity(0.3),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        children: [
          const Text(
            'Current Points',
            style: TextStyle(
              color: Colors.white70,
              fontSize: 14,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            '$totalPoints',
            style: const TextStyle(
              color: Colors.white,
              fontSize: 36,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 8),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(
                'Available: $availablePoints',
                style: const TextStyle(
                  color: Colors.white70,
                  fontSize: 12,
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            'Updated: ${_formatDateTime(_balance?.lastUpdated)}',
            style: const TextStyle(
              color: Colors.white70,
              fontSize: 12,
            ),
          ),
        ],
      ),
    );
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
                        _buildFilterChip('Streak', 'CONSECUTIVE_CHECKIN_7'),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
          Expanded(
            child: _transactions.isEmpty
                ? const Center(
                    child: Text(
                      'No Transaction Records',
                      style: TextStyle(color: AppColors.textSecondary),
                    ),
                  )
                : ListView.builder(
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
      'CONSECUTIVE_CHECKIN_3': '3-Day Streak',
      'CONSECUTIVE_CHECKIN_7': '7-Day Streak',
      'CONSECUTIVE_CHECKIN_15': '15-Day Streak',
      'CONSECUTIVE_CHECKIN_30': '30-Day Streak',
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
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(Icons.error_outline, size: 64, color: AppColors.error),
          const SizedBox(height: 16),
          Text(
            _error ?? 'Failed to Load',
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

  String _formatDate(DateTime date) {
    return '${date.month}/${date.day}';
  }

  String _formatDateTime(DateTime? date) {
    if (date == null) return '--';
    return '${date.month}/${date.day} ${date.hour}:${date.minute.toString().padLeft(2, '0')}';
  }
}
