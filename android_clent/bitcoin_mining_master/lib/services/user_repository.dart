import '../models/user_model.dart';
import '../services/api_service.dart';
import '../services/storage_service.dart';
import 'package:device_info_plus/device_info_plus.dart';
import 'dart:math';

/// 用户仓库 - 对应Kotlin的UserRepository
class UserRepository {
  final ApiService _apiService = ApiService();
  final StorageService _storageService = StorageService();

  /// 获取用户ID（如果不存在则通过deviceLogin自动登录/注册）
  /// 支持离线模式：无网络时生成临时ID，有网络后自动同步到后端
  Future<Result<String>> fetchUserId() async {
    try {
      // 1. 先尝试从本地获取已存在的用户ID
      final cachedUserId = _storageService.getUserId();
      if (cachedUserId != null && cachedUserId.isNotEmpty) {
        // 检查是否是离线临时用户，如果是则尝试同步到后端
        final isOfflineUser = _storageService.isOfflineUser();
        if (isOfflineUser) {
          print('检测到离线临时用户，尝试同步到后端...');
          await _syncOfflineUserToBackend(cachedUserId);
        }
        return Result.success(cachedUserId);
      }

      // 2. 本地不存在用户ID，需要创建新用户
      final deviceInfo = DeviceInfoPlugin();
      final androidInfo = await deviceInfo.androidInfo;
      
      // 获取稳定的设备标识符
      // 注意：androidInfo.id和fingerprint在某些设备上可能为空或不稳定
      // 优先使用fingerprint，然后id，最后使用型号+品牌组合
      String androidId;
      
      // 尝试多种方式获取设备标识符
      if (androidInfo.fingerprint.isNotEmpty) {
        androidId = androidInfo.fingerprint; // 使用fingerprint（更稳定）
      } else if (androidInfo.id.isNotEmpty) {
        androidId = androidInfo.id;
      } else {
        // 备用方案1：使用型号+品牌+设备名组合
        final brandModel = '${androidInfo.brand}_${androidInfo.model}_${androidInfo.device}';
        if (brandModel.replaceAll('_', '').isNotEmpty) {
          androidId = brandModel;
        } else {
          // 备用方案2：生成基于时间的唯一标识符（最后手段）
          final now = DateTime.now();
          final timestamp = now.millisecondsSinceEpoch;
          final random = Random().nextInt(999999).toString().padLeft(6, '0');
          androidId = 'GENERATED_$timestamp$random';
          print('⚠️ 无法获取设备标识符，使用生成的唯一ID: $androidId');
        }
      }
      
      print('🔍 设备信息:');
      print('   androidInfo.id: ${androidInfo.id}');
      print('   androidInfo.fingerprint: ${androidInfo.fingerprint}');
      print('   androidInfo.brand: ${androidInfo.brand}');
      print('   androidInfo.model: ${androidInfo.model}');
      print('   androidInfo.device: ${androidInfo.device}');
      print('   最终使用的androidId: $androidId');

      try {
        // 3. 尝试通过后端API创建用户（有网络）
        print('正在通过后端API创建新用户...');
        print('   设备ID: $androidId');
        
        final response = await _apiService.deviceLogin(androidId: androidId);
        
        print('🔍 API响应状态:');
        print('   success: ${response.success}');
        print('   isNewUser: ${response.isNewUser}');
        print('   message: ${response.message}');
        print('   data存在: ${response.data != null}');
        
        if (response.success && response.data != null) {
          final userId = response.data!.userId;
          final invitationCode = response.data!.invitationCode;
          
          // 添加调试日志：验证后端返回的数据
          print('🔍 后端API返回:');
          print('   user_id: $userId');
          print('   invitation_code: $invitationCode');
          
          // 验证数字部分是否一致
          final userIdNum = userId.replaceAll('U', '');
          final invCodeNum = invitationCode.replaceAll('INV', '');
          if (userIdNum == invCodeNum) {
            print('   ✅ 数字部分一致: $userIdNum');
          } else {
            print('   ⚠️ 数字部分不一致!');
            print('      user_id数字: $userIdNum');
            print('      invitation_code数字: $invCodeNum');
          }
          
          // 保存到本地
          print('正在保存到本地存储...');
          final saveUserIdResult = await _storageService.saveUserId(userId);
          final saveInvCodeResult = await _storageService.saveInvitationCode(invitationCode);
          print('   saveUserId结果: $saveUserIdResult');
          print('   saveInvitationCode结果: $saveInvCodeResult');
          
          await _storageService.setOfflineUser(false); // 标记为在线用户
          
          // 验证保存后的数据
          final savedUserId = _storageService.getUserId();
          final savedInvCode = _storageService.getInvitationCode();
          print('🔍 本地存储验证:');
          print('   保存的user_id: $savedUserId');
          print('   保存的invitation_code: $savedInvCode');
          
          if (savedUserId != userId || savedInvCode != invitationCode) {
            print('   ⚠️ 警告：本地存储的数据与API返回不一致！');
          }
          
          if (response.token != null && response.token!.isNotEmpty) {
            await _storageService.saveAuthToken(response.token!);
          }
          
          // 保存用户等级和积分到本地
          if (response.data!.userLevel != null) {
            await _storageService.saveUserLevel(response.data!.userLevel!);
          }
          
          print('✅ 用户创建成功（在线）: $userId');
          return Result.success(userId);
        } else {
          final errorMsg = response.message ?? 'Backend returned failure';
          print('❌ API返回失败: $errorMsg');
          throw Exception(errorMsg);
        }
      } catch (e) {
        // 4. 网络失败，生成离线临时用户ID
        print('⚠️ 网络连接失败，创建离线临时用户: $e');
        
        // 生成统一的时间戳和随机数，确保user_id和invitation_code的数字部分一致
        final now = DateTime.now();
        final timestamp = now.millisecondsSinceEpoch.toString();
        final random = Random().nextInt(100000).toString().padLeft(5, '0');
        final uniqueString = '$timestamp$random';
        
        final offlineUserId = 'OFFLINE_U$uniqueString';
        final offlineInvitationCode = 'OFFLINE_INV$uniqueString';
        
        // 保存到本地并标记为离线用户
        await _storageService.saveUserId(offlineUserId);
        await _storageService.saveInvitationCode(offlineInvitationCode);
        await _storageService.setOfflineUser(true); // 标记为离线用户
        await _storageService.saveAndroidId(androidId); // 保存设备ID用于后续同步
        
        print('✅ 离线临时用户创建成功: $offlineUserId');
        print('📝 等待网络恢复后将自动同步到后端');
        
        return Result.success(offlineUserId);
      }
    } catch (e) {
      print('❌ fetchUserId 失败: $e');
      return Result.failure(e as Exception);
    }
  }

