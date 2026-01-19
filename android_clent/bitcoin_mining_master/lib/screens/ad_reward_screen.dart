import 'package:flutter/material.dart';
import '../constants/app_constants.dart';
import '../services/user_repository.dart';
import '../services/storage_service.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'dart:io' show Platform;

/// 广告奖励页面 - Ad Reward Screen 
class AdRewardScreen extends StatefulWidget {
  final bool isDailyCheckIn; // true: 每日签到, false: 广告奖励
  
  const AdRewardScreen({super.key, this.isDailyCheckIn = false});

  @override
  State<AdRewardScreen> createState() => _AdRewardScreenState();
}

class _AdRewardScreenState extends State<AdRewardScreen> {
  bool _isWatchingAd = false;
  int _countdown = 3; // 3秒广告倒计时
  final UserRepository _userRepository = UserRepository();
  final StorageService _storageService = StorageService();
  bool _isProcessing = false;
  String? _lastErrorMessage;
  bool _hasCheckedInToday = false; // 今日是否已签到

  @override
  void initState() {
    super.initState();
    if (widget.isDailyCheckIn) {
      _checkIfAlreadyCheckedIn();
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
  
  // 调用后端API执行签到并创建Daily Check-in合约
  // 📌 签到会激活Daily Check-in合约（7.5Gh/s，2小时），不影响Free Ad Reward
  Future<bool> _performCheckIn() async {
    try {
      final userIdResult = await _userRepository.fetchUserId();
      if (!userIdResult.isSuccess || userIdResult.data == null || userIdResult.data!.isEmpty) {
        _lastErrorMessage = '用户未登录，请返回重试';
        return false;
      }
      final userId = userIdResult.data!;
      
      // 获取JWT token
      final token = _storageService.getAuthToken();
      if (token == null || token.isEmpty) {
        _lastErrorMessage = '认证失败，请重新登录';
        return false;
      }
      
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
              'Authorization': 'Bearer $token',
            },
            body: json.encode({'user_id': userId}),
          ).timeout(
            const Duration(seconds: 10),
            onTimeout: () {
              throw Exception('请求超时，请检查网络连接');
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
        _lastErrorMessage = lastError?.toString() ?? '网络连接失败，请检查网络设置或稍后重试';
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
          _storageService.saveLastCheckInDate(today);
          setState(() {
            _hasCheckedInToday = true;
          });
          return true;
        } else {
          // 检查是否是今日已签到
          if (data['data'] != null && data['data']['alreadyCheckedIn'] == true) {
            _lastErrorMessage = 'You have already checked in today';
            final today = DateTime.now().toIso8601String().split('T')[0];
            _storageService.saveLastCheckInDate(today);
            setState(() {
              _hasCheckedInToday = true;
            });
          } else {
            _lastErrorMessage = data['message'] ?? '签到失败，请稍后重试';
          }
          print('❌ API返回失败: ${data['message']}');
          return false;
        }
      } else {
        _lastErrorMessage = '签到失败，请稍后重试';
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
        _lastErrorMessage = '用户未登录，请返回重试';
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
            const Duration(seconds: 10),
            onTimeout: () {
              throw Exception('请求超时，请检查网络连接');
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
        _lastErrorMessage = lastError?.toString() ?? '网络连接失败，请检查网络设置或稍后重试';
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
          _lastErrorMessage = data['message'] ?? '奖励领取失败，请稍后重试';
          print('❌ API返回失败: ${data['message']}');
          return false;
        }
      } else {
        _lastErrorMessage = '服务器错误 (${response.statusCode})';
        print('❌ 延长合约失败 (${response.statusCode}): ${response.body}');
        return false;
      }
    } catch (e) {
      _lastErrorMessage = '网络连接失败，请检查网络设置或稍后重试';
      print('❌ 调用API异常: $e');
      return false;
    }
  }

  void _startWatchingAd() {
    setState(() {
      _isWatchingAd = true;
    });

    // 模拟广告播放倒计时
    Future.doWhile(() async {
      if (_countdown > 0 && _isWatchingAd) {
        await Future.delayed(const Duration(seconds: 1));
        if (mounted && _isWatchingAd) {
          setState(() {
            _countdown--;
          });
        }
        return true;
      } else {
        if (mounted && _isWatchingAd) {
          _showRewardDialog();
        }
        return false;
      }
    });
  }

