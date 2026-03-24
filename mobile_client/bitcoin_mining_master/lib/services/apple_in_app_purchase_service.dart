import 'dart:async';
import 'package:in_app_purchase/in_app_purchase.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
import '../constants/app_constants.dart';

/// iOS App Store 内购服务
/// 镜像 GooglePlayBillingService，使用统一的 in_app_purchase 插件处理 StoreKit
class AppleInAppPurchaseService {
  // 单例模式
  static final AppleInAppPurchaseService _instance =
      AppleInAppPurchaseService._internal();
  factory AppleInAppPurchaseService() => _instance;
  AppleInAppPurchaseService._internal();

  final InAppPurchase _iap = InAppPurchase.instance;
  StreamSubscription<List<PurchaseDetails>>? _subscription;

  // 商品 ID 列表 —— 必须与 App Store Connect 中创建的商品 ID 完全一致
  // App Store Connect 产品ID: appstore04.99 / appstore06.99 / appstore09.99 / appstore19.99
  static const Set<String> _productIds = {
    'appstore04.99', // $4.99 - Starter Plan
    'appstore06.99', // $6.99 - Standard Plan
    'appstore09.99', // $9.99 - Advanced Plan
    'appstore19.99', // $19.99 - Premium Plan
  };

  // 商品详情列表
  List<ProductDetails> products = [];

  // 购买结果回调
  Function(bool success, String message)? onPurchaseUpdate;

  // 用户 ID（初始化时从外部注入）
  String? userId;

  /// 初始化 App Store IAP
  Future<bool> init() async {
    try {
      final available = await _iap.isAvailable();
      print('🔍 [IAP] isAvailable=$available');
      if (!available) {
        print('❌ App Store In-App Purchase 不可用');
        return false;
      }

      // 先取消旧订阅，防止多次 init 造成重复监听
      await _subscription?.cancel();
      _subscription = null;

      // 监听购买状态流
      _subscription = _iap.purchaseStream.listen(
        _onPurchaseUpdate,
        onDone: () => _subscription?.cancel(),
        onError: (error) => print('❌ iOS IAP 流错误: $error'),
      );

      await loadProducts();
      print('✅ App Store IAP 初始化成功');
      return true;
    } catch (e) {
      print('❌ iOS IAP 初始化失败: $e');
      return false;
    }
  }

  /// 加载 App Store 商品列表
  Future<void> loadProducts() async {
    try {
      print('🔍 [IAP] 开始查询商品, IDs: $_productIds');
      final ProductDetailsResponse response =
          await _iap.queryProductDetails(_productIds);

      print('🔍 [IAP] 查询完成: found=${response.productDetails.length}, notFoundIDs=${response.notFoundIDs}, error=${response.error}');

      if (response.error != null) {
        print('❌ [IAP] iOS 商品查询失败 code=${response.error?.code} msg=${response.error?.message} src=${response.error?.source}');
        return;
      }

      if (response.notFoundIDs.isNotEmpty) {
        print('⚠️ [IAP] App Store 中未找到的商品 (ID不匹配或商品未配置): ${response.notFoundIDs}');
      }

      products = response.productDetails;
      print('✅ [IAP] 加载了 ${products.length} 个 iOS 商品');
      for (final p in products) {
        print('📦 [IAP] iOS 商品: id=${p.id} price=${p.price} title=${p.title}');
      }
    } catch (e) {
      print('❌ iOS 商品加载异常: $e');
    }
  }

  /// 获取指定商品详情
  ProductDetails? getProduct(String productId) {
    try {
      return products.firstWhere((p) => p.id == productId);
    } catch (_) {
      print('⚠️ iOS 商品 $productId 未找到');
      return null;
    }
  }

  /// 发起购买
  Future<void> buyProduct(String productId) async {
    try {
      final product = getProduct(productId);
      if (product == null) {
        onPurchaseUpdate?.call(
          false,
          'Product not found. Please check your connection and try again.',
        );
        return;
      }

      print('🛒 发起 iOS 购买: ${product.id} - ${product.price}');
      final purchaseParam = PurchaseParam(productDetails: product);
      // 非消耗型或非自动续期订阅使用 buyNonConsumable
      await _iap.buyNonConsumable(purchaseParam: purchaseParam);
    } catch (e) {
      final errStr = e.toString();
      print('❌ iOS 购买失败: $e');
      // storekit_duplicate_product_object：该商品已有待处理的交易（用户上次购买流程未完成）。
      // StoreKit 会通过 purchaseStream 自动重放该交易并完成，无需用户再次操作，
      // 此处仅保持 loading 状态，等待回调即可，不通知失败。
      if (errStr.contains('storekit_duplicate_product_object')) {
        print('⚠️ [IAP] 检测到重复交易，等待 StoreKit 自动完成...');
        return; // 不调用 onPurchaseUpdate，保持 loading 状态
      }
      onPurchaseUpdate?.call(false, 'Purchase failed. Please try again.');
    }
  }

