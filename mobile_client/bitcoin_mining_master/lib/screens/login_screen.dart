import 'package:flutter/material.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:url_launcher/url_launcher.dart';
import 'web_view_screen.dart';
import 'package:sign_in_with_apple/sign_in_with_apple.dart';
import 'package:flutter/foundation.dart';
import 'package:device_info_plus/device_info_plus.dart';
import 'dart:io' show Platform;
import '../constants/app_constants.dart';
import '../services/storage_service.dart';
import '../services/api_service.dart';
import '../services/user_repository.dart';
import '../services/network_service.dart';
import '../services/device_info_service.dart';
import '../services/native_device_id_service.dart';
import '../services/analytics_service.dart';
import 'home_screen.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  static const String _termsUrl = 'https://bitcoin-mining-master-legal.davidpony007.workers.dev/terms-of-service';
  static const String _privacyUrl = 'https://bitcoin-mining-master-legal.davidpony007.workers.dev/privacy-policy';

  final StorageService _storageService = StorageService();
  final ApiService _apiService = ApiService();
  final UserRepository _userRepository = UserRepository();
  final NetworkService _networkService = NetworkService();
  final GoogleSignIn _googleSignIn = GoogleSignIn(
    scopes: ['email', 'profile'],
    // Android 14+ / google_sign_in v6.x 需要 serverClientId（Web Client ID）才能
    // 正常调用 Credential Manager API，否则在 Android 14/15 上会抛出
    // PlatformException(sign_in_failed) 或静默失败
    serverClientId: GoogleAuthConstants.webClientId,
  );
  
  final TextEditingController _referrerCodeController = TextEditingController();
  bool _isLoading = false;
  final bool _showReferrerInput = false;
  // 用户是否已主动勾选同意条款（Apple/Google 政策要求明确同意）
  bool _agreedToTerms = false;

  // iOS 广告追踪信息（在 initState 中通过 ATT 弹窗收集）
  String? _idfv;
  String? _idfa;
  int? _attStatus;

  @override
  void initState() {
    super.initState();
    // iOS：页面首次加载后触发 ATT 权限请求弹窗
    if (!kIsWeb && Platform.isIOS) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        _requestATTAndCollectIds();
      });
    }
  }

  /// 请求 iOS ATT 权限并收集 IDFV / IDFA
  Future<void> _requestATTAndCollectIds() async {
    final adInfo = await DeviceInfoService.getIosAdInfo();
    if (mounted) {
      setState(() {
        _idfv = adInfo['idfv'] as String?;
        _idfa = adInfo['idfa'] as String?;
        _attStatus = adInfo['att_status'] as int?;
      });
    }
  }

  @override
  void dispose() {
    _referrerCodeController.dispose();
    super.dispose();
  }

  /// Apple Sign In（仅 iOS 设备）
  Future<void> _handleAppleSignIn() async {
    if (!await _checkNetworkConnection()) return;

    setState(() => _isLoading = true);
    try {
      final credential = await SignInWithApple.getAppleIDCredential(
        scopes: [
          AppleIDAuthorizationScopes.email,
          AppleIDAuthorizationScopes.fullName,
        ],
      );

      final String appleId = credential.userIdentifier ?? '';
      if (appleId.isEmpty) throw Exception('Apple user identifier is empty.');

      // Apple 只在首次授权时返回 email 和 name，之后返回 null——尞属正常行为
      final String? appleEmail = credential.email;
      final String appleName = [
        credential.givenName ?? '',
        credential.familyName ?? '',
      ].where((s) => s.isNotEmpty).join(' ');

      // 收集 iOS 设备标识符（_idfv 已在 initState 中通过 ATT 流程获取）
      final deviceInfo = await DeviceInfoService.getDeviceInfo();
      final country = deviceInfo['country'];

      final response = await _apiService.appleLoginOrCreate(
        appleId:       appleId,
        appleAccount:  appleEmail,
        appleName:     appleName.isEmpty == true ? null : appleName,
        iosDeviceId:   _idfv,
        idfv:          _idfv,
        idfa:          _idfa,
        attStatus:     _attStatus,
        country:       country,
        identityToken: credential.identityToken,
      );

      final responseData = response['data'];
      if (response['success'] == true && responseData is Map<String, dynamic>) {
        final userId = (responseData['user_id'] ?? responseData['userId'])?.toString() ?? '';
        final invitationCode = (responseData['invitation_code'] ?? responseData['invitationCode'])?.toString() ?? '';

        if (userId.isEmpty) throw Exception('Invalid user data returned from server.');

        await _storageService.saveUserId(userId);
        await _storageService.saveInvitationCode(invitationCode);
        await _storageService.saveAppleId(appleId);
        if (appleEmail != null && appleEmail.isNotEmpty) {
          await _storageService.saveAppleAccount(appleEmail);
        }
        await _storageService.saveIsLoggedOut(false);
        final bool appleIsNewUser = response['isNewUser'] == true;
        // 如果 Apple 返回了邀请码逻辑需要
        final referrerResult = await _handleReferrerCode(userId);
        if (!referrerResult) return;

        _navigateToHome(loginMethod: 'apple', isNewUser: appleIsNewUser);
      } else {
        final msg = response['message']?.toString() ?? response['error']?.toString() ?? 'Apple sign-in failed.';
        _showError(msg);
      }
    } on SignInWithAppleAuthorizationException catch (e) {
      if (e.code == AuthorizationErrorCode.canceled) {
        // 用户主动取消，不提示
      } else if (e.code == AuthorizationErrorCode.failed ||
                 e.code == AuthorizationErrorCode.unknown) {
        // 密码错误 / 2FA未开启 / 账号问题
        _showError('Apple sign-in failed. Please ensure Two-Factor Authentication is enabled on your Apple ID.');
      } else {
        _showError('Apple sign-in failed (${e.code}). Please try again.');
      }
    } catch (e) {
      final msg = e.toString().toLowerCase();
      // 仅过滤真正的用户取消操作
      if (!msg.contains('usercancel') && !msg.contains('user_cancel')) {
        _showError('Apple sign-in failed. Please try again.');
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  /// Google登录
  Future<void> _handleGoogleSignIn() async {
    if (!kIsWeb && Platform.isIOS) {
      final missingIosGoogleConfig =
          GoogleAuthConstants.iosClientId.isEmpty ||
          GoogleAuthConstants.iosReversedClientId.isEmpty;

      if (missingIosGoogleConfig) {
        _showError(
          'Google Sign-In is not configured on iOS yet. Please set iOS Client ID and Reversed Client ID first.',
        );
        return;
      }
    }

    if (!await _checkNetworkConnection()) {
      return;
    }

    setState(() => _isLoading = true);

    GoogleSignInAccount? account;

    try {
      account = await _googleSignIn.signInSilently();
      account ??= await _googleSignIn.signIn();

      if (account == null) {
        _showError('Google sign-in cancelled');
        return;
      }

      final String googleId = account.id;
      final String email = account.email;
      final String googleName = account.displayName?.trim() ?? '';

      if (email.isEmpty) {
        throw Exception('Google account email is empty.');
      }

      final devicePayload = await _collectDevicePayloadForGoogleLogin();

      final response = await _apiService.googleLoginOrCreate(
        googleId: googleId,
        googleEmail: email,
        googleName: googleName,
        deviceId: devicePayload['deviceId'],
        gaid: devicePayload['gaid'],
        country: devicePayload['country'],
        system: Platform.isIOS ? 'iOS' : 'Android',
      );

      final responseData = response['data'];
      if (response['success'] == true && responseData is Map<String, dynamic>) {
        final userId = (responseData['user_id'] ?? responseData['userId'])?.toString() ?? '';
        final invitationCode = (responseData['invitation_code'] ?? responseData['invitationCode'])?.toString() ?? '';

        if (userId.isEmpty) {
          throw Exception('Invalid user data returned from server.');
        }

        await _storageService.saveUserId(userId);
        await _storageService.saveInvitationCode(invitationCode);
        await _storageService.saveGoogleSignInStatus(true);
        await _storageService.saveGoogleEmail(email);
        await _storageService.saveIsLoggedOut(false);
        final bool googleIsNewUser = response['isNewUser'] == true;

        final referrerResult = await _handleReferrerCode(userId);
        if (!referrerResult) {
          await _googleSignIn.signOut();
          return;
        }

        _navigateToHome(loginMethod: 'google', isNewUser: googleIsNewUser);
      } else {
        final messageValue = response['message'] ?? response['error'];
        String errorMsg = messageValue?.toString() ?? 'Google sign-in failed. Please try again.';
        if (errorMsg.contains('network') || errorMsg.contains('connection')) {
          errorMsg = 'Network connection error. Please check your internet connection and try again.';
        } else if (errorMsg.contains('timeout')) {
          errorMsg = 'Connection timeout. Please try again.';
        }
        await _googleSignIn.signOut();
        _showError(errorMsg);
      }
    } catch (e) {
      final errorText = e.toString();
      print('[GoogleSignIn] error: $e');
      if (account != null) {
        await _googleSignIn.signOut();
      }

      String errorMsg;
      if (errorText.contains('sign_in_canceled') || errorText.contains('sign_in_cancelled')) {
        errorMsg = 'Google sign-in cancelled';
      } else if (errorText.contains('network') ||
          errorText.contains('connection') ||
          errorText.contains('SocketException')) {
        errorMsg = 'Network connection error. Please check your internet connection and try again.';
      } else if (errorText.contains('timeout')) {
        errorMsg = 'Connection timeout. Please try again.';
      } else if (errorText.contains('10') && errorText.contains('sign_in_failed')) {
        // DEVELOPER_ERROR: SHA-1 fingerprint not registered in Firebase Console
        errorMsg = 'Google sign-in configuration error. Please contact support.';
        print('[GoogleSignIn] DEVELOPER_ERROR (code 10): SHA-1 not registered in Firebase Console');
      } else if (errorText.contains('12500') || errorText.contains('sign_in_failed')) {
        errorMsg = 'Google sign-in failed. Please ensure a Google account is added on this device.';
      } else {
        errorMsg = 'Google sign-in failed. Please try again.';
      }

      _showError(errorMsg);
    } finally {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  Future<Map<String, String?>> _collectDevicePayloadForGoogleLogin() async {
    final deviceInfo = DeviceInfoPlugin();
    String deviceId;

    if (!kIsWeb && Platform.isAndroid) {
      final androidInfo = await deviceInfo.androidInfo;
      final nativeDeviceId = await NativeDeviceIdService.getAndroidId();

      if (nativeDeviceId != null && nativeDeviceId.isNotEmpty) {
        deviceId = nativeDeviceId;
      } else if (androidInfo.id.isNotEmpty && androidInfo.id != 'unknown') {
        deviceId = androidInfo.id;
      } else if (androidInfo.fingerprint.isNotEmpty) {
        deviceId = androidInfo.fingerprint;
      } else {
        deviceId = 'ANDROID_${DateTime.now().millisecondsSinceEpoch}';
      }
    } else if (!kIsWeb && Platform.isIOS) {
      final iosInfo = await deviceInfo.iosInfo;
      final identifierForVendor = iosInfo.identifierForVendor;

      if (identifierForVendor != null && identifierForVendor.isNotEmpty) {
        deviceId = 'IOS_$identifierForVendor';
      } else {
        deviceId = 'IOS_${DateTime.now().millisecondsSinceEpoch}';
      }
    } else {
      deviceId = 'GENERIC_${DateTime.now().millisecondsSinceEpoch}';
    }

    final deviceInfoMap = await DeviceInfoService.getDeviceInfo();
    final gaid = deviceInfoMap['gaid'];
    final country = deviceInfoMap['country'];

    return {
      'deviceId': deviceId,
      'gaid': gaid,
      'country': country,
    };
  }
  
  /* 原Google登录代码已完全注释掉
    // 先检查网络连接
    if (!await _checkNetworkConnection()) {
      return;
    }

    setState(() => _isLoading = true);
    
    try {
      // 1. Google登录
      GoogleSignInAccount? account = await _googleSignIn.signInSilently();
      account ??= await _googleSignIn.signIn();
      
      if (account == null) {
        _showError('Google sign-in cancelled');
        return;
      }

      final GoogleSignInAuthentication auth = await account.authentication;
      final String? googleId = account.id;
      final String? email = account.email;
      final String? displayName = account.displayName;
      
      print('✅ Google login success');
      print('   - Email: $email');
      print('   - ID: $googleId');
      print('   - Name: $displayName');

      // 验证email不为空
      if (email == null || email.isEmpty) {
        throw Exception('Google account email is empty. Please make sure you grant email permission.');
      }

      // 收集设备信息（android_id、gaid、country）
      print('🔍 ========================================');
      print('🔍 开始收集设备信息...');
      print('🔍 ========================================');
      String? androidId;
      String? gaid;
      String? country;
      
      // 步骤1: 获取Android ID（独立try-catch，失败不影响其他）
      try {
        print('📱 步骤1: 获取Android ID（原生方法）...');
        androidId = await NativeDeviceIdService.getAndroidId();
        
        if (androidId == null || androidId.isEmpty) {
          print('⚠️ 原生方法返回空，尝试device_info_plus...');
          final deviceInfo = DeviceInfoPlugin();
          final androidInfo = await deviceInfo.androidInfo;
          
          if (androidInfo.id.isNotEmpty && androidInfo.id != 'unknown') {
            androidId = androidInfo.id;
            print('✅ 使用 device_info_plus Android ID: "$androidId"');
          } else if (androidInfo.fingerprint.isNotEmpty) {
            androidId = androidInfo.fingerprint;
            print('⚠️ 使用 fingerprint 作为备用: "$androidId"');
          }
        } else {
          print('✅ 原生方法获取成功 Android ID: "$androidId" (长度: ${androidId.length})');
        }
      } catch (e) {
        print('❌ Android ID 获取失败: $e');
      }
        
      // 步骤2: 获取GAID和Country（一次性获取所有设备信息）
      try {
        print('📱 步骤2: 获取GAID和Country...');
        final deviceInfoMap = await DeviceInfoService.getDeviceInfo();
        
        gaid = deviceInfoMap['gaid'];
        if (gaid != null && gaid.isNotEmpty) {
          print('✅ GAID 获取成功: ${gaid.substring(0, 8)}...');
        } else {
          print('⚠️ GAID 为空');
        }
        
        country = deviceInfoMap['country'];
        if (country != null && country.isNotEmpty) {
          print('✅ Country 获取成功: $country');
        } else {
          print('⚠️ Country 为空');
        }
      } catch (e) {
        print('❌ GAID和Country 获取失败: $e');
      }
      
      print('🔍 ========================================');
      print('📱 设备信息收集汇总:');
      print('   ✓ Android ID: ${androidId ?? "未获取"}');
      print('   ✓ GAID: ${gaid ?? "未获取"}');
      print('   ✓ Country: ${country ?? "未获取"}');
      print('🔍 ========================================');

      // 2. 调用后端API：Google登录或创建新用户
      print('🔍 Google登录或创建新用户: $email');
      print('📤 准备发送参数:');
      print('   - googleId: $googleId');
      print('   - googleEmail: $email');
      print('   - androidId: $androidId');
      print('   - gaid: $gaid');
      print('   - country: $country');
      
      final response = await _apiService.googleLoginOrCreate(
        googleId: googleId,
        googleEmail: email,
        googleName: displayName ?? '',
        deviceId: androidId,
        gaid: gaid,
        country: country,
        system: Platform.isIOS ? 'iOS' : 'Android',
      );
      print('🔍 Google登录/创建响应: $response');

      if (response['success'] == true && response['data'] != null) {
        final userId = response['data']['user_id'] ?? response['data']['userId'];
        final invitationCode = response['data']['invitation_code'] ?? response['data']['invitationCode'];
        final isNewUser = response['isNewUser'] ?? false;
        
        print('✅ ${isNewUser ? "New user created successfully" : "User login successful"}: $userId');
        
        // 保存用户信息到本地
        await _storageService.saveUserId(userId);
        await _storageService.saveInvitationCode(invitationCode);
        await _storageService.saveGoogleSignInStatus(true);
        await _storageService.saveGoogleEmail(email);
        
        // 3. 处理推荐人邀请码（如果有输入）
        print('🔍 开始验证邀请码...');
        final referrerResult = await _handleReferrerCode(userId);
        print('🔍 邀请码验证结果: $referrerResult');
        
        if (!referrerResult) {
          // 邀请码验证失败，撤销Google登录并阻止登录流程
          print('❌ 邀请码验证失败，撤销Google登录');
          await _googleSignIn.signOut();
          return;
        }
        
        print('✅ 邀请码验证通过，进入应用');
        _navigateToHome(loginMethod: 'google');
      } else {
        // 创建/登录失败 - 网络或服务器错误
        String errorMessage = response['message'] ?? response['error'] ?? 'Server error. Please try again later.';
        
        // 标准化错误消息
        if (errorMessage.contains('network') || errorMessage.contains('connection')) {
          errorMessage = 'Network connection error. Please check your internet connection and try again.';
        } else if (errorMessage.contains('timeout')) {
          errorMessage = 'Connection timeout. Please try again.';
        } else if (!errorMessage.contains('Server error') && !errorMessage.contains('Network')) {
          errorMessage = 'Server error. Please try again later.';
        }
        
        print('❌ Google登录/创建失败: $errorMessage');
        await _googleSignIn.signOut();
        _showError(errorMessage);
      }
    } catch (e) {
      print('❌ Google sign-in error: $e');
      await _googleSignIn.signOut();
      
      String errorMsg = e.toString();
      if (errorMsg.contains('network') || errorMsg.contains('connection') || errorMsg.contains('SocketException')) {
        errorMsg = 'Network connection error. Please check your internet connection and try again.';
      } else if (errorMsg.contains('timeout')) {
        errorMsg = 'Connection timeout. Please try again.';
      } else if (errorMsg.contains('Server error')) {
        errorMsg = 'Server error. Please try again later.';
      } else {
        errorMsg = 'Google sign-in failed. Please try again.';
      }
      _showError(errorMsg);
    } finally {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  } // 原_handleGoogleSignIn函数结束
  */ // 注释结束

  /// 访客模式
  Future<void> _handleGuestMode() async {
    // 先检查网络连接
    if (!await _checkNetworkConnection()) {
      return;
    }

    setState(() => _isLoading = true);
    
    try {
      // 检查本地是否已有账号（即使已登出）
      String? existingUserId = _storageService.getUserId();
      String? existingInvitationCode = _storageService.getInvitationCode();
      
      if (existingUserId != null && existingUserId.isNotEmpty && 
          !existingUserId.startsWith('OFFLINE_') &&
          existingInvitationCode != null && existingInvitationCode.isNotEmpty) {
        // 有已存在的账号 → 恢复账号（不创建新账号）
        print('✅ 账号恢复模式: 检测到已存在账号 $existingUserId');
        await _storageService.saveIsLoggedOut(false);  // 清除登出标记
        
        // 处理推荐人邀请码（如果这次登录页输入了新的邀请码）- 如果验证失败则阻止登录
        final referrerResult = await _handleReferrerCode(existingUserId);
        if (!referrerResult) {
          // 邀请码验证失败，不继续登录流程
          return;
        }
        
        _navigateToHome(isNewUser: false);
      } else {
        // 没有已存在的账号 → 创建新账号
        print('✅ 新账号模式: 创建全新的游客账号');
        final result = await _userRepository.fetchUserId();
        
        if (result.isSuccess) {
          // 获取userId
          final userId = _storageService.getUserId();
          if (userId != null && userId.isNotEmpty) {
            await _storageService.saveIsLoggedOut(false);  // 标记为已登录
            // 处理推荐人邀请码（如果有）- 如果验证失败则阻止登录
            final referrerResult = await _handleReferrerCode(userId);
            if (!referrerResult) {
              // 邀请码验证失败，不继续登录流程
              return;
            }
          }
          _navigateToHome(isNewUser: true);
        } else {
          // 网络或服务器错误，显示错误提示
          final errorValue = result.error;
          String errorMsg = (errorValue != null) ? errorValue.toString() : 'Failed to create account';
          
          // 清理可能残留的离线数据
          await _storageService.saveUserId('');
          await _storageService.saveInvitationCode('');
          await _storageService.setOfflineUser(false);
          
          print('❌ Guest登录失败: $errorMsg');
          _showError(errorMsg);
        }
      }
    } catch (e) {
      print('❌ Guest mode error: $e');
      
      // 清理可能残留的离线数据
      await _storageService.saveUserId('');
      await _storageService.saveInvitationCode('');
      await _storageService.setOfflineUser(false);
      
      String errorMsg = e.toString();
      if (errorMsg.contains('Network connection')) {
        errorMsg = 'Network connection error. Please check your internet connection and try again.';
      } else if (errorMsg.contains('Server error')) {
        errorMsg = 'Server error. Please try again later.';
      }
      _showError(errorMsg);
    } finally {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  /// 获取或创建用户ID
  Future<String> _getOrCreateUserId() async {
    String? userId = _storageService.getUserId();
    
    if (userId == null || userId.isEmpty || userId.startsWith('OFFLINE_')) {
      final result = await _userRepository.fetchUserId();
      if (result.isSuccess && result.data != null) {
        userId = result.data!;
      } else {
        throw Exception('Failed to get user ID');
      }
    }
    
    return userId;
  }

  /// 处理推荐人邀请码
  /// 处理邀请码验证
  /// 返回 true 表示可以继续登录（邀请码为空或验证成功）
  /// 返回 false 表示不能继续登录（邀请码验证失败）
  Future<bool> _handleReferrerCode(String userId) async {
    final referrerCode = _referrerCodeController.text.trim();
    
    print('🔍 _handleReferrerCode - referrerCode: "$referrerCode"');
    
    // 1. 如果邀请码为空，允许继续登录
    if (referrerCode.isEmpty) {
      print('✅ 邀请码为空，允许登录');
      return true;
    }

    print('🔍 邀请码不为空，开始验证...');
    
    // 2. 有邀请码输入，必须验证成功才能继续
    try {
      final response = await _apiService.addReferrer(
        userId: userId,
        referrerInvitationCode: referrerCode,
      );
      
      print('🔍 API响应: $response');
      
      if (response['success'] == true) {
        print('✅ Referrer code added successfully');
        // 设置 pending 标志，进入 HomeScreen 后弹出庆祝窗
        final storage = StorageService();
        await storage.setPendingReferralSuccessDialog();
        return true;  // 验证成功，允许继续登录
      } else {
        final errorCode = response['errorCode']?.toString() ?? '';
        final messageValue = response['message'];
        String errorMsg = (messageValue != null) ? messageValue.toString() : 'Invalid invitation code';
        print('❌ 邀请码验证失败: errorCode=$errorCode, msg=$errorMsg');

        // 已绑定过推荐人：直接放行，不阻止登录
        if (errorCode == 'ALREADY_HAS_REFERRER') {
          print('ℹ️ 用户已绑定推荐人，跳过绑定直接登录');
          return true;
        }

        if (errorMsg.contains('not found') || 
            errorMsg.contains('not exist') ||
            errorCode == 'INVALID_INVITATION_CODE') {
          errorMsg = 'The invitation code you entered does not exist. Please confirm and try again.';
        }
        _showInvitationCodeError(errorMsg);
        return false;  // 验证失败，阻止登录
      }
    } catch (e) {
      print('❌ 邀请码验证异常: $e');
      // 检查是否是邀请码不存在的错误
      String errorMsg = e.toString();
      if (errorMsg.contains('404') || errorMsg.contains('not found') || 
          errorMsg.contains('not exist')) {
        _showInvitationCodeError('The invitation code you entered does not exist. Please confirm and try again.');
      } else {
        _showInvitationCodeError('Failed to verify invitation code. Please try again.');
      }
      return false;  // 验证失败，阻止登录
    }
  }

  /// 显示邀请码错误提示
  void _showInvitationCodeError(String message) {
    if (!mounted) return;
    
    showDialog(
      context: context,
      builder: (BuildContext context) {
        return AlertDialog(
          backgroundColor: AppColors.cardDark,
          title: Row(
            children: [
              Icon(Icons.error_outline, color: Colors.orangeAccent, size: 24),
              const SizedBox(width: 8),
              const Text(
                'Invalid Invitation Code',
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w600,
                  color: Colors.orangeAccent,
                ),
              ),
            ],
          ),
          content: Text(
            message,
            style: const TextStyle(
              color: AppColors.textPrimary,
              fontSize: 14,
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: Text(
                'OK',
                style: TextStyle(color: AppColors.primary),
              ),
            ),
          ],
        );
      },
    );
  }

  /// 导航到主页（loginMethod: 'apple' | 'google' | 'device'）
  void _navigateToHome({String loginMethod = 'device', bool isNewUser = false}) {
    if (!mounted) return;
    // 埋点：关联用户 ID（必须在 login/signup 之前调用，否则事件无法按用户归因）
    final userId = _storageService.getUserId();
    AnalyticsService.instance.setUserId(userId);
    // 埋点：新用户注册
    if (isNewUser) {
      AnalyticsService.instance.logSignUp(method: loginMethod);
    }
    // 埋点：登录成功
    AnalyticsService.instance.logLogin(method: loginMethod);
    Navigator.of(context).pushReplacement(
      MaterialPageRoute(builder: (context) => const HomeScreen()),
    );
  }

  /// 显示错误信息
  void _showError(String message) {
    if (!mounted) return;
    
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: Colors.red,
        duration: const Duration(seconds: 3),
      ),
    );
  }

  /// 检查网络连接
  Future<bool> _checkNetworkConnection() async {
    // 只做本地网络状态检测（快速，无需发起实际 HTTP 请求）
    // 服务器可达性交由后续 API 调用自行处理，避免因超时误报 "无网络"
    final isConnected = await _networkService.isConnected();
    
    if (!isConnected) {
      _showNetworkError();
      return false;
    }

    return true;
  }

  /// 显示网络错误提示
  void _showNetworkError() {
    if (!mounted) return;
    
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (BuildContext context) {
        return AlertDialog(
          backgroundColor: AppColors.cardDark,
          title: const Text(
            'Network Connection Error',
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.w600,
              color: Colors.redAccent,
            ),
          ),
          content: const Text('Please check your network and try again!'),
          actions: [
            TextButton(
              onPressed: () {
                Navigator.of(context).pop();
              },
              child: Text(
                'OK',
                style: TextStyle(
                  color: AppColors.primary,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
          ],
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.transparent,
      body: Container(
        width: double.infinity,
        height: double.infinity,
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [
              Color(0xFF1a1a1a),  // 深灰色
              Color(0xFF2d2d2d),  // 中灰色
              Color(0xFF3d3d3d),  // 浅灰色
              Color(0xFFFF9500),  // 橙黄色
            ],
            stops: [0.0, 0.4, 0.7, 1.0],
          ),
        ),
        child: SafeArea(
          child: _isLoading
              ? const Center(child: CircularProgressIndicator())
              : SingleChildScrollView(
                  padding: const EdgeInsets.all(24.0),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      const SizedBox(height: 40),
                      
                      // Logo
                      Center(
                        child: Container(
                          width: 100,
                          height: 100,
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(20),
                            boxShadow: [
                              BoxShadow(
                                color: Colors.black.withOpacity(0.2),
                                blurRadius: 8,
                                offset: const Offset(0, 4),
                              ),
                            ],
                          ),
                          child: ClipRRect(
                            borderRadius: BorderRadius.circular(20),
                            child: Image.asset(
                              'assets/images/bitcoin_chip_logo.png',
                              fit: BoxFit.cover,
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(height: 16),
                      
                      // Title
                      const Text(
                        'Bitcoin Mining Master',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          fontSize: 28,
                          fontWeight: FontWeight.bold,
                          color: Colors.white,
                        ),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        'Start Your Mining Journey',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          fontSize: 16,
                          color: AppColors.textSecondary,
                        ),
                      ),
                      
                      const SizedBox(height: 60),
                      
                      // Referrer Code Section
                      _buildReferrerCodeSection(),
                      
                      const SizedBox(height: 40),
                      
                      // Google Sign In Button (Android only)
                      if (!kIsWeb && Platform.isAndroid)
                        _buildGoogleSignInButton(),

                      // Apple Sign In Button (iOS only)
                      if (!kIsWeb && Platform.isIOS)
                        _buildAppleSignInButton(),

                      const SizedBox(height: 12),
                      _buildGuestButton(),
                      
                      const SizedBox(height: 24),
                      
                      // Terms & Privacy
                      _buildTermsText(),
                    ],
                  ),
                ),
        ),
      ),
    );
  }

  /// 登录前检查条款同意状态，未勾选则弹 SnackBar 提示
  void _requireTermsAgreement(VoidCallback action) {
    if (!_agreedToTerms) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'Please agree to the Terms of Service and Privacy Policy to continue.',
          ),
          duration: Duration(seconds: 3),
          behavior: SnackBarBehavior.floating,
        ),
      );
      return;
    }
    action();
  }

  Widget _buildAppleSignInButton() {
    return ElevatedButton(
      onPressed: () => _requireTermsAgreement(_handleAppleSignIn),
      style: ElevatedButton.styleFrom(
        backgroundColor: Colors.black,
        foregroundColor: Colors.white,
        padding: const EdgeInsets.symmetric(vertical: 16),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
          side: const BorderSide(color: Colors.white24, width: 1),
        ),
        elevation: 2,
      ),
      child: const Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.apple, size: 26, color: Colors.white),
          SizedBox(width: 10),
          Text(
            'Sign In With Apple',
            style: TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.w600,
              color: Colors.white,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildGoogleSignInButton() {
    return ElevatedButton(
      onPressed: () => _requireTermsAgreement(_handleGoogleSignIn),
      style: ElevatedButton.styleFrom(
        backgroundColor: Colors.white,
        foregroundColor: Colors.black87,
        padding: const EdgeInsets.symmetric(vertical: 16),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
        ),
        elevation: 2,
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Image.asset(
            'assets/images/google.png',
            width: 24,
            height: 24,
          ),
          const SizedBox(width: 12),
          const Text(
            'Sign In With Google',
            style: TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildReferrerCodeSection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // 标题
        Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: Text(
            'Referrer\'s Invitation Code (Optional)',
            style: TextStyle(
              color: Colors.white,
              fontSize: 15,
              fontWeight: FontWeight.w600,
            ),
            textAlign: TextAlign.center,
          ),
        ),
        // 输入框
        Container(
          decoration: BoxDecoration(
            boxShadow: [
              BoxShadow(
                color: AppColors.primary.withOpacity(0.2),
                blurRadius: 8,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          child: TextField(
            controller: _referrerCodeController,
            decoration: InputDecoration(
              hintText: 'INV...',
              hintStyle: TextStyle(
                color: AppColors.textSecondary.withOpacity(0.6),
                fontSize: 14,
              ),
              filled: true,
              fillColor: Colors.white,
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide(
                  color: AppColors.primary,
                  width: 2,
                ),
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide(
                  color: AppColors.primary.withOpacity(0.5),
                  width: 2,
                ),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide(
                  color: AppColors.primary,
                  width: 2,
                ),
              ),
              prefixIcon: Icon(
                Icons.card_giftcard,
                color: AppColors.primary,
                size: 24,
              ),
              contentPadding: const EdgeInsets.symmetric(
                horizontal: 16,
                vertical: 18,
              ),
            ),
            textCapitalization: TextCapitalization.characters,
            style: const TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w600,
              color: Colors.black87,
              letterSpacing: 1,
            ),
          ),
        ),
        const SizedBox(height: 12),
        // 提示信息
        Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: AppColors.primary.withOpacity(0.1),
            borderRadius: BorderRadius.circular(8),
            border: Border.all(
              color: AppColors.primary.withOpacity(0.3),
            ),
          ),
          child: Row(
            children: [
              Icon(
                Icons.info_outline,
                color: AppColors.primary,
                size: 18,
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  'Enter your referrer\'s invitation code to get an extra reward! If you already have a referrer linked, please skip this.',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 13,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildGuestButton() {
    return OutlinedButton(
      onPressed: () => _requireTermsAgreement(_handleGuestMode),
      style: OutlinedButton.styleFrom(
        foregroundColor: Colors.white,
        side: BorderSide(
          color: Color(0xFF06B6D4),  // 明亮的青蓝色边框
          width: 2,
        ),
        padding: const EdgeInsets.symmetric(vertical: 16),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
        ),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(
            Icons.person_outline,
            size: 24,
            color: Colors.white,
          ),
          const SizedBox(width: 12),
          const Text(
            'Continue As Guest',
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w600,
              color: Colors.white,
            ),
          ),
        ],
      ),
    );
  }

  void _launchUrl(String url) {
    final title = url.contains('terms') ? 'Terms of Service' : 'Privacy Policy';
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => WebViewScreen(title: title, url: url),
      ),
    );
  }

  Widget _buildTermsText() {
    const textStyle = TextStyle(
      fontSize: 12,
      color: Color(0x99AAAAAA),
    );
    const linkStyle = TextStyle(
      fontSize: 12,
      color: Color(0xFFFF9800),
      decoration: TextDecoration.underline,
      decorationColor: Color(0xFFFF9800),
      fontWeight: FontWeight.w600,
    );
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Checkbox + 条款文字（Apple 5.1.1 / Google Play 要求明确用户同意）
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SizedBox(
              width: 24,
              height: 24,
              child: Checkbox(
                value: _agreedToTerms,
                onChanged: (val) {
                  setState(() => _agreedToTerms = val ?? false);
                },
                activeColor: const Color(0xFFFF9800),
                checkColor: Colors.white,
                side: const BorderSide(color: Color(0x99AAAAAA), width: 1.5),
                materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                visualDensity: VisualDensity.compact,
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: Wrap(
                alignment: WrapAlignment.start,
                crossAxisAlignment: WrapCrossAlignment.center,
                children: [
                  const Text('I have read and agree to the ', style: textStyle),
                  GestureDetector(
                    onTap: () => _launchUrl(_termsUrl),
                    child: const Text('Terms of Service', style: linkStyle),
                  ),
                  const Text(' and ', style: textStyle),
                  GestureDetector(
                    onTap: () => _launchUrl(_privacyUrl),
                    child: const Text('Privacy Policy', style: linkStyle),
                  ),
                ],
              ),
            ),
          ],
        ),
      ],
    );
  }
}
