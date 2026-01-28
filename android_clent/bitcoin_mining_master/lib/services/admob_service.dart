import 'dart:io';
import 'dart:async';
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
  
  // 模拟广告模式（当广告无法加载时使用）
  bool _mockAdMode = false;
  
  /// 初始化AdMob SDK
  static Future<void> initialize() async {
    // 配置AdMob
    final RequestConfiguration requestConfiguration = RequestConfiguration(
      testDeviceIds: ['YOUR_TEST_DEVICE_ID'], // 可以添加测试设备ID
    );
    
    MobileAds.instance.updateRequestConfiguration(requestConfiguration);
    
    final InitializationStatus status = await MobileAds.instance.initialize();
    
    print('✅ AdMob SDK 初始化成功');
    print('📱 AdMob 适配器状态: ${status.adapterStatuses}');
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
      // 临时使用测试ID，等测试通过后再改回生产ID
      // 生产ID备份: ca-app-pub-1048949483424060/7268543515
      if (Platform.isAndroid) {
        return 'ca-app-pub-3940256099942544/5224354917'; // Google测试ID (临时)
      } else if (Platform.isIOS) {
        return 'ca-app-pub-3940256099942544/1712485313'; // Google测试ID (临时)
      }
    }
    return '';
  }

  /// 预加载激励视频广告
  Future<void> loadRewardedAd() async {
    if (_isAdLoading) {
      print('⚠️ 广告正在加载中');
      return;
    }

    if (_isAdLoaded) {
      if (_rewardedAd != null) {
        print('✅ 广告已加载完成，直接触发回调');
        onAdLoaded?.call();
        return;
      }
      print('⚠️ 广告标记为已加载，但实例为空，重置并重新加载');
      _isAdLoaded = false;
      _isAdLoading = false;
    }

    _isAdLoading = true;
    print('📡 开始加载激励视频广告...');
    print('📱 广告单元ID: $_rewardedAdUnitId');

    await RewardedAd.load(
      adUnitId: _rewardedAdUnitId,
      request: const AdRequest(),
      rewardedAdLoadCallback: RewardedAdLoadCallback(
        onAdLoaded: (RewardedAd ad) {
          print('✅ 激励视频广告加载成功');
          _rewardedAd = ad;
          _isAdLoaded = true;
          _isAdLoading = false;
          
          // 仅设置播放开始的回调，关闭回调将在showRewardedAd中设置
          _rewardedAd!.fullScreenContentCallback = FullScreenContentCallback(
            onAdShowedFullScreenContent: (RewardedAd ad) {
              print('📺 广告开始播放');
            },
          );
          
          onAdLoaded?.call();
        },
        onAdFailedToLoad: (LoadAdError error) {
          print('❌ 激励视频广告加载失败:');
          print('   错误码: ${error.code}');
          print('   错误域: ${error.domain}');
          print('   错误消息: ${error.message}');
          print('   响应信息: ${error.responseInfo}');
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
    // 如果处于模拟广告模式，直接返回true
    if (_mockAdMode) {
      print('🎬 模拟广告模式：自动通过');
      await Future.delayed(const Duration(seconds: 1));
      return true;
    }
    
    if (_rewardedAd == null || !_isAdLoaded) {
      print('⚠️ 广告未加载，无法播放');
      return false;
    }

    // 使用Completer等待广告回调完成
    final completer = Completer<bool>();
    bool userEarnedReward = false;

    // 设置全屏内容回调来监听广告关闭
    _rewardedAd!.fullScreenContentCallback = FullScreenContentCallback(
      onAdDismissedFullScreenContent: (ad) {
        print('👋 广告已关闭');
        // 广告关闭时完成Future，返回用户是否获得奖励
        if (!completer.isCompleted) {
          completer.complete(userEarnedReward);
        }
        // 释放广告资源，不自动重新加载
        ad.dispose();
        _isAdLoaded = false;
        _isAdLoading = false;
        print('🧹 广告资源已释放，不自动重新加载');
      },
      onAdFailedToShowFullScreenContent: (ad, error) {
        print('❌ 广告显示失败: $error');
        ad.dispose();
        _isAdLoaded = false;
        _isAdLoading = false;
        if (!completer.isCompleted) {
          completer.complete(false);
        }
      },
    );

    await _rewardedAd!.show(
      onUserEarnedReward: (AdWithoutView ad, RewardItem reward) {
        print('🎉 用户获得奖励: ${reward.amount} ${reward.type}');
        userEarnedReward = true;
      },
    );

    // 等待广告关闭
    return completer.future;
  }

  /// 启用模拟广告模式
  void enableMockAdMode() {
    _mockAdMode = true;
    print('🎬 已启用模拟广告模式');
  }

  /// 检查广告是否已加载
  bool get isAdReady => _mockAdMode || (_isAdLoaded && _rewardedAd != null);
  
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
