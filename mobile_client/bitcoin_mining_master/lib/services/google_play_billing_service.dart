import 'dart:async';
import 'dart:io';
import 'package:in_app_purchase/in_app_purchase.dart';
import 'package:in_app_purchase_android/in_app_purchase_android.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
import '../constants/app_constants.dart';

class GooglePlayBillingService {
  // 单例模式
  static final GooglePlayBillingService _instance = GooglePlayBillingService._internal();
  factory GooglePlayBillingService() => _instance;
  GooglePlayBillingService._internal();

  final InAppPurchase _iap = InAppPurchase.instance;
  StreamSubscription<List<PurchaseDetails>>? _subscription;
  
  // 订阅商品ID列表 —— 必须与 Google Play Console 中创建的订阅ID完全一致
  static const Set<String> _subscriptionIds = {
    'p04.99',   // $4.99/月 - 入门订阅 (GP_04.99)
    'p06.99',   // $6.99/月 - 标准订阅 (GP_06.99)
    'p09.99',   // $9.99/月 - 进阶订阅 (GP_09.99)
    'p19.99',   // $19.99/月 - 高级订阅 (GP_19.99)
  };
  
  // 订阅商品列表
  List<ProductDetails> subscriptionProducts = [];
  
  // 购买状态回调
  Function(bool success, String message)? onPurchaseUpdate;
  
  // 用户ID（需要从外部设置，由 purchase_page 注入）
  String? userId;

  /// 初始化IAP系统
  Future<bool> init() async {
    try {
      // 检查IAP是否可用
      final available = await _iap.isAvailable();
      if (!available) {
        print('❌ Google Play Billing不可用');
        return false;
      }

      // 监听购买更新
      _subscription = _iap.purchaseStream.listen(
        _onPurchaseUpdate,
        onDone: () => _subscription?.cancel(),
        onError: (error) => print('❌ 购买流错误: $error'),
      );

      // 加载商品列表
      await loadProducts();
      
      print('✅ Google Play Billing初始化成功');
      return true;
    } catch (e) {
      print('❌ IAP初始化失败: $e');
      return false;
    }
  }

  /// 加载订阅商品列表
  Future<void> loadProducts() async {
    try {
      final ProductDetailsResponse response = await _iap.queryProductDetails(_subscriptionIds);
      
      if (response.error != null) {
        print('❌ 查询订阅商品失败: ${response.error}');
        return;
      }
      
      if (response.notFoundIDs.isNotEmpty) {
        print('⚠️ 未找到的订阅商品: ${response.notFoundIDs}');
      }

      subscriptionProducts = response.productDetails;
      subscriptionProducts.sort((a, b) => a.id.compareTo(b.id)); // 按价格排序
      
      print('✅ 加载了 ${subscriptionProducts.length} 个订阅商品');
      for (var product in subscriptionProducts) {
        print('📦 订阅: ${product.id} - ${product.price} - ${product.title}');
      }
    } catch (e) {
      print('❌ 加载订阅商品异常: $e');
    }
  }

  /// 获取指定订阅商品
  ProductDetails? getSubscription(String subscriptionId) {
    try {
      return subscriptionProducts.firstWhere((p) => p.id == subscriptionId);
    } catch (e) {
      print('⚠️ 订阅商品 $subscriptionId 未找到');
      return null;
    }
  }

  /// 购买订阅
  Future<void> buySubscription(String subscriptionId) async {
    try {
      final product = getSubscription(subscriptionId);
      if (product == null) {
        onPurchaseUpdate?.call(false, 'Product not found. Please refresh and try again.');
        return;
      }

      print('🛒 发起订阅购买: ${product.id} - ${product.price}');
      
      final purchaseParam = PurchaseParam(productDetails: product);
      // 订阅使用buyNonConsumable
      await _iap.buyNonConsumable(purchaseParam: purchaseParam);
      
    } catch (e) {
      print('❌ 订阅购买失败: $e');
      onPurchaseUpdate?.call(false, 'Subscription failed: $e');
    }
  }

