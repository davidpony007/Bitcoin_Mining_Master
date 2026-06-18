import 'dart:io' show Platform;
import 'package:flutter/foundation.dart';
import 'package:se_flutter_sdk_us/solar_engine_core/solar_engine.dart';
import 'package:se_flutter_sdk_us/solar_engine_core/solar_engine_config.dart';
import 'package:se_flutter_sdk_us/solar_engine_core/solar_engine_event_data.dart';

/// SolarEngine 归因监测服务
///
/// 集成文档：https://help.solar-engine.com/cn/docs/oexBGV
///
/// 调用顺序（严格遵守）：
///   1. main() 最开始调用 SolarEngineService.preInitialize()
///   2. Firebase 初始化完成后调用 SolarEngineService.initialize()
///   3. 用户登录后调用 SolarEngineService.login(accountId)
///   4. 用户登出后调用 SolarEngineService.logout()
///   5. iOS 需在合适时机调用 SolarEngineService.requestATT()
class SolarEngineService {
  SolarEngineService._();
  static final SolarEngineService instance = SolarEngineService._();

  /// SolarEngine AppKey（各平台独立）
  static const String _appKeyAndroid = '2c4b7e4ee3376672';
  static const String _appKeyIOS     = 'ab36d820c48d066d';

  static String get _appKey =>
      Platform.isIOS ? _appKeyIOS : _appKeyAndroid;

  bool _initialized = false;

