import '../models/user_model.dart';
import '../services/api_service.dart';
import '../services/storage_service.dart';

/// 用户仓库 - 对应Kotlin的UserRepository
class UserRepository {
  final ApiService _apiService = ApiService();
  final StorageService _storageService = StorageService();

  /// 获取用户ID（如果不存在则生成新的）
  Future<Result<String>> fetchUserId() async {
    try {
      // 先尝试从本地获取
      final cachedUserId = _storageService.getUserId();
      if (cachedUserId != null && cachedUserId.isNotEmpty) {
        return Result.success(cachedUserId);
      }

      // 从服务器获取新ID
      final response = await _apiService.generateUserId();
      if (response.success) {
        // 保存到本地
        await _storageService.saveUserId(response.userId);
        return Result.success(response.userId);
      } else {
        return Result.failure(Exception(response.message ?? '获取用户ID失败'));
      }
    } catch (e) {
      return Result.failure(e as Exception);
    }
  }

  /// 获取比特币余额
  Future<Result<String>> fetchBitcoinBalance() async {
    try {
      // 先获取用户ID
      final userIdResult = await fetchUserId();
      if (!userIdResult.isSuccess) {
        return Result.failure(userIdResult.error!);
      }

      final userId = userIdResult.data!;
      final response = await _apiService.getBitcoinBalance(userId);
      
      if (response.success) {
        // 保存到本地
        await _storageService.saveBitcoinBalance(response.balance);
        return Result.success(response.balance);
      } else {
        return Result.failure(Exception(response.message ?? '获取余额失败'));
      }
    } catch (e) {
      // 如果网络失败，尝试从本地获取
      final cachedBalance = _storageService.getBitcoinBalance();
      if (cachedBalance != null) {
        return Result.success(cachedBalance);
      }
      return Result.failure(e as Exception);
    }
  }

  /// 获取交易记录
  Future<Result<List<Transaction>>> fetchTransactions() async {
    try {
      final userIdResult = await fetchUserId();
      if (!userIdResult.isSuccess) {
        return Result.failure(userIdResult.error!);
      }

      final userId = userIdResult.data!;
      final transactions = await _apiService.getTransactions(userId);
      return Result.success(transactions);
    } catch (e) {
      return Result.failure(e as Exception);
    }
  }

  /// 提现
  Future<Result<bool>> withdrawBitcoin(String amount, String address) async {
    try {
      final userIdResult = await fetchUserId();
      if (!userIdResult.isSuccess) {
        return Result.failure(userIdResult.error!);
      }

      final userId = userIdResult.data!;
      final response = await _apiService.withdrawBitcoin(
        userId: userId,
        amount: amount,
        address: address,
      );

      if (response['success'] == true) {
        // 刷新余额
        await fetchBitcoinBalance();
        return Result.success(true);
      } else {
        return Result.failure(Exception(response['message'] ?? '提现失败'));
      }
    } catch (e) {
      return Result.failure(e as Exception);
    }
  }
}

/// Result类 - 类似Kotlin的Result
class Result<T> {
  final T? data;
  final Exception? error;
  final bool isSuccess;

  Result._({this.data, this.error, required this.isSuccess});

  factory Result.success(T data) {
    return Result._(data: data, isSuccess: true);
  }

  factory Result.failure(Exception error) {
    return Result._(error: error, isSuccess: false);
  }
}
