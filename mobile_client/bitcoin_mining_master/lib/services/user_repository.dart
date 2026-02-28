import '../models/user_model.dart';
import '../services/api_service.dart';
import '../services/storage_service.dart';
import '../services/device_info_service.dart';
import '../services/native_device_id_service.dart';
import 'package:device_info_plus/device_info_plus.dart';
import 'package:flutter/foundation.dart';
import 'dart:io' show Platform;
import 'dart:math';

/// 用户仓库 - 对应Kotlin的UserRepository
class UserRepository {
  final ApiService _apiService = ApiService();
  final StorageService _storageService = StorageService();

  /// 获取用户ID（如果不存在则通过deviceLogin自动登录/注册）
  /// 修改：网络失败时不生成离线ID，而是直接返回失败，阻止用户进入应用
  Future<Result<String>> fetchUserId() async {
    try {
      // 1. 先尝试从本地获取已存在的用户ID
      final cachedUserId = _storageService.getUserId();
      if (cachedUserId != null && cachedUserId.isNotEmpty) {
        // 如果是离线用户ID，不允许使用，必须联网创建正式账号
        if (cachedUserId.startsWith('OFFLINE_')) {
          print('❌ 检测到离线临时用户，不允许使用，必须联网创建正式账号');
          // 清除离线数据
          await _storageService.saveUserId('');
          await _storageService.saveInvitationCode('');
          await _storageService.setOfflineUser(false);
          throw Exception('Network connection required. Please check your internet connection and try again.');
        }
        return Result.success(cachedUserId);
      }

      // 2. 本地不存在用户ID，需要创建新用户
      final deviceInfo = DeviceInfoPlugin();

      // 获取稳定的设备标识符（兼容 Android / iOS）
      String androidId;

      print('🔍 [Guest Login] 开始获取设备ID...');
      if (!kIsWeb && Platform.isAndroid) {
        final androidInfo = await deviceInfo.androidInfo;
        final String? nativeAndroidId = await NativeDeviceIdService.getAndroidId();

        if (nativeAndroidId != null && nativeAndroidId.isNotEmpty) {
          androidId = nativeAndroidId;
          print('✅ [Guest Login] 使用原生Android ID: $androidId');
        } else if (androidInfo.id.isNotEmpty && androidInfo.id != 'unknown') {
          androidId = androidInfo.id;
          print('⚠️ [Guest Login] 原生方法失败，使用device_info_plus ID: $androidId');
        } else if (androidInfo.fingerprint.isNotEmpty) {
          androidId = androidInfo.fingerprint;
          print('⚠️ [Guest Login] 使用fingerprint: $androidId');
        } else {
          final brandModel = '${androidInfo.brand}_${androidInfo.model}_${androidInfo.device}';
          if (brandModel.replaceAll('_', '').isNotEmpty) {
            androidId = brandModel;
          } else {
            final now = DateTime.now();
            final timestamp = now.millisecondsSinceEpoch;
            final random = Random().nextInt(999999).toString().padLeft(6, '0');
            androidId = 'GENERATED_ANDROID_$timestamp$random';
            print('⚠️ 无法获取Android设备标识符，使用生成ID: $androidId');
          }
        }

        print('🔍 [Guest Login] Android设备信息:');
        print('   androidInfo.id: ${androidInfo.id}');
        print('   androidInfo.fingerprint: ${androidInfo.fingerprint}');
        print('   androidInfo.brand: ${androidInfo.brand}');
        print('   androidInfo.model: ${androidInfo.model}');
        print('   androidInfo.device: ${androidInfo.device}');
      } else if (!kIsWeb && Platform.isIOS) {
        final iosInfo = await deviceInfo.iosInfo;
        final identifierForVendor = iosInfo.identifierForVendor;

        if (identifierForVendor != null && identifierForVendor.isNotEmpty) {
          androidId = 'IOS_$identifierForVendor';
          print('✅ [Guest Login] 使用 iOS identifierForVendor: $androidId');
        } else {
          final modelName = iosInfo.utsname.machine;
          final deviceName = iosInfo.name;
          final systemVersion = iosInfo.systemVersion;
          final fallback = '${modelName}_${deviceName}_$systemVersion';

          if (fallback.replaceAll('_', '').isNotEmpty) {
            androidId = 'IOS_$fallback';
            print('⚠️ [Guest Login] identifierForVendor为空，使用iOS信息组合ID: $androidId');
          } else {
            final now = DateTime.now();
            final timestamp = now.millisecondsSinceEpoch;
            final random = Random().nextInt(999999).toString().padLeft(6, '0');
            androidId = 'GENERATED_IOS_$timestamp$random';
            print('⚠️ 无法获取iOS设备标识符，使用生成ID: $androidId');
          }
        }

        print('🔍 [Guest Login] iOS设备信息:');
        print('   iosInfo.name: ${iosInfo.name}');
        print('   iosInfo.model: ${iosInfo.model}');
        print('   iosInfo.systemVersion: ${iosInfo.systemVersion}');
        print('   iosInfo.identifierForVendor: ${iosInfo.identifierForVendor}');
      } else {
        final now = DateTime.now();
        final timestamp = now.millisecondsSinceEpoch;
        final random = Random().nextInt(999999).toString().padLeft(6, '0');
        androidId = 'GENERATED_GENERIC_$timestamp$random';
        print('⚠️ [Guest Login] 非移动端环境，使用生成ID: $androidId');
      }

      print('🔍 [Guest Login] 最终使用的设备ID: $androidId');

      // 3. 获取GAID和设备地区信息（独立try-catch，失败不影响整体）
      String? gaid;
      String? country;
      
      try {
        print('📱 [Guest Login] 正在获取GAID和地区信息...');
        final deviceInfo = await DeviceInfoService.getDeviceInfo();
        gaid = deviceInfo['gaid'];
        country = deviceInfo['country'];
        
        final gaidPreview = (gaid != null && gaid.length >= 8)
          ? '${gaid.substring(0, 8)}...'
          : (gaid ?? '未获取');
        print('📱 [Guest Login] GAID: $gaidPreview');
        print('📍 [Guest Login] Country: ${country ?? "未获取"}');
        print('📍 国家代码: ${country ?? "未获取"}');
        
        // 4. 尝试通过后端API创建用户（有网络）
        print('正在通过后端API创建新用户...');
        print('   设备ID: $androidId');
        
        final response = await _apiService.deviceLogin(
          androidId: androidId,
          gaid: gaid,
          country: country,
        );
        
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
          final errorMsg = response.message ?? 'Server error. Please try again later.';
          print('❌ API返回失败: $errorMsg');
          throw Exception(errorMsg);
        }
      } catch (e) {
        // 网络或服务器失败时，不生成离线用户，直接抛出异常阻止登录
        print('❌ 网络或服务器错误，无法创建账号: $e');
        String errorMessage = 'Network connection error. Please check your internet connection and try again.';
        
        if (e.toString().contains('Server error')) {
          errorMessage = 'Server error. Please try again later.';
        } else if (e.toString().contains('SocketException') || e.toString().contains('Failed host lookup')) {
          errorMessage = 'Cannot reach server. Please check your network connection.';
        } else if (e.toString().contains('TimeoutException')) {
          errorMessage = 'Connection timeout. Please try again.';
        }
        
        throw Exception(errorMessage);
      }
    } catch (e) {
      print('❌ fetchUserId 失败: $e');
      return Result.failure(e is Exception ? e : Exception(e.toString()));
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
  Future<Result<BitcoinBalanceResponse>> fetchBitcoinBalance() async {
    try {
      // 先获取用户ID
      final userIdResult = await fetchUserId();
      if (!userIdResult.isSuccess) {
        return Result.failure(userIdResult.error!);
      }

      final userId = userIdResult.data!;
      print('🔍 Repository: 请求余额 userId=$userId');
      final response = await _apiService.getBitcoinBalance(userId);
      print('🔍 Repository: API 响应 success=${response.success}, balance=${response.balance}, speed=${response.speedPerSecond}');
      
      if (response.success) {
        // 保存到本地
        await _storageService.saveBitcoinBalance(response.balance);
        return Result.success(response);
      } else {
        return Result.failure(Exception(response.message ?? 'Failed to get balance'));
      }
    } catch (e) {
      print('🔍 Repository: 获取余额异常: $e');
      // 如果网络失败，尝试从本地获取
      final cachedBalance = _storageService.getBitcoinBalance();
      if (cachedBalance != null) {
        final fallbackResponse = BitcoinBalanceResponse(
          success: true,
          balance: cachedBalance,
          speedPerSecond: 0.0,
        );
        return Result.success(fallbackResponse);
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
      // 获取登录标识符用于用户去重
      final googleAccount = _storageService.getGoogleEmail();
      final appleId = _storageService.getAppleId();

      final response = await _apiService.withdrawBitcoin(
        userId: userId,
        email: email,
        amount: amount,
        address: address,
        network: network,
        networkFee: networkFee,
        googleAccount: googleAccount,
        appleId: appleId,
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
