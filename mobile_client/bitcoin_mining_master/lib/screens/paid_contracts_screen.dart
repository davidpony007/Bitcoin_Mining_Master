import 'dart:io';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
import '../constants/app_constants.dart';
import '../services/google_play_billing_service.dart';
import '../services/apple_in_app_purchase_service.dart';
import '../services/storage_service.dart';

class PaidContractsScreen extends StatefulWidget {
  const PaidContractsScreen({super.key});

  @override
  State<PaidContractsScreen> createState() => _PaidContractsScreenState();
}

class _PaidContractsScreenState extends State<PaidContractsScreen> {
  final GooglePlayBillingService _billingService = GooglePlayBillingService();
  final AppleInAppPurchaseService _appleService = AppleInAppPurchaseService();
  bool _serviceInitialized = false;
  String? _loadingTierId; // 正在发起购买的套餐内部ID
  bool _isLoadingProducts = true; // 正在从服务端加载产品列表

  // 定义色彩和 popular 标记（按 sort_order 位置对应）
  static const List<Color> _tierColors = [
    Color(0xFF4A90E2),
    Color(0xFF50C878),
    Color(0xFFFF6B35),
    Color(0xFFFFD700),
  ];
  static const List<bool> _tierPopular = [false, true, false, false];

  // 从服务端加载的产品列表（替代硬编码的 _contractTiers）
  List<Map<String, dynamic>> _contractTiers = [];

  @override
  void initState() {
    super.initState();
    _loadProductsFromServer();
    if (Platform.isAndroid) {
      _initBillingService();
    } else if (Platform.isIOS) {
      _initAppleService();
    }
  }

  /// 从服务端 API 加载产品列表，加载失败时 fallback 到本地默认值
  Future<void> _loadProductsFromServer() async {
    try {
      final url = Uri.parse('${ApiConstants.baseUrl}/paid-contracts/products');
      final response = await http.get(url).timeout(const Duration(seconds: 10));
      if (response.statusCode == 200) {
        final data = jsonDecode(response.body) as Map<String, dynamic>;
        if (data['success'] == true && data['products'] is List) {
          final List<dynamic> raw = data['products'];
          final tiers = raw.asMap().entries.map((entry) {
            final i = entry.key;
            final p = entry.value as Map<String, dynamic>;
            final rawHashrate = double.tryParse('${p['hashrate_raw'] ?? 0}') ?? 0.0;
            final duration = (p['duration_days'] as num?)?.toInt() ?? 30;
            final durationSec = duration * 86400.0;
            final daily = rawHashrate * 86400;
            final total = rawHashrate * durationSec;
            return {
              'id': p['product_id'] ?? '',
              'price': double.tryParse('${p['product_price'] ?? 0}') ?? 0.0,
              'name': p['display_name'] ?? p['product_name'] ?? '',
              'duration': duration,
              'hashrate': p['hashrate'] ?? '',
              'dailyOutput': '${daily.toStringAsFixed(11)} BTC',
              'totalOutput': '${total.toStringAsFixed(11)} BTC',
              'description': p['description'] ?? '',
              'ios_product_id': p['ios_product_id'] ?? '',
              'android_product_id': p['android_product_id'] ?? '',
              'color': i < _tierColors.length ? _tierColors[i] : const Color(0xFF4A90E2),
              'popular': i < _tierPopular.length ? _tierPopular[i] : false,
            };
          }).toList();
          if (mounted) {
            setState(() {
              _contractTiers = tiers;
              _isLoadingProducts = false;
            });
          }
          return;
        }
      }
    } catch (e) {
      debugPrint('⚠️ 从服务端加载产品列表失败，使用内置默认值: $e');
    }
    // Fallback: 内置默认产品列表
    if (mounted) {
      setState(() {
        _contractTiers = _defaultContractTiers();
        _isLoadingProducts = false;
      });
    }
  }

