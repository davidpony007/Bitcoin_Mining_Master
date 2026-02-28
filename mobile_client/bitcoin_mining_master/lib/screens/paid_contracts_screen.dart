import 'dart:io';
import 'package:flutter/material.dart';
import '../services/google_play_billing_service.dart';
import '../services/storage_service.dart';

class PaidContractsScreen extends StatefulWidget {
  const PaidContractsScreen({super.key});

  @override
  State<PaidContractsScreen> createState() => _PaidContractsScreenState();
}

class _PaidContractsScreenState extends State<PaidContractsScreen> {
  final GooglePlayBillingService _billingService = GooglePlayBillingService();
  bool _serviceInitialized = false;
  String? _loadingTierId; // 正在发起购买的套餐内部ID

  // 内部ID → 商店产品ID 映射
  static const Map<String, String> _storeProductIdMap = {
    'p0499': 'p04.99',
    'p0699': 'p06.99',
    'p0999': 'p09.99',
    'p1999': 'p19.99',
  };

  // 付费合约档位配置
  final List<Map<String, dynamic>> _contractTiers = [
    {
      'id': 'p0499',
      'price': 4.99,
      'name': 'Starter Plan',
      'duration': 30,
      'hashrate': '176.3 Gh/s',
      'dailyOutput': '0.00000038503 BTC',
      'totalOutput': '0.00001155091 BTC',
      'description': 'Perfect for beginners',
      'color': Color(0xFF4A90E2),
      'popular': false,
    },
    {
      'id': 'p0699',
      'price': 6.99,
      'name': 'Standard Plan',
      'duration': 30,
      'hashrate': '305.6 Gh/s',
      'dailyOutput': '0.00000066727 BTC',
      'totalOutput': '0.00002001802 BTC',
      'description': 'Most popular choice',
      'color': Color(0xFF50C878),
      'popular': true,
    },
    {
      'id': 'p0999',
      'price': 9.99,
      'name': 'Advanced Plan',
      'duration': 30,
      'hashrate': '611.2 Gh/s',
      'dailyOutput': '0.00000133466 BTC',
      'totalOutput': '0.00004003982 BTC',
      'description': 'For serious miners',
      'color': Color(0xFFFF6B35),
      'popular': false,
    },
    {
      'id': 'p1999',
      'price': 19.99,
      'name': 'Premium Plan',
      'duration': 30,
      'hashrate': '1326.4 Gh/s',
      'dailyOutput': '0.00000289630 BTC',
      'totalOutput': '0.00008688902 BTC',
      'description': 'Maximum hashrate power',
      'color': Color(0xFFFFD700),
      'popular': false,
    },
  ];

  @override
  void initState() {
    super.initState();
    if (Platform.isAndroid) {
      _initBillingService();
    }
  }

  Future<void> _initBillingService() async {
    final userId = StorageService().getUserId();
    _billingService.userId = userId;
    _billingService.onPurchaseUpdate = (bool success, String message) {
      if (!mounted) return;
      setState(() => _loadingTierId = null);
      _showPurchaseResult(success, message);
    };
    final available = await _billingService.init();
    if (available) {
      await _billingService.loadProducts();
    }
    if (mounted) setState(() => _serviceInitialized = available);
  }

