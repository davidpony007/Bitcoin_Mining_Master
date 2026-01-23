import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'dart:io' show Platform;
import '../constants/app_constants.dart';
import '../models/user_model.dart';

/// API服务类 - 对应Kotlin的ApiService
class ApiService {
  late final Dio _dio;

  ApiService() {
    _dio = Dio(
      BaseOptions(
        baseUrl: ApiConstants.baseUrl,
        connectTimeout: Duration(seconds: ApiConstants.connectTimeout),
        receiveTimeout: Duration(seconds: ApiConstants.receiveTimeout),
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
    required String androidId,
    String? referrerInvitationCode,
    String? gaid,
    String? country,
    String? email,
  }) async {
    final payload = {
      'android_id': androidId,
      if (referrerInvitationCode != null)
        'referrer_invitation_code': referrerInvitationCode,
      if (gaid != null) 'gaid': gaid,
      if (country != null) 'country': country,
      if (email != null) 'email': email,
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

  /// 获取比特币余额
  Future<BitcoinBalanceResponse> getBitcoinBalance(String userId) async {
    try {
      final response = await _dio.get(
        ApiConstants.getBitcoinBalance,
        queryParameters: {'userId': userId},
      );
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
  }) async {
    try {
      final response = await _dio.post(
        ApiConstants.withdrawRequest,
        data: {
          'userId': userId,
          'email': email,
          'walletAddress': address,
          'amount': amount,
          'network': network,
          'networkFee': networkFee,
        },
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
  Future<List<Transaction>> getTransactions(String userId) async {
    try {
      final response = await _dio.get(
        ApiConstants.getTransactions,
        queryParameters: {'userId': userId, 'limit': 100},
      );

      if (response.data['success'] == true) {
        final List<dynamic> data = response.data['data']['records'] ?? [];
        return data.map((json) => Transaction.fromJson(json)).toList();
      }
      return [];
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
  Exception _handleError(DioException error) {
    switch (error.type) {
      case DioExceptionType.connectionTimeout:
      case DioExceptionType.sendTimeout:
      case DioExceptionType.receiveTimeout:
        return Exception('Connection timeout, please check your network');
      case DioExceptionType.badResponse:
        return Exception('Server error: ${error.response?.statusCode}');
      case DioExceptionType.cancel:
        return Exception('Request cancelled');
      default:
        return Exception('Network error: ${error.message}');
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
      throw _handleError(e);
    }
  }
}
