import 'package:firebase_analytics/firebase_analytics.dart';
import 'package:flutter/foundation.dart';
import 'storage_service.dart';

/// Firebase Analytics 埋点服务
///
/// 使用场景：
///   - 追踪用户关键行为（登录、充值、签到、挖矿操作等）
///   - 统计页面访问量（Screen View）
///   - 分析用户留存和转化漏斗
///
/// 使用方式（在任意位置）：
///   AnalyticsService.instance.logLogin(method: 'email');
///   AnalyticsService.instance.logScreenView(screenName: 'Dashboard');
class AnalyticsService {
  AnalyticsService._();
  static final AnalyticsService instance = AnalyticsService._();

  final FirebaseAnalytics _analytics = FirebaseAnalytics.instance;

  /// 获取 NavigatorObserver，用于自动追踪页面切换
  /// 在 MaterialApp 的 navigatorObservers 中注册即可
  FirebaseAnalyticsObserver get observer =>
      FirebaseAnalyticsObserver(analytics: _analytics);

  // ─────────────────────────────────────────
  // 用户身份
  // ─────────────────────────────────────────

  /// 设置用户 ID（登录成功后调用）
  /// 用途：将所有后续事件与该用户关联，在 BigQuery 导出时可按用户分析
  /// 注意：不要传入可识别个人身份的信息（姓名/邮箱），传内部用户 ID 即可
  Future<void> setUserId(String? userId) async {
    try {
      await _analytics.setUserId(id: userId);
      _log('setUserId: $userId');
    } catch (e) {
      _logError('setUserId', e);
    }
  }

  /// 设置用户属性（可选，用于受众细分）
  /// 例如：会员等级、国家、设备类型
  /// Firebase 最多支持 25 个自定义用户属性
  Future<void> setUserProperty({
    required String name,
    required String? value,
  }) async {
    try {
      await _analytics.setUserProperty(name: name, value: value);
      _log('setUserProperty: $name=$value');
    } catch (e) {
      _logError('setUserProperty', e);
    }
  }

  // ─────────────────────────────────────────
  // 页面追踪
  // ─────────────────────────────────────────

  /// 手动记录页面访问
  /// 当使用 NavigatorObserver 无法自动捕获时手动调用
  Future<void> logScreenView({
    required String screenName,
    String? screenClass,
  }) async {
    try {
      await _analytics.logScreenView(
        screenName: screenName,
        screenClass: screenClass ?? screenName,
      );
      _log('logScreenView: $screenName');
    } catch (e) {
      _logError('logScreenView', e);
    }
  }

  // ─────────────────────────────────────────
  // 预定义事件（Firebase 推荐使用，有内置报表）
  // ─────────────────────────────────────────

  /// 用户登录
  /// method: 'email' | 'google' | 'apple' | 'device'
  Future<void> logLogin({required String method}) async {
    try {
      await _analytics.logLogin(loginMethod: method);
      _log('logLogin: method=$method');
    } catch (e) {
      _logError('logLogin', e);
    }
  }

  /// 用户注册
  Future<void> logSignUp({required String method}) async {
    try {
      await _analytics.logSignUp(signUpMethod: method);
      _log('logSignUp: method=$method');
    } catch (e) {
      _logError('logSignUp', e);
    }
  }

  /// 购买/充值完成（Firebase 标准电商事件，会关联到 Revenue 报表）
  /// currency: 'USD' | 'CNY'
  /// value: 金额（double）
  /// transactionId: 订单号
  Future<void> logPurchase({
    required String currency,
    required double value,
    required String transactionId,
    String? itemName,
  }) async {
    try {
      await _analytics.logPurchase(
        currency: currency,
        value: value,
        transactionId: transactionId,
        items: itemName != null
            ? [AnalyticsEventItem(itemName: itemName)]
            : null,
      );
      _log('logPurchase: $value $currency, tx=$transactionId');
    } catch (e) {
      _logError('logPurchase', e);
    }
  }

  // ─────────────────────────────────────────
  // 自定义事件（业务专属埋点）
  // ─────────────────────────────────────────

  /// 每日签到
  Future<void> logCheckIn({required int day, required int points}) async {
    await _logCustomEvent('check_in', {
      'day': day,           // 连续签到天数
      'points_earned': points, // 本次获得积分
    });
  }

