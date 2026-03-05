import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';
import '../providers/user_provider.dart';
import '../constants/app_constants.dart';
import 'withdrawal_history_screen.dart';

/// 提现页面 - Withdrawal Screen
class WithdrawalScreen extends StatefulWidget {
  const WithdrawalScreen({super.key});

  @override
  State<WithdrawalScreen> createState() => _WithdrawalScreenState();
}

class _WithdrawalScreenState extends State<WithdrawalScreen> {
  final _addressController = TextEditingController();
  final _amountController = TextEditingController();
  // 提现方式：'Binance UID' 或 'BEP20'
  String _selectedWithdrawMethod = 'Binance UID';
  bool _useAllBalance = false;

  double get _minimumAmount => 0.00002200;
  double get _networkFee =>
      _selectedWithdrawMethod == 'Binance UID' ? 0.0 : 0.00000028;

  @override
  void dispose() {
    _addressController.dispose();
    _amountController.dispose();
    super.dispose();
  }

  double get _currentBalance {
    final provider = Provider.of<UserProvider>(context, listen: false);
    return double.tryParse(provider.bitcoinBalance) ?? 0.0;
  }

  double get _withdrawAmount {
    if (_useAllBalance) {
      return _currentBalance;
    }
    return double.tryParse(_amountController.text) ?? 0.0;
  }

  double get _amountReceived {
    final amount = _withdrawAmount - _networkFee;
    return amount > 0 ? amount : 0.0;
  }

  bool get _canWithdraw {
    return _withdrawAmount >= _minimumAmount &&
        _isValidAddress(_addressController.text) &&
        _withdrawAmount <= _currentBalance;
  }