  /// 同步离线用户到后端
  /// 当检测到离线用户且网络恢复时调用
  Future<void> _syncOfflineUserToBackend(String offlineUserId) async {
    try {
      final androidId = _storageService.getAndroidId();
      if (androidId == null || androidId.isEmpty) {
        print('⚠️ 无法同步：未找到设备ID');
        return;
      }

      print('开始同步离线用户到后端...');
      final response = await _apiService.deviceLogin(androidId: androidId);
      
      if (response.success && response.data != null) {
        final newUserId = response.data!.userId;
        final newInvitationCode = response.data!.invitationCode;
        
        // 更新本地存储为后端返回的正式ID
        await _storageService.saveUserId(newUserId);
        await _storageService.saveInvitationCode(newInvitationCode);
        await _storageService.setOfflineUser(false); // 标记为在线用户
        
        if (response.token != null && response.token!.isNotEmpty) {
          await _storageService.saveAuthToken(response.token!);
        }
        
        if (response.data!.userLevel != null) {
          await _storageService.saveUserLevel(response.data!.userLevel!);
        }
        
        print('✅ 离线用户同步成功！');
        print('   旧ID: $offlineUserId');
        print('   新ID: $newUserId');
      }
    } catch (e) {
      print('⚠️ 同步离线用户失败（网络仍未恢复）: $e');
      // 同步失败不影响继续使用离线ID
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
      print('🔍 Repository: 请求余额 userId=$userId');
      final response = await _apiService.getBitcoinBalance(userId);
      print('🔍 Repository: API 响应 success=${response.success}, balance=${response.balance}');
      
      if (response.success) {
        // 保存到本地
        await _storageService.saveBitcoinBalance(response.balance);
        return Result.success(response.balance);
      } else {
        return Result.failure(Exception(response.message ?? 'Failed to get balance'));
      }
    } catch (e) {
      print('🔍 Repository: 获取余额异常: $e');
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
  Future<Result<bool>> withdrawBitcoin(
    String amount, 
    String address,
    String network,
    String networkFee,
  ) async {
    try {
      final userIdResult = await fetchUserId();
      if (!userIdResult.isSuccess) {
        return Result.failure(userIdResult.error!);
      }

      final userId = userIdResult.data!;
      // 优先使用保存的邮箱，否则使用默认邮箱格式
      String email = _storageService.getUserEmail() ?? '';
      if (email.isEmpty) {
        // 使用userId生成默认邮箱
        email = '$userId@cloudminingtool.com';
      }

      final response = await _apiService.withdrawBitcoin(
        userId: userId,
        email: email,
        amount: amount,
        address: address,
        network: network,
        networkFee: networkFee,
      );

      if (response['success'] == true) {
        // 刷新余额
        await fetchBitcoinBalance();
        return Result.success(true);
      } else {
        return Result.failure(Exception(response['message'] ?? 'Withdrawal failed'));
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
