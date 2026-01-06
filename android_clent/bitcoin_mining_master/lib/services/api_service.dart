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

  /// 生成用户ID
  Future<UserIdResponse> generateUserId() async {
    try {
      final response = await _dio.post(ApiConstants.generateUserId);
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

  /// 错误处理
  Exception _handleError(DioException error) {
    switch (error.type) {
      case DioExceptionType.connectionTimeout:
      case DioExceptionType.sendTimeout:
      case DioExceptionType.receiveTimeout:
        return Exception('连接超时，请检查网络');
      case DioExceptionType.badResponse:
        return Exception('服务器错误: ${error.response?.statusCode}');
      case DioExceptionType.cancel:
        return Exception('请求已取消');
      default:
        return Exception('网络错误: ${error.message}');
    }
  }
}
