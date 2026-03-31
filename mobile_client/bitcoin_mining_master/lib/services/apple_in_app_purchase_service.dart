import 'dart:async';
import 'dart:io';
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

  // 积分奖励回调（首次订阅某档位时触发）
  Function(int pointsAwarded)? onPointsAwarded;

  // 用户 ID（初始化时从外部注入）
  String? userId;
  // JWT 鉴权 Token（用于 verify-purchase 接口的 Authorization header）
  String? authToken;

  // 本次 App 会话内已提交后端验证的交易 ID（防止 StoreKit 多次回调同一笔交易时重复创建合约）
  final Set<String> _processedTransactionIds = {};

  // 是否正在执行后台状态同步（sync 期间的 restored 回调不需要通知 UI，抑制主回调）
  bool _isSyncing = false;

  // 是否正在清理 StoreKit 队列残留交易（cleaning 期间所有事件只 complete 不回调）
  // 清理结束后队列为空，buyNonConsumable 才能正确弹出 Apple 确认对话框
  bool _isCleaningQueue = false;

  // 是否正在执行用户主动 Restore（区分用户按 Restore 按钮 vs 后台 syncSubscriptionStatus）
  // 为 true 时，restored 交易的 _verifyAndDeliver 结果会触发 onPurchaseUpdate 回调。
  bool _isUserRestoring = false;

  // 用户当前主动发起购买的产品 ID（区分用户主动购买 vs StoreKit 后台重播/续订）
  // 只有 productID 与此匹配的交易验证结果才触发 UI 回调，防止后台续订竞态条件
  String? _activeUserProductId;

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

      // 后台异步加载商品，不阻塞 init() 返回，避免用户在商品查询期间点击购买时报"服务不可用"
      loadProducts();
      print('✅ App Store IAP 初始化成功（商品后台加载中）');
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
  /// [preCheckConfirmedClean]：调用方通过后端预检查后确认该 productId 当前无活跃合约时置 true。
  /// 只有此标志为 true 时，storekit_duplicate_product_object 才允许触发 restorePurchases 回放。
  Future<void> buyProduct(String productId, {bool preCheckConfirmedClean = false}) async {
    try {
      // 如果商品列表尚未加载（init() 后台加载中），按需等待加载完成
      if (products.isEmpty) {
        print('🔍 [IAP] 商品列表为空，按需加载中...');
        await loadProducts();
      }

      ProductDetails? product = getProduct(productId);
      if (product == null) {
        // 尝试使用单个商品 ID 重新查询（兜底处理）
        print('⚠️ [IAP] 商品 $productId 未在缓存中，尝试单独查询...');
        final response = await _iap.queryProductDetails({productId});
        if (response.productDetails.isNotEmpty) {
          products = [...products, ...response.productDetails];
          product = response.productDetails.first;
        }
      }

      if (product == null) {
        onPurchaseUpdate?.call(
          false,
          'Product not found. Please verify your App Store configuration.',
        );
        return;
      }

      print('🛒 发起 iOS 购买: ${product.id} - ${product.price}');
      // 记录用户主动发起的产品 ID，用于 _verifyAndDeliver 竞态条件保护
      _activeUserProductId = productId;
      final purchaseParam = PurchaseParam(productDetails: product);
      // 非消耗型或非自动续期订阅使用 buyNonConsumable
      await _iap.buyNonConsumable(purchaseParam: purchaseParam);
    } catch (e) {
      final errStr = e.toString();
      print('❌ iOS 购买失败: $e');
      // storekit_duplicate_product_object：StoreKit 队列中有该产品的未完成交易
      // （沙盒自动续期残留 或 上次购买未完成 completePurchase）。
      // 注意：到达此处前 _handlePurchase 已通过后端预检查确认该产品无活跃合约，
      // 因此队列中的待处理交易是合法的续订场景，应直接作为用户主动购买处理。
      // 做法：保持 _activeUserProductId 不变，清除去重缓存，调用 restorePurchases
      // 让 StoreKit 回放队列中的交易 → _onPurchaseUpdate → _verifyAndDeliver → 续订成功。
      if (errStr.contains('storekit_duplicate_product_object')) {
        if (preCheckConfirmedClean) {
          // 预检查已明确确认无活跃合约 → 队列残留交易是合法的待处理购买，通过 restore 回放。
          print('⚠️ [IAP] StoreKit 队列仍有残留交易（预检查已确认无活跃合约），尝试 restore 回放...');
          _processedTransactionIds.clear();
          // _activeUserProductId 保持当前值，使 _verifyAndDeliver 正常判定为用户主动购买
          try {
            await _iap.restorePurchases();
          } catch (restoreErr) {
            print('❌ [IAP] restore 回放失败: $restoreErr');
            _activeUserProductId = null;
            onPurchaseUpdate?.call(false, 'Purchase failed. Please try again.');
          }
        } else {
          // 预检查未通过（网络失败 / API异常 / productId未匹配到但实际有活跃合约）。
          // 绝对不能 restore：已激活订阅回放后 _verifyAndDeliver 会误报"购买成功"。
          print('⚠️ [IAP] StoreKit duplicate - 预检查未确认干净，阻止 restore 回放');
          _activeUserProductId = null;
          onPurchaseUpdate?.call(
            false,
            'You already have an active subscription for this plan.',
          );
        }
        return;
      }
      // 其他异常：清除主动购买标记，避免后续回调误判
      _activeUserProductId = null;
      onPurchaseUpdate?.call(false, 'Purchase failed. Please try again.');
    }
  }

  /// 处理购买状态更新（来自 purchaseStream）
  void _onPurchaseUpdate(List<PurchaseDetails> purchaseDetailsList) {
    for (final purchase in purchaseDetailsList) {
      // 清理 StoreKit 队列模式：静默完成所有残留交易，不触发任何 UI 回调
      // 此时 _activeUserProductId 未设置，任何事件都不应被视为用户主动购买
      if (_isCleaningQueue) {
        print('🧹 [IAP] 清理模式：静默完成残留交易 ${purchase.productID} (${purchase.status})');
        if (purchase.pendingCompletePurchase) _iap.completePurchase(purchase);
        continue;
      }

      print(
        '📦 iOS 购买状态: ${purchase.productID} - ${purchase.status}',
      );

      switch (purchase.status) {
        case PurchaseStatus.pending:
          // pending 仅出现在 Ask to Buy（家长审批）或 StoreKit 处理中的过渡状态。
          // 【重要】不调用 onPurchaseUpdate：回调会清空 _loadingTierId，导致后续
          // purchased 事件到来时 purchasedProductId = null，队列无法激活。
          // 按钮的加载状态已由 _loadingTierId != null 在 UI 层维持，无需额外 SnackBar。
          print('⏳ iOS 购买挂起（Ask to Buy 或处理中）: ${purchase.productID}');
          break;

        case PurchaseStatus.purchased:
        case PurchaseStatus.restored:
          // sync 期间：只在没有主动购买时才抑制 restored 事件。
          // 若正在购买（_activeUserProductId != null），用户刚确认的交易有时会以
          // PurchaseStatus.restored 回调（sandbox 自动续期订阅常见），必须允许通过，
          // 否则用户点击「确认」后什么都不发生（事件被静默丢弃 → onPurchaseUpdate 永不触发）。
          if (_isSyncing &&
              purchase.status == PurchaseStatus.restored &&
              _activeUserProductId == null) {
            if (purchase.pendingCompletePurchase) {
              _iap.completePurchase(purchase);
            }
            break;
          }
          // 防止 StoreKit 多次回调同一笔交易（purchased/restored 可能对同一 purchaseID 重复触发）
          // 注：storekit_duplicate_product_object 发生时 buyProduct 已清空 _processedTransactionIds，
          // 因此 StoreKit 回放的交易不会再被此处跳过，用户主动订阅流程能正常走完。
          final txId = purchase.purchaseID;
          if (txId != null && _processedTransactionIds.contains(txId)) {
            print('⚠️ [IAP] 跳过重复交易 $txId（本次会话已处理），仅完成 StoreKit 确认');
            if (purchase.pendingCompletePurchase) {
              _iap.completePurchase(purchase);
            }
            break;
          }
          if (txId != null) _processedTransactionIds.add(txId);
          // 发送到后端验证并激活合约（completePurchase 在验证完成后调用）
          _verifyAndDeliver(purchase);
          break;

        case PurchaseStatus.error:
          // sync 期间不触发 UI 回调
          if (_isSyncing) {
            if (purchase.pendingCompletePurchase) _iap.completePurchase(purchase);
            break;
          }
          final msg = purchase.error?.message ?? 'Unknown error';
          print('❌ iOS 购买错误: $msg');
          // Restore 模式下错误静默处理，UI 层的超时计时器负责兜底提示
          if (!_isUserRestoring) {
            onPurchaseUpdate?.call(false, 'Purchase failed: $msg');
          }
          // error 状态也需要完成交易，否则 StoreKit 会反复重播
          if (purchase.pendingCompletePurchase) {
            _iap.completePurchase(purchase);
          }
          break;

        case PurchaseStatus.canceled:
          // sync 期间不触发 UI 回调
          if (_isSyncing) {
            if (purchase.pendingCompletePurchase) _iap.completePurchase(purchase);
            break;
          }
          print('⚠️ 用户取消 iOS 购买');
          // Restore 模式下 canceled 静默处理（无订阅可恢复时 StoreKit 也不会 cancel）
          if (!_isUserRestoring) {
            onPurchaseUpdate?.call(false, 'Purchase cancelled.');
          }
          if (purchase.pendingCompletePurchase) {
            _iap.completePurchase(purchase);
          }
          break;
      }
      // completePurchase 已在各分支内处理，不再统一调用
    }
  }

  /// 将收据发送后端验证，成功后激活付费合约
  /// 按照 Apple 审核规范：在后端确认后才调用 completePurchase，
  /// 网络异常时不关闭交易，让 StoreKit 在下次启动时自动重播以便重试。
  Future<void> _verifyAndDeliver(PurchaseDetails purchase) async {
    // ⚠️ 必须在任何 await 之前同步捕获并立即清除状态标记。
    // 若在 HTTP await 之后才比较，后台续订的异步任务可能在等待期间抢占标记，
    // 导致后台结果被误判为用户主动操作，错误/成功提示出现错乱。
    final bool isFromUserRestore = _isUserRestoring;
    final bool isUserInitiated = (purchase.productID == _activeUserProductId) || isFromUserRestore;
    if (_activeUserProductId != null && purchase.productID == _activeUserProductId) {
      // 立即清除，防止并发的其他 _verifyAndDeliver 调用重复匹配
      _activeUserProductId = null;
    }
    // Restore 模式：第一个 restored 交易处理后清除标记，防止本会话后续后台事件误判
    if (isFromUserRestore) {
      _isUserRestoring = false;
    }

    try {
      print('🔐 iOS 验证收据 (产品: ${purchase.productID}, 用户主动: $isUserInitiated)...');

      if (userId == null || userId!.isEmpty) {
        print('❌ 用户未登录');
        if (isUserInitiated) {
          onPurchaseUpdate?.call(false, 'Please log in first.');
        }
        // 永久性失败（用户未登录），关闭交易避免 StoreKit 反复重播
        if (purchase.pendingCompletePurchase) {
          _iap.completePurchase(purchase);
        }
        return;
      }

      // iOS 自动续期订阅：优先用 serverVerificationData（经 StoreKit 编码的完整收据）
      // serverVerificationData 与 localVerificationData 在 iOS 上内容相同（均为 base64 App Receipt）
      // 但某些版本 localVerificationData 可能为空，serverVerificationData 更可靠
      String receiptData =
          purchase.verificationData.serverVerificationData.isNotEmpty
              ? purchase.verificationData.serverVerificationData
              : purchase.verificationData.localVerificationData;

      // ⚠️ 沙盒环境下 App Receipt 会持续累积所有续订历史，体积可超 10MB，
      // 触发 Nginx 413 Request Entity Too Large。
      // Apple 验证只需要能找到当前 transaction_id 的 receipt 片段即可；
      // 对于超大 receipt，截断到 4MB 上限（base64 字符数 < 5,500,000）以防止网络错误。
      const int receiptSizeLimit = 5500000; // ~4MB base64
      if (receiptData.length > receiptSizeLimit) {
        print('⚠️ [IAP] App Receipt 过大 (${receiptData.length} chars)，截断至 $receiptSizeLimit chars 发送');
        receiptData = receiptData.substring(0, receiptSizeLimit);
      } else {
        print('📦 [IAP] App Receipt 大小: ${receiptData.length} chars');
      }

      final transactionId =
          purchase.purchaseID ??
          purchase.verificationData.serverVerificationData;

      final url =
          '${ApiConstants.baseUrl}${ApiConstants.paymentVerify}';
      print('📡 iOS 验证接口: $url');

      final response = await http.post(
        Uri.parse(url),
        headers: {
          'Content-Type': 'application/json',
          if (authToken != null && authToken!.isNotEmpty)
            'Authorization': 'Bearer $authToken',
        },
        body: jsonEncode({
          'user_id': userId,
          'platform': 'ios',
          'store_product_id': purchase.productID,
          'transaction_id': transactionId,
          'verification_data': receiptData, // base64 app receipt
        }),
      ).timeout(const Duration(seconds: 60)); // Apple API 双重验证最多需~20s，给60s足够余量

      // 判断此交易是否为用户主动发起的购买已在函数入口处同步完成（见顶部 isUserInitiated）

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        if (data['success'] == true) {
          print('✅ iOS 购买验证成功，合约已激活 (产品: ${purchase.productID}, 用户主动: $isUserInitiated)');
          if (isUserInitiated) {
            final int pts = (data['pointsAwarded'] ?? 0) as int;
            if (pts > 0) {
              print('🎉 iOS 购买积分奖励: +$pts 积分');
              onPointsAwarded?.call(pts);
            }
            onPurchaseUpdate?.call(
              true,
              'Purchase successful! Contract activated. Check "My Contracts" to view.',
            );
          } else {
            print('ℹ️ [IAP] 后台交易验证成功（非用户主动购买），静默处理: ${purchase.productID}');
          }
        } else {
          print('❌ iOS 验证失败: ${data['message']} (产品: ${purchase.productID}, 用户主动: $isUserInitiated)');
          if (isUserInitiated) {
            onPurchaseUpdate?.call(
              false,
              'Verification failed: ${data["message"]}',
            );
          }
        }
        // 服务端已处理（无论成功/失败），关闭 StoreKit 交易
        if (purchase.pendingCompletePurchase) {
          _iap.completePurchase(purchase);
        }
      } else {
        print('❌ iOS 服务器验证失败: ${response.statusCode} (产品: ${purchase.productID}, 用户主动: $isUserInitiated)');
        if (isUserInitiated) {
          onPurchaseUpdate?.call(
            false,
            'Server verification failed. Please contact support.',
          );
        }
        // 服务端返回错误，关闭交易（通知用户联系客服）
        if (purchase.pendingCompletePurchase) {
          _iap.completePurchase(purchase);
        }
      }
    } catch (e) {
      print('❌ iOS 验证异常（网络错误）: $e (产品: ${purchase.productID}, 用户主动: $isUserInitiated)');
      if (isUserInitiated) {
        onPurchaseUpdate?.call(
          false,
          'Network error. Please check your connection.',
        );
      }
      // 网络错误：不调用 completePurchase，让 StoreKit 在下次启动时重播此交易以便自动重试。
      // 同时从去重集合中移除该 txId，允许本会话内重试。
      final txId = purchase.purchaseID;
      if (txId != null) _processedTransactionIds.remove(txId);
    }
  }

  /// 清除 StoreKit 交易队列中所有残留的未完成交易
  /// 必须在发起新购买（buyProduct）之前调用，以确保 Apple 支付确认弹窗能够正常显示。
  /// 若队列不为空，buyNonConsumable 会直接回放旧交易而不弹出确认框。
  Future<void> clearPendingTransactions() async {
    _isCleaningQueue = true;
    try {
      await _iap.restorePurchases();
      // 等待 StoreKit 将队列中所有残留交易回放到 _onPurchaseUpdate 并完成
      await Future.delayed(const Duration(milliseconds: 800));
    } catch (e) {
      print('⚠️ [IAP] clearPendingTransactions 异常（队列可能已为空）: $e');
    } finally {
      _isCleaningQueue = false;
    }
    print('🧹 [IAP] StoreKit 交易队列清理完成');
  }

  /// 恢复历史购买（Apple 审核要求：非消耗型商品必须提供恢复入口）
  /// 设置 _isUserRestoring=true，确保 _verifyAndDeliver 对 restored 交易触发 onPurchaseUpdate。
  Future<void> restorePurchases() async {
    _isUserRestoring = true;
    try {
      print('🔄 恢复 iOS 历史购买...');
      await _iap.restorePurchases();
      // StoreKit 会异步通过 purchaseStream 返回结果，_isUserRestoring 由
      // _verifyAndDeliver 在首个 restored 交易处理后清除，或由 cancelRestore() 兜底清除。
    } catch (e) {
      _isUserRestoring = false;
      print('❌ iOS 恢复购买失败: $e');
      onPurchaseUpdate?.call(false, 'Restore failed: $e');
    }
  }

  /// 取消 Restore 模式（供 UI 层超时计时器或 dispose 时清理状态）
  void cancelRestore() {
    _isUserRestoring = false;
  }

  /// 同步 iOS 订阅状态到后端（当 App 恢复前台时调用）
  /// 通过 restorePurchases 获取当前活跃的订阅收据，发到后端重新验证，
  /// 识别已关闭自动续期或已过期的订阅并更新合约状态
  Future<void> syncSubscriptionStatus({String? token}) async {
    if (userId == null || userId!.isEmpty) return;
    if (token == null || token.isEmpty) return;
    // 购买流程进行中时不允许后台 sync：sync 会调用 restorePurchases 设置 _isSyncing=true，
    // 可能导致用户刚确认的交易（以 restored 状态回调）被静默丢弃
    if (_activeUserProductId != null) {
      print('ℹ️ [IAP] 购买进行中，跳过本次 syncSubscriptionStatus');
      return;
    }

    final completer = Completer<String?>();
    StreamSubscription<List<PurchaseDetails>>? tempSub;

    // 设置 5 秒超时
    final timer = Timer(const Duration(seconds: 5), () {
      if (!completer.isCompleted) completer.complete(null);
    });

    // 临时监听 purchaseStream，捕获 restorePurchases 返回的收据
    tempSub = _iap.purchaseStream.listen((purchases) {
      for (final purchase in purchases) {
        if (purchase.status == PurchaseStatus.restored ||
            purchase.status == PurchaseStatus.purchased) {
          final receipt = purchase.verificationData.serverVerificationData;
          if (receipt.isNotEmpty && !completer.isCompleted) {
            completer.complete(receipt);
          }
        }
        // 完成 StoreKit 交易，防止重复回调
        if (purchase.pendingCompletePurchase) {
          _iap.completePurchase(purchase);
        }
      }
    });

    try {
      _isSyncing = true;
      await _iap.restorePurchases();
      final receiptData = await completer.future;
      timer.cancel();
      await tempSub.cancel();
      _isSyncing = false;

      if (receiptData == null || receiptData.isEmpty) {
        print('ℹ️ [syncStatus] 无活跃订阅，跳过同步');
        return;
      }

      // 发送到后端同步
      final url = '${ApiConstants.baseUrl}/payment/sync-ios-status';
      final response = await http.post(
        Uri.parse(url),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
        body: jsonEncode({'verification_data': receiptData}),
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        print('✅ [syncStatus] 订阅状态已同步: ${data['message']}');
      } else {
        print('⚠️ [syncStatus] 同步失败: ${response.statusCode} ${response.body}');
      }
    } catch (e) {
      timer.cancel();
      await tempSub.cancel();
      _isSyncing = false;
      print('⚠️ [syncStatus] 同步异常: $e');
    }
  }

  /// 清理资源（注意：单例模式下只取消订阅流，不清空回调，由调用方负责清除回调）
  void dispose() {
    _isUserRestoring = false;
    _subscription?.cancel();
  }
}
