import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/user_provider.dart';
import '../constants/app_constants.dart';
import '../models/user_model.dart';

class TransactionHistoryScreen extends StatefulWidget {
  final int initialTab;
  const TransactionHistoryScreen({super.key, this.initialTab = 0});

  @override
  State<TransactionHistoryScreen> createState() => _TransactionHistoryScreenState();
}

class _TransactionHistoryScreenState extends State<TransactionHistoryScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;
  final ScrollController _scrollController = ScrollController();

  static const _tabs = ['All', 'Mining', 'Withdrawal', 'Rebate'];
  static const _typeFilters = ['all', 'mining', 'withdrawal', 'rebate'];

  int _activeTab = 0;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: _tabs.length, vsync: this, initialIndex: widget.initialTab);
    _activeTab = widget.initialTab;
    _tabController.addListener(() {
      if (!_tabController.indexIsChanging) return;
      setState(() => _activeTab = _tabController.index);
    });

    // 刷新第一页
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<UserProvider>().fetchTransactions();
    });

    // 监听滚动到底部 → 加载更多
    _scrollController.addListener(() {
      if (_scrollController.position.pixels >=
          _scrollController.position.maxScrollExtent - 200) {
        context.read<UserProvider>().loadMoreTransactions();
      }
    });
  }

  @override
  void dispose() {
    _tabController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  List<Transaction> _filtered(List<Transaction> all) {
    final filter = _typeFilters[_activeTab];
    if (filter == 'all') return all;
    return all.where((tx) {
      switch (filter) {
        case 'mining':
          return tx.type.contains('mining') ||
              tx.type.contains('contract') ||
              tx.type == 'Free Ad Reward' ||
              tx.type == 'Daily Check-in Reward' ||
              tx.type == 'Invite Friend Reward' ||
              tx.type == 'Bind Referrer Reward';
        case 'withdrawal':
          return tx.type == 'withdrawal' ||
              tx.type == 'refund for withdrawal failure';
        case 'rebate':
          return tx.type == 'subordinate rebate';
        default:
          return true;
      }
    }).toList();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.background,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios, color: AppColors.textPrimary),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Text(
          'Transaction Records',
          style: TextStyle(
            color: AppColors.textPrimary,
            fontSize: 18,
            fontWeight: FontWeight.bold,
          ),
        ),
        centerTitle: true,
        titleSpacing: 0,
        flexibleSpace: Align(
          alignment: Alignment.bottomCenter,
          child: Padding(
            padding: const EdgeInsets.only(bottom: 52),
            child: Text(
              'Last 3 Days',
              style: TextStyle(
                color: AppColors.primary.withOpacity(0.85),
                fontSize: 11,
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
        ),
        bottom: TabBar(
          controller: _tabController,
          indicatorColor: AppColors.primary,
          labelColor: AppColors.primary,
          unselectedLabelColor: AppColors.textSecondary,
          labelPadding: EdgeInsets.zero,
          labelStyle: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
          unselectedLabelStyle: const TextStyle(fontSize: 13),
          tabs: _tabs.map((t) => Tab(text: t)).toList(),
        ),
      ),
      body: Consumer<UserProvider>(
        builder: (context, provider, _) {
          final all = provider.transactions;
          final filtered = _filtered(all);

          return RefreshIndicator(
            color: AppColors.primary,
            onRefresh: () => provider.fetchTransactions(),
            child: filtered.isEmpty && !provider.isLoading
                ? _buildEmpty()
                : ListView.builder(
                    controller: _scrollController,
                    padding: const EdgeInsets.fromLTRB(16, 16, 16, 100),
                    itemCount: filtered.length +
                        (provider.transactionHasMore ? 1 : 0),
                    itemBuilder: (context, index) {
                      if (index == filtered.length) {
                        return _buildLoadMoreIndicator(provider);
                      }
                      return _buildTransactionItem(filtered[index]);
                    },
                  ),
          );
        },
      ),
    );
  }

  Widget _buildEmpty() {
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      children: [
        SizedBox(height: MediaQuery.of(context).size.height * 0.3),
        Center(
          child: Column(
            children: [
              Icon(Icons.receipt_long_outlined,
                  size: 64, color: AppColors.textSecondary.withOpacity(0.5)),
              const SizedBox(height: 16),
              Text(
                'No Transaction Records',
                style: TextStyle(
                  color: AppColors.textSecondary,
                  fontSize: 16,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                'in the last 3 days',
                style: TextStyle(
                  color: AppColors.textSecondary.withOpacity(0.6),
                  fontSize: 13,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildLoadMoreIndicator(UserProvider provider) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 24),
      child: Center(
        child: provider.isLoadingMoreTransactions
            ? const CircularProgressIndicator(
                valueColor: AlwaysStoppedAnimation(AppColors.primary),
                strokeWidth: 2,
              )
            : Text(
                'All ${provider.transactionTotal} records loaded',
                style: const TextStyle(
                  color: AppColors.textSecondary,
                  fontSize: 12,
                ),
              ),
      ),
    );
  }

  Widget _buildTransactionItem(Transaction tx) {
    IconData icon;
    Color iconColor;
    Color iconBgColor;
    bool isPositive = true;

    switch (tx.type) {
      case 'withdrawal':
        icon = Icons.arrow_upward;
        iconColor = Colors.white;
        iconBgColor = const Color(0xFF4CAF50);
        isPositive = false;
        break;
      case 'subordinate rebate':
        icon = Icons.people;
        iconColor = Colors.green;
        iconBgColor = Colors.orange;
        break;
      case 'Free Ad Reward':
        icon = Icons.play_arrow;
        iconColor = Colors.white;
        iconBgColor = Colors.orange;
        break;
      case 'Daily Check-in Reward':
        icon = Icons.card_giftcard;
        iconColor = Colors.black;
        iconBgColor = Colors.yellow;
        break;
      case 'Invite Friend Reward':
      case 'Bind Referrer Reward':
        icon = Icons.card_giftcard;
        iconColor = Colors.blue;
        iconBgColor = Colors.blue.withOpacity(0.12);
        break;
      case 'contract_4.99':
      case 'contract_6.99':
      case 'contract_9.99':
      case 'contract_19.99':
        icon = Icons.monetization_on;
        iconColor = Colors.amber;
        iconBgColor = Colors.amber.withOpacity(0.12);
        break;
      default:
        icon = Icons.attach_money;
        iconColor = AppColors.primary;
        iconBgColor = AppColors.primary.withOpacity(0.12);
    }

    final isPending = tx.status == 'pending';

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.cardDark,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: AppColors.textSecondary.withOpacity(0.1),
          width: 1,
        ),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // 图标
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: iconBgColor,
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(icon, color: iconColor, size: 22),
          ),
          const SizedBox(width: 12),
          // 详情
          Expanded(
            child: tx.type == 'subordinate rebate'
                // subordinate rebate: 4行全宽布局，避免 user_id / 金额截断
                ? Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [

                      // 第1行：标签类别
                      Text(
                        tx.typeLabel,
                        style: const TextStyle(
                          color: AppColors.textPrimary,
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      // 第2行：From: user_id (完整显示)
                      if (tx.description != null &&
                          tx.description!.startsWith('From: ')) ...[
                        const SizedBox(height: 4),
                        Text(
                          'From: ${tx.description!.substring(6)}',
                          style: const TextStyle(
                            color: Color(0xFF64B5F6),
                            fontSize: 12,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ],
                      // 第3行：时间戳
                      const SizedBox(height: 4),
                      Text(
                        _formatDate(tx.createdAt),
                        style: const TextStyle(
                          color: AppColors.textSecondary,
                          fontSize: 12,
                        ),
                      ),
                      // 第4行：BTC 数额
                      const SizedBox(height: 4),
                      Text(
                        '${isPositive ? '+' : '-'}${tx.amount.toStringAsFixed(18)} BTC',
                        style: TextStyle(
                          color: isPositive ? AppColors.primary : Colors.red,
                          fontSize: 12,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ],
                  )
                // Free Ad / Daily Check-in / Invite / Bind Referrer: 3行全宽布局
                : Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // 第1行：标签（+ Pending 角标）
                      Row(
                        children: [
                          Text(
                            tx.typeLabel,
                            style: const TextStyle(
                              color: AppColors.textPrimary,
                              fontSize: 14,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                          if (isPending) ...[
                            const SizedBox(width: 8),
                            Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 6, vertical: 2),
                              decoration: BoxDecoration(
                                color: Colors.orange.withOpacity(0.15),
                                borderRadius: BorderRadius.circular(4),
                              ),
                              child: const Text(
                                'Pending',
                                style: TextStyle(
                                  color: Colors.orange,
                                  fontSize: 10,
                                  fontWeight: FontWeight.w500,
                                ),
                              ),
                            ),
                          ],
                        ],
                      ),
                      // 第2行：时间戳
                      const SizedBox(height: 4),
                      Text(
                        _formatDate(tx.createdAt),
                        style: const TextStyle(
                          color: AppColors.textSecondary,
                          fontSize: 12,
                        ),
                      ),
                      // 第3行：BTC 数额
                      const SizedBox(height: 4),
                      Text(
                        '${isPositive ? '+' : '-'}${tx.amount.toStringAsFixed(18)} BTC',
                        style: TextStyle(
                          color: isPositive ? AppColors.primary : Colors.red,
                          fontSize: 12,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ],
                  ),
          ),
        ],
      ),
    );
  }

  String _formatDate(DateTime date) {
    final utcDate = date.toUtc();
    return '${utcDate.year}-${utcDate.month.toString().padLeft(2, '0')}-'
        '${utcDate.day.toString().padLeft(2, '0')} '
        '${utcDate.hour.toString().padLeft(2, '0')}:'
        '${utcDate.minute.toString().padLeft(2, '0')} UTC';
  }
}