  void _showPurchaseResult(bool success, String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Row(
          children: [
            Icon(
              success ? Icons.check_circle : Icons.error_outline,
              color: Colors.white,
              size: 20,
            ),
            const SizedBox(width: 8),
            Expanded(child: Text(message)),
          ],
        ),
        backgroundColor: success ? const Color(0xFF50C878) : Colors.redAccent,
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
        duration: const Duration(seconds: 4),
      ),
    );
  }

  @override
  void dispose() {
    _billingService.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF1A1A2E),
      appBar: AppBar(
        backgroundColor: const Color(0xFF16213E),
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Colors.white),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Text(
          'Mining Contracts',
          style: TextStyle(
            color: Colors.white,
            fontSize: 20,
            fontWeight: FontWeight.bold,
          ),
        ),
        centerTitle: true,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // 页面标题和说明
            _buildHeaderSection(),
            const SizedBox(height: 24),

            // 合约列表
            ..._contractTiers.map((tier) => _buildContractCard(tier)),

            const SizedBox(height: 24),

            // 底部说明
            _buildFooterInfo(),
          ],
        ),
      ),
    );
  }

  // 顶部标题区域
  Widget _buildHeaderSection() {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF6366F1), Color(0xFF8B5CF6)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(
                Icons.rocket_launch,
                color: Colors.white,
                size: 32,
              ),
              const SizedBox(width: 12),
              const Text(
                'Boost Your Mining',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 24,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          const Text(
            'Choose a mining contract to increase your hashrate and maximize Bitcoin earnings',
            style: TextStyle(
              color: Colors.white70,
              fontSize: 14,
              height: 1.5,
            ),
          ),
        ],
      ),
    );
  }

  // 合约卡片
  Widget _buildContractCard(Map<String, dynamic> tier) {
    final bool isPopular = tier['popular'] ?? false;

    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      decoration: BoxDecoration(
        color: const Color(0xFF0F1624),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: tier['color'],
          width: isPopular ? 2.5 : 2,
        ),
        boxShadow: [
          BoxShadow(
            color: (tier['color'] as Color).withOpacity(isPopular ? 0.4 : 0.2),
            blurRadius: isPopular ? 12 : 8,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Stack(
        children: [
          // 热门标签
          if (isPopular)
            Positioned(
              top: 12,
              left: 16,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                decoration: BoxDecoration(
                  color: tier['color'],
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Text(
                  '🔥 POPULAR',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 11,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
            ),

          Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // 预留POPULAR标签的空间
                if (isPopular) const SizedBox(height: 32),
                
                // 标题和价格
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            tier['name'],
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 20,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            tier['description'],
                            style: const TextStyle(
                              color: Colors.white60,
                              fontSize: 13,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 12),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        Text(
                          '\$${tier['price'].toStringAsFixed(2)}',
                          style: TextStyle(
                            color: tier['color'],
                            fontSize: 28,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        const Text(
                          'Monthly',
                          style: TextStyle(
                            color: Colors.white60,
                            fontSize: 12,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),

                const SizedBox(height: 16),

                // 算力信息
                _buildInfoRow(
                  icon: Icons.speed,
                  label: 'Hashrate',
                  value: tier['hashrate'],
                  color: tier['color'],
                ),

                const SizedBox(height: 16),

                // 购买按钮
                SizedBox(
                  width: double.infinity,
                  height: 48,
                  child: ElevatedButton(
                    onPressed: _loadingTierId != null
                        ? null
                        : () => _handlePurchase(tier),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: tier['color'],
                      disabledBackgroundColor:
                          (tier['color'] as Color).withOpacity(0.5),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                      elevation: 0,
                    ),
                    child: _loadingTierId == tier['id']
                        ? const SizedBox(
                            width: 22,
                            height: 22,
                            child: CircularProgressIndicator(
                              strokeWidth: 2.5,
                              valueColor:
                                  AlwaysStoppedAnimation<Color>(Colors.white),
                            ),
                          )
                        : const Text(
                            'Subscribe',
                            style: TextStyle(
                              color: Colors.white,
                              fontSize: 16,
                              fontWeight: FontWeight.bold,
                            ),
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

  // 信息行
  Widget _buildInfoRow({
    required IconData icon,
    required String label,
    required String value,
    required Color color,
  }) {
    return Row(
      children: [
        Icon(
          icon,
          color: color,
          size: 20,
        ),
        const SizedBox(width: 8),
        Text(
          label,
          style: const TextStyle(
            color: Colors.white70,
            fontSize: 14,
          ),
        ),
        const Spacer(),
        Text(
          value,
          style: const TextStyle(
            color: Colors.white,
            fontSize: 14,
            fontWeight: FontWeight.bold,
          ),
        ),
      ],
    );
  }

  // 底部说明信息
  Widget _buildFooterInfo() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFF0F1624),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: const [
              Icon(
                Icons.info_outline,
                color: Color(0xFF6366F1),
                size: 20,
              ),
              SizedBox(width: 8),
              Text(
                'How it works',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          _buildBulletPoint('Contract activates immediately after purchase'),
          _buildBulletPoint('Mining runs automatically for 1 month'),
          _buildBulletPoint('Daily earnings are added to your balance'),
          _buildBulletPoint('Withdraw anytime once balance reaches minimum'),
          _buildBulletPoint('No additional fees or hidden costs'),
        ],
      ),
    );
  }

  // 说明要点
  Widget _buildBulletPoint(String text) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            '• ',
            style: TextStyle(
              color: Color(0xFF6366F1),
              fontSize: 16,
              fontWeight: FontWeight.bold,
            ),
          ),
          Expanded(
            child: Text(
              text,
              style: const TextStyle(
                color: Colors.white70,
                fontSize: 13,
                height: 1.4,
              ),
            ),
          ),
        ],
      ),
    );
  }

  // 处理购买 - 直接调起平台支付
  Future<void> _handlePurchase(Map<String, dynamic> tier) async {
    if (Platform.isAndroid) {
      // Android: 调起 Google Play Billing
      if (!_serviceInitialized) {
        _showPurchaseResult(false, 'Payment service unavailable. Please check your connection and try again.');
        return;
      }
      final userId = StorageService().getUserId();
      if (userId == null || userId.isEmpty) {
        _showPurchaseResult(false, 'Please log in before subscribing.');
        return;
      }
      final storeId = _storeProductIdMap[tier['id'] as String];
      if (storeId == null) {
        _showPurchaseResult(false, 'Invalid product configuration.');
        return;
      }
      setState(() => _loadingTierId = tier['id'] as String);
      _billingService.userId = userId;
      await _billingService.buySubscription(storeId);
      // 结果通过 onPurchaseUpdate 回调返回，会自动清除 _loadingTierId
    } else if (Platform.isIOS) {
      // iOS: Apple In-App Purchase (即将支持)
      _showPurchaseResult(false, 'Apple In-App Purchase coming soon.');
    }
  }
}
