import 'dart:async';
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

  // 积分奖励回调（首次订阅某档位时触发）
  Function(int pointsAwarded)? onPointsAwarded;
  
  // 用户ID（需要从外部设置，由 purchase_page 注入）
  String? userId;
  // JWT 鉴权 Token（用于 verify-purchase 接口的 Authorization header）
  String? authToken;

  // 本次 App 会话内已提交后端验证的交易 ID（防止 Google Play 多次回调同一笔交易时重复创建合约）
  final Set<String> _processedTransactionIds = {};

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

  /// 加载订阅商品列表（最多重试3次，每次间隔2秒）
  Future<void> loadProducts({int maxRetries = 3}) async {
    for (int attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        final ProductDetailsResponse response = await _iap.queryProductDetails(_subscriptionIds);

        if (response.error != null) {
          print('❌ [第$attempt次] 查询订阅商品失败: ${response.error}');
        } else {
          if (response.notFoundIDs.isNotEmpty) {
            print('⚠️ [第$attempt次] 未找到的订阅商品: ${response.notFoundIDs}');
          }
          if (response.productDetails.isNotEmpty) {
            subscriptionProducts = response.productDetails;
            subscriptionProducts.sort((a, b) => a.id.compareTo(b.id));
            print('✅ 加载了 ${subscriptionProducts.length} 个订阅商品');
            for (var product in subscriptionProducts) {
              print('📦 订阅: ${product.id} - ${product.price} - ${product.title}');
            }
            return; // 加载成功，直接返回
          }
          print('⚠️ [第$attempt次] queryProductDetails 返回空列表');
        }
      } catch (e) {
        print('❌ [第$attempt次] 加载订阅商品异常: $e');
      }
      if (attempt < maxRetries) {
        print('⏳ ${attempt * 2}秒后重试...');
        await Future.delayed(Duration(seconds: attempt * 2));
      }
    }
    print('❌ 加载订阅商品最终失败，已重试 $maxRetries 次');
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
      ProductDetails? product = getSubscription(subscriptionId);
      // 若商品列表为空或商品未找到，尝试重新加载一次
      if (product == null) {
        print('⚠️ 商品未找到，尝试重新加载商品列表...');
        await loadProducts();
        product = getSubscription(subscriptionId);
      }
      if (product == null) {
        print('❌ 重新加载后仍未找到商品: $subscriptionId，列表: ${subscriptionProducts.map((p) => p.id).toList()}');
        onPurchaseUpdate?.call(false, 'Product not found. Please refresh and try again.');
        return;
      }

      print('🛒 发起订阅购买: ${product.id} - ${product.price}');

      // 将 userId 作为 applicationUserName 写入购买参数。
      // Google Play 会将其存为 obfuscatedExternalAccountId，
      // RTDN Webhook 可通过 Play Developer API 获取此字段以定位用户合约。
      final purchaseParam = GooglePlayPurchaseParam(
        productDetails: product,
        applicationUserName: userId,
      );
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
        // pending 仅出现在特殊支付方式（需线下付款等）或处理中的过渡状态。
        // 【重要】不调用 onPurchaseUpdate：回调会清空 _loadingTierId，导致后续
        // purchased 事件到来时 purchasedProductId = null，队列无法激活。
        // 按钮的加载状态已由 _loadingTierId != null 在 UI 层维持，无需额外 SnackBar。
        print('⏳ 购买挂起（处理中或需线下付款）: ${purchaseDetails.productID}');

      } else if (purchaseDetails.status == PurchaseStatus.purchased) {
        // 防止 Google Play 多次回调同一笔交易重复创建合约
        final txId = purchaseDetails.purchaseID;
        if (txId != null && _processedTransactionIds.contains(txId)) {
          print('⚠️ [GP] 跳过重复交易 $txId（本次会话已处理），仅完成确认');
          if (purchaseDetails.pendingCompletePurchase) {
            _iap.completePurchase(purchaseDetails);
          }
        } else {
          if (txId != null) _processedTransactionIds.add(txId);
          // 购买成功 - 验证收据（completePurchase 在验证完成后调用）
          _verifyAndDeliver(purchaseDetails);
        }
        
      } else if (purchaseDetails.status == PurchaseStatus.error) {
        // 购买失败
        print('❌ 购买失败: ${purchaseDetails.error}');
        onPurchaseUpdate?.call(false, 'Purchase failed: ${purchaseDetails.error?.message ?? "Unknown error"}');
        if (purchaseDetails.pendingCompletePurchase) {
          _iap.completePurchase(purchaseDetails);
        }
        
      } else if (purchaseDetails.status == PurchaseStatus.canceled) {
        // 用户取消
        print('⚠️ 用户取消购买');
        onPurchaseUpdate?.call(false, 'Purchase cancelled.');
        if (purchaseDetails.pendingCompletePurchase) {
          _iap.completePurchase(purchaseDetails);
        }

      } else if (purchaseDetails.status == PurchaseStatus.restored) {
        // 恢复购买（restorePurchases 触发）：走与新购买相同的验证流程
        final txId = purchaseDetails.purchaseID;
        if (txId != null && _processedTransactionIds.contains(txId)) {
          print('⚠️ [GP] 跳过重复恢复交易 $txId（本次会话已处理）');
          if (purchaseDetails.pendingCompletePurchase) {
            _iap.completePurchase(purchaseDetails);
          }
        } else {
          if (txId != null) _processedTransactionIds.add(txId);
          _verifyAndDeliver(purchaseDetails);
        }
      }
      // completePurchase 已在各分支内处理（purchased 状态由 _verifyAndDeliver 负责调用）
    }
  }

  /// 验证收据并发放奖励
  /// 按照 Google Play 规范：在后端确认后才调用 completePurchase，
  /// 网络异常时不关闭交易，让 Google Play 在下次启动时重播以便自动重试。
  Future<void> _verifyAndDeliver(PurchaseDetails purchase) async {
    try {
      print('🔐 验证购买收据...');

      if (userId == null || userId!.isEmpty) {
        print('❌ 用户未登录');
        onPurchaseUpdate?.call(false, 'Please log in first.');
        // 永久性失败，关闭交易避免反复重播
        if (purchase.pendingCompletePurchase) {
          _iap.completePurchase(purchase);
        }
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
        headers: {
          'Content-Type': 'application/json',
          if (authToken != null && authToken!.isNotEmpty)
            'Authorization': 'Bearer $authToken',
        },
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
          final int pts = (data['pointsAwarded'] ?? 0) as int;
          if (pts > 0) {
            print('🎉 Android 购买积分奖励: +$pts 积分');
            onPointsAwarded?.call(pts);
          }
          onPurchaseUpdate?.call(true, 'Purchase successful! Contract activated. Check "My Contracts" to view.');
        } else {
          print('❌ 验证失败: ${data['message']}');
          final String errCode = (data['code'] as String?) ?? '';
          if (errCode == 'SUBSCRIPTION_EXPIRED') {
            // 后端明确告知订阅已过期：友好提示，让用户点击「Subscribe」重新订阅
            onPurchaseUpdate?.call(
              false,
              'Your previous subscription has expired. Please tap Subscribe again to start a new subscription.',
            );
          } else {
            onPurchaseUpdate?.call(false, 'Verification failed: ${data["message"]}');
          }
        }
        // 服务端已处理（无论成功/失败），关闭 Google Play 交易
        if (purchase.pendingCompletePurchase) {
          _iap.completePurchase(purchase);
        }
      } else {
        print('❌ 服务器验证失败: ${response.statusCode}');
        onPurchaseUpdate?.call(false, 'Server verification failed. Please contact support.');
        // 服务端返回错误，关闭交易
        if (purchase.pendingCompletePurchase) {
          _iap.completePurchase(purchase);
        }
      }
      
    } catch (e) {
      print('❌ 验证异常（网络错误）: $e');
      onPurchaseUpdate?.call(false, 'Network error. Please check your connection.');
      // 网络错误：不调用 completePurchase，让 Google Play 重播此交易以便自动重试。
      // 同时从去重集合中移除该 txId，允许本会话内重试。
      final txId = purchase.purchaseID;
      if (txId != null) _processedTransactionIds.remove(txId);
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
