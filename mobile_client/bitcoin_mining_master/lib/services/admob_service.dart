import 'dart:async';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:google_mobile_ads/google_mobile_ads.dart';
import 'analytics_service.dart';
import '../constants/app_constants.dart';

/// AdMob广告服务管理类
/// 负责初始化AdMob SDK、加载和展示激励视频广告
class AdMobService {
  static final AdMobService _instance = AdMobService._internal();
  factory AdMobService() => _instance;
  AdMobService._internal();

  RewardedAd? _rewardedAd;
  bool _isAdLoaded = false;
  bool _isAdLoading = false;
  
  // 广告加载回调
  Function()? onAdLoaded;
  Function(String)? onAdFailedToLoad;
  
  // 广告位 ID：统一由 AdMobConstants 管理，切换测试/正式只需改一处 _isTestMode
  static String get _rewardedAdUnitId {
    if (kIsWeb) return '';
    if (Platform.isAndroid) return AdMobConstants.androidRewardedAdUnitId;
    if (Platform.isIOS)     return AdMobConstants.iosRewardedAdUnitId;
    return '';
  }
  
  /// 初始化AdMob SDK
  static Future<void> initialize() async {
    try {
      await MobileAds.instance.initialize();
      print('✅ AdMob SDK初始化成功');
    } catch (e) {
      print('❌ AdMob SDK初始化失败: $e');
    }
  }

  /// 预加载激励视频广告
  Future<void> loadRewardedAd() async {
    if (_isAdLoading) {
      print('⏳ 广告正在加载中，跳过重复加载');
      return;
    }
    
    if (_isAdLoaded) {
      print('ℹ️ 广告已加载，无需重复加载');
      return;
    }
    
    _isAdLoading = true;
    print('📡 开始加载激励视频广告: $_rewardedAdUnitId');
    
    try {
      await RewardedAd.load(
        adUnitId: _rewardedAdUnitId,
        request: const AdRequest(),
        rewardedAdLoadCallback: RewardedAdLoadCallback(
          onAdLoaded: (ad) {
            print('✅ 激励视频广告加载成功');
            _rewardedAd = ad;
            _isAdLoaded = true;
            _isAdLoading = false;
            onAdLoaded?.call();

            // ad_impression：广告产生收益时上报金额（使 Firebase Revenue 报表有数据）
            // onPaidEvent 在 google_mobile_ads v5.x 的签名：(Ad, double, PrecisionType, String)
            _rewardedAd?.onPaidEvent = (Ad ad, double valueMicros, PrecisionType precision, String currencyCode) {
              AnalyticsService.instance.logCustomEvent('ad_impression', {
                'ad_unit_id': ad.adUnitId,
                'ad_format': 'rewarded',
                'currency': currencyCode,
                'value': valueMicros / 1000000.0,
                'precision': precision.index,
              });
            };
            // fullScreenContentCallback 在 showRewardedAd() 中按需绑定（含 Completer 引用）
          },
          onAdFailedToLoad: (error) {
            print('❌ 广告加载失败: $error');
            _isAdLoading = false;
            _isAdLoaded = false;
            onAdFailedToLoad?.call(error.message);
          },
        ),
      );
    } catch (e) {
      print('❌ 广告加载异常: $e');
      _isAdLoading = false;
      _isAdLoaded = false;
      onAdFailedToLoad?.call(e.toString());
    }
  }

  /// 展示激励视频广告
  /// 返回值：true = 用户完整观看并获得奖励；false = 广告未加载 / 用户提前退出 / 展示失败
  ///
  /// 关键修复：将 fullScreenContentCallback 在 show() 调用前绑定，让 Completer 对
  /// "提前退出"和"展示失败"回调可见，避免原有 30 秒超时导致的 UI 卡死。
  Future<bool> showRewardedAd() async {
    if (_rewardedAd == null || !_isAdLoaded) {
      print('⚠️ 广告未准备好，无法展示');
      return false;
    }

    final completer = Completer<bool>();

    // 在 show() 之前绑定回调，确保所有退出路径都能 complete completer
    _rewardedAd!.fullScreenContentCallback = FullScreenContentCallback(
      onAdDismissedFullScreenContent: (ad) {
        print('📺 广告已关闭');
        ad.dispose();
        _rewardedAd = null;
        _isAdLoaded = false;
        // 用户提前退出时 reward 回调不会触发，在此以 false 结束等待
        if (!completer.isCompleted) completer.complete(false);
        // 预加载下一个广告
        loadRewardedAd();
      },
      onAdFailedToShowFullScreenContent: (ad, error) {
        print('❌ 广告展示失败: $error');
        ad.dispose();
        _rewardedAd = null;
        _isAdLoaded = false;
        if (!completer.isCompleted) completer.complete(false);
      },
    );

    try {
      await _rewardedAd!.show(
        onUserEarnedReward: (ad, reward) {
          print('🎉 用户获得奖励: ${reward.amount} ${reward.type}');
          if (!completer.isCompleted) completer.complete(true);
        },
      );
      return await completer.future;
    } catch (e) {
      print('❌ 展示广告异常: $e');
      if (!completer.isCompleted) completer.complete(false);
      return false;
    }
  }

  /// 检查广告是否已加载
  bool get isAdReady => _isAdLoaded && _rewardedAd != null;
  
  /// 重置加载状态
  void resetLoadingState() {
    print('🔄 重置广告加载状态');
    _isAdLoading = false;
    _isAdLoaded = false;
  }

  /// 释放资源
  void dispose() {
    _rewardedAd?.dispose();
    _rewardedAd = null;
    _isAdLoaded = false;
    _isAdLoading = false;
  }
}