  /// 处理购买状态更新（来自 purchaseStream）
  void _onPurchaseUpdate(List<PurchaseDetails> purchaseDetailsList) {
    for (final purchase in purchaseDetailsList) {
      print(
        '📦 iOS 购买状态: ${purchase.productID} - ${purchase.status}',
      );

      switch (purchase.status) {
        case PurchaseStatus.pending:
          onPurchaseUpdate?.call(false, 'Processing, please wait...');
          break;

        case PurchaseStatus.purchased:
        case PurchaseStatus.restored:
          // 发送到后端验证并激活合约
          _verifyAndDeliver(purchase);
          break;

        case PurchaseStatus.error:
          final msg = purchase.error?.message ?? 'Unknown error';
          print('❌ iOS 购买错误: $msg');
          onPurchaseUpdate?.call(false, 'Purchase failed: $msg');
          break;

        case PurchaseStatus.canceled:
          print('⚠️ 用户取消 iOS 购买');
          onPurchaseUpdate?.call(false, 'Purchase cancelled.');
          break;
      }

      // 通知 StoreKit 交易已处理
      if (purchase.pendingCompletePurchase) {
        _iap.completePurchase(purchase);
      }
    }
  }

  /// 将收据发送后端验证，成功后激活付费合约
  Future<void> _verifyAndDeliver(PurchaseDetails purchase) async {
    try {
      print('🔐 iOS 验证收据...');

      if (userId == null || userId!.isEmpty) {
        print('❌ 用户未登录');
        onPurchaseUpdate?.call(false, 'Please log in first.');
        return;
      }

      // iOS 自动续期订阅：优先用 serverVerificationData（经 StoreKit 编码的完整收据）
      // serverVerificationData 与 localVerificationData 在 iOS 上内容相同（均为 base64 App Receipt）
      // 但某些版本 localVerificationData 可能为空，serverVerificationData 更可靠
      final receiptData =
          purchase.verificationData.serverVerificationData.isNotEmpty
              ? purchase.verificationData.serverVerificationData
              : purchase.verificationData.localVerificationData;
      final transactionId =
          purchase.purchaseID ??
          purchase.verificationData.serverVerificationData;

      final url =
          '${ApiConstants.baseUrl}${ApiConstants.paymentVerify}';
      print('📡 iOS 验证接口: $url');

      final response = await http.post(
        Uri.parse(url),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'user_id': userId,
          'platform': 'ios',
          'store_product_id': purchase.productID,
          'transaction_id': transactionId,
          'verification_data': receiptData, // base64 app receipt
        }),
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        if (data['success'] == true) {
          print('✅ iOS 购买验证成功，合约已激活');
          onPurchaseUpdate?.call(
            true,
            'Purchase successful! Contract activated. Check "My Contracts" to view.',
          );
        } else {
          print('❌ iOS 验证失败: ${data['message']}');
          onPurchaseUpdate?.call(
            false,
            'Verification failed: ${data["message"]}',
          );
        }
      } else {
        print('❌ iOS 服务器验证失败: ${response.statusCode}');
        onPurchaseUpdate?.call(
          false,
          'Server verification failed. Please contact support.',
        );
      }
    } catch (e) {
      print('❌ iOS 验证异常: $e');
      onPurchaseUpdate?.call(
        false,
        'Network error. Please check your connection.',
      );
    }
  }

  /// 恢复历史购买（Apple 审核要求：非消耗型商品必须提供恢复入口）
  Future<void> restorePurchases() async {
    try {
      print('🔄 恢复 iOS 历史购买...');
      await _iap.restorePurchases();
    } catch (e) {
      print('❌ iOS 恢复购买失败: $e');
      onPurchaseUpdate?.call(false, 'Restore failed: $e');
    }
  }

  /// 清理资源
  void dispose() {
    _subscription?.cancel();
  }
}