  void _showRewardDialog() {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) => Dialog(
        backgroundColor: Colors.white,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
        ),
        child: Padding(
          padding: const EdgeInsets.all(24),
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
              
              // Contract 奖励行
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
                        style: TextStyle(
                          color: Colors.black,
                          fontSize: widget.isDailyCheckIn ? 15 : 18,
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
              
              // Power 奖励行
              Container(
                padding: const EdgeInsets.symmetric(vertical: 16),
                child: Row(
                  children: [
                    // 自定义电池图标（与Mining Pool一致）
                    Container(
                      width: 40,
                      height: 40,
                      decoration: BoxDecoration(
                        color: const Color(0xFFFF9800), // 橙色，与mining pool一致
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
                                color: Colors.white,
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
                                  color: Colors.white,
                                  width: 1.5,
                                ),
                              ),
                              child: Column(
                                children: [
                                  // Level 4 (top) - filled
                                  Expanded(
                                    child: Container(
                                      margin: const EdgeInsets.all(1),
                                      decoration: BoxDecoration(
                                        color: Colors.white,
                                        borderRadius: BorderRadius.circular(1),
                                      ),
                                    ),
                                  ),
                                  const SizedBox(height: 0.5),
                                  // Level 3 - filled
                                  Expanded(
                                    child: Container(
                                      margin: const EdgeInsets.all(1),
                                      decoration: BoxDecoration(
                                        color: Colors.white,
                                        borderRadius: BorderRadius.circular(1),
                                      ),
                                    ),
                                  ),
                                  const SizedBox(height: 0.5),
                                  // Level 2 - filled
                                  Expanded(
                                    child: Container(
                                      margin: const EdgeInsets.all(1),
                                      decoration: BoxDecoration(
                                        color: Colors.white,
                                        borderRadius: BorderRadius.circular(1),
                                      ),
                                    ),
                                  ),
                                  const SizedBox(height: 0.5),
                                  // Level 1 (bottom) - filled
                                  Expanded(
                                    child: Container(
                                      margin: const EdgeInsets.all(1),
                                      decoration: BoxDecoration(
                                        color: Colors.white,
                                        borderRadius: BorderRadius.circular(1),
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
              const SizedBox(height: 16),
              
              // Continue 按钮
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: _isProcessing ? null : () async {
                    // 如果是签到且今日已签到，直接显示提示
                    if (widget.isDailyCheckIn && _hasCheckedInToday) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(
                          content: Text('⚠️ You have already checked in today'),
                          backgroundColor: Colors.orange,
                          duration: Duration(seconds: 3),
                        ),
                      );
                      return;
                    }
                    
                    setState(() {
                      _isProcessing = true;
                    });
                    
                    // 📌 根据类型调用不同的API
                    bool success = widget.isDailyCheckIn 
                        ? await _performCheckIn()  // 签到API
                        : await _extendContract(); // 延长合约API
                    
                    if (mounted) {
                      setState(() {
                        _isProcessing = false;
                      });
                      
                      if (success) {
                        // 先关闭对话框
                        Navigator.pop(context); // 关闭对话框
                        
                        // 立即显示成功提示（在主界面显示，不被对话框遮挡）
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(
                            content: Text(widget.isDailyCheckIn 
                                ? '✅ 签到成功，已激活Daily Check-in合约！' 
                                : '✅ 奖励已领取，合约已延长！'),
                            backgroundColor: Colors.green,
                            duration: const Duration(seconds: 2),
                          ),
                        );
                        
                        if (widget.isDailyCheckIn) {
                          // 📌 签到成功后：通知HomeScreen切换到Contracts标签
                          Navigator.pop(context, {'action': 'switchToContracts'}); // 返回并传递切换指令
                        } else {
                          // 广告奖励成功后返回Mining页面
                          Navigator.pop(context, true); // 返回成功标志
                        }
                      } else {
                        // 失败提示
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(
                            content: Text('⚠️ ${_lastErrorMessage ?? '网络连接失败，请检查网络设置或稍后重试'}'),
                            backgroundColor: Colors.red,
                            duration: Duration(seconds: 4),
                          ),
                        );
                      }
                    }
                  },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(8),
                    ),
                  ),
                  child: _isProcessing 
                    ? const SizedBox(
                        height: 20,
                        width: 20,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                        ),
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
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('观看广告获取奖励'),
        backgroundColor: AppColors.cardDark,
      ),
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              if (!_isWatchingAd) ...[
                Container(
                  padding: const EdgeInsets.all(32),
                  decoration: BoxDecoration(
                    color: AppColors.cardDark,
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: Column(
                    children: [
                      Icon(
                        Icons.play_circle_outline,
                        size: 80,
                        color: AppColors.primary,
                      ),
                      const SizedBox(height: 24),
                      Text(
                        '观看3秒广告',
                        style: TextStyle(
                          color: AppColors.textPrimary,
                          fontSize: 20,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        '获得 7.5 Gh/s 挖矿算力奖励',
                        style: TextStyle(
                          color: AppColors.textSecondary,
                          fontSize: 14,
                        ),
                      ),
                      const SizedBox(height: 32),
                      ElevatedButton(
                        onPressed: _startWatchingAd,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppColors.primary,
                          foregroundColor: Colors.black87,
                          padding: const EdgeInsets.symmetric(
                            horizontal: 48,
                            vertical: 16,
                          ),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12),
                          ),
                        ),
                        child: const Text(
                          '开始观看',
                          style: TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ] else ...[
                Container(
                  padding: const EdgeInsets.all(32),
                  decoration: BoxDecoration(
                    color: AppColors.cardDark,
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: Column(
                    children: [
                      Stack(
                        alignment: Alignment.center,
                        children: [
                          SizedBox(
                            width: 120,
                            height: 120,
                            child: CircularProgressIndicator(
                              value: 1 - (_countdown / 30),
                              strokeWidth: 8,
                              backgroundColor: AppColors.surface,
                              valueColor: AlwaysStoppedAnimation<Color>(
                                AppColors.primary,
                              ),
                            ),
                          ),
                          Text(
                            '$_countdown',
                            style: TextStyle(
                              color: AppColors.textPrimary,
                              fontSize: 32,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 24),
                      Text(
                        '正在播放广告...',
                        style: TextStyle(
                          color: AppColors.textPrimary,
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        '请勿关闭页面',
                        style: TextStyle(
                          color: AppColors.textSecondary,
                          fontSize: 14,
                        ),
                      ),
                      const SizedBox(height: 24),
                      // 模拟广告内容区域
                      Container(
                        width: double.infinity,
                        height: 200,
                        decoration: BoxDecoration(
                          color: AppColors.surface,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(
                            color: AppColors.divider,
                            width: 1,
                          ),
                        ),
                        child: Center(
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(
                                Icons.videocam,
                                size: 48,
                                color: AppColors.textSecondary,
                              ),
                              const SizedBox(height: 8),
                              Text(
                                '广告内容区域',
                                style: TextStyle(
                                  color: AppColors.textSecondary,
                                  fontSize: 14,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  @override
  void dispose() {
    _isWatchingAd = false;
    super.dispose();
  }
}
