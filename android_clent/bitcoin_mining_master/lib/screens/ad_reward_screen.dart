import 'package:flutter/material.dart';
import '../constants/app_constants.dart';
import '../services/user_repository.dart';
import '../services/storage_service.dart';
import '../services/admob_service.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'dart:io' show Platform;
import 'contracts_screen.dart';
import 'checkin_screen.dart';

/// 广告奖励页面 - Ad Reward Screen 
class AdRewardScreen extends StatefulWidget {
  final bool isDailyCheckIn; // true: 每日签到, false: 广告奖励
  
  const AdRewardScreen({super.key, this.isDailyCheckIn = false});

  @override
  State<AdRewardScreen> createState() => _AdRewardScreenState();
}

class _AdRewardScreenState extends State<AdRewardScreen> {
  bool _isWatchingAd = false;
  final UserRepository _userRepository = UserRepository();
  final StorageService _storageService = StorageService();
  final AdMobService _adMobService = AdMobService();
  bool _isProcessing = false;
  String? _lastErrorMessage;
  bool _hasCheckedInToday = false; // 今日是否已签到
  bool _isAdReady = false; // 广告是否准备好
  bool _isLoadingAd = true; // 是否正在加载广告
  bool _adWatched = false; // 是否已观看完广告

  @override
  void initState() {
    super.initState();
    print('🚀 AdRewardScreen initState 启动 - isDailyCheckIn: ${widget.isDailyCheckIn}');
    if (widget.isDailyCheckIn) {
      // 先检查后端签到状态，再决定是否播放广告
      _checkBackendCheckInStatus();
    } else {
      // 广告奖励模式直接播放广告
      print('🎬 准备调用 _loadAndPlayAd()');
      _loadAndPlayAd();
    }
  }
  
  @override
  void dispose() {
    // 清理广告资源
    super.dispose();
  }
  
