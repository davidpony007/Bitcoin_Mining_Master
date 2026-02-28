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
  String _selectedNetwork = 'BNB Smart Chain(BEP20)';
  bool _useAllBalance = false;

  final double _minimumAmount = 0.00002200;
  final double _networkFee = 0.00000790;

  final List<String> _networkOptions = [
    'BNB Smart Chain(BEP20)',
    'Bitcoin(BTC)',
    'Ethereum(ERC20)',
    'Tron(TRC20)',
  ];

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
        _isValidBitcoinAddress(_addressController.text) &&
        _withdrawAmount <= _currentBalance;
  }

  /// 验证比特币地址格式
  bool _isValidBitcoinAddress(String address) {
    if (address.isEmpty) return false;

    // Legacy地址 (P2PKH): 以1开头，26-35个字符
    final legacyPattern = RegExp(r'^1[a-km-zA-HJ-NP-Z1-9]{25,34}$');
    // Script Hash地址 (P2SH): 以3开头，26-35个字符
    final p2shPattern = RegExp(r'^3[a-km-zA-HJ-NP-Z1-9]{25,34}$');
    // SegWit地址 (Bech32): 以bc1开头，42-62个字符
    final segwitPattern = RegExp(r'^bc1[a-z0-9]{39,59}$');

    return legacyPattern.hasMatch(address) ||
        p2shPattern.hasMatch(address) ||
        segwitPattern.hasMatch(address);
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
              'Please enter the correct BTC wallet address.\nIncorrect entry may result in loss of your BTC.',
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

  Widget _buildNetworkSection() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Network',
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w600,
              color: AppColors.textPrimary,
            ),
          ),
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
            decoration: BoxDecoration(
              color: AppColors.cardDark,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: AppColors.divider, width: 1),
            ),
            child: DropdownButtonHideUnderline(
              child: DropdownButton<String>(
                value: _selectedNetwork,
                isExpanded: true,
                dropdownColor: AppColors.cardDark,
                icon: const Icon(
                  Icons.keyboard_arrow_down,
                  color: AppColors.textPrimary,
                ),
                items: _networkOptions.map((String network) {
                  return DropdownMenuItem<String>(
                    value: network,
                    child: Text(
                      network,
                      style: const TextStyle(
                        fontSize: 16,
                        color: AppColors.textPrimary,
                      ),
                    ),
                  );
                }).toList(),
                onChanged: (String? newValue) {
                  if (newValue != null) {
                    setState(() {
                      _selectedNetwork = newValue;
                    });
                  }
                },
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildWalletAddressSection() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Wallet address',
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w600,
              color: AppColors.textPrimary,
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
                      content: const Text('Address pasted'),
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
                inputFormatters: [
                  // 限制长度为最大62个字符（Taproot地址长度）
                  LengthLimitingTextInputFormatter(62),
                  // 只允许字母数字字符（比特币地址格式）
                  FilteringTextInputFormatter.allow(RegExp(r'[a-zA-Z0-9]')),
                ],
                decoration: InputDecoration(
                  hintText: 'Long press to paste',
                  hintStyle: TextStyle(
                    color: AppColors.textSecondary.withOpacity(0.5),
                    fontSize: 16,
                  ),
                  border: InputBorder.none,
                  contentPadding: EdgeInsets.zero,
                ),
                style: const TextStyle(
                  fontSize: 16,
                  color: AppColors.textPrimary,
                ),
                maxLines: 2,
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
              height: 140,
              decoration: BoxDecoration(
                color: Colors.black,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFF2B2B2B), width: 1),
              ),
              child: Stack(
                children: [
                  // 右侧装饰图标（盾牌+钥匙）
                  Positioned(
                    right: 16,
                    top: 0,
                    bottom: 0,
                    child: Center(
                      child: Stack(
                        alignment: Alignment.center,
                        children: [
                          Icon(
                            Icons.shield,
                            size: 80,
                            color: const Color(0xFFF0B90B),
                          ),
                          Positioned(
                            right: 0,
                            bottom: 4,
                            child: Container(
                              padding: const EdgeInsets.all(4),
                              decoration: const BoxDecoration(
                                color: Colors.black,
                                shape: BoxShape.circle,
                              ),
                              child: const Icon(
                                Icons.vpn_key,
                                size: 22,
                                color: Colors.white,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  // 左侧内容
                  Padding(
                    padding: const EdgeInsets.fromLTRB(20, 16, 100, 16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        // Binance Wallet logo 行
                        Row(
                          children: [
                            Container(
                              width: 20,
                              height: 20,
                              decoration: const BoxDecoration(
                                color: Color(0xFFF0B90B),
                                shape: BoxShape.circle,
                              ),
                              child: const Center(
                                child: Text(
                                  'B',
                                  style: TextStyle(
                                    color: Colors.black,
                                    fontSize: 12,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                              ),
                            ),
                            const SizedBox(width: 6),
                            RichText(
                              text: const TextSpan(
                                children: [
                                  TextSpan(
                                    text: 'BINANCE ',
                                    style: TextStyle(
                                      color: Color(0xFFF0B90B),
                                      fontSize: 13,
                                      fontWeight: FontWeight.bold,
                                      letterSpacing: 0.5,
                                    ),
                                  ),
                                  TextSpan(
                                    text: 'WALLET',
                                    style: TextStyle(
                                      color: Colors.white,
                                      fontSize: 13,
                                      fontWeight: FontWeight.bold,
                                      letterSpacing: 0.5,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 10),
                        // 主标题
                        const Text(
                          'A TRUE\nSELF-CUSTODY\nWALLET',
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 17,
                            fontWeight: FontWeight.w900,
                            height: 1.15,
                            letterSpacing: 0.3,
                          ),
                        ),
                      ],
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
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          label,
          style: const TextStyle(color: AppColors.textSecondary, fontSize: 14),
        ),
        Text(
          value,
          style: TextStyle(
            color: valueColor ?? AppColors.textPrimary,
            fontSize: 14,
            fontWeight: FontWeight.w600,
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
            _buildDialogRow('Network', _selectedNetwork),
            const SizedBox(height: 12),
            const Text(
              'Address:',
              style: TextStyle(color: AppColors.textSecondary, fontSize: 14),
            ),
            const SizedBox(height: 4),
            Text(
              _addressController.text,
              style: const TextStyle(
                color: AppColors.textPrimary,
                fontSize: 13,
              ),
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
                      'Please double-check the address. Incorrect addresses will result in permanent loss.',
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
        _selectedNetwork,
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
