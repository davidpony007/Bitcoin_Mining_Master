import 'package:dio/dio.dart';
import '../constants/app_constants.dart';
import '../models/points_model.dart';
import '../models/checkin_model.dart';
import '../services/storage_service.dart';
import '../services/user_repository.dart';

/// 积分系统API服务
class PointsApiService {
  late final Dio _dio;
  String? _token;
  final StorageService _storageService = StorageService();
  final UserRepository _userRepository = UserRepository();

  PointsApiService() {
    _dio = Dio(BaseOptions(
      baseUrl: ApiConstants.baseUrl,
      connectTimeout: Duration(seconds: ApiConstants.connectTimeout),
      receiveTimeout: Duration(seconds: ApiConstants.receiveTimeout),
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    ));

    _dio.interceptors.add(LogInterceptor(
      request: true,
      requestHeader: true,
      requestBody: true,
      responseBody: true,
      error: true,
    ));

    // 积分系统不需要JWT认证，只使用user_id参数
    // 已移除认证拦截器
  }

  /// 设置认证token
  void setToken(String token) {
    _token = token;
  }

  Future<String> _getUserId() async {
    final cached = _storageService.getUserId();
    if (cached != null && cached.isNotEmpty) {
      return cached;
    }
    final result = await _userRepository.fetchUserId();
    if (!result.isSuccess || result.data == null || result.data!.isEmpty) {
      throw Exception('User ID not found');
    }
    return result.data!;
  }

  // ==================== 积分相关 ====================