  /// 开始挖矿 / 启动合约
  Future<void> logStartMining({
    required String contractType, // 'free' | 'paid'
    required String contractId,
    double? hashrate,
  }) async {
    await _logCustomEvent('start_mining', {
      'contract_type': contractType,
      'contract_id': contractId,
      if (hashrate != null) 'hashrate': hashrate,
    });
  }

  /// 合约详情页查看
  Future<void> logViewContract({
    required String contractId,
    required String contractType,
    required double price,
  }) async {
    await _logCustomEvent('view_contract', {
      'contract_id': contractId,
      'contract_type': contractType,
      'price': price,
    });
  }

  /// 发起充值/购买合约（点击购买按钮）
  /// 区分"发起"和"完成"，可分析支付转化率
  Future<void> logInitiatePurchase({
    required String contractId,
    required double price,
    required String currency,
  }) async {
    await _logCustomEvent('initiate_purchase', {
      'contract_id': contractId,
      'price': price,
      'currency': currency,
    });
  }

  /// 提现申请
  Future<void> logWithdrawal({
    required double amount,
    required String currency,
    required String address,
  }) async {
    await _logCustomEvent('withdrawal', {
      'amount': amount,
      'currency': currency,
      // 安全：只记录前6位地址，不记录完整钱包地址
      'address_prefix': address.length > 6 ? address.substring(0, 6) : address,
    });
  }

  /// 邀请码分享
  Future<void> logShareReferral({required String method}) async {
    await _logCustomEvent('share_referral', {
      'share_method': method, // 'copy' | 'whatsapp' | 'telegram' | 'other'
    });
  }

  /// 广告奖励观看完成
  Future<void> logAdRewardEarned({
    required String adUnit,
    required int points,
  }) async {
    await _logCustomEvent('ad_reward_earned', {
      'ad_unit': adUnit,
      'points_earned': points,
    });
  }

  /// 广告展示收益上报（Firebase 官方 ad_impression 事件格式）
  /// Firebase GA4 会将此事件纳入 Revenue 报表，可在 BigQuery 按 user_id 查询
  ///
  /// [valueMicros]  onPaidEvent 原始值，单位：百万分之一美元
  /// [precision]    UNKNOWN / ESTIMATED / PUBLISHER_PROVIDED / PRECISE
  /// [currencyCode] 货币代码，如 'USD'
  /// [adUnitId]     AdMob 广告位 ID
  Future<void> logAdRevenue({
    required double valueMicros,
    required String precision,
    required String currencyCode,
    required String adUnitId,
  }) async {
    final userId = StorageService().getUserId() ?? 'unknown';
    final valueUsd = valueMicros / 1_000_000.0;

    // 1. 使用 Firebase 官方 ad_impression 事件（GA4 Revenue 报表可识别）
    await _logCustomEvent('ad_impression', {
      'ad_platform': 'Google AdMob',
      'ad_format': 'Rewarded',
      'ad_unit_name': adUnitId,
      'currency': currencyCode,
      'value': valueUsd,
      'precision_type': precision,
      'user_id': userId,
    });

    // 2. 同时上报自定义事件，方便在 BigQuery 按用户维度聚合
    await _logCustomEvent('user_ad_revenue', {
      'user_id': userId,
      'ad_unit_id': adUnitId,
      'currency': currencyCode,
      'value_usd': valueUsd,
      'value_micros': valueMicros,
      'precision_type': precision,
    });
  }

  /// 积分兑换
  Future<void> logPointsRedeemed({required int points}) async {
    await _logCustomEvent('points_redeemed', {'points': points});
  }

  /// 通用自定义事件（兜底方法，不适合用专属方法时调用）
  Future<void> logCustomEvent(
    String eventName,
    Map<String, Object> parameters,
  ) async {
    await _logCustomEvent(eventName, parameters);
  }

  // ─────────────────────────────────────────
  // 内部工具方法
  // ─────────────────────────────────────────

  Future<void> _logCustomEvent(
    String name,
    Map<String, Object?> params,
  ) async {
    try {
      final safeParams = Map<String, Object>.fromEntries(
        params.entries.whereType<MapEntry<String, Object>>(),
      );
      await _analytics.logEvent(name: name, parameters: safeParams);
      _log('logEvent: $name, params=$params');
    } catch (e) {
      _logError(name, e);
    }
  }

  void _log(String msg) {
    if (kDebugMode) debugPrint('[Analytics] $msg');
  }

  void _logError(String event, Object e) {
    if (kDebugMode) debugPrint('[Analytics] ERROR in $event: $e');
  }
}