  // ─────────────────────────────────────────────────────────────────
  // 第一步：预初始化（在 main() 最开始调用，WidgetsFlutterBinding 之后）
  // 预初始化期间 SDK 不采集任何数据
  // ─────────────────────────────────────────────────────────────────
  static void preInitialize() {
    try {
      final appKey = Platform.isIOS ? _appKeyIOS : _appKeyAndroid;
      SolarEngine.preInitialize(appKey);
      debugPrint('[SE] preInitialize OK (${Platform.isIOS ? "iOS" : "Android"})');
    } catch (e) {
      debugPrint('[SE] preInitialize error: $e');
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // 第二步：正式初始化（在 Firebase 初始化之后调用）
  // ─────────────────────────────────────────────────────────────────
  Future<void> initialize() async {
    if (_initialized) return;
    try {
      final SolarEngineConfig config = SolarEngineConfig();
      config.logEnabled = kDebugMode; // 调试模式开启日志，发布时自动关闭

      // iOS：等待 ATT 授权最多 60 秒，提升归因精准率
      // 注意：同时还需要在初始化后调用 requestATT()
      if (Platform.isIOS) {
        config.attAuthorizationWaitingInterval = 60;
      }

      // 归因结果回调（可选，用于自定义逻辑）
      config.onAttributionSuccess = (data) {
        debugPrint('[SE] 归因成功: $data');
      };
      config.onAttributionFail = (code) {
        debugPrint('[SE] 归因失败 code=$code');
      };

      SolarEngine.initializeWithCallbacK(_appKey, config, (int? code) {
        if (code == 0) {
          _initialized = true;
          debugPrint('[SE] 初始化成功');
        } else {
          debugPrint('[SE] 初始化失败 code=$code');
        }
      });
    } catch (e) {
      debugPrint('[SE] initialize error: $e');
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // iOS ATT 追踪授权请求
  // 在合适的 UI 时机调用（如首次启动引导页 / 主页加载后）
  // ─────────────────────────────────────────────────────────────────
  Future<void> requestATT() async {
    if (!Platform.isIOS) return;
    try {
      SolarEngine.requestTrackingAuthorizationWithCompletionHandler((code) {
        // 0: Not Determined  1: Restricted  2: Denied  3: Authorized
        debugPrint('[SE] ATT 授权状态: $code');
      });
    } catch (e) {
      debugPrint('[SE] requestATT error: $e');
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // 用户身份
  // ─────────────────────────────────────────────────────────────────

  /// 用户登录成功后调用（传入服务器端用户 ID）
  void login(String accountId) {
    try {
      SolarEngine.login(accountId);
      debugPrint('[SE] login: $accountId');
    } catch (e) {
      debugPrint('[SE] login error: $e');
    }
  }

  /// 用户登出后调用
  void logout() {
    try {
      SolarEngine.logout();
      debugPrint('[SE] logout');
    } catch (e) {
      debugPrint('[SE] logout error: $e');
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // 预定义事件上报
  // ─────────────────────────────────────────────────────────────────

  /// 用户注册事件
  /// [loginType] 注册方式，如 'google'、'apple'、'email'
  void trackRegister({required String loginType, String status = 'success'}) {
    try {
      final data = SEAppRegisterData();
      data.regType = loginType;
      data.status = status;
      SolarEngine.trackAppRegister(data);
      debugPrint('[SE] trackRegister: $loginType');
    } catch (e) {
      debugPrint('[SE] trackRegister error: $e');
    }
  }

  /// 用户登录事件
  /// [loginType] 登录方式，如 'google'、'apple'、'device'
  void trackLogin({required String loginType, String status = 'success'}) {
    try {
      final data = SEAppLoginData();
      data.loginType = loginType;
      data.status = status;
      SolarEngine.trackAppLogin(data);
      debugPrint('[SE] trackLogin: $loginType');
    } catch (e) {
      debugPrint('[SE] trackLogin error: $e');
    }
  }

  /// 内购/订阅支付事件
  /// [productId] 商品 ID，[amount] 金额，[currency] 货币（如 'USD'）
  /// [payType] 支付方式：'applepay' | 'googleplay'
  /// [payStatus] 1:成功 2:余额不足 3:取消 4:商品不足 5:超时
  void trackPurchase({
    required String productId,
    required double amount,
    required String currency,
    required String payType,
    required int payStatus,
    String? orderId,
    String? productName,
    int productNum = 1,
  }) {
    try {
      final data = SEAppPurchaseData();
      data.orderId = orderId ?? '';
      data.payAmount = amount;
      data.currencyType = currency;
      data.payType = payType;
      data.productId = productId;
      data.productName = productName ?? productId;
      data.productNum = productNum;
      data.payStatus = payStatus;
      SolarEngine.trackAppPurchase(data);
      debugPrint('[SE] trackPurchase: $productId \$$amount');
    } catch (e) {
      debugPrint('[SE] trackPurchase error: $e');
    }
  }

  /// AdMob 广告展示事件
  /// [adUnitId] 广告位 ID，[adType] 广告类型（见下方注释），[ecpm] 千次展示收益
  ///
  /// adType: 1:激励视频 2:开屏 3:插屏 4:全屏视频 5:Banner 6:信息流
  void trackAdImpression({
    required String adUnitId,
    required int adType,
    double ecpm = 0,
    String currency = 'USD',
  }) {
    try {
      final data = SEAppImpressionData();
      data.adNetworkPlatform = 'admob';
      data.adType = adType;
      data.adNetworkADID = adUnitId;
      data.mediationPlatform = 'custom'; // 未使用聚合平台时填 'custom'
      data.ecpm = ecpm;
      data.currencyType = currency;
      data.isRenderSuccess = true;
      SolarEngine.trackAppImpress(data);
      debugPrint('[SE] trackAdImpression: $adUnitId');
    } catch (e) {
      debugPrint('[SE] trackAdImpression error: $e');
    }
  }

  /// AdMob 广告点击事件
  void trackAdClick({
    required String adUnitId,
    required int adType,
  }) {
    try {
      final data = SEAdClickData();
      data.adPlatform = 'admob';
      data.adType = adType;
      data.adNetworkADID = adUnitId;
      data.mediationPlatform = 'custom';
      SolarEngine.trackAdClick(data);
      debugPrint('[SE] trackAdClick: $adUnitId');
    } catch (e) {
      debugPrint('[SE] trackAdClick error: $e');
    }
  }

  /// 自定义事件（业务扩展用）
  void trackCustom(String eventName, Map<String, dynamic> properties) {
    try {
      final data = SECustomEventData();
      data.customEventName = eventName;
      data.customProperties = properties;
      SolarEngine.trackCustomEvent(data);
      debugPrint('[SE] trackCustom: $eventName');
    } catch (e) {
      debugPrint('[SE] trackCustom error: $e');
    }
  }
}
