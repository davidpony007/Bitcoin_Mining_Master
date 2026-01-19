import 'package:dio/dio.dart';
import '../constants/app_constants.dart';
import '../models/user_model.dart';

/// API服务类 - 对应Kotlin的ApiService
class ApiService {
  late final Dio _dio;
  
  ApiService() {
    _dio = Dio(BaseOptions(
      baseUrl: ApiConstants.baseUrl,
      connectTimeout: Duration(seconds: ApiConstants.connectTimeout),
      receiveTimeout: Duration(seconds: ApiConstants.receiveTimeout),
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    ));
    
    // 添加拦截器用于日志
    _dio.interceptors.add(LogInterceptor(
      request: true,
      requestHeader: true,
      requestBody: true,
      responseHeader: true,
      responseBody: true,
      error: true,
    ));
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
    try {
      final response = await _dio.post(
        ApiConstants.deviceLogin,
        data: {
          'android_id': androidId,
          if (referrerInvitationCode != null) 'referrer_invitation_code': referrerInvitationCode,
          if (gaid != null) 'gaid': gaid,
          if (country != null) 'country': country,
          if (email != null) 'email': email,
        },
      );
      return DeviceLoginResponse.fromJson(response.data);
    } on DioException catch (e) {
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
        data: {
          'user_id': userId,
          'google_account': googleAccount,
        },
      );
      return response.data;
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  /// 解绑Google账号 - 对应后端 /api/auth/unbind-google
  Future<Map<String, dynamic>> unbindGoogle({
    required String userId,
  }) async {
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
        data: {
          'user_id': userId,
          'contract_id': contractId,
        },
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
    required String amount,
    required String address,
  }) async {
    try {
      final response = await _dio.post(
        ApiConstants.withdrawBitcoin,
        data: {
          'userId': userId,
          'amount': amount,
          'address': address,
        },
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
        queryParameters: {'userId': userId},
      );
      
      final List<dynamic> data = response.data['transactions'] ?? [];
      return data.map((json) => Transaction.fromJson(json)).toList();
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  /// 检查用户是否有活跃的挖矿合约
  Future<Map<String, dynamic>> checkActiveContracts(String userId) async {
    try {
      final response = await _dio.get(
        '/contract-status/has-active/$userId',
      );
      return response.data;
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  /// 获取用户的合约详情（My Contract页面）
  Future<Map<String, dynamic>> getMyContracts(String userId) async {
    try {
      final response = await _dio.get(
        '/contract-status/my-contracts/$userId',
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
}
