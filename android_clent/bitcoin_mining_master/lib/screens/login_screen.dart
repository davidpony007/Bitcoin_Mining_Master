import 'package:flutter/material.dart';
import 'package:google_sign_in/google_sign_in.dart';
import '../constants/app_constants.dart';
import '../services/storage_service.dart';
import '../services/api_service.dart';
import '../services/user_repository.dart';
import '../services/network_service.dart';
import 'home_screen.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final StorageService _storageService = StorageService();
  final ApiService _apiService = ApiService();
  final UserRepository _userRepository = UserRepository();
  final NetworkService _networkService = NetworkService();
  final GoogleSignIn _googleSignIn = GoogleSignIn(scopes: ['email', 'profile']);
  
  final TextEditingController _referrerCodeController = TextEditingController();
  bool _isLoading = false;
  bool _showReferrerInput = false;

  @override
  void dispose() {
    _referrerCodeController.dispose();
    super.dispose();
  }

  /// Google登录
  Future<void> _handleGoogleSignIn() async {
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
      
      print('✅ Google login success: $email');

      // 2. 调用后端API绑定Google账号
      final userId = await _getOrCreateUserId();
      final response = await _apiService.bindGoogleAccount(
        userId: userId,
        googleId: googleId,
        googleEmail: email ?? '',
        googleName: displayName ?? '',
      );

      if (response['success'] == true) {
        // 3. 处理推荐人邀请码（如果有）
        await _handleReferrerCode(userId);
        
        // 4. 保存Google登录状态
        await _storageService.saveGoogleSignInStatus(true);
        await _storageService.saveGoogleEmail(email ?? '');
        
        _navigateToHome();
      } else {
        throw Exception(response['message'] ?? 'Failed to bind Google account');
      }
    } catch (e) {
      print('❌ Google sign-in error: $e');
      _showError('Google sign-in failed: ${e.toString()}');
    } finally {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

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
        
        // 处理推荐人邀请码（如果这次登录页输入了新的邀请码）
        await _handleReferrerCode(existingUserId);
        
        _navigateToHome();
      } else {
        // 没有已存在的账号 → 创建新账号
        print('✅ 新账号模式: 创建全新的游客账号');
        final result = await _userRepository.fetchUserId();
        
        if (result.isSuccess) {
          // 获取userId
          final userId = _storageService.getUserId();
          if (userId != null && userId.isNotEmpty) {
            await _storageService.saveIsLoggedOut(false);  // 标记为已登录
            // 处理推荐人邀请码（如果有）
            await _handleReferrerCode(userId);
          }
          _navigateToHome();
        } else {
          throw Exception(result.error ?? 'Failed to create guest account');
        }
      }
    } catch (e) {
      print('❌ Guest mode error: $e');
      _showError('Failed to continue as guest: ${e.toString()}');
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
  Future<void> _handleReferrerCode(String userId) async {
    final referrerCode = _referrerCodeController.text.trim();
    if (referrerCode.isEmpty) return;

    try {
      final response = await _apiService.addReferrer(
        userId: userId,
        referrerInvitationCode: referrerCode,
      );
      
      if (response['success'] == true) {
        print('✅ Referrer code added successfully');
        // 创建免费广告合约
        await _apiService.createAdFreeContract(userId: userId);
      }
    } catch (e) {
      print('⚠️ Failed to add referrer code: $e');
      // 不阻止登录流程，只记录错误
    }
  }

  /// 导航到主页
  void _navigateToHome() {
    if (!mounted) return;
    
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
    final isConnected = await _networkService.isConnected();
    
    if (!isConnected) {
      _showNetworkError();
      return false;
    }

    // 检查是否能连接到后端
    final canReach = await _networkService.canReachBackend();
    if (!canReach) {
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
          title: const Text('网络连接错误'),
          content: const Text('网络连接错误，请重试！'),
          actions: [
            TextButton(
              onPressed: () {
                Navigator.of(context).pop();
              },
              child: const Text('确定'),
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
                      
                      // Google Sign In Button
                      _buildGoogleSignInButton(),
                      
                      const SizedBox(height: 16),
                      
                      // Continue as Guest
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

  Widget _buildGoogleSignInButton() {
    return ElevatedButton(
      onPressed: _handleGoogleSignIn,
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
            'Sign In With Google (Recommended)',
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
                  'Enter your referrer\'s invitation code to get extra reward!',
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
      onPressed: _handleGuestMode,
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
      child: Text(
        'Continue As Guest',
        style: TextStyle(
          fontSize: 16,
          fontWeight: FontWeight.w600,
          color: Colors.white,
        ),
      ),
    );
  }

  Widget _buildTermsText() {
    return Text(
      'By continuing, you agree to our Terms of Service and Privacy Policy',
      textAlign: TextAlign.center,
      style: TextStyle(
        fontSize: 12,
        color: AppColors.textSecondary.withOpacity(0.7),
      ),
    );
  }
}
