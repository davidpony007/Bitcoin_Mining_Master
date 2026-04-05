import 'dart:async';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
import '../constants/app_constants.dart';
import '../services/google_play_billing_service.dart';
import '../services/apple_in_app_purchase_service.dart';
import '../services/analytics_service.dart';
import '../services/storage_service.dart';

class PaidContractsScreen extends StatefulWidget {
  final String? highlightProductId; // 续订时高亮指定档位
  const PaidContractsScreen({super.key, this.highlightProductId});

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

  // Restore 状态
  bool _isRestoring = false;
  bool _restoreFoundAny = false;
  Timer? _restoreTimer;

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
    _billingService.authToken = StorageService().getAuthToken();
    _billingService.onPurchaseUpdate = (bool success, String message) {
      if (!mounted) return;
      final purchasedProductId = _loadingTierId; // 在清空前先捕获已购产品ID
      setState(() => _loadingTierId = null);
      // 只有用户有主动购买意图（purchasedProductId != null）时才显示 SnackBar
      // 后台 StoreKit 重播交易（_loadingTierId == null）无论成功还是失败都不弹提示，
      // 避免无操作时持续弹出错误提示（如旧测试交易回放验证失败）
      if (purchasedProductId != null) {
        _showPurchaseResult(success, message);
      }
      if (success && purchasedProductId != null) {
        // 只有用户主动发起购买（_loadingTierId != null）时才关闭页面
        Future.delayed(const Duration(milliseconds: 300), () {
          if (mounted) {
            Navigator.pop(context, purchasedProductId);
          }
        });
      }
    };
    _billingService.onPointsAwarded = (int pts) {
      if (!mounted) return;
      // 只有用户主动购买（_loadingTierId != null）时才显示积分奖励
      // 后台 StoreKit/Google Play 重播旧交易时不弹积分提示
      if (_loadingTierId == null) return;
      Future.delayed(const Duration(milliseconds: 500), () {
        if (mounted) _showPointsReward(pts);
      });
    };
    final available = await _billingService.init();
    if (available) {
      await _billingService.loadProducts();
    }
    // 只有在商品成功加载时才标记服务可用（否则点击购买会立即报 Product not found）
    final productsLoaded = _billingService.subscriptionProducts.isNotEmpty;
    if (mounted) setState(() => _serviceInitialized = available && productsLoaded);
  }

  Future<void> _initAppleService() async {
    final userId = StorageService().getUserId();
    _appleService.userId = userId;
    _appleService.authToken = StorageService().getAuthToken();
    _appleService.onPurchaseUpdate = (bool success, String message) {
      if (!mounted) return;

      // ── Restore 路径 ──────────────────────────────────────────
      // restorePurchases() 由用户主动触发时 _loadingTierId=null，
      // 需单独判断 _isRestoring，不能走下面的 purchasedProductId 路径。
      if (_isRestoring) {
        if (success) {
          _restoreFoundAny = true;
          _restoreTimer?.cancel();
          setState(() => _isRestoring = false);
          _showPurchaseResult(true, 'Subscription restored! Your contract is now active.');
        }
        // 失败时保持 _isRestoring=true，等待后续事件或超时
        return;
      }

      // ── 正常购买路径 ───────────────────────────────────────────
      final purchasedProductId = _loadingTierId; // 在清空前先捕获已购产品ID
      setState(() => _loadingTierId = null);
      // 只有用户有主动购买意图（purchasedProductId != null）时才显示 SnackBar
      // 后台 StoreKit 重播交易（_loadingTierId == null）无论成功还是失败都不弹提示，
      // 避免无操作时持续弹出错误提示（如旧测试交易回放验证失败）
      if (purchasedProductId != null) {
        _showPurchaseResult(success, message);
      }
      if (success && purchasedProductId != null) {
        // 只有用户主动发起购买（_loadingTierId != null）时才关闭页面
        Future.delayed(const Duration(milliseconds: 300), () {
          if (mounted) {
            Navigator.pop(context, purchasedProductId);
          }
        });
      }
    };
    _appleService.onPointsAwarded = (int pts) {
      if (!mounted) return;
      // 只有用户主动购买（_loadingTierId != null）时才显示积分奖励
      // 后台 StoreKit 重播旧交易时不弹积分提示
      if (_loadingTierId == null) return;
      Future.delayed(const Duration(milliseconds: 500), () {
        if (mounted) _showPointsReward(pts);
      });
    };
    final available = await _appleService.init();
    if (mounted) setState(() => _serviceInitialized = available);
  }

  void _startRestore() {
    setState(() {
      _isRestoring = true;
      _restoreFoundAny = false;
    });
    _appleService.restorePurchases();
    // 10 秒超时：若无任何已购订阅，StoreKit 不会回调，此处兜底提示用户
    _restoreTimer?.cancel();
    _restoreTimer = Timer(const Duration(seconds: 10), () {
      if (!mounted) return;
      _appleService.cancelRestore(); // 清理服务层 _isUserRestoring 标志
      setState(() => _isRestoring = false);
      if (!_restoreFoundAny) {
        _showPurchaseResult(false, 'No active subscriptions found to restore.');
      }
    });
  }

  void _showPointsReward(int points) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Row(
          children: [
            const Text('🎉', style: TextStyle(fontSize: 18)),
            const SizedBox(width: 8),
            Text(
              '+$points Points！Subscription Reward',
              style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
            ),
          ],
        ),
        backgroundColor: const Color(0xFF50C878),
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
        duration: const Duration(seconds: 5),
      ),
    );
  }

  void _showPurchaseResult(bool success, String message) {
    final bool isProcessing = !success && message.toLowerCase().contains('processing');
    final Color bgColor = success
        ? const Color(0xFF50C878)
        : isProcessing
            ? const Color(0xFFFFC107)
            : Colors.redAccent;
    final IconData iconData = success
        ? Icons.check_circle
        : isProcessing
            ? Icons.hourglass_top
            : Icons.error_outline;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Row(
          children: [
            Icon(
              iconData,
              color: Colors.white,
              size: 20,
            ),
            const SizedBox(width: 8),
            Expanded(child: Text(message)),
          ],
        ),
        backgroundColor: bgColor,
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
        duration: const Duration(seconds: 4),
      ),
    );
  }

  @override
  void dispose() {
    _restoreTimer?.cancel();
    _billingService.dispose();
    // 页面销毁前先清除回调，防止单例 AppleInAppPurchaseService 在页面销毁后
    // 仍触发 onPurchaseUpdate（如 contracts_screen syncSubscriptionStatus 触发
    // restorePurchases 回调），意外执行 Navigator.pop 导致黑屏
    _appleService.onPurchaseUpdate = null;
    _appleService.onPointsAwarded = null;
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
                  onPressed: (_serviceInitialized && !_isRestoring && _loadingTierId == null)
                      ? _startRestore
                      : null,
                  child: _isRestoring
                      ? const SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            valueColor: AlwaysStoppedAnimation<Color>(Colors.white70),
                          ),
                        )
                      : const Text(
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
    final bool isHighlighted =
        widget.highlightProductId != null &&
        tier['id'] == widget.highlightProductId;

    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      decoration: BoxDecoration(
        color: const Color(0xFF0F1624),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: isHighlighted ? const Color(0xFFF7931A) : tier['color'],
          width: (isPopular || isHighlighted) ? 2.5 : 2,
        ),
        boxShadow: [
          BoxShadow(
            color: (isHighlighted
                    ? const Color(0xFFF7931A)
                    : tier['color'] as Color)
                .withOpacity(0.45),
            blurRadius: 16,
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

          // 续订标签
          if (isHighlighted)
            Positioned(
              top: 12,
              left: 16,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                decoration: BoxDecoration(
                  color: const Color(0xFFF7931A),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Text(
                  '🔄 RENEW',
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
                // 预留POPULAR/RENEW标签的空间
                if (isPopular || isHighlighted) const SizedBox(height: 32),
                
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
    // 埋点：用户点击订阅（发起购买，还未完成）— 用于计算支付转化率
    final price = (tier['price'] as num?)?.toDouble() ?? 0.0;
    AnalyticsService.instance.logInitiatePurchase(
      contractId: tier['id']?.toString() ?? '',
      price: price,
      currency: 'USD',
    );
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
      // ── 购买前预检查（Android）：若已有该档位的活跃合约则阻止重复订阅 ──
      final productId = tier['id'] as String;
      try {
        final statusUrl = Uri.parse('${ApiConstants.baseUrl}/contract-status/details/$userId');
        final statusResp = await http.get(statusUrl).timeout(const Duration(seconds: 8));
        if (statusResp.statusCode == 200) {
          final statusData = jsonDecode(statusResp.body) as Map<String, dynamic>;
          if (statusData['success'] == true) {
            final paidData = statusData['data']?['paidContracts'] as Map<String, dynamic>? ?? {};
            final activeList = (paidData['active'] as List<dynamic>?) ?? [];
            final hasActiveForThisPlan = activeList.any((c) => c['productId'] == productId);
            if (hasActiveForThisPlan) {
              _showPurchaseResult(false, 'You already have an active subscription for this plan.');
              return;
            }
          }
        }
      } catch (e) {
        debugPrint('⚠️ Android 活跃合约预检查失败（不阻断购买）: $e');
        // 预检查失败时不阻断，后端仍会做最终判断
      }
      setState(() => _loadingTierId = tier['id'] as String);
      _billingService.userId = userId;
      _billingService.authToken = StorageService().getAuthToken();
      await _billingService.buySubscription(storeId);
      // 结果通过 onPurchaseUpdate 回调返回，会自动清除 _loadingTierId
      // 安全超时：60 秒内若 onPurchaseUpdate 仍未回调（如 itemAlreadyOwned 事件未触发），
      // 自动清除 loading 防止永久转圈，让用户可以再次尝试。
      final capturedTierIdAndroid = tier['id'] as String;
      Future.delayed(const Duration(seconds: 60), () {
        if (mounted && _loadingTierId == capturedTierIdAndroid) {
          setState(() => _loadingTierId = null);
          _showPurchaseResult(false, 'Purchase is taking too long. Please try again.');
        }
      });
    } else if (Platform.isIOS) {
      // iOS: Apple In-App Purchase via App Store
      if (!_serviceInitialized) {
        // 可能 init() 仍在运行，等待最多 3 秒再检查一次
        setState(() => _loadingTierId = tier['id'] as String);
        int waited = 0;
        while (!_serviceInitialized && waited < 30) {
          await Future.delayed(const Duration(milliseconds: 100));
          waited++;
        }
        if (!_serviceInitialized) {
          setState(() => _loadingTierId = null);
          _showPurchaseResult(false, 'Payment service unavailable. Please check your network and try again, or check Settings > Screen Time.');
          return;
        }
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
      // ── 购买前预检查：查询后端该用户是否已有此产品的活跃合约 ──
      // 活跃合约 → 阻止重复购买；过期/取消/无合约 → 正常续订
      setState(() => _loadingTierId = tier['id'] as String);
      final productId = tier['id'] as String;
      // preCheckConfirmedClean：只有在 API 返回 200+success 且明确无活跃合约时才置 true。
      // 该值传给 buyProduct，控制 storekit_duplicate_product_object 时是否允许 restore 回放。
      bool preCheckConfirmedClean = false;
      try {
        final statusUrl = Uri.parse('${ApiConstants.baseUrl}/contract-status/details/$userId');
        final statusResp = await http.get(statusUrl).timeout(const Duration(seconds: 8));
        if (statusResp.statusCode == 200) {
          final statusData = jsonDecode(statusResp.body) as Map<String, dynamic>;
          if (statusData['success'] == true) {
            final paidData = statusData['data']?['paidContracts'] as Map<String, dynamic>? ?? {};
            final activeList = (paidData['active'] as List<dynamic>?) ?? [];
            // 检查该 productId 是否已有活跃合约；同时拦截 productId='custom'（DB product_id 为 NULL 的异常数据）
            final hasActiveForThisPlan = activeList.any(
              (c) => c['productId'] == productId,
            );
            if (hasActiveForThisPlan) {
              setState(() => _loadingTierId = null);
              _showPurchaseResult(false, 'You already have an active subscription for this plan.');
              return;
            }
            // API 成功返回且明确无活跃合约 → 允许后续 restore 回放残留交易
            preCheckConfirmedClean = true;
          }
        }
      } catch (e) {
        // 预检查失败（网络异常等），preCheckConfirmedClean 保持 false
        debugPrint('⚠️ 活跃合约预检查失败: $e');
      }
      _appleService.userId = userId;
      _appleService.authToken = StorageService().getAuthToken();
      // 清除 StoreKit 队列中的残留未完成交易，防止旧交易被直接回放
      // 导致跳过 Apple 支付确认弹窗、直接显示"订阅成功"
      await _appleService.clearPendingTransactions();
      await _appleService.buyProduct(storeId, preCheckConfirmedClean: preCheckConfirmedClean);
      // 安全超时：buyProduct 返回后若 35 秒内 onPurchaseUpdate 仍未回调
      // （storekit_duplicate_product_object 后 StoreKit 未重放，或其他异常），
      // 自动清除 loading 防止永久转圈，让用户可以再次尝试。
      final capturedTierId = tier['id'] as String;
      Future.delayed(const Duration(seconds: 90), () {
        if (mounted && _loadingTierId == capturedTierId) {
          setState(() => _loadingTierId = null);
          _showPurchaseResult(false, 'Purchase is taking too long. Please try again.');
        }
      });
      // 结果通过 onPurchaseUpdate 回调返回，会自动清除 _loadingTierId
    }
  }
}