  /// 加载并自动播放AdMob广告
  Future<void> _loadAndPlayAd() async {
    print('📱 _loadAndPlayAd() 方法被调用');
    
    // 检查广告是否已经加载好了
    if (_adMobService.isAdReady) {
      print('🎯 广告已经加载完成，直接播放');
      setState(() {
        _isAdReady = true;
        _isLoadingAd = false;
      });
      await _playAd();
      return;
    }
    
    setState(() {
      _isLoadingAd = true;
      _isAdReady = false;
    });

    print('🔧 设置广告回调...');
    _adMobService.onAdLoaded = () async {
      print('✅ onAdLoaded 回调被触发');
      if (mounted) {
        setState(() {
          _isAdReady = true;
          _isLoadingAd = false;
        });
        print('✅ 广告加载完成，自动播放');
        // 广告加载完成后自动播放
        await _playAd();
      }
    };

    _adMobService.onAdFailedToLoad = (String error) {
      print('❌ onAdFailedToLoad 回调被触发: $error');
      // 重置AdMobService的加载状态
      _adMobService.resetLoadingState();
      if (mounted) {
        setState(() {
          _isLoadingAd = false;
          _isAdReady = false;
          _lastErrorMessage = 'Ad loading failed: $error';
        });
        print('❌ 广告加载失败: $error');
        // 广告加载失败，返回上一页
        Navigator.of(context).pop();
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('❌ Ad loading failed, please try again later'),
            backgroundColor: Colors.red,
          ),
        );
      }
    };

    print('📡 开始调用 AdMobService.loadRewardedAd()...');
    await _adMobService.loadRewardedAd();
    print('📡 AdMobService.loadRewardedAd() 调用完成');
  }
  
  /// 播放广告
  Future<void> _playAd() async {
    try {
      final earnedReward = await _adMobService.showRewardedAd();
      
      if (mounted) {
        if (earnedReward) {
          // 用户看完广告
          setState(() {
            _adWatched = true;
          });
          print('✅ 用户看完广告，显示奖励确认页面');
          
          // ⚠️ 重要:移除onAdLoaded回调,防止新加载的广告自动播放
          print('🧹 移除onAdLoaded回调,停止自动播放循环');
          _adMobService.onAdLoaded = null;
          _adMobService.onAdFailedToLoad = null;
        } else {
          // 用户未看完广告
          print('⚠️ 用户未看完广告，返回上一页');
          Navigator.of(context).pop();
        }
      }
    } catch (e) {
      print('❌ 播放广告失败: $e');
      if (mounted) {
        Navigator.of(context).pop();
      }
    }
  }
  
  // 检查今日是否已经签到
  Future<void> _checkIfAlreadyCheckedIn() async {
    try {
      final lastCheckInDate = _storageService.getLastCheckInDate();
      final today = DateTime.now().toIso8601String().split('T')[0];
      
      if (lastCheckInDate == today) {
        setState(() {
          _hasCheckedInToday = true;
        });
      }
    } catch (e) {
      print('❌ 检查签到状态失败: $e');
    }
  }
  
  // 🆕 检查后端签到状态（在播放广告前调用）
  Future<void> _checkBackendCheckInStatus() async {
    print('🔍 检查后端签到状态...');
    
    try {
      final userIdResult = await _userRepository.fetchUserId();
      if (!userIdResult.isSuccess || userIdResult.data == null || userIdResult.data!.isEmpty) {
        print('❌ 用户未登录');
        if (mounted) {
          Navigator.pop(context);
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('User not logged in, please try again'),
              backgroundColor: Colors.red,
            ),
          );
        }
        return;
      }
      final userId = userIdResult.data!;
      
      // 🔍 验证Google账户是否匹配（防止切换账户后使用旧的userId）
      final isGoogleSignedIn = _storageService.isGoogleSignedIn();
      if (isGoogleSignedIn) {
        final savedGoogleEmail = _storageService.getGoogleEmail();
        print('🔍 已保存的Google账户: $savedGoogleEmail');
        
        // 检查后端userId是否与保存的Google账户匹配
        try {
          final verifyResponse = await http.get(
            Uri.parse('${ApiConstants.baseUrl}/auth/google-binding-status/$userId'),
            headers: {
              'Content-Type': 'application/json',
            },
          ).timeout(const Duration(seconds: 10));
          
          if (verifyResponse.statusCode == 200) {
            final verifyData = json.decode(verifyResponse.body);
            final boundEmail = verifyData['data']?['googleEmail'];
            
            if (boundEmail != null && savedGoogleEmail != null && boundEmail != savedGoogleEmail) {
              // Google账户不匹配！用户可能切换了账户
              print('⚠️ 检测到Google账户不匹配！');
              print('   保存的账户: $savedGoogleEmail');
              print('   后端绑定账户: $boundEmail');
              
              if (mounted) {
                Navigator.pop(context);
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(
                    content: Text('⚠️ Account mismatch detected. Please log out and sign in with the correct Google account.'),
                    backgroundColor: Colors.orange,
                    duration: Duration(seconds: 5),
                  ),
                );
              }
              return;
            }
          }
        } catch (e) {
          print('⚠️ 验证Google账户时出错: $e (继续签到流程)');
        }
      }
      
      // 调用后端API检查签到状态
      final apiUrl = '${ApiConstants.baseUrl}/check-in/status';
      print('📍 检查签到状态 API URL: $apiUrl');
      
      final response = await http.get(
        Uri.parse(apiUrl),
        headers: {
          'Content-Type': 'application/json',
        },
      ).timeout(
        const Duration(seconds: 30), // 增加超时时间到30秒
        onTimeout: () {
          throw Exception('Server response timeout. Please check your network connection and try again.');
        },
      );
      
      print('📥 签到状态API响应: ${response.statusCode} - ${response.body}');
      
      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        final alreadyCheckedIn = data['data']?['alreadyCheckedIn'] ?? false;
        
        if (alreadyCheckedIn) {
          print('⚠️ 今日已签到');
          if (mounted) {
            Navigator.pop(context);
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(
                content: Text('⚠️ You have already checked in today! Please try again after UTC 00:00'),
                backgroundColor: Colors.orange,
                duration: Duration(seconds: 3),
              ),
            );
          }
          return;
        } else {
          print('✅ 今日未签到，可以播放广告');
          // 今日未签到，播放广告
          _loadAndPlayAd();
        }
      } else {
        print('❌ 签到状态检查失败: ${response.statusCode}');
        // API失败，为了用户体验，允许播放广告（后端会再次验证）
        _loadAndPlayAd();
      }
    } catch (e) {
      print('❌ 检查签到状态异常: $e');
      // 网络异常，为了用户体验，允许播放广告（后端会再次验证）
      _loadAndPlayAd();
    }
  }
  
  // 调用后端API执行签到并创建Daily Check-in合约
  // 📌 签到会激活Daily Check-in合约（7.5Gh/s，2小时），不影响Free Ad Reward
  Future<bool> _performCheckIn() async {
    try {
      final userIdResult = await _userRepository.fetchUserId();
      if (!userIdResult.isSuccess || userIdResult.data == null || userIdResult.data!.isEmpty) {
        _lastErrorMessage = 'User not logged in, please try again';
        return false;
      }
      final userId = userIdResult.data!;
      
      print('📝 调用签到API - userId: $userId');

      final baseUrls = <String>[];
      final primaryBase = ApiConstants.baseUrl;
      baseUrls.add(primaryBase);

      http.Response? response;
      Exception? lastError;

      for (final base in baseUrls.toSet()) {
        final apiUrl = '$base/check-in/daily';
        print('📍 签到API URL: $apiUrl');
        try {
          response = await http.post(
            Uri.parse(apiUrl),
            headers: {
              'Content-Type': 'application/json',
            },
            body: json.encode({'user_id': userId}),
          ).timeout(
            const Duration(seconds: 30), // 增加超时时间到30秒
            onTimeout: () {
              throw Exception('Server response timeout. Please try again in a moment.');
            },
          );
          if (response.statusCode == 200) {
            break;
          }
        } catch (e) {
          lastError = e is Exception ? e : Exception(e.toString());
          continue;
        }
      }

      if (response == null) {
        // 提取更友好的错误信息
        String errorMsg = 'Network connection failed. Please try again later.';
        if (lastError != null) {
          String errStr = lastError.toString();
          if (errStr.contains('timeout')) {
            errorMsg = 'Server response timeout. Please check your network and try again.';
          } else if (errStr.contains('SocketException')) {
            errorMsg = 'Unable to connect to server. Please check your internet connection.';
          }
        }
        _lastErrorMessage = errorMsg;
        return false;
      }
      
      print('📥 签到API响应状态: ${response.statusCode}');
      print('📥 签到API响应内容: ${response.body}');
      
      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        print('✅ 签到成功: $data');
        
        if (data['success'] == true) {
          // 保存签到日期到本地
          final today = DateTime.now().toIso8601String().split('T')[0];
          final saved = await _storageService.saveLastCheckInDate(today);
          print('✅ [AdReward] 签到成功! 保存日期: $today, saved=$saved');
          // 验证是否真的保存成功
          final verified = _storageService.getLastCheckInDate();
          print('🔍 [AdReward] 验证保存结果: $verified');
          setState(() {
            _hasCheckedInToday = true;
          });
          return true;
        } else {
          // 检查是否是今日已签到
          if (data['data'] != null && data['data']['alreadyCheckedIn'] == true) {
            _lastErrorMessage = 'You have already checked in today! Please try again after UTC 00:00';
            final today = DateTime.now().toIso8601String().split('T')[0];
            _storageService.saveLastCheckInDate(today);
            setState(() {
              _hasCheckedInToday = true;
            });
          } else {
            _lastErrorMessage = data['message'] ?? 'Check-in failed, please try again later';
          }
          print('❌ API返回失败: ${data['message']}');
          return false;
        }
      } else {
        _lastErrorMessage = 'Check-in failed, please try again later';
        return false;
      }
    } catch (e) {
      print('❌ 签到异常: $e');
      _lastErrorMessage = e.toString();
      return false;
    }
  }

  // 调用后端API延长合约
  // 📌 重要：只有Free Ad Reward才会增加电池数量（+2小时=+2个电池）
  Future<bool> _extendContract() async {
    try {
      final userIdResult = await _userRepository.fetchUserId();
      if (!userIdResult.isSuccess || userIdResult.data == null || userIdResult.data!.isEmpty) {
        _lastErrorMessage = 'User not logged in, please try again';
        return false;
      }
      final userId = userIdResult.data!;
      
      print('🔄 调用延长合约API - userId: $userId');

      final baseUrls = <String>[];
      final primaryBase = ApiConstants.baseUrl.replaceAll('/api', '');
      baseUrls.add(primaryBase);
      if (!kIsWeb && Platform.isAndroid) {
        baseUrls.add('http://10.0.2.2:8888');
        baseUrls.add('http://127.0.0.1:8888');
      }

      http.Response? response;
      Exception? lastError;

      for (final base in baseUrls.toSet()) {
        final apiUrl = '$base/api/mining-pool/extend-contract';
        print('📍 API URL: $apiUrl');
        try {
          response = await http.post(
            Uri.parse(apiUrl),
            headers: {'Content-Type': 'application/json'},
            body: json.encode({
              'user_id': userId,
              'hours': 2, // 观看广告奖励2小时
            }),
          ).timeout(
            const Duration(seconds: 30), // 增加超时时间到30秒
            onTimeout: () {
              throw Exception('Server response timeout. Please try again in a moment.');
            },
          );
          if (response.statusCode == 200) {
            break;
          }
        } catch (e) {
          lastError = e is Exception ? e : Exception(e.toString());
          continue;
        }
      }

      if (response == null) {
        _lastErrorMessage = lastError?.toString() ?? 'Network connection failed. Please check your network or try again later.';
        return false;
      }
      
      print('📥 API响应状态: ${response.statusCode}');
      print('📥 API响应内容: ${response.body}');
      
      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        print('✅ 延长合约成功: $data');
        
        // 检查返回的 success 字段
        if (data['success'] == true) {
          return true;
        } else {
          _lastErrorMessage = data['message'] ?? 'Reward collection failed, please try again later';
          print('❌ API返回失败: ${data['message']}');
          return false;
        }
      } else {
        _lastErrorMessage = 'Server error (${response.statusCode})';
        print('❌ 延长合约失败 (${response.statusCode}): ${response.body}');
        return false;
      }
    } catch (e) {
      _lastErrorMessage = 'Network connection failed, please check settings or try again later';
      print('❌ 调用API异常: $e');
      return false;
    }
  }

  void _startWatchingAd() async {
    print('🔍 [AdReward] _startWatchingAd: isDailyCheckIn=${widget.isDailyCheckIn}, _hasCheckedInToday=$_hasCheckedInToday');
    
    // 如果是签到且今日已签到，直接返回
    if (widget.isDailyCheckIn && _hasCheckedInToday) {
      print('⚠️ [AdReward] 今日已签到，阻止播放广告');
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('⚠️ You have already checked in today! Please try again after UTC 00:00'),
          backgroundColor: Colors.orange,
          duration: Duration(seconds: 3),
        ),
      );
      return;
    }
    
    print('✅ [AdReward] 未签到，准备播放广告');

    if (!_isAdReady) {
      _showMessage('Ad is not loaded yet, please wait...');
      return;
    }

    setState(() {
      _isWatchingAd = true;
      _isProcessing = true;
    });

    try {
      // 展示真实的AdMob激励视频广告
      print('📺 开始播放AdMob激励视频广告...');
      final earnedReward = await _adMobService.showRewardedAd();

      if (!mounted) return;

      if (earnedReward) {
        // 用户看完广告，给予奖励
        print('✅ 用户看完广告，开始发放奖励...');
        await _completeAdReward();
      } else {
        // 用户未看完广告
        print('⚠️ 用户未看完广告');
        setState(() {
          _isWatchingAd = false;
          _isProcessing = false;
          _lastErrorMessage = 'You did not watch the ad completely, cannot get reward';
        });
      }
    } catch (e) {
      print('❌ 播放广告异常: $e');
      if (mounted) {
        setState(() {
          _isWatchingAd = false;
          _isProcessing = false;
          _lastErrorMessage = 'Error occurred while playing ad: $e';
        });
      }
    }
  }

  /// 增加积分
  Future<bool> _addPoints(int points) async {
    try {
      final userIdResult = await _userRepository.fetchUserId();
      if (!userIdResult.isSuccess || userIdResult.data == null || userIdResult.data!.isEmpty) {
        print('❌ 用户未登录，无法增加积分');
        return false;
      }
      final userId = userIdResult.data!;
      
      print('💰 调用增加积分API - userId: $userId, points: $points');

      final baseUrls = <String>[];
      final primaryBase = ApiConstants.baseUrl;
      baseUrls.add(primaryBase);

      http.Response? response;
      Exception? lastError;

      for (final base in baseUrls.toSet()) {
        final apiUrl = '$base/points/add';
        print('📍 积分API URL: $apiUrl');
        try {
          response = await http.post(
            Uri.parse(apiUrl),
            headers: {
              'Content-Type': 'application/json',
            },
            body: json.encode({
              'user_id': userId,
              'points': points,
              'reason': widget.isDailyCheckIn ? 'daily_check_in' : 'ad_reward',
            }),
          ).timeout(
            const Duration(seconds: 30), // 增加超时时间到30秒
            onTimeout: () {
              throw Exception('Server response timeout. Please try again.');
            },
          );
          if (response.statusCode == 200) {
            break;
          }
        } catch (e) {
          lastError = e is Exception ? e : Exception(e.toString());
          continue;
        }
      }

      if (response == null) {
        print('❌ 增加积分失败: 网络连接失败');
        return false;
      }
      
      print('📥 积分API响应状态: ${response.statusCode}');
      print('📥 积分API响应内容: ${response.body}');
      
      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        if (data['success'] == true) {
          print('✅ 积分增加成功: +$points');
          return true;
        } else {
          print('❌ 积分增加失败: ${data['message']}');
          return false;
        }
      } else {
        print('❌ 积分API失败 (${response.statusCode})');
        return false;
      }
    } catch (e) {
      print('❌ 增加积分异常: $e');
      return false;
    }
  }

  /// 完成广告观看后的奖励发放
  Future<void> _completeAdReward() async {
    setState(() {
      _isProcessing = true;
    });

    bool success;
    if (widget.isDailyCheckIn) {
      // 每日签到流程
      success = await _performCheckIn();
    } else {
      // 广告奖励流程
      success = await _extendContract();
    }

    if (!mounted) return;

    if (success) {
      // 奖励发放成功
      setState(() {
        _isProcessing = false;
        _isWatchingAd = false;
      });
      
      // 延迟后返回并刷新
      await Future.delayed(const Duration(milliseconds: 1500));
      if (mounted) {
        Navigator.pop(context, true); // 返回true表示成功
      }
    } else {
      // 奖励发放失败
      setState(() {
        _isProcessing = false;
        _isWatchingAd = false;
      });
      _showMessage(_lastErrorMessage ?? 'Operation failed, please try again');
    }
  }

  void _showMessage(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        duration: const Duration(seconds: 3),
        backgroundColor: Colors.red,
      ),
    );
  }



  @override
  Widget build(BuildContext context) {
    print('🖼️ AdRewardScreen build 被调用 - _adWatched: $_adWatched, _isLoadingAd: $_isLoadingAd, _isAdReady: $_isAdReady');
    
    // 不显示加载界面，直接在后台加载并播放广告
    // 只有看完广告后才显示Succeed Dialog
    if (!_adWatched) {
      // 广告加载和播放期间，显示一个简单的黑色页面（不显示加载动画）
      // 这样给AdMob提供一个有效的surface来显示广告
      return WillPopScope(
        onWillPop: () async {
          print('⚠️ 用户尝试返回，但广告未看完，阻止返回');
          return false;
        },
        child: Scaffold(
          backgroundColor: const Color(0xFF1A1A1A), // 深色背景，接近Dashboard颜色
          body: Container(), // 空容器，提供有效的渲染surface
        ),
      );
    }
    
    // 看完广告后显示奖励确认对话框
    print('✅ 显示奖励确认对话框');
    return Scaffold(
      backgroundColor: Colors.black.withOpacity(0.5),
      body: _buildSucceedDialog(),
    );
  }
  
  /// 构建Succeed奖励确认对话框
  Widget _buildSucceedDialog() {
    return Center(
      child: Container(
        margin: const EdgeInsets.symmetric(horizontal: 24),
        padding: const EdgeInsets.all(24),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Succeed 标题
            const Text(
              'Succeed',
              style: TextStyle(
                color: Colors.black,
                fontSize: 24,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 24),
            
            // Contract/Reward 奖励行
            Container(
              padding: const EdgeInsets.symmetric(vertical: 16),
              decoration: BoxDecoration(
                border: Border(
                  bottom: BorderSide(
                    color: Colors.grey[200]!,
                    width: 1,
                  ),
                ),
              ),
              child: Row(
                children: [
                  // Bitcoin 图标
                  Container(
                    width: 40,
                    height: 40,
                    decoration: BoxDecoration(
                      color: AppColors.primary,
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(
                      Icons.currency_bitcoin,
                      color: Colors.white,
                      size: 24,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      widget.isDailyCheckIn ? 'Daily Check-in Reward' : 'Free Ad Reward',
                      style: const TextStyle(
                        color: Colors.black,
                        fontSize: 18,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Text(
                    widget.isDailyCheckIn ? '+ 7.5Gh/s' : '+ 5.5Gh/s',
                    style: const TextStyle(
                      color: Colors.black,
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ],
              ),
            ),
            
            // Power 奖励行 (仅广告奖励显示)
            if (!widget.isDailyCheckIn)
              Container(
                padding: const EdgeInsets.symmetric(vertical: 16),
                decoration: BoxDecoration(
                  border: Border(
                    bottom: BorderSide(
                      color: Colors.grey[200]!,
                      width: 1,
                    ),
                  ),
                ),
                child: Row(
                  children: [
                    // 电池图标 - 与Mining Pool一致的设计
                    Container(
                      width: 40,
                      height: 40,
                      decoration: BoxDecoration(
                        color: AppColors.primary.withOpacity(0.1),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Center(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            // Battery top cap
                            Container(
                              width: 10,
                              height: 2,
                              decoration: BoxDecoration(
                                color: AppColors.primary,
                                borderRadius: const BorderRadius.only(
                                  topLeft: Radius.circular(1),
                                  topRight: Radius.circular(1),
                                ),
                              ),
                            ),
                            // Battery main body with 4 levels
                            Container(
                              width: 16,
                              height: 24,
                              decoration: BoxDecoration(
                                color: Colors.transparent,
                                borderRadius: BorderRadius.circular(2),
                                border: Border.all(
                                  color: AppColors.primary,
                                  width: 1.5,
                                ),
                              ),
                              child: Column(
                                children: [
                                  // Level 4 (top) - filled
                                  Expanded(
                                    child: Container(
                                      margin: const EdgeInsets.all(1.5),
                                      decoration: BoxDecoration(
                                        color: AppColors.primary,
                                        borderRadius: BorderRadius.circular(0.5),
                                      ),
                                    ),
                                  ),
                                  const SizedBox(height: 0.5),
                                  // Level 3 - filled
                                  Expanded(
                                    child: Container(
                                      margin: const EdgeInsets.symmetric(horizontal: 1.5),
                                      decoration: BoxDecoration(
                                        color: AppColors.primary,
                                        borderRadius: BorderRadius.circular(0.5),
                                      ),
                                    ),
                                  ),
                                  const SizedBox(height: 0.5),
                                  // Level 2 - filled
                                  Expanded(
                                    child: Container(
                                      margin: const EdgeInsets.symmetric(horizontal: 1.5),
                                      decoration: BoxDecoration(
                                        color: AppColors.primary,
                                        borderRadius: BorderRadius.circular(0.5),
                                      ),
                                    ),
                                  ),
                                  const SizedBox(height: 0.5),
                                  // Level 1 (bottom) - filled
                                  Expanded(
                                    child: Container(
                                      margin: const EdgeInsets.only(left: 1.5, right: 1.5, bottom: 1.5),
                                      decoration: BoxDecoration(
                                        color: AppColors.primary,
                                        borderRadius: BorderRadius.circular(0.5),
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    const Text(
                      'Power',
                      style: TextStyle(
                        color: Colors.black,
                        fontSize: 18,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                    const Spacer(),
                    const Text(
                      '+ 2',
                      style: TextStyle(
                        color: Colors.black,
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ],
                ),
              ),
            
            // Points 积分奖励行
            Container(
              padding: const EdgeInsets.symmetric(vertical: 16),
              child: Row(
                children: [
                  // 积分图标
                  Container(
                    width: 40,
                    height: 40,
                    decoration: BoxDecoration(
                      color: Colors.purple,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: const Icon(
                      Icons.stars,
                      color: Colors.white,
                      size: 24,
                    ),
                  ),
                  const SizedBox(width: 12),
                  const Text(
                    'Points',
                    style: TextStyle(
                      color: Colors.black,
                      fontSize: 18,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                  const Spacer(),
                  Text(
                    widget.isDailyCheckIn ? '+ 4' : '+ 1',
                    style: const TextStyle(
                      color: Colors.black,
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ],
              ),
            ),
            
            const SizedBox(height: 16),
            
            // Continue 按钮
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: _isProcessing ? null : () async {
                  print('🔘 Continue 按钮被点击');
                  setState(() => _isProcessing = true);
                  
                  // 执行奖励领取逻辑
                  bool success = false;
                  bool pointsSuccess = false;
                  
                  if (widget.isDailyCheckIn) {
                    print('📝 执行每日签到...');
                    success = await _performCheckIn();
                    // ✅ 签到API已包含积分增加逻辑，无需再次调用_addPoints
                    if (success) {
                      print('✅ 签到成功，后端已自动发放4积分');
                      pointsSuccess = true; // 签到API已处理积分
                    }
                  } else {
                    print('🎁 执行广告奖励领取...');
                    success = await _extendContract();
                    if (success) {
                      print('✅ 广告奖励成功，发放1积分');
                      pointsSuccess = await _addPoints(1);
                    }
                  }
                  
                  setState(() => _isProcessing = false);
                  
                  if (mounted) {
                    if (success) {
                      // 每日签到成功
                      if (widget.isDailyCheckIn) {
                        print('⏳ [AdReward] 签到成功，等待后端数据写入完成...');
                        // 等待后端数据写入
                        await Future.delayed(const Duration(milliseconds: 1500));
                        
                        if (mounted) {
                          print('📍 [AdReward] 关闭当前页面并跳转到CheckInScreen');
                          // 先关闭当前页面（返回到 Dashboard）
                          Navigator.of(context).pop(true);
                          // 然后立即跳转到 CheckInScreen，传递 shouldRefresh: true 让它延迟刷新
                          await Navigator.push(
                            context,
                            MaterialPageRoute(builder: (context) => const CheckInScreen(shouldRefresh: true)),
                          );
                        }
                      } else {
                        // 广告奖励成功，返回上一页
                        String successMessage = 'Reward claimed successfully';
                        if (pointsSuccess) {
                          successMessage += ' (+1 Point)';
                        }
                        Navigator.of(context).pop(success);
                        print('✅ 广告奖励领取完成，返回上一页');
                        
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(
                            content: Text('✅ $successMessage!'),
                            backgroundColor: Colors.green,
                          ),
                        );
                      }
                    } else {
                      // 操作失败
                      String errorMessage = _lastErrorMessage ?? "Operation failed, please try again";
                      Navigator.of(context).pop(false);
                      
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(
                          content: Text('❌ $errorMessage'),
                          backgroundColor: Colors.red,
                        ),
                      );
                    }
                  }
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: _isProcessing 
                    ? AppColors.primary.withOpacity(0.8)  // loading状态下保持主色调但稍微透明
                    : AppColors.primary,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(8),
                  ),
                  disabledBackgroundColor: AppColors.primary.withOpacity(0.8), // 禁用状态也保持主色调
                ),
                child: _isProcessing 
                  ? Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: const [
                        SizedBox(
                          height: 20,
                          width: 20,
                          child: CircularProgressIndicator(
                            strokeWidth: 2.5,
                            valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                          ),
                        ),
                        SizedBox(width: 12),
                        Text(
                          'Processing...',
                          style: TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w600,
                            color: Colors.white,
                          ),
                        ),
                      ],
                    )
                  : Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: const [
                        Text(
                          'Continue',
                          style: TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        SizedBox(width: 8),
                        Icon(Icons.arrow_forward, size: 20),
                      ],
                    ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