  /// 根据提现方式验证地址/UID格式
  bool _isValidAddress(String address) {
    if (address.isEmpty) return false;
    if (_selectedWithdrawMethod == 'Binance UID') {
      // Binance UID: 纯数字，6-12位
      return RegExp(r'^\d{6,12}$').hasMatch(address);
    } else {
      // BEP20地址: 0x开头，40位十六进制
      return RegExp(r'^0x[0-9a-fA-F]{40}$').hasMatch(address);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      resizeToAvoidBottomInset: true,
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.cardDark,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: AppColors.textPrimary),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Text(
          'Withdraw',
          style: TextStyle(
            color: AppColors.textPrimary,
            fontSize: 20,
            fontWeight: FontWeight.w600,
          ),
        ),
        actions: [
          TextButton(
            onPressed: () {
              Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (context) => const WithdrawalHistoryScreen(),
                ),
              );
            },
            child: const Text(
              'History',
              style: TextStyle(
                color: Color(0xFFFFA726),
                fontSize: 16,
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
        ],
      ),
      body: Consumer<UserProvider>(
        builder: (context, provider, child) {
          return SingleChildScrollView(
            padding: EdgeInsets.only(
              bottom: MediaQuery.of(context).padding.bottom + 20,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // 警告提示
                _buildWarningBanner(),

                const SizedBox(height: 24),

                // Amount 部分
                _buildAmountSection(),

                const SizedBox(height: 24),

                // Network 选择
                _buildNetworkSection(),

                const SizedBox(height: 24),

                // Wallet Address
                _buildWalletAddressSection(),

                const SizedBox(height: 32),

                // 底部信息和提现按钮
                _buildBottomSection(provider),

                const SizedBox(height: 24),

                // Binance 广告（最底部）
                _buildBinanceAd(),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _buildWarningBanner() {
    final isUID = _selectedWithdrawMethod == 'Binance UID';
    return Container(
      margin: const EdgeInsets.all(16),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.primary.withOpacity(0.15),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.primary.withOpacity(0.3), width: 1),
      ),
      child: Row(
        children: [
          Icon(Icons.warning_amber_rounded, color: AppColors.primary, size: 24),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              isUID
                  ? 'Please enter your Binance UID. The system will transfer BTC directly to your Binance account for free.'
                  : 'Please enter the correct BEP20 wallet address (starting with 0x).\nIncorrect entry may result in loss of your BTC.',
              style: TextStyle(
                color: AppColors.textPrimary,
                fontSize: 13,
                height: 1.5,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildAmountSection() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'Amount',
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w600,
                  color: AppColors.textPrimary,
                ),
              ),
              Text(
                '${_currentBalance.toStringAsFixed(14)} BTC',
                style: const TextStyle(
                  fontSize: 14,
                  color: AppColors.textSecondary,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          // 金额输入框
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            decoration: BoxDecoration(
              color: AppColors.cardDark,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: AppColors.divider, width: 1),
            ),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _amountController,
                    enabled: !_useAllBalance,
                    keyboardType: const TextInputType.numberWithOptions(
                      decimal: true,
                    ),
                    inputFormatters: [
                      FilteringTextInputFormatter.allow(
                        RegExp(r'^\d*\.?\d{0,8}'),
                      ),
                      _BitcoinAmountFormatter(),
                    ],
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w600,
                      color: _useAllBalance
                          ? AppColors.textSecondary
                          : AppColors.textPrimary,
                    ),
                    decoration: InputDecoration(
                      hintText: 'Enter amount',
                      hintStyle: TextStyle(
                        fontSize: 16,
                        color: AppColors.textSecondary.withOpacity(0.5),
                      ),
                      suffixText: 'BTC',
                      suffixStyle: const TextStyle(
                        fontSize: 14,
                        color: AppColors.textSecondary,
                      ),
                      border: InputBorder.none,
                      contentPadding: EdgeInsets.zero,
                    ),
                    onChanged: (value) {
                      setState(() {});
                    },
                  ),
                ),
                const SizedBox(width: 12),
                GestureDetector(
                  onTap: () {
                    setState(() {
                      _useAllBalance = !_useAllBalance;
                      if (_useAllBalance) {
                        // 自动填充当前余额，截取到小数点后8位（聪为最小单位）
                        _amountController.text = _currentBalance
                            .toStringAsFixed(8);
                      } else {
                        _amountController.clear();
                      }
                    });
                  },
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 20,
                      vertical: 8,
                    ),
                    decoration: BoxDecoration(
                      color: _useAllBalance
                          ? AppColors.primary
                          : Colors.transparent,
                      borderRadius: BorderRadius.circular(6),
                      border: Border.all(color: AppColors.primary, width: 1.5),
                    ),
                    child: Text(
                      'All',
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                        color: _useAllBalance
                            ? Colors.black
                            : AppColors.primary,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 8),
          // 最小金额提示
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Text(
              'Minimum amount: ${_minimumAmount.toStringAsFixed(8)} BTC',
              style: const TextStyle(
                fontSize: 12,
                color: AppColors.textSecondary,
              ),
            ),
          ),
        ],
      ),
    );
  }

  void _showNetworkHelp() {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: AppColors.cardDark,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Row(
          children: [
            Icon(Icons.hub_outlined, color: AppColors.primary, size: 22),
            SizedBox(width: 8),
            Text(
              'Withdrawal Network',
              style: TextStyle(color: AppColors.textPrimary, fontSize: 18, fontWeight: FontWeight.bold),
            ),
          ],
        ),
        content: SizedBox(
          width: double.maxFinite,
          child: Scrollbar(
            thumbVisibility: true,
            child: SingleChildScrollView(
              primary: true,
              child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Choose the right network to receive your BTC. Wrong network selection may result in permanent loss of funds.',
                  style: TextStyle(color: AppColors.textSecondary, fontSize: 13, height: 1.5),
                ),
                const SizedBox(height: 20),
                _buildNetworkHelpItem(
                  icon: Icons.account_circle_outlined,
                  badge: 'DEFAULT',
                  title: 'Binance UID',
                  description: 'Transfer BTC directly to your Binance account using your Binance UID. No wallet address needed. Zero network fee. Recommended for Binance users.',
                ),
                const SizedBox(height: 16),
                _buildNetworkHelpItem(
                  icon: Icons.account_balance_wallet_outlined,
                  badge: 'BEP20',
                  title: 'BNB Smart Chain (BEP20)',
                  description: 'Withdraw BTC to any BEP20-compatible wallet (e.g. Trust Wallet, MetaMask). The wallet address must start with "0x" and be exactly 42 characters. A small network fee of 0.00000028 BTC applies.',
                ),
                const SizedBox(height: 20),
                // How to get Binance UID section
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: const Color(0xFF1A1A2E),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: AppColors.primary.withOpacity(0.85), width: 1.8),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Row(
                        children: [
                          Icon(Icons.help_outline_rounded, color: AppColors.primary, size: 16),
                          SizedBox(width: 6),
                          Text(
                            'How to get my Binance UID?',
                            style: TextStyle(
                              color: AppColors.textPrimary,
                              fontSize: 13,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 10),
                      const Text(
                        '① Open Binance account and go to your Profile\n② Your UID is displayed on the dashboard page\n③ Tap the UID to copy it',
                        style: TextStyle(color: AppColors.textSecondary, fontSize: 12, height: 1.6),
                      ),
                      const SizedBox(height: 10),
                      ClipRRect(
                        borderRadius: BorderRadius.circular(8),
                        child: Image.asset(
                          'assets/images/binance_uid_guide.png',
                          fit: BoxFit.contain,
                          width: double.infinity,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
                // How to get BEP20 address section
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: const Color(0xFF1A1A2E),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: AppColors.primary.withOpacity(0.85), width: 1.8),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Row(
                        children: [
                          Icon(Icons.help_outline_rounded, color: AppColors.primary, size: 16),
                          SizedBox(width: 6),
                          Text(
                            'How to get my BEP20 address?',
                            style: TextStyle(
                              color: AppColors.textPrimary,
                              fontSize: 13,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 10),
                      const Text(
                        'Follow these steps to find your BNB Smart Chain(BEP20) address in Binance:',
                        style: TextStyle(color: AppColors.textSecondary, fontSize: 12, height: 1.6),
                      ),
                      const SizedBox(height: 8),
                      for (final step in [
                        ('assets/images/step1.jpg', '① Tap "Deposit"'),
                        ('assets/images/step2.jpg', '② Tap "Deposit Crypto"'),
                        ('assets/images/step3.jpg', '③ Choose "BTC"'),
                        ('assets/images/step4.jpg', '④ Select "BNB Smart Chain (BEP20)" as the network'),
                        ('assets/images/step5.jpg', '⑤ Copy the deposit address starting with "0x" (42 characters)'),
                      ]) ...[
                        Text(
                          step.$2,
                          style: const TextStyle(color: AppColors.textSecondary, fontSize: 12, height: 1.6),
                        ),
                        const SizedBox(height: 6),
                        ClipRRect(
                          borderRadius: BorderRadius.circular(8),
                          child: Image.asset(
                            step.$1,
                            fit: BoxFit.contain,
                            width: double.infinity,
                          ),
                        ),
                        const SizedBox(height: 10),
                      ],
                    ],
                  ),
                ),
                const SizedBox(height: 16),
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: AppColors.error.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: AppColors.error.withOpacity(0.3)),
                  ),
                  child: const Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Icon(Icons.warning_amber_rounded, color: AppColors.error, size: 18),
                      SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          'Always double-check your address or UID before confirming. Transactions cannot be reversed once submitted.',
                          style: TextStyle(color: AppColors.error, fontSize: 12, height: 1.5),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          ),
        ),
        actions: [
          ElevatedButton(
            onPressed: () => Navigator.pop(context),
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.primary,
              foregroundColor: Colors.black,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
            ),
            child: const Text('Got it', style: TextStyle(fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );
  }

  Widget _buildNetworkHelpItem({
    required IconData icon,
    required String badge,
    required String title,
    required String description,
  }) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          padding: const EdgeInsets.all(8),
          decoration: BoxDecoration(
            color: AppColors.primary.withOpacity(0.12),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Icon(icon, color: AppColors.primary, size: 20),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Flexible(
                    child: Text(
                      title,
                      style: const TextStyle(
                        color: AppColors.textPrimary,
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                  const SizedBox(width: 6),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(
                      color: AppColors.primary.withOpacity(0.2),
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: Text(
                      badge,
                      style: const TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.bold,
                        color: AppColors.primary,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 4),
              Text(
                description,
                style: const TextStyle(
                  color: AppColors.textSecondary,
                  fontSize: 12,
                  height: 1.5,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildNetworkSection() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Text(
                'Withdrawal Network',
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w600,
                  color: AppColors.textPrimary,
                ),
              ),
              const Spacer(),
              GestureDetector(
                onTap: _showNetworkHelp,
                child: Container(
                  width: 18,
                  height: 18,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    border: Border.all(color: AppColors.primary, width: 1.5),
                  ),
                  child: const Center(
                    child: Text(
                      '?',
                      style: TextStyle(
                        color: AppColors.primary,
                        fontSize: 11,
                        fontWeight: FontWeight.bold,
                        height: 1.0,
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: _buildMethodCard(
                  method: 'Binance UID',
                  icon: Icons.account_circle_outlined,
                  title: 'Binance UID',
                  subtitle: 'Fee: 0 BTC',
                  badge: 'DEFAULT',
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _buildMethodCard(
                  method: 'BEP20',
                  icon: Icons.account_balance_wallet_outlined,
                  title: 'BNB Smart Chain',
                  subtitle: 'Fee: 0.00000028 BTC',
                  badge: 'BEP20',
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildMethodCard({
    required String method,
    required IconData icon,
    required String title,
    required String subtitle,
    required String badge,
  }) {
    final isSelected = _selectedWithdrawMethod == method;
    return GestureDetector(
      onTap: () {
        setState(() {
          _selectedWithdrawMethod = method;
          _addressController.clear();
        });
      },
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: isSelected
              ? AppColors.primary.withOpacity(0.12)
              : AppColors.cardDark,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: isSelected ? AppColors.primary : AppColors.divider,
            width: isSelected ? 2 : 1,
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(
                  icon,
                  color: isSelected ? AppColors.primary : AppColors.textSecondary,
                  size: 20,
                ),
                const SizedBox(width: 6),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(
                    color: isSelected
                        ? AppColors.primary
                        : AppColors.divider,
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: Text(
                    badge,
                    style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.bold,
                      color: isSelected ? Colors.black : AppColors.textSecondary,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Text(
              title,
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: isSelected ? AppColors.primary : AppColors.textPrimary,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              subtitle,
              style: const TextStyle(
                fontSize: 11,
                color: AppColors.textSecondary,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildWalletAddressSection() {
    final isUID = _selectedWithdrawMethod == 'Binance UID';
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            isUID ? 'Binance UID' : 'Wallet Address',
            style: const TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w600,
              color: AppColors.textPrimary,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            isUID
                ? 'Find your UID in Binance Account → Profile → UID'
                : 'Must start with 0x, 42 characters total',
            style: const TextStyle(
              fontSize: 12,
              color: AppColors.textSecondary,
            ),
          ),
          const SizedBox(height: 12),
          GestureDetector(
            onLongPress: () async {
              final data = await Clipboard.getData('text/plain');
              if (data != null && data.text != null) {
                setState(() {
                  _addressController.text = data.text!;
                });
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text(isUID ? 'UID pasted' : 'Address pasted'),
                      backgroundColor: AppColors.success,
                    ),
                  );
                }
              }
            },
            child: Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: AppColors.cardDark,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppColors.divider, width: 1),
              ),
              child: TextField(
                controller: _addressController,
                keyboardType: isUID
                    ? TextInputType.number
                    : TextInputType.text,
                inputFormatters: isUID
                    ? [
                        FilteringTextInputFormatter.digitsOnly,
                        LengthLimitingTextInputFormatter(12),
                      ]
                    : [
                        LengthLimitingTextInputFormatter(42),
                        FilteringTextInputFormatter.allow(
                            RegExp(r'[0-9a-fA-Fx]')),
                      ],
                decoration: InputDecoration(
                  hintText: isUID
                      ? 'Enter Binance UID (e.g. 123456789)'
                      : 'Long press to paste (0x...)',
                  hintStyle: TextStyle(
                    color: AppColors.textSecondary.withOpacity(0.5),
                    fontSize: 15,
                  ),
                  border: InputBorder.none,
                  contentPadding: EdgeInsets.zero,
                ),
                style: const TextStyle(
                  fontSize: 16,
                  color: AppColors.textPrimary,
                ),
                maxLines: isUID ? 1 : 2,
                onChanged: (value) {
                  setState(() {});
                },
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBinanceAd() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Create a BTC wallet now!',
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w600,
              color: AppColors.textPrimary,
            ),
          ),
          const SizedBox(height: 12),
          GestureDetector(
            onTap: () => _openBinanceRegistration(),
            child: Container(
              width: double.infinity,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppColors.primary, width: 1.5),
                boxShadow: [
                  BoxShadow(
                    color: AppColors.primary.withOpacity(0.18),
                    blurRadius: 8,
                    spreadRadius: 0,
                  ),
                ],
              ),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(10.5),
                child: Image.asset(
                  'assets/images/binance_wallet_banner.png',
                  fit: BoxFit.fitWidth,
                  errorBuilder: (context, error, stackTrace) {
                    // 图片未放置时显示降级UI
                    return Container(
                      color: const Color(0xFF1A1A1A),
                      child: const Center(
                        child: Text(
                          'Register Binance Wallet',
                          style: TextStyle(color: Color(0xFFF0B90B), fontWeight: FontWeight.bold),
                        ),
                      ),
                    );
                  },
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
  Widget _buildBottomSection(UserProvider provider) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Column(
        children: [
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: AppColors.cardDark,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: AppColors.divider, width: 1),
            ),
            child: Column(
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text(
                      'Amount Received',
                      style: TextStyle(
                        fontSize: 14,
                        color: AppColors.textSecondary,
                      ),
                    ),
                    Text(
                      '${_amountReceived.toStringAsFixed(8)} BTC',
                      style: const TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                        color: AppColors.primary,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text(
                      'Network Fee',
                      style: TextStyle(
                        fontSize: 14,
                        color: AppColors.textSecondary,
                      ),
                    ),
                    Text(
                      '${_networkFee.toStringAsFixed(8)} BTC',
                      style: const TextStyle(
                        fontSize: 14,
                        color: AppColors.textSecondary,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),
          Container(
            width: double.infinity,
            height: 56,
            decoration: BoxDecoration(
              gradient: _canWithdraw
                  ? LinearGradient(
                      colors: [AppColors.primary, AppColors.secondary],
                      begin: Alignment.centerLeft,
                      end: Alignment.centerRight,
                    )
                  : null,
              color: _canWithdraw ? null : AppColors.divider,
              borderRadius: BorderRadius.circular(28),
              boxShadow: _canWithdraw
                  ? [
                      BoxShadow(
                        color: AppColors.primary.withOpacity(0.3),
                        blurRadius: 12,
                        offset: const Offset(0, 4),
                      ),
                    ]
                  : null,
            ),
            child: ElevatedButton(
              onPressed: _canWithdraw ? () => _handleWithdraw(provider) : null,
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.transparent,
                disabledBackgroundColor: Colors.transparent,
                foregroundColor: Colors.white,
                shadowColor: Colors.transparent,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(28),
                ),
                elevation: 0,
              ),
              child: const Text(
                'WITHDRAW',
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                  letterSpacing: 0.5,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  /// 打开Binance注册页面
  Future<void> _openBinanceRegistration() async {
    final url = Uri.parse('https://www.binance.com/en/register');
    try {
      if (await canLaunchUrl(url)) {
        await launchUrl(url, mode: LaunchMode.externalApplication);
      } else {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Unable to open Binance registration page'),
              backgroundColor: AppColors.error,
            ),
          );
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Error: $e'),
            backgroundColor: AppColors.error,
          ),
        );
      }
    }
  }

  Widget _buildDialogRow(String label, String value, {Color? valueColor}) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: const TextStyle(color: AppColors.textSecondary, fontSize: 14),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Text(
            value,
            textAlign: TextAlign.end,
            style: TextStyle(
              color: valueColor ?? AppColors.textPrimary,
              fontSize: 14,
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
      ],
    );
  }

  Future<void> _handleWithdraw(UserProvider provider) async {
    // 显示确认对话框
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: AppColors.cardDark,
        title: const Text(
          'Confirm Withdrawal',
          style: TextStyle(color: AppColors.textPrimary),
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _buildDialogRow(
              'Amount',
              '${_withdrawAmount.toStringAsFixed(8)} BTC',
            ),
            const SizedBox(height: 12),
            _buildDialogRow('Fee', '${_networkFee.toStringAsFixed(8)} BTC'),
            const SizedBox(height: 12),
            _buildDialogRow(
              'Receive',
              '${_amountReceived.toStringAsFixed(8)} BTC',
              valueColor: AppColors.primary,
            ),
            const SizedBox(height: 12),
            _buildDialogRow('Network',
              _selectedWithdrawMethod == 'Binance UID'
                  ? 'Binance UID'
                  : 'BNB Smart Chain(BEP20)'),
            const SizedBox(height: 12),
            _buildDialogRow(
              _selectedWithdrawMethod == 'Binance UID' ? 'UID' : 'Address',
              _addressController.text,
            ),
            const SizedBox(height: 16),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppColors.error.withOpacity(0.15),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(
                  color: AppColors.error.withOpacity(0.3),
                  width: 1,
                ),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Icon(
                    Icons.warning_amber_rounded,
                    color: AppColors.error,
                    size: 20,
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      _selectedWithdrawMethod == 'Binance UID'
                          ? 'Please double-check your Binance UID. Incorrect UID will result in permanent loss.'
                          : 'Please double-check the BEP20 address. Incorrect addresses will result in permanent loss.',
                      style: TextStyle(
                        color: AppColors.error,
                        fontSize: 12,
                        height: 1.4,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text(
              'Cancel',
              style: TextStyle(color: AppColors.textSecondary),
            ),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(context, true),
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.primary,
              foregroundColor: Colors.black,
            ),
            child: const Text('Confirm'),
          ),
        ],
      ),
    );

    if (confirmed == true && mounted) {
      // 显示加载对话框
      showDialog(
        context: context,
        barrierDismissible: false,
        builder: (context) => Center(
          child: Container(
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              color: AppColors.cardDark,
              borderRadius: BorderRadius.circular(12),
            ),
            child: const CircularProgressIndicator(
              valueColor: AlwaysStoppedAnimation<Color>(AppColors.primary),
            ),
          ),
        ),
      );

      // 执行提现
      final success = await provider.withdrawBitcoin(
        _withdrawAmount.toString(),
        _addressController.text,
        _selectedWithdrawMethod == 'Binance UID' ? 'BINANCE_UID' : 'BEP20',
        _networkFee.toString(),
      );

      if (mounted) {
        Navigator.pop(context); // 关闭加载对话框

        if (success) {
          // 提现成功，跳转到历史页面，显示pending标签
          Navigator.pushReplacement(
            context,
            MaterialPageRoute(
              builder: (context) => const WithdrawalHistoryScreen(
                initialTabIndex: 1, // pending标签的索引
              ),
            ),
          );
          
          // 显示成功提示
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Withdrawal request submitted successfully! Pending review.'),
              backgroundColor: AppColors.success,
              duration: Duration(seconds: 3),
              behavior: SnackBarBehavior.floating,
            ),
          );
        } else {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(provider.errorMessage ?? 'Withdrawal failed'),
              backgroundColor: AppColors.error,
              duration: const Duration(seconds: 4),
              behavior: SnackBarBehavior.floating,
              margin: const EdgeInsets.only(bottom: 80, left: 16, right: 16),
            ),
          );
        }
      }
    }
  }
}

/// 比特币金额格式化器 - 限制小数点后8位
class _BitcoinAmountFormatter extends TextInputFormatter {
  @override
  TextEditingValue formatEditUpdate(
    TextEditingValue oldValue,
    TextEditingValue newValue,
  ) {
    if (newValue.text.isEmpty) {
      return newValue;
    }

    // 验证格式是否正确
    final regex = RegExp(r'^\d*\.?\d{0,8}$');
    if (!regex.hasMatch(newValue.text)) {
      return oldValue;
    }

    // 防止多个小数点
    if (newValue.text.split('.').length > 2) {
      return oldValue;
    }

    // 防止以多个0开头（除了0.xxx）
    if (newValue.text.length > 1 &&
        newValue.text[0] == '0' &&
        newValue.text[1] != '.') {
      return oldValue;
    }

    return newValue;
  }
}
