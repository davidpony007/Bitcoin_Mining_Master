import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:fluttertoast/fluttertoast.dart';
import 'dart:io' show Platform;
import 'dart:ui' as ui;
import 'package:package_info_plus/package_info_plus.dart';
import '../constants/app_constants.dart';
import '../models/user_model.dart';
import 'storage_service.dart';

/// API服务类 - 对应Kotlin的ApiService
class ApiService {
  late final Dio _dio;

  /// 获取设备 locale 国家码（方案B：最贴近 AdMob 归因国家）
  static String getDeviceCountryCode() {
    try {
      final locale = ui.PlatformDispatcher.instance.locale;
      final code = locale.countryCode ?? '';
      if (code.isNotEmpty) return code.toUpperCase();
      if (!kIsWeb) {
        final localeName = Platform.localeName;
        if (localeName.contains('_')) {
          return localeName.split('_').last.split('@').first.toUpperCase();
        }
      }
      return '';
    } catch (_) {
      return '';
    }
  }

  ApiService() {
    // iOS 上 VPN 会延迟 HTTP 回包，接收超时用 60s；Android / 其他平台用 30s
    final int effectiveReceiveTimeout =
        !kIsWeb && Platform.isIOS ? 60 : ApiConstants.receiveTimeout;

    _dio = Dio(
      BaseOptions(
        baseUrl: ApiConstants.baseUrl,
        connectTimeout: Duration(seconds: ApiConstants.connectTimeout),
        receiveTimeout: Duration(seconds: effectiveReceiveTimeout),
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      ),
    );

    // 添加拦截器用于日志
    _dio.interceptors.add(
      LogInterceptor(
        request: true,
        requestHeader: true,
        requestBody: true,
        responseHeader: true,
        responseBody: true,
        error: true,
      ),
    );

    // 自动注入 JWT token
    _dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) {
          final token = StorageService().getAuthToken();
          if (token != null && token.isNotEmpty) {
            options.headers['Authorization'] = 'Bearer $token';
          }
          handler.next(options);
        },
      ),
    );
  }

  List<String> _getAndroidFallbackBaseUrls() {
    if (kIsWeb) {
      return [ApiConstants.baseUrl];
    }
    if (Platform.isAndroid) {
      return ['http://10.0.2.2:8888/api', 'http://127.0.0.1:8888/api'];
    }
    return [ApiConstants.baseUrl];
  }

  void _switchBaseUrl(String baseUrl) {
    _dio.options.baseUrl = baseUrl;
  }

  /// 设备登录/注册 - 对应后端 /api/auth/device-login
  /// 首次打开APP时自动创建账号或登录
  Future<DeviceLoginResponse> deviceLogin({
    required String deviceId,
    String? referrerInvitationCode,
    String? installReferrer, // Android Play Store install referrer (utm_source=xxx&...)
    String? gaid,
    String? country,
    String? email,
  }) async {
    // 获取当前 App 版本信息，登录时同步到服务端
    String? appVersion;
    int? appBuildNumber;
    try {
      final info = await PackageInfo.fromPlatform();
      appVersion = info.version;
      appBuildNumber = int.tryParse(info.buildNumber);
    } catch (_) {
      // 获取失败不阻断登录
    }

    final payload = {
      'android_id': deviceId,
      if (referrerInvitationCode != null)
        'referrer_invitation_code': referrerInvitationCode,
      if (installReferrer != null) 'install_referrer': installReferrer,
      if (gaid != null) 'gaid': gaid,
      if (country != null) 'country': country,
      if (email != null) 'email': email,
      if (appVersion != null) 'app_version': appVersion,
      if (appBuildNumber != null) 'app_build_number': appBuildNumber,
    };

    try {
      final response = await _dio.post(ApiConstants.deviceLogin, data: payload);
      return DeviceLoginResponse.fromJson(response.data);
    } on DioException catch (e) {
      // Android环境尝试回退地址
      final fallbacks = _getAndroidFallbackBaseUrls();
      for (final baseUrl in fallbacks) {
        if (baseUrl == _dio.options.baseUrl) {
          continue;
        }
        try {
          _switchBaseUrl(baseUrl);
          final response = await _dio.post(
            ApiConstants.deviceLogin,
            data: payload,
          );
          return DeviceLoginResponse.fromJson(response.data);
        } catch (_) {
          // 继续尝试下一个
        }
      }
      throw _handleError(e);
    }
  }

  /// 绑定Google账号 - 对应后端 /api/auth/bind-google
  Future<Map<String, dynamic>> bindGoogle({
    required String userId,
    required String googleAccount,
  }) async {
    try {
      final response = await _dio.post(
        ApiConstants.bindGoogle,
        data: {'user_id': userId, 'google_account': googleAccount},
      );
      return response.data;
    } on DioException catch (e) {
      // 如果是400错误，返回后端的错误信息，而不是抛出异常
      if (e.response?.statusCode == 400 && e.response?.data != null) {
        print('❌ bindGoogle API返回400: ${e.response?.data}');
        return {
          'success': false,
          'error': e.response?.data['error'] ?? 'Failed to bind Google account',
          'message': e.response?.data['message'] ?? e.response?.data['error'] ?? 'Unknown error',
        };
      }
      throw _handleError(e);
    }
  }

  /// 绑定Google账号（完整信息）- 对应后端 /api/auth/bind-google
  Future<Map<String, dynamic>> bindGoogleAccount({
    required String userId,
    required String? googleId,
    required String googleEmail,
    required String googleName,
  }) async {
    try {
      final response = await _dio.post(
        ApiConstants.bindGoogle,
        data: {
          'user_id': userId,
          'google_account': googleEmail,
          'google_id': googleId,
          'google_name': googleName,
        },
      );
      return response.data;
    } on DioException catch (e) {
      // 如果是400错误，返回后端的错误信息，而不是抛出异常
      if (e.response?.statusCode == 400 && e.response?.data != null) {
        print('❌ bindGoogleAccount API返回400: ${e.response?.data}');
        return {
          'success': false,
          'error': e.response?.data['error'] ?? 'Failed to bind Google account',
          'message': e.response?.data['message'] ?? e.response?.data['error'] ?? 'Unknown error',
        };
      }
      throw _handleError(e);
    }
  }

  /// Google登录或创建用户 - 对应后端 /api/auth/google-login-create
  /// 如果Google账号已绑定用户则登录，否则创建新用户
  Future<Map<String, dynamic>> googleLoginOrCreate({
    required String? googleId,
    required String googleEmail,
    required String googleName,
    String? deviceId,
    String? gaid,
    String? country,
    String? system,
  }) async {
    String? appVersion;
    int? appBuildNumber;
    try {
      final info = await PackageInfo.fromPlatform();
      appVersion = info.version;
      appBuildNumber = int.tryParse(info.buildNumber);
    } catch (_) {}
    try {
      final requestData = {
        'google_id': googleId,
        'google_account': googleEmail,
        'google_name': googleName,
        'device_id': deviceId,
        'gaid': gaid,
        'country': country,
        'device_country': getDeviceCountryCode(), // 方案B：设备locale国家，最贴近AdMob归因
        if (system != null) 'system': system,
        if (appVersion != null) 'app_version': appVersion,
        if (appBuildNumber != null) 'app_build_number': appBuildNumber,
      };
      
      print('📤 [API] 发送Google登录请求到后端:');
      print('   URL: ${ApiConstants.googleLoginCreate}');
      print('   Data: $requestData');
      
      final response = await _dio.post(
        ApiConstants.googleLoginCreate,
        data: requestData,
      );
      
      print('📥 [API] 后端响应: ${response.data}');
      return response.data;
    } on DioException catch (e) {
      // 如果是400错误，返回后端的错误信息，而不是抛出异常
      if (e.response?.statusCode == 400 && e.response?.data != null) {
        print('❌ googleLoginOrCreate API返回400: ${e.response?.data}');
        return {
          'success': false,
          'error': e.response?.data['error'] ?? 'Failed to switch account',
          'message': e.response?.data['message'] ?? e.response?.data['error'] ?? 'Unknown error',
        };
      }
      throw _handleError(e);
    }
  }

  /// Apple登录或创建用户 - 对应后端 /api/auth/apple-login-create
  Future<Map<String, dynamic>> appleLoginOrCreate({
    required String appleId,
    String? appleAccount,
    String? appleName,
    String? iosDeviceId,
    String? idfv,
    String? idfa,
    int? attStatus,
    String? country,
    String? identityToken,
  }) async {
    String? appVersion;
    int? appBuildNumber;
    try {
      final info = await PackageInfo.fromPlatform();
      appVersion = info.version;
      appBuildNumber = int.tryParse(info.buildNumber);
    } catch (_) {}
    try {
      final requestData = {
        'apple_id':       appleId,
        'apple_account':  appleAccount,
        'apple_name':     appleName,
        'ios_device_id':  iosDeviceId,
        'idfv':           idfv,
        'idfa':           idfa,
        'att_status':     attStatus,
        'country':        country,
        if (identityToken != null) 'identity_token': identityToken,
        if (appVersion != null) 'app_version': appVersion,
        if (appBuildNumber != null) 'app_build_number': appBuildNumber,
      };
      print('📤 [API] 发送 Apple 登录请求到后端: $requestData');
      final response = await _dio.post(
        ApiConstants.appleLoginCreate,
        data: requestData,
      );
      print('📥 [API] Apple 登录后端响应: ${response.data}');
      return response.data;
    } on DioException catch (e) {
      if (e.response?.statusCode == 400 && e.response?.data != null) {
        return {
          'success': false,
          'error':   e.response?.data['error']   ?? 'Apple sign-in failed',
          'message': e.response?.data['message'] ?? e.response?.data['error'] ?? 'Unknown error',
        };
      }
      throw _handleError(e);
    }
  }

  /// 绑定 Apple 账号到访客用户 - 对应后端 /api/auth/bind-apple
  Future<Map<String, dynamic>> bindApple({
    required String userId,
    required String appleId,
    String? appleAccount,
    String? identityToken,
  }) async {
    try {
      final response = await _dio.post(
        ApiConstants.bindApple,
        data: {
          'user_id': userId,
          'apple_id': appleId,
          'apple_account': appleAccount,
          if (identityToken != null) 'identity_token': identityToken,
        },
      );
      return response.data;
    } on DioException catch (e) {
      if (e.response?.statusCode == 400 && e.response?.data != null) {
        print('❌ bindApple API返回400: ${e.response?.data}');
        return {
          'success': false,
          'error': e.response?.data['error'] ?? 'Failed to bind Apple account',
          'message': e.response?.data['message'] ?? e.response?.data['error'] ?? 'Unknown error',
        };
      }
      throw _handleError(e);
    }
  }

  /// 解绑Google账号 - 对应后端 /api/auth/unbind-google
  Future<Map<String, dynamic>> unbindGoogle({required String userId}) async {
    try {
      final response = await _dio.post(
        ApiConstants.unbindGoogle,
        data: {'user_id': userId},
      );
      return response.data;
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  /// 获取Google账号绑定状态 - 对应后端 /api/auth/google-binding-status/:userId
  Future<Map<String, dynamic>> getGoogleBindingStatus(String userId) async {
    try {
      final response = await _dio.get(
        '${ApiConstants.googleBindingStatus}/$userId',
      );
      return response.data;
    } on DioException catch (e) {
      print('❌ getGoogleBindingStatus API错误: ${e.message}');
      throw _handleError(e);
    }
  }

  /// 获取 Apple 账号绑定状态 - 对应后端 /api/auth/apple-binding-status/:userId
  Future<Map<String, dynamic>> getAppleBindingStatus(String userId) async {
    try {
      final response = await _dio.get('${ApiConstants.appleBindingStatus}/$userId');
      return response.data;
    } on DioException catch (e) {
      print('❌ getAppleBindingStatus API错误: ${e.message}');
      throw _handleError(e);
    }
  }

  /// 获取用户状态 - 对应后端 /api/auth/user-status
  Future<Map<String, dynamic>> getUserStatus(String userId) async {
    try {
      final response = await _dio.get(
        ApiConstants.userStatus,
        queryParameters: {'user_id': userId},
      );
      return response.data;
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  /// 查询账户禁用状态 - 对应后端 /api/auth/ban-status
  Future<Map<String, dynamic>> checkBanStatus(String userId) async {
    try {
      final response = await _dio.get(
        ApiConstants.banStatus,
        queryParameters: {'user_id': userId},
      );
      return response.data;
    } on DioException catch (e) {
      print('❌ checkBanStatus API错误: ${e.message}');
      throw _handleError(e);
    }
  }

  /// 获取邀请关系信息 - 对应后端 /api/auth/invitation-info
  Future<Map<String, dynamic>> getInvitationInfo(String userId) async {
    try {
      final response = await _dio.get(
        ApiConstants.invitationInfo,
        queryParameters: {'user_id': userId},
      );
      return response.data;
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  /// 查询邀请返利记录
  Future<Map<String, dynamic>> getInvitationRebate(String userId, {int page = 1, int limit = 20}) async {
    try {
      final response = await _dio.get(
        ApiConstants.invitationRebate,
        queryParameters: {'user_id': userId, 'page': page, 'limit': limit},
      );
      return response.data;
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  /// 后期添加推荐人 - 对应后端 /api/auth/add-referrer
  Future<Map<String, dynamic>> addReferrer({
    required String userId,
    required String referrerInvitationCode,
  }) async {
    try {
      final response = await _dio.post(
        ApiConstants.addReferrer,
        data: {
          'user_id': userId,
          'referrer_invitation_code': referrerInvitationCode,
        },
      );
      return response.data;
    } on DioException catch (e) {
      // 4xx 响应：直接返回后端的 JSON data，保留 errorCode 供上层判断
      if (e.type == DioExceptionType.badResponse && e.response?.data is Map) {
        return Map<String, dynamic>.from(e.response!.data as Map);
      }
      throw _handleError(e);
    }
  }

  /// 创建免费广告合约 - 对应后端 /api/auth/create-ad-contract
  Future<Map<String, dynamic>> createAdFreeContract({
    required String userId,
  }) async {
    try {
      final response = await _dio.post(
        ApiConstants.createAdContract,
        data: {'user_id': userId},
      );
      return response.data;
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  /// 激活免费广告合约 - 对应后端 /api/auth/activate-ad-contract
  Future<Map<String, dynamic>> activateAdFreeContract({
    required String userId,
    required int contractId,
  }) async {
    try {
      final response = await _dio.post(
        ApiConstants.activateAdContract,
        data: {'user_id': userId, 'contract_id': contractId},
      );
      return response.data;
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  /// 邮箱+密码登录 - 对应后端 /api/auth/email-login
  Future<Map<String, dynamic>> emailLogin({
    required String email,
    required String password,
  }) async {
    try {
      final response = await _dio.post(
        '/auth/email-login',
        data: {
          'email': email,
          'password': password,
        },
      );
      return response.data;
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  /// 邮箱注册 - 对应后端 /api/auth/email-register
  Future<Map<String, dynamic>> emailRegister({
    required String email,
    required String password,
    String? referrerInvitationCode,
  }) async {
    try {
      final payload = {
        'email': email,
        'password': password,
      };
      
      if (referrerInvitationCode != null && referrerInvitationCode.isNotEmpty) {
        payload['referrer_invitation_code'] = referrerInvitationCode;
      }
      
      final response = await _dio.post(
        '/auth/email-register',
        data: payload,
      );
      return response.data;
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  /// 生成用户ID（已废弃，改用deviceLogin）
  @Deprecated('Use deviceLogin instead')
  Future<UserIdResponse> generateUserId() async {
    try {
      final response = await _dio.post(ApiConstants.deviceLogin);
      return UserIdResponse.fromJson(response.data);
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  /// 获取比特币余额（实时余额，包含未持久化的挖矿收益）
  Future<BitcoinBalanceResponse> getBitcoinBalance(String userId) async {
    try {
      final response = await _dio.get(
        '${ApiConstants.getBitcoinBalance}/$userId',
      );
      print('🔍 API 响应完整数据: ${response.data}');
      return BitcoinBalanceResponse.fromJson(response.data);
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  /// 提现比特币
  Future<Map<String, dynamic>> withdrawBitcoin({
    required String userId,
    required String email,
    required String amount,
    required String address,
    required String network,
    required String networkFee,
    String? googleAccount,
    String? appleAccount,
  }) async {
    try {
      // 显式获取 token 并注入 Authorization header（与拦截器双重保障）
      final token = StorageService().getAuthToken();
      print('[Withdrawal] token=${token != null ? "present(${token.length}chars)" : "NULL"}');
      if (token == null || token.isEmpty) {
        throw Exception('Authentication required. Please restart the app and try again.');
      }
      final response = await _dio.post(
        ApiConstants.withdrawRequest,
        data: {
          'userId': userId,
          'email': email,
          'walletAddress': address,
          'amount': amount,
          'network': network,
          'networkFee': networkFee,
          if (googleAccount != null) 'googleAccount': googleAccount,
          if (appleAccount != null) 'appleAccount': appleAccount,
        },
        options: Options(headers: {'Authorization': 'Bearer $token'}),
      );
      return response.data;
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  /// 获取提现历史记录
  Future<Map<String, dynamic>> getWithdrawalHistory({
    required String userId,
    String status = 'all',
    int limit = 20,
    int offset = 0,
  }) async {
    try {
      final response = await _dio.get(
        ApiConstants.withdrawHistory,
        queryParameters: {
          'userId': userId,
          'status': status,
          'limit': limit,
          'offset': offset,
        },
      );
      return response.data;
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  /// 获取单个提现记录详情
  Future<Map<String, dynamic>> getWithdrawalDetail({
    required String withdrawalId,
    String? userId,
  }) async {
    try {
      final response = await _dio.get(
        '${ApiConstants.withdrawDetail}/$withdrawalId',
        queryParameters: userId != null ? {'userId': userId} : null,
      );
      return response.data;
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  /// 获取交易记录
  Future<Map<String, dynamic>> getTransactions(
    String userId, {
    int limit = 20,
    int offset = 0,
    String type = 'all',
  }) async {
    try {
      final response = await _dio.get(
        ApiConstants.getTransactions,
        queryParameters: {
          'userId': userId,
          'limit': limit,
          'offset': offset,
          if (type != 'all') 'type': type,
        },
      );

      if (response.data['success'] == true) {
        final List<dynamic> data = response.data['data']['records'] ?? [];
        final pagination = response.data['data']['pagination'] ?? {};
        return {
          'records': data.map((json) => Transaction.fromJson(json)).toList(),
          'total': pagination['total'] ?? 0,
          'hasMore': pagination['hasMore'] ?? false,
        };
      }
      return {'records': <Transaction>[], 'total': 0, 'hasMore': false};
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  /// 检查用户是否有活跃的挖矿合约
  Future<Map<String, dynamic>> checkActiveContracts(String userId) async {
    try {
      final response = await _dio.get('/contract-status/has-active/$userId');
      return response.data;
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  /// 获取用户的合约详情（My Contract页面）
  Future<Map<String, dynamic>> getMyContracts(String userId) async {
    try {
      final response = await _dio.get('/contract-status/my-contracts/$userId');
      return response.data;
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  /// 获取用户等级信息 - 对应后端 /api/level/info
  Future<Map<String, dynamic>> getUserLevel(String userId) async {
    try {
      final response = await _dio.get(
        '/level/info',
        queryParameters: {'user_id': userId},
      );
      return response.data;
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  /// 错误处理
  // 静态防抖：多个并发请求同时失败时（如从后台恢复），只弹一次 toast
  // 声明为 public 以供 user_provider.dart 共用同一个防抖时间戳
  static DateTime? lastNetworkErrorToastTime;

  // App 从后台恢复的时间戳：恢复后 3 秒内的网络错误为正常抖动，静默处理不弹 Toast
  static DateTime? _lastResumeTime;
  static const int _resumeSilenceSeconds = 3;

  /// 由 main.dart 在 AppLifecycleState.resumed 时调用，记录恢复时间
  static void notifyAppResumed() {
    _lastResumeTime = DateTime.now();
  }

  /// 判断当前是否处于从后台恢复的静默窗口期
  static bool get isInResumeSilenceWindow {
    final t = _lastResumeTime;
    if (t == null) return false;
    return DateTime.now().difference(t).inSeconds < _resumeSilenceSeconds;
  }

  Exception _handleError(DioException error) {
    final bool isNetworkError =
        error.type == DioExceptionType.connectionTimeout ||
        error.type == DioExceptionType.sendTimeout ||
        error.type == DioExceptionType.receiveTimeout ||
        error.type == DioExceptionType.connectionError;

    // receive timeout：连接成功但无响应——通常由 VPN 拦截 HTTP 回包导致
    final bool isReceiveTimeout = error.type == DioExceptionType.receiveTimeout;

    if (isNetworkError) {
      // 从后台恢复后 3 秒静默窗口内不弹 Toast（网络重建的正常抖动）
      if (!isInResumeSilenceWindow) {
        final now = DateTime.now();
        final lastShown = lastNetworkErrorToastTime;
        // 5 秒内只弹一次，避免多个并发请求同时失败时重复弹出
        if (lastShown == null || now.difference(lastShown).inSeconds >= 5) {
          lastNetworkErrorToastTime = now;
          final msg = isReceiveTimeout
              ? 'Connection timed out. If you have a VPN enabled, please disable it and try again.'
              : 'Network connection error, please try again!';
          Fluttertoast.showToast(
            msg: msg,
            toastLength: Toast.LENGTH_LONG,
            gravity: ToastGravity.CENTER,
          );
        }
      }
    }

    switch (error.type) {
      case DioExceptionType.receiveTimeout:
        return Exception('Connection timed out. If you have a VPN enabled, please disable it and try again.');
      case DioExceptionType.connectionTimeout:
      case DioExceptionType.sendTimeout:
        return Exception('Network connection error, please try again!');
      case DioExceptionType.badResponse:
        final data = error.response?.data;
        if (data is Map && data['message'] is String && (data['message'] as String).isNotEmpty) {
          return Exception(data['message'] as String);
        }
        return Exception('Server error: ${error.response?.statusCode}');
      case DioExceptionType.cancel:
        return Exception('Request cancelled');
      default:
        return Exception('Network connection error, please try again!');
    }
  }

  /// 获取比特币实时价格
  Future<Map<String, dynamic>> getBitcoinPrice() async {
    try {
      final response = await _dio.get('/bitcoin/price');
      return response.data as Map<String, dynamic>;
    } on DioException catch (e) {
      // Android环境尝试回退地址
      final fallbacks = _getAndroidFallbackBaseUrls();
      for (final baseUrl in fallbacks) {
        if (baseUrl == _dio.options.baseUrl) {
          continue;
        }
        try {
          _switchBaseUrl(baseUrl);
          final response = await _dio.get('/bitcoin/price');
          return response.data as Map<String, dynamic>;
        } catch (_) {
          // 继续尝试下一个
        }
      }
      // 价格获取失败时静默抛出，不弹出 Toast（调用方已有 try/catch 兜底）
      throw Exception('Bitcoin price fetch failed: ${e.message}');
    }
  }

  /// 延长广告奖励合约（Free Ad Reward）
  Future<Map<String, dynamic>> extendAdRewardContract({
    required String userId,
    required int hours,
  }) async {
    try {
      final response = await _dio.post(
        '/mining-pool/extend-contract',
        data: {
          'user_id': userId,
          'hours': hours,
        },
      );
      return response.data as Map<String, dynamic>;
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  /// 执行每日签到（Daily Check-in）
  Future<Map<String, dynamic>> performCheckIn({
    required String userId,
  }) async {
    try {
      print('📡 [API Service] 调用签到API: /check-in/daily, userId=$userId');
      final response = await _dio.post(
        '/check-in/daily',
        data: {
          'user_id': userId,
          'device_country': getDeviceCountryCode(), // 方案B：设备locale国家，最贴近AdMob归因
        },
      );
      print('✅ [API Service] 签到API响应: ${response.data}');
      return response.data as Map<String, dynamic>;
    } on DioException catch (e) {
      // 检查是否是"今日已签到"的情况（服务端返回 HTTP 400）
      if (e.response?.statusCode == 400 && e.response?.data != null) {
        final responseData = e.response!.data;
        // 兼容顶层 alreadyCheckedIn 和嵌套在 data 字段内的情况
        final alreadyCheckedIn = (responseData is Map) &&
            (responseData['alreadyCheckedIn'] == true ||
                (responseData['data'] is Map &&
                    responseData['data']['alreadyCheckedIn'] == true));
        if (alreadyCheckedIn) {
          print('ℹ️ [API Service] 检测到今日已签到，返回特殊标记');
          return {
            'success': true,
            'alreadyCheckedIn': true,
            'message': (responseData is Map ? responseData['message'] : null) ??
                'Already checked in today'
          };
        }
      }
      print('❌ [API Service] 签到API错误: ${e.response?.data ?? e.message}');
      throw _handleError(e);
    }
  }

  /// 更新用户昵称
  Future<Map<String, dynamic>> updateNickname({
    required String userId,
    required String nickname,
  }) async {
    try {
      print('🔧 [updateNickname] 开始请求');
      print('🔧 userId: $userId');
      print('🔧 nickname: $nickname');
      print('🔧 baseUrl: ${_dio.options.baseUrl}');
      print('🔧 完整URL: ${_dio.options.baseUrl}/userInformation/$userId/nickname');
      
      final response = await _dio.put(
        '/userInformation/$userId/nickname',
        data: {'nickname': nickname},
      );
      
      print('🔧 [updateNickname] 响应成功: ${response.data}');
      return response.data as Map<String, dynamic>;
    } on DioException catch (e) {
      print('🔧 [updateNickname] 请求失败: ${e.type}');
      print('🔧 错误信息: ${e.message}');
      print('🔧 响应: ${e.response?.data}');
      throw _handleError(e);
    } catch (e) {
      print('🔧 [updateNickname] 未知错误: $e');
      rethrow;
    }
  }

  /// 检查App版本更新
  /// [platform] 'android' 或 'ios'
  /// [currentVersion] 当前版本号，如 '1.0.1'
  Future<Map<String, dynamic>> checkAppVersion({
    required String platform,
    required String currentVersion,
  }) async {
    try {
      final response = await _dio.get(
        ApiConstants.appConfig,
        queryParameters: {
          'platform': platform,
          'current_version': currentVersion,
        },
      );
      return response.data as Map<String, dynamic>;
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }
}