  /// 获取积分余额 GET /api/points/balance
  Future<PointsBalance> getPointsBalance() async {
    try {
      final userId = await _getUserId();
      final response = await _dio.get('/points/balance', queryParameters: {
        'user_id': userId,
      });
      if (response.data['success'] == true) {
        return PointsBalance.fromJson(response.data['data']);
      }
      throw Exception(response.data['message'] ?? 'Failed to get points balance');
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  /// 获取积分交易记录 GET /api/points/transactions
  Future<List<PointsTransaction>> getPointsTransactions({
    int page = 1,
    int pageSize = 20,
    String? type,
  }) async {
    try {
      final userId = await _getUserId();
      final response = await _dio.get('/points/transactions', queryParameters: {
        'user_id': userId,
        'page': page,
        'page_size': pageSize,
        if (type != null) 'type': type,
      });
      if (response.data['success'] == true) {
        final data = response.data['data'];
        final List<dynamic> transactions = data['transactions'] ?? [];
        return transactions.map((json) => PointsTransaction.fromJson(json)).toList();
      }
      throw Exception(response.data['message'] ?? 'Failed to get transaction records');
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  /// 获取积分统计 GET /api/points/statistics
  Future<PointsStatistics> getPointsStatistics() async {
    try {
      final userId = await _getUserId();
      final response = await _dio.get('/points/statistics', queryParameters: {
        'user_id': userId,
      });
      if (response.data['success'] == true) {
        return PointsStatistics.fromJson(response.data['data']);
      }
      throw Exception(response.data['message'] ?? 'Failed to get points statistics');
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  /// 获取积分排行榜 GET /api/points/leaderboard
  Future<List<LeaderboardUser>> getLeaderboard({int limit = 50}) async {
    try {
      final response = await _dio.get('/points/leaderboard', queryParameters: {
        'limit': limit,
      });
      if (response.data['success'] == true) {
        final List<dynamic> leaderboard = response.data['data']?['leaderboard'] ?? response.data['data']?['data'] ?? response.data['data'] ?? [];
        return leaderboard.asMap().entries.map((entry) {
          final json = (entry.value as Map<String, dynamic>);
          return LeaderboardUser.fromJson({
            ...json,
            'rank': entry.key + 1,
          });
        }).toList();
      }
      throw Exception(response.data['message'] ?? 'Failed to get leaderboard');
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  // ==================== 签到相关 ====================

  /// 执行签到 POST /api/checkin
  Future<CheckInResult> performCheckIn() async {
    try {
      final userId = await _getUserId();
      final response = await _dio.post('/checkin', data: {
        'user_id': userId,
      });
      return CheckInResult.fromJson(response.data);
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  /// 获取签到状态 GET /api/checkin/status
  Future<CheckInStatus> getCheckInStatus() async {
    try {
      final userId = await _getUserId();
      final response = await _dio.get('/checkin/status', queryParameters: {
        'user_id': userId,
      });
      if (response.data['success'] == true) {
        return CheckInStatus.fromJson(response.data['data']);
      }
      throw Exception(response.data['message'] ?? 'Failed to get check-in status');
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  /// 获取签到历史 GET /api/checkin/history
  Future<List<CheckInRecord>> getCheckInHistory({int days = 30}) async {
    try {
      final userId = await _getUserId();
      final response = await _dio.get('/checkin/history', queryParameters: {
        'user_id': userId,
        'days': days,
      });
      if (response.data['success'] == true) {
        final List<dynamic> records = response.data['data']['records'] ?? [];
        return records.map((json) => CheckInRecord.fromJson(json)).toList();
      }
      throw Exception(response.data['message'] ?? 'Failed to get check-in history');
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  /// 获取签到里程碑 GET /api/checkin/milestones
  Future<List<CheckInMilestone>> getCheckInMilestones() async {
    try {
      final userId = await _getUserId();
      final response = await _dio.get('/checkin/milestones', queryParameters: {
        'user_id': userId,
      });
      if (response.data['success'] == true) {
        final List<dynamic> milestones = response.data['data']['milestones'] ?? [];
        return milestones.map((json) => CheckInMilestone.fromJson(json)).toList();
      }
      throw Exception(response.data['message'] ?? 'Failed to get milestones');
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  /// 获取30天签到日历 GET /api/checkin/calendar
  Future<Map<String, dynamic>> get30DayCalendar() async {
    try {
      final userId = await _getUserId();
      final response = await _dio.get('/checkin/calendar', queryParameters: {
        'user_id': userId,
      });
      if (response.data['success'] == true) {
        return response.data;
      }
      throw Exception(response.data['message'] ?? 'Failed to get calendar');
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  /// 获取签到配置 GET /api/checkin/config
  Future<Map<String, dynamic>> getCheckInConfig() async {
    try {
      final userId = await _getUserId();
      final response = await _dio.get('/checkin/config', queryParameters: {
        'user_id': userId,
      });
      if (response.data['success'] == true) {
        return response.data;
      }
      throw Exception(response.data['message'] ?? 'Failed to get config');
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  /// 领取里程碑奖励 POST /api/checkin/claim-milestone
  Future<Map<String, dynamic>> claimMilestone(int days) async {
    try {
      final userId = await _getUserId();
      final response = await _dio.post('/checkin/claim-milestone', data: {
        'user_id': userId,
        'days': days,
      });
      return response.data;
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  // ==================== 广告观看相关 ====================

  /// 观看广告 POST /api/ad/watch
  Future<Map<String, dynamic>> watchAd() async {
    try {
      final userId = await _getUserId();
      final response = await _dio.post('/ad/watch', data: {
        'user_id': userId,
      });
      return response.data;
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  /// 获取今日广告观看详情 GET /api/ad/today
  Future<Map<String, dynamic>> getTodayAdInfo() async {
    try {
      final userId = await _getUserId();
      final response = await _dio.get('/ad/today', queryParameters: {
        'user_id': userId,
      });
      if (response.data['success'] == true) {
        return response.data['data'];
      }
      throw Exception(response.data['message'] ?? 'Failed to get ad info');
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  /// 错误处理
  Exception _handleError(DioException error) {
    if (error.response?.data != null && error.response?.data['message'] != null) {
      return Exception(error.response?.data['message']);
    }
    
    switch (error.type) {
      case DioExceptionType.connectionTimeout:
      case DioExceptionType.sendTimeout:
      case DioExceptionType.receiveTimeout:
        return Exception('Connection timeout, please check network');
      case DioExceptionType.badResponse:
        if (error.response?.statusCode == 401) {
          return Exception('Unauthorized, please login again');
        }
        return Exception('Server error: ${error.response?.statusCode}');
      case DioExceptionType.cancel:
        return Exception('Request cancelled');
      default:
        return Exception('Network error: ${error.message}');
    }
  }
}
