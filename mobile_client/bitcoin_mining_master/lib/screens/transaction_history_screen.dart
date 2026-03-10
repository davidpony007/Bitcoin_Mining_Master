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
    bool isPositive = true;

    switch (tx.type) {
      case 'withdrawal':
        icon = Icons.arrow_upward;
        iconColor = Colors.red;
        isPositive = false;
        break;
      case 'subordinate rebate':
        icon = Icons.people;
        iconColor = Colors.purple;
        break;
      case 'Free Ad Reward':
        icon = Icons.play_arrow;
        iconColor = Colors.blue;
        break;
      case 'Daily Check-in Reward':
      case 'Invite Friend Reward':
      case 'Bind Referrer Reward':
        icon = Icons.card_giftcard;
        iconColor = Colors.blue;
        break;
      case 'contract_4.99':
      case 'contract_6.99':
      case 'contract_9.99':
      case 'contract_19.99':
        icon = Icons.monetization_on;
        iconColor = Colors.amber;
        break;
      default:
        icon = Icons.attach_money;
        iconColor = AppColors.primary;
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
        children: [
          // 图标
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: iconColor.withOpacity(0.12),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(icon, color: iconColor, size: 22),
          ),
          const SizedBox(width: 12),
          // 详情
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
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
                if (tx.description != null && tx.description!.isNotEmpty) ...[
                  const SizedBox(height: 3),
                  Text(
                    tx.description!,
                    style: TextStyle(
                      color: AppColors.textSecondary,
                      fontSize: 11,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
                const SizedBox(height: 4),
                Text(
                  _formatDate(tx.createdAt),
                  style: const TextStyle(
                    color: AppColors.textSecondary,
                    fontSize: 12,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          // 金额
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                '${isPositive ? '+' : '-'}${tx.amount.toStringAsFixed(18)}',
                style: TextStyle(
                  color: isPositive ? AppColors.primary : Colors.red,
                  fontSize: 11,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const Text(
                'BTC',
                style: TextStyle(
                  color: AppColors.textSecondary,
                  fontSize: 10,
                ),
              ),
            ],
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
