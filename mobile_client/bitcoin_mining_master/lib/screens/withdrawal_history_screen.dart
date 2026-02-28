import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../constants/app_constants.dart';
import '../services/api_service.dart';
import '../services/storage_service.dart';

/// 提现历史页面 - Withdrawal History Screen
class WithdrawalHistoryScreen extends StatefulWidget {
  final int initialTabIndex;
  
  const WithdrawalHistoryScreen({
    super.key,
    this.initialTabIndex = 0,
  });

  @override
  State<WithdrawalHistoryScreen> createState() => _WithdrawalHistoryScreenState();
}

class _WithdrawalHistoryScreenState extends State<WithdrawalHistoryScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;
  bool _isLoading = true;
  List<WithdrawalTransaction> _allTransactions = [];
  final ApiService _apiService = ApiService();
  final StorageService _storageService = StorageService();
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(
      length: 4,
      vsync: this,
      initialIndex: widget.initialTabIndex,
    );
    _loadTransactions();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _loadTransactions() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final userId = _storageService.getUserId();
      if (userId == null || userId.isEmpty) {
        setState(() {
          _errorMessage = 'User not logged in';
          _isLoading = false;
        });
        return;
      }

      // 从API加载提现历史
      final response = await _apiService.getWithdrawalHistory(
        userId: userId,
        status: 'all',
        limit: 100,
        offset: 0,
      );

      if (response['success'] == true && response['data'] != null) {
        final data = response['data'];
        final withdrawals = data['withdrawals'] as List<dynamic>;
        
        setState(() {
          _allTransactions = withdrawals.map((json) {
            return WithdrawalTransaction(
              id: json['id'].toString(),
              amount: (json['amount'] as num).toDouble(),
              address: json['walletAddress'] as String,
              network: 'Bitcoin(BTC)', // 暂时固定,后续从API获取
              fee: (json['networkFee'] as num).toDouble(),
              status: _parseStatus(json['status'] as String),
              createdAt: json['createdAt'] != null 
                ? DateTime.parse(json['createdAt']) 
                : DateTime.now(),
              completedAt: json['updatedAt'] != null 
                ? DateTime.parse(json['updatedAt']) 
                : null,
              rejectedReason: json['rejectedReason'] as String?,
            );
          }).toList();
          _isLoading = false;
        });
      } else {
        setState(() {
          _errorMessage = response['message'] ?? 'Failed to load withdrawal history';
          _isLoading = false;
        });
      }
    } catch (e) {
      setState(() {
        _errorMessage = 'Error loading withdrawal history: $e';
        _isLoading = false;
      });
    }
  }

  WithdrawalStatus _parseStatus(String status) {
    switch (status.toLowerCase()) {
      case 'success':
        return WithdrawalStatus.success;
      case 'pending':
        return WithdrawalStatus.pending;
      case 'rejected':
        return WithdrawalStatus.rejected;
      default:
        return WithdrawalStatus.pending;
    }
  }

  List<WithdrawalTransaction> _getFilteredTransactions(WithdrawalStatus? status) {
    if (status == null) {
      return _allTransactions;
    }
    return _allTransactions.where((tx) => tx.status == status).toList();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.cardDark,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: AppColors.textPrimary),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Text(
          'Withdrawal History',
          style: TextStyle(
            color: AppColors.textPrimary,
            fontSize: 20,
            fontWeight: FontWeight.w600,
          ),
        ),
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(48),
          child: Container(
            color: AppColors.cardDark,
            child: TabBar(
              controller: _tabController,
              indicatorColor: AppColors.primary,
              indicatorWeight: 3,
              labelColor: AppColors.primary,
              unselectedLabelColor: AppColors.textSecondary,
              labelStyle: const TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w600,
              ),
              tabs: const [
                Tab(text: 'All'),
                Tab(text: 'Pending'),
                Tab(text: 'Success'),
                Tab(text: 'Rejected'),
              ],
            ),
          ),
        ),
      ),
      body: _isLoading
          ? const Center(
              child: CircularProgressIndicator(
                color: AppColors.primary,
              ),
            )
          : _errorMessage != null
              ? Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(
                        Icons.error_outline,
                        size: 64,
                        color: AppColors.error,
                      ),
                      const SizedBox(height: 16),
                      Text(
                        _errorMessage!,
                        style: const TextStyle(
                          color: AppColors.textSecondary,
                          fontSize: 16,
                        ),
                        textAlign: TextAlign.center,
                      ),
                      const SizedBox(height: 24),
                      ElevatedButton(
                        onPressed: _loadTransactions,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppColors.primary,
                          foregroundColor: Colors.black,
                        ),
                        child: const Text('Retry'),
                      ),
                    ],
                  ),
                )
              : TabBarView(
                  controller: _tabController,
                  children: [
                    _buildTransactionList(null),
                    _buildTransactionList(WithdrawalStatus.pending),
                    _buildTransactionList(WithdrawalStatus.success),
                    _buildTransactionList(WithdrawalStatus.rejected),
                  ],
                ),
    );
  }

  Widget _buildTransactionList(WithdrawalStatus? status) {
    final transactions = _getFilteredTransactions(status);

    if (transactions.isEmpty) {
      return _buildEmptyState();
    }

    return RefreshIndicator(
      onRefresh: _loadTransactions,
      color: AppColors.primary,
      backgroundColor: AppColors.cardDark,
      child: ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: transactions.length,
        itemBuilder: (context, index) {
          return _buildTransactionCard(transactions[index]);
        },
      ),
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            Icons.receipt_long_outlined,
            size: 80,
            color: AppColors.textSecondary.withOpacity(0.5),
          ),
          const SizedBox(height: 16),
          Text(
            'No transactions found',
            style: TextStyle(
              color: AppColors.textSecondary,
              fontSize: 16,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'Your withdrawal history will appear here',
            style: TextStyle(
              color: AppColors.textSecondary.withOpacity(0.7),
              fontSize: 14,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTransactionCard(WithdrawalTransaction transaction) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: AppColors.cardDark,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: _getStatusBorderColor(transaction.status),
          width: 1.5,
        ),
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: () => _showTransactionDetails(transaction),
          borderRadius: BorderRadius.circular(12),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Header: Status & Amount
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    _buildStatusBadge(transaction.status),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        Text(
                          '${transaction.amount.toStringAsFixed(8)} BTC',
                          style: const TextStyle(
                            color: AppColors.textPrimary,
                            fontSize: 18,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        Text(
                          'Fee: ${transaction.fee.toStringAsFixed(8)} BTC',
                          style: TextStyle(
                            color: AppColors.textSecondary,
                            fontSize: 12,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
                const SizedBox(height: 12),

                // Transaction ID
                _buildInfoRow(
                  'Transaction ID',
                  transaction.id,
                  Icons.tag,
                ),
                const SizedBox(height: 8),

                // Network
                _buildInfoRow(
                  'Network',
                  transaction.network,
                  Icons.hub_outlined,
                ),
                const SizedBox(height: 8),

                // Wallet Address
                _buildInfoRow(
                  'Address',
                  _truncateAddress(transaction.address),
                  Icons.account_balance_wallet_outlined,
                ),
                const SizedBox(height: 8),

                // DateTime
                _buildInfoRow(
                  'DateTime',
                  _formatDateTime(transaction.createdAt),
                  Icons.access_time,
                ),

                // Rejected Reason (if applicable)
                if (transaction.status == WithdrawalStatus.rejected &&
                    transaction.rejectedReason != null) ...[
                  const SizedBox(height: 12),
                  Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: Colors.red.withOpacity(0.1),
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(
                        color: Colors.red.withOpacity(0.3),
                        width: 1,
                      ),
                    ),
                    child: Row(
                      children: [
                        const Icon(
                          Icons.error_outline,
                          color: Colors.red,
                          size: 16,
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            transaction.rejectedReason!,
                            style: const TextStyle(
                              color: Colors.red,
                              fontSize: 12,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],

                // Completed Time (if success)
                if (transaction.status == WithdrawalStatus.success &&
                    transaction.completedAt != null) ...[
                  const SizedBox(height: 8),
                  _buildInfoRow(
                    'Completed',
                    _formatDateTime(transaction.completedAt!),
                    Icons.check_circle_outline,
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildStatusBadge(WithdrawalStatus status) {
    Color backgroundColor;
    Color textColor;
    IconData icon;
    String label;

    switch (status) {
      case WithdrawalStatus.pending:
        backgroundColor = Colors.orange.withOpacity(0.2);
        textColor = Colors.orange;
        icon = Icons.pending_outlined;
        label = 'Pending';
        break;
      case WithdrawalStatus.success:
        backgroundColor = Colors.green.withOpacity(0.2);
        textColor = Colors.green;
        icon = Icons.check_circle_outline;
        label = 'Success';
        break;
      case WithdrawalStatus.rejected:
        backgroundColor = Colors.red.withOpacity(0.2);
        textColor = Colors.red;
        icon = Icons.cancel_outlined;
        label = 'Rejected';
        break;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: backgroundColor,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 16, color: textColor),
          const SizedBox(width: 4),
          Text(
            label,
            style: TextStyle(
              color: textColor,
              fontSize: 12,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildInfoRow(String label, String value, IconData icon) {
    return Row(
      children: [
        Icon(
          icon,
          size: 16,
          color: AppColors.textSecondary,
        ),
        const SizedBox(width: 8),
        Text(
          '$label: ',
          style: TextStyle(
            color: AppColors.textSecondary,
            fontSize: 12,
          ),
        ),
        Expanded(
          child: Text(
            value,
            style: const TextStyle(
              color: AppColors.textPrimary,
              fontSize: 12,
            ),
            overflow: TextOverflow.ellipsis,
          ),
        ),
      ],
    );
  }

  Color _getStatusBorderColor(WithdrawalStatus status) {
    switch (status) {
      case WithdrawalStatus.pending:
        return Colors.orange.withOpacity(0.5);
      case WithdrawalStatus.success:
        return Colors.green.withOpacity(0.5);
      case WithdrawalStatus.rejected:
        return Colors.red.withOpacity(0.5);
    }
  }

  String _truncateAddress(String address) {
    if (address.length <= 20) return address;
    return '${address.substring(0, 10)}...${address.substring(address.length - 10)}';
  }

  String _formatDateTime(DateTime dateTime) {
    // Convert to UTC time
    final utcTime = dateTime.toUtc();
    
    // Format: YYYY-MM-DD HH:MM:SS UTC
    return '${utcTime.year}-${utcTime.month.toString().padLeft(2, '0')}-${utcTime.day.toString().padLeft(2, '0')} '
           '${utcTime.hour.toString().padLeft(2, '0')}:${utcTime.minute.toString().padLeft(2, '0')}:${utcTime.second.toString().padLeft(2, '0')} UTC';
  }

  void _showTransactionDetails(WithdrawalTransaction transaction) {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (context) => Container(
        decoration: const BoxDecoration(
          color: AppColors.cardDark,
          borderRadius: BorderRadius.only(
            topLeft: Radius.circular(24),
            topRight: Radius.circular(24),
          ),
        ),
        padding: EdgeInsets.only(
          bottom: MediaQuery.of(context).viewInsets.bottom,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Handle bar
            Container(
              margin: const EdgeInsets.only(top: 12),
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: AppColors.textSecondary.withOpacity(0.3),
                borderRadius: BorderRadius.circular(2),
              ),
            ),

            Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Title
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text(
                        'Transaction Details',
                        style: TextStyle(
                          color: AppColors.textPrimary,
                          fontSize: 20,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      _buildStatusBadge(transaction.status),
                    ],
                  ),
                  const SizedBox(height: 24),

                  // Details
                  _buildDetailRow('Transaction ID', transaction.id, canCopy: true),
                  _buildDetailRow('Amount', '${transaction.amount.toStringAsFixed(8)} BTC'),
                  _buildDetailRow('Network Fee', '${transaction.fee.toStringAsFixed(8)} BTC'),
                  _buildDetailRow('Received', '${(transaction.amount - transaction.fee).toStringAsFixed(8)} BTC'),
                  _buildDetailRow('Network', transaction.network),
                  _buildDetailRow('Wallet Address', transaction.address, canCopy: true),
                  _buildDetailRow('Created At', _formatFullDateTime(transaction.createdAt)),
                  
                  if (transaction.completedAt != null)
                    _buildDetailRow('Completed At', _formatFullDateTime(transaction.completedAt!)),

                  if (transaction.rejectedReason != null)
                    _buildDetailRow('Rejection Reason', transaction.rejectedReason!),

                  const SizedBox(height: 16),

                  // Close button
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton(
                      onPressed: () => Navigator.pop(context),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.primary,
                        padding: const EdgeInsets.symmetric(vertical: 16),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                      child: const Text(
                        'Close',
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w600,
                          color: Colors.white,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildDetailRow(String label, String value, {bool canCopy = false}) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 120,
            child: Text(
              label,
              style: TextStyle(
                color: AppColors.textSecondary,
                fontSize: 14,
              ),
            ),
          ),
          Expanded(
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    value,
                    style: const TextStyle(
                      color: AppColors.textPrimary,
                      fontSize: 14,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ),
                if (canCopy)
                  IconButton(
                    onPressed: () {
                      // Copy to clipboard
                      Clipboard.setData(ClipboardData(text: value));
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(
                          content: Text('Copied to clipboard'),
                          duration: Duration(seconds: 2),
                          backgroundColor: AppColors.primary,
                        ),
                      );
                    },
                    icon: const Icon(
                      Icons.copy,
                      size: 18,
                      color: AppColors.primary,
                    ),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  String _formatFullDateTime(DateTime dateTime) {
    return '${dateTime.year}-${dateTime.month.toString().padLeft(2, '0')}-${dateTime.day.toString().padLeft(2, '0')} '
        '${dateTime.hour.toString().padLeft(2, '0')}:${dateTime.minute.toString().padLeft(2, '0')}';
  }
}

/// 提现交易模型
class WithdrawalTransaction {
  final String id;
  final double amount;
  final String address;
  final String network;
  final double fee;
  final WithdrawalStatus status;
  final DateTime createdAt;
  final DateTime? completedAt;
  final String? rejectedReason;

  WithdrawalTransaction({
    required this.id,
    required this.amount,
    required this.address,
    required this.network,
    required this.fee,
    required this.status,
    required this.createdAt,
    this.completedAt,
    this.rejectedReason,
  });
}

/// 提现状态枚举
enum WithdrawalStatus {
  pending,
  success,
  rejected,
}
