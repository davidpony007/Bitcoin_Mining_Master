import 'dart:async';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:google_mobile_ads/google_mobile_ads.dart';
import 'analytics_service.dart';
import 'solar_engine_service.dart';
import 'storage_service.dart';
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
  // 记录当前广告是否携带了有效的 userId（用于 SSV 二次校验）
  // null = 尚未加载 或 加载时 userId 为空
  String? _loadedWithUserId;

  // 自动重试：对 No Fill(3) 和 Network Error(2) 最多重试 3 次，指数退避（5/10/20s）
  int _retryCount = 0;
  static const int _maxRetries = 3;
  bool _isLoadFailed = false;
  
  // 广告加载回调
  Function()? onAdLoaded;
  Function(String)? onAdFailedToLoad;
  /// 自动重试进度回调（retryNum: 当前第几次重试, maxRetries: 最大次数）
  Function(int retryNum, int maxRetries)? onAdRetrying;

  /// 暴露最大重试次数供 UI 层同步进度显示
  static int get adMaxRetries => _maxRetries;

  /// 所有自动重试耗尽后为 true，供轮询侧提前退出
  bool get isLoadFailed => _isLoadFailed;
  
  // 广告位 ID：统一由 AdMobConstants 管理，切换测试/正式只需改一处 _isTestMode
  static String get _rewardedAdUnitId {
    if (kIsWeb) return '';
    if (Platform.isAndroid) return AdMobConstants.androidRewardedAdUnitId;
    if (Platform.isIOS)     return AdMobConstants.iosRewardedAdUnitId;
    return '';
  }
  
  /// 初始化AdMob SDK（含 GDPR/IDFA 同意弹窗）
  /// 必须在 MobileAds.instance.initialize() 之前完成 UMP 同意收集，
  /// 否则欧盟用户只能投放非个性化广告，eCPM 损失 70-80%。
  static Future<void> initialize() async {
    try {
      // Step 1: 请求 GDPR 同意状态并在需要时展示表单
      final consentCompleter = Completer<void>();
      ConsentInformation.instance.requestConsentInfoUpdate(
        ConsentRequestParameters(),
        () {
          // 成功获取同意状态 —— 如需要则展示表单（仅欧盟用户会看到）
          ConsentForm.loadAndShowConsentFormIfRequired((FormError? formError) {
            if (formError != null) {
              print('⚠️ UMP 同意表单错误: ${formError.message}');
            }
            if (!consentCompleter.isCompleted) consentCompleter.complete();
          });
        },
        (FormError error) {
          // 网络错误等情况，跳过同意直接继续
          print('⚠️ UMP 状态更新失败: ${error.message}');
          if (!consentCompleter.isCompleted) consentCompleter.complete();
        },
      );
      // 最多等 15 秒，防止网络问题卡死启动
      await consentCompleter.future
          .timeout(const Duration(seconds: 15), onTimeout: () {});

      // Step 2: 同意收集完成后初始化 AdMob SDK
      await MobileAds.instance.initialize();
      print('✅ AdMob SDK初始化成功');
    } catch (e) {
      print('❌ AdMob SDK初始化失败: $e');
    }
  }

  /// 登录后确保广告以当前用户 ID 加载（修复 SSV user_id 为空的全局 Bug）
  ///
  /// 若广告已加载但没有携带有效 userId（_loadedWithUserId == null），说明该广告
  /// 是在 userId 尚未可用时预加载的，SSV 回调将无法关联用户。此方法会强制丢弃
  /// 这个"无主广告"并重新加载，确保 SSV 回调中包含正确的 user_id。
  ///
  /// 应在 HomeScreen.initState() 内用 addPostFrameCallback 异步调用，
  /// 给 StorageService 足够时间完成写入。
  Future<void> ensureLoadedForUser(String userId) async {
    if (_loadedWithUserId == userId && (_isAdLoaded || _isAdLoading)) {
      // 已用正确 userId 加载过，无需重复
      print('ℹ️ 广告已携带 userId=$userId，无需重新加载');
      return;
    }
    // 需要重新加载：丢弃无主广告或 userId 不匹配的广告
    if (_rewardedAd != null) {
      print('🔄 广告 userId 不匹配（当前: $_loadedWithUserId），重新加载以修复 SSV');
      _rewardedAd!.dispose();
      _rewardedAd = null;
    }
    _isAdLoaded = false;
    _isAdLoading = false;
    _loadedWithUserId = null;
    await loadRewardedAd();
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
    _isLoadFailed = false; // 每次尝试加载时重置失败标志
    print('📡 开始加载激励视频广告: $_rewardedAdUnitId');
    
    // 读取当前登录用户 ID，用于 SSV 后端二次校验奖励合法性
    final userId = StorageService().getUserId();
    _loadedWithUserId = (userId != null && userId.isNotEmpty) ? userId : null;

    try {
      await RewardedAd.load(
        adUnitId: _rewardedAdUnitId,
        request: const AdRequest(),
        rewardedAdLoadCallback: RewardedAdLoadCallback(
          onAdLoaded: (ad) async {
            // 加载成功后立即设置 SSV userId（google_mobile_ads 5.x 的正确 API）
            // 注意：serverSideVerificationOptions 不是 RewardedAd.load() 的参数，
            // 必须通过 ad.setServerSideOptions() 单独设置，否则 SSV 回调中 user_id 永远为空
            if (_loadedWithUserId != null) {
              try {
                await ad.setServerSideOptions(
                    ServerSideVerificationOptions(userId: _loadedWithUserId!));
                print('✅ SSV userId 已设置: $_loadedWithUserId');
              } catch (e) {
                print('⚠️ SSV userId 设置失败（不影响广告展示）: $e');
              }
            }
            _retryCount = 0; // 加载成功，重置重试计数
            print('✅ 激励视频广告加载成功 (ssv_userId=${_loadedWithUserId ?? "empty"})');  
            _rewardedAd = ad;
            _isAdLoaded = true;
            _isAdLoading = false;
            onAdLoaded?.call();

            // onPaidEvent：广告产生收益时上报，含 user_id，便于 BigQuery 按用户分析
            // valueMicros 单位为百万分之一美元，precision 表示金额精度
            _rewardedAd?.onPaidEvent = (Ad ad, double valueMicros, PrecisionType precision, String currencyCode) {
              AnalyticsService.instance.logAdRevenue(
                valueMicros: valueMicros,
                precision: precision.name,
                currencyCode: currencyCode,
                adUnitId: ad.adUnitId,
              );
              // SolarEngine：上报广告展示事件（ecpm = valueMicros / 1000，单位元/美元）
              // adType=1 为激励视频，SE ROI 分析的关键数据来源
              SolarEngineService.instance.trackAdImpression(
                adUnitId: ad.adUnitId,
                adType: 1, // 激励视频
                ecpm: valueMicros / 1000,
                currency: currencyCode,
              );
            };
            // fullScreenContentCallback 在 showRewardedAd() 中按需绑定（含 Completer 引用）
          },
          onAdFailedToLoad: (error) {
            print('❌ 广告加载失败: code=${error.code} domain=${error.domain} msg=${error.message}');
            _isAdLoading = false;
            _isAdLoaded = false;
            _loadedWithUserId = null;

            // code 2 = 网络错误, code 3 = 无广告填充(No Fill)
            // 这两种属于临时状况，自动重试（最多4次，指数退避3/6/12/24s）
            // code 0 = 内部错误（偶发），也加入重试；code 1 = 无效请求，直接报错
            final shouldRetry = (error.code == 0 || error.code == 2 || error.code == 3) && _retryCount < _maxRetries;
            if (shouldRetry) {
              _retryCount++;
              // 指数退避：第1次5s，第2次10s，第3次20s（总延35s，少于屏庖65s超时）
              final delaySeconds = (5 * (1 << (_retryCount - 1))).clamp(5, 20);
              print('🔄 广告暂时无法填充(code=${error.code})，${delaySeconds}s 后自动重试 ($_retryCount/$_maxRetries)...');
              onAdRetrying?.call(_retryCount, _maxRetries);
              Future.delayed(Duration(seconds: delaySeconds), loadRewardedAd);
              return;
            }

            _retryCount = 0;
            _isLoadFailed = true;
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
      onAdClicked: (ad) {
        // SolarEngine：广告被点击事件
        SolarEngineService.instance.trackAdClick(
          adUnitId: ad.adUnitId,
          adType: 1, // 激励视频
        );
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
          // 上报广告奖励观看完成事件
          AnalyticsService.instance.logAdRewardEarned(
            adUnit: ad.adUnitId,
            points: reward.amount.toInt(),
          );
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
    _retryCount = 0;
    _isLoadFailed = false;
    onAdRetrying = null;
  }

  /// 后台预热：App 从后台恢复时，若广告未就绪则静默重新加载
  Future<void> backgroundWarmUp() async {
    if (_isAdLoaded || _isAdLoading) return;
    print('🌅 [AdMob] 后台预热：重新加载广告...');
    _retryCount = 0;
    await loadRewardedAd();
  }

  /// 释放资源
  void dispose() {
    _rewardedAd?.dispose();
    _rewardedAd = null;
    _isAdLoaded = false;
    _isAdLoading = false;
  }
}