  /// 本地 fallback 产品数据（服务端不可达时使用）
  List<Map<String, dynamic>> _defaultContractTiers() {
    return [
      {
        'id': 'p0499', 'price': 4.99, 'name': 'Starter Plan', 'duration': 30,
        'hashrate': '176.3 Gh/s', 'dailyOutput': '0.00000038503 BTC',
        'totalOutput': '0.00001155091 BTC', 'description': 'Perfect for beginners',
        'ios_product_id': 'appstore04.99', 'android_product_id': 'p04.99',
        'color': const Color(0xFF4A90E2), 'popular': false,
      },
      {
        'id': 'p0699', 'price': 6.99, 'name': 'Standard Plan', 'duration': 30,
        'hashrate': '305.6 Gh/s', 'dailyOutput': '0.00000066727 BTC',
        'totalOutput': '0.00002001802 BTC', 'description': 'Most popular choice',
        'ios_product_id': 'appstore06.99', 'android_product_id': 'p06.99',
        'color': const Color(0xFF50C878), 'popular': true,
      },
      {
        'id': 'p0999', 'price': 9.99, 'name': 'Advanced Plan', 'duration': 30,
        'hashrate': '611.2 Gh/s', 'dailyOutput': '0.00000133466 BTC',
        'totalOutput': '0.00004003982 BTC', 'description': 'For serious miners',
        'ios_product_id': 'appstore09.99', 'android_product_id': 'p09.99',
        'color': const Color(0xFFFF6B35), 'popular': false,
      },
      {
        'id': 'p1999', 'price': 19.99, 'name': 'Premium Plan', 'duration': 30,
        'hashrate': '1326.4 Gh/s', 'dailyOutput': '0.00000289630 BTC',
        'totalOutput': '0.00008688902 BTC', 'description': 'Maximum hashrate power',
        'ios_product_id': 'appstore19.99', 'android_product_id': 'p19.99',
        'color': const Color(0xFFFFD700), 'popular': false,
      },
    ];
  }

  Future<void> _initBillingService() async {
    final userId = StorageService().getUserId();
    _billingService.userId = userId;
    _billingService.onPurchaseUpdate = (bool success, String message) {
      if (!mounted) return;
      setState(() => _loadingTierId = null);
      _showPurchaseResult(success, message);
      if (success) {
        Future.delayed(const Duration(milliseconds: 300), () {
          if (mounted) {
            Navigator.pop(context, true);
          }
        });
      }
    };
    final available = await _billingService.init();
    if (available) {
      await _billingService.loadProducts();
    }
    if (mounted) setState(() => _serviceInitialized = available);
  }

  Future<void> _initAppleService() async {
    final userId = StorageService().getUserId();
    _appleService.userId = userId;
    _appleService.onPurchaseUpdate = (bool success, String message) {
      if (!mounted) return;
      setState(() => _loadingTierId = null);
      _showPurchaseResult(success, message);
      if (success) {
        Future.delayed(const Duration(milliseconds: 300), () {
          if (mounted) {
            Navigator.pop(context, true);
          }
        });
      }
    };
    final available = await _appleService.init();
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
    _appleService.dispose();
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
        // iOS 要求提供恢复购买入口（Restore Purchases）
        actions: Platform.isIOS
            ? [
                TextButton(
                  onPressed: _serviceInitialized
                      ? () {
                          _appleService.restorePurchases();
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(
                              content: Text('Restoring purchases...'),
                              duration: Duration(seconds: 2),
                            ),
                          );
                        }
                      : null,
                  child: const Text(
                    'Restore',
                    style: TextStyle(color: Colors.white70, fontSize: 14),
                  ),
                ),
              ]
            : null,
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
            if (_isLoadingProducts)
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 40),
                child: Center(
                  child: CircularProgressIndicator(color: Color(0xFF6366F1)),
                ),
              )
            else
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
      final storeId = tier['android_product_id'] as String? ?? '';
      if (storeId.isEmpty) {
        _showPurchaseResult(false, 'Invalid product configuration.');
        return;
      }
      setState(() => _loadingTierId = tier['id'] as String);
      _billingService.userId = userId;
      await _billingService.buySubscription(storeId);
      // 结果通过 onPurchaseUpdate 回调返回，会自动清除 _loadingTierId
    } else if (Platform.isIOS) {
      // iOS: Apple In-App Purchase via App Store
      if (!_serviceInitialized) {
        _showPurchaseResult(false, 'Payment service unavailable. Please check your connection and try again.');
        return;
      }
      final userId = StorageService().getUserId();
      if (userId == null || userId.isEmpty) {
        _showPurchaseResult(false, 'Please log in before subscribing.');
        return;
      }
      final storeId = tier['ios_product_id'] as String? ?? '';
      if (storeId.isEmpty) {
        _showPurchaseResult(false, 'Invalid product configuration.');
        return;
      }
      setState(() => _loadingTierId = tier['id'] as String);
      _appleService.userId = userId;
      await _appleService.buyProduct(storeId);
      // 结果通过 onPurchaseUpdate 回调返回，会自动清除 _loadingTierId
    }
  }
}