  /// 处理购买更新
  void _onPurchaseUpdate(List<PurchaseDetails> purchaseDetailsList) {
    for (var purchaseDetails in purchaseDetailsList) {
      print('📦 购买状态更新: ${purchaseDetails.productID} - ${purchaseDetails.status}');
      
      if (purchaseDetails.status == PurchaseStatus.pending) {
        // 购买待处理
        print('⏳ 购买待处理...');
        onPurchaseUpdate?.call(false, 'Processing, please wait...');
        
      } else if (purchaseDetails.status == PurchaseStatus.purchased) {
        // 购买成功 - 验证收据
        _verifyAndDeliver(purchaseDetails);
        
      } else if (purchaseDetails.status == PurchaseStatus.error) {
        // 购买失败
        print('❌ 购买失败: ${purchaseDetails.error}');
        onPurchaseUpdate?.call(false, 'Purchase failed: ${purchaseDetails.error?.message ?? "Unknown error"}');
        
      } else if (purchaseDetails.status == PurchaseStatus.canceled) {
        // 用户取消
        print('⚠️ 用户取消购买');
        onPurchaseUpdate?.call(false, 'Purchase cancelled.');
      }

      // 标记购买已处理
      if (purchaseDetails.pendingCompletePurchase) {
        _iap.completePurchase(purchaseDetails);
      }
    }
  }

  /// 验证收据并发放奖励
  Future<void> _verifyAndDeliver(PurchaseDetails purchase) async {
    try {
      print('🔐 验证购买收据...');

      if (userId == null || userId!.isEmpty) {
        print('❌ 用户未登录');
        onPurchaseUpdate?.call(false, 'Please log in first.');
        return;
      }

      // 获取 Android purchaseToken
      String? purchaseToken;
      if (purchase is GooglePlayPurchaseDetails) {
        purchaseToken = purchase.billingClientPurchase.purchaseToken;
      }

      // 发送到后端验证
      final url = '${ApiConstants.baseUrl}${ApiConstants.paymentVerify}';
      print('📡 验证接口: $url');
      final response = await http.post(
        Uri.parse(url),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'user_id': userId,
          'platform': 'android',
          'store_product_id': purchase.productID,
          'transaction_id': purchase.purchaseID,
          'purchase_token': purchaseToken,
        }),
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        if (data['success'] == true) {
          print('✅ 购买验证成功，合约已发放');
          onPurchaseUpdate?.call(true, 'Purchase successful! Contract activated. Check "My Contracts" to view.');
        } else {
          print('❌ 验证失败: ${data['message']}');
          onPurchaseUpdate?.call(false, 'Verification failed: ${data["message"]}');
        }
      } else {
        print('❌ 服务器验证失败: ${response.statusCode}');
        onPurchaseUpdate?.call(false, 'Server verification failed. Please contact support.');
      }
      
    } catch (e) {
      print('❌ 验证异常: $e');
      onPurchaseUpdate?.call(false, 'Network error. Please check your connection.');
    }
  }

  /// 恢复购买（处理未完成的交易）
  Future<void> restorePurchases() async {
    try {
      print('🔄 恢复购买...');
      await _iap.restorePurchases();
      onPurchaseUpdate?.call(true, 'Purchases restored.');
    } catch (e) {
      print('❌ 恢复购买失败: $e');
      onPurchaseUpdate?.call(false, 'Restore failed: $e');
    }
  }
  
  /// 恢复历史订阅状态（将触发 purchaseStream 回调）
  Future<void> getActiveSubscriptions() async {
    try {
      print('🔄 查询历史订阅...');
      await _iap.restorePurchases();
    } catch (e) {
      print('❌ 查询订阅异常: $e');
    }
  }

  /// 清理资源
  void dispose() {
    _subscription?.cancel();
  }
}
