import 'dart:io';
import 'package:google_mobile_ads/google_mobile_ads.dart';
import 'package:flutter/foundation.dart';

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
  
  /// 初始化AdMob SDK
  static Future<void> initialize() async {
    await MobileAds.instance.initialize();
    print('✅ AdMob SDK 初始化成功');
  }

  /// 获取激励视频广告ID
  /// 测试ID和正式ID
  String get _rewardedAdUnitId {
    if (kDebugMode) {
      // 测试广告ID
      if (Platform.isAndroid) {
        return 'ca-app-pub-3940256099942544/5224354917'; // Google测试ID
      } else if (Platform.isIOS) {
        return 'ca-app-pub-3940256099942544/1712485313'; // Google测试ID
      }
    } else {
      // 正式广告ID - 需要从AdMob后台获取
      if (Platform.isAndroid) {
        return 'ca-app-pub-1048949483424060/XXXXXXXXXX'; // 替换为您的Android激励视频广告ID
      } else if (Platform.isIOS) {
        return 'ca-app-pub-1048949483424060/YYYYYYYYYY'; // 替换为您的iOS激励视频广告ID
      }
    }
    return '';
  }

  /// 预加载激励视频广告
  Future<void> loadRewardedAd() async {
    if (_isAdLoading || _isAdLoaded) {
      print('⚠️ 广告正在加载或已加载');
      return;
    }

    _isAdLoading = true;
    print('📡 开始加载激励视频广告...');

    await RewardedAd.load(
      adUnitId: _rewardedAdUnitId,
      request: const AdRequest(),
      rewardedAdLoadCallback: RewardedAdLoadCallback(
        onAdLoaded: (RewardedAd ad) {
          print('✅ 激励视频广告加载成功');
          _rewardedAd = ad;
          _isAdLoaded = true;
          _isAdLoading = false;
          
          // 设置全屏内容回调
          _rewardedAd!.fullScreenContentCallback = FullScreenContentCallback(
            onAdShowedFullScreenContent: (RewardedAd ad) {
              print('📺 广告开始播放');
            },
            onAdDismissedFullScreenContent: (RewardedAd ad) {
              print('👋 广告已关闭');
              ad.dispose();
              _rewardedAd = null;
              _isAdLoaded = false;
              // 广告关闭后立即预加载下一个
              loadRewardedAd();
            },
            onAdFailedToShowFullScreenContent: (RewardedAd ad, AdError error) {
              print('❌ 广告播放失败: ${error.message}');
              ad.dispose();
              _rewardedAd = null;
              _isAdLoaded = false;
              onAdFailedToLoad?.call(error.message);
            },
          );
          
          onAdLoaded?.call();
        },
        onAdFailedToLoad: (LoadAdError error) {
          print('❌ 激励视频广告加载失败: ${error.message}');
          _isAdLoading = false;
          _isAdLoaded = false;
          onAdFailedToLoad?.call(error.message);
        },
      ),
    );
  }

  /// 展示激励视频广告
  /// 返回值：true表示用户看完广告获得奖励，false表示用户未看完或广告未加载
  Future<bool> showRewardedAd() async {
    if (_rewardedAd == null || !_isAdLoaded) {
      print('⚠️ 广告未加载，无法播放');
      return false;
    }

    bool userEarnedReward = false;

    await _rewardedAd!.show(
      onUserEarnedReward: (AdWithoutView ad, RewardItem reward) {
        print('🎉 用户获得奖励: ${reward.amount} ${reward.type}');
        userEarnedReward = true;
      },
    );

    return userEarnedReward;
  }

  /// 检查广告是否已加载
  bool get isAdReady => _isAdLoaded && _rewardedAd != null;

  /// 释放资源
  void dispose() {
    _rewardedAd?.dispose();
    _rewardedAd = null;
    _isAdLoaded = false;
    _isAdLoading = false;
  }
}
