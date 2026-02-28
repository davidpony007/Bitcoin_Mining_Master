import 'package:flutter/material.dart';
import 'dart:async';
import 'dart:io';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:sign_in_with_apple/sign_in_with_apple.dart';
import 'package:url_launcher/url_launcher.dart';
import 'web_view_screen.dart';
import '../constants/app_constants.dart';
import '../services/storage_service.dart';
import '../services/user_repository.dart';
import '../services/api_service.dart';
import 'login_screen.dart';

/// 设置页面 - Settings Screen
class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> with WidgetsBindingObserver {
  bool _pushNotifications = true;
  bool _isGoogleSignedIn = false; // Google登录状态
  GoogleSignInAccount? _googleAccount; // 保存Google账号信息
  String? _boundGoogleEmail; // 保存已绑定的Google邮箱（即使未登录也要显示）
  bool _isAppleSignedIn = false; // Apple 登录状态
  String? _boundAppleEmail; // 已绑定的 Apple 邮箱
  String _userId = 'Loading...'; // 用户ID
  String _userName = 'Guest User'; // 用户昵称，可编辑
  final _storageService = StorageService();
  final _userRepository = UserRepository();
  final _apiService = ApiService();
  bool _isLoading = false;
  final GoogleSignIn _googleSignIn = GoogleSignIn(scopes: ['email', 'profile']);
  
  // 用户等级相关
  int _userLevel = 1;
  String _levelName = 'Lv.1';

  // UTC时间显示
  String _utcTime = '';
  Timer? _timeTimer;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _loadUserData(); // 先加载userId，再加载昵称
    _loadUserLevel();
    _startUtcTimeUpdater();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    super.didChangeAppLifecycleState(state);
    if (state == AppLifecycleState.resumed) {
      // 页面重新激活时刷新等级数据
      _loadUserLevel();
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _timeTimer?.cancel();
    super.dispose();
  }

  /// 启动UTC时间更新定时器
  void _startUtcTimeUpdater() {
    _updateUtcTime();
    _timeTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      _updateUtcTime();
    });
  }

  /// 更新UTC时间
  void _updateUtcTime() {
    final now = DateTime.now().toUtc();
    setState(() {
      _utcTime =
          '${now.year}-${now.month.toString().padLeft(2, '0')}-${now.day.toString().padLeft(2, '0')} '
          '${now.hour.toString().padLeft(2, '0')}:${now.minute.toString().padLeft(2, '0')}:${now.second.toString().padLeft(2, '0')}';
    });
  }

  /// 加载用户数据（先加载userId，再加载对应的昵称）
  Future<void> _loadUserData() async {
    setState(() {
      _isLoading = true;
    });

    try {
      // 1. 加载userId
      final savedUserId = _storageService.getUserId();
      if (savedUserId != null && savedUserId.isNotEmpty) {
        setState(() {
          _userId = savedUserId;
          _isLoading = false;
        });
        
        // 2. 加载该userId对应的昵称
        _loadUserNickname();
        
        // 3. 加载Google登录状态
        _loadGoogleSignInStatus();
        
        // 4. 加载 Apple 登录状态（仅 iOS）
        if (Platform.isIOS) _loadAppleSignInStatus();
        return;
      }

      // 如果本地没有，等待UserProvider初始化
      print('⚠️ Settings: 本地未找到userId，等待UserProvider初始化...');

      for (int i = 0; i < 50; i++) {
        await Future.delayed(Duration(milliseconds: 100));
        final retryUserId = _storageService.getUserId();
        if (retryUserId != null && retryUserId.isNotEmpty) {
          setState(() {
            _userId = retryUserId;
            _isLoading = false;
          });
          print('✅ Settings: 从缓存获取userId: $retryUserId (等待${i * 100}ms)');
          
          // 加载昵称和Google状态
          _loadUserNickname();
          _loadGoogleSignInStatus();
          if (Platform.isIOS) _loadAppleSignInStatus();
          return;
        }
      }

      // 超时
      print('❌ Settings: UserProvider初始化超时（5秒）');
      setState(() {
        _userId = 'Tap to Retry';
        _isLoading = false;
      });
    } catch (e) {
      print('Error loading user data: $e');
      setState(() {
        _userId = 'Error: ${e.toString()}';
        _isLoading = false;
      });
    }
  }

  /// 从本地加载用户昵称
  Future<void> _loadUserNickname() async {
    final savedNickname = _storageService.getUserNickname();
    if (savedNickname != null && savedNickname.isNotEmpty) {
      setState(() {
        _userName = savedNickname;
      });
      print('✅ 加载账户昵称: $savedNickname');
    } else {
      print('ℹ️ 该账户没有保存的昵称，显示默认值: $_userName');
    }
  }

  /// 从本地加载UserID（登录已在UserProvider中完成）
  Future<void> _loadUserId() async {
    setState(() {
      _isLoading = true;
    });

    try {
      // 优先从本地存储加载（UserProvider已在APP启动时初始化）
      final savedUserId = _storageService.getUserId();
      if (savedUserId != null && savedUserId.isNotEmpty) {
        setState(() {
          _userId = savedUserId;
          _isLoading = false;
        });
        
        // 加载Google登录状态
        _loadGoogleSignInStatus();
        return; // 找到缓存直接返回，不要再次调用API
      }

      // 如果本地确实没有（极少见），等待UserProvider完成初始化
      print('⚠️ Settings: 本地未找到userId，等待UserProvider初始化...');

      // 等待UserProvider完成初始化（最多5秒，每100ms检查一次）
      for (int i = 0; i < 50; i++) {
        await Future.delayed(Duration(milliseconds: 100));
        final retryUserId = _storageService.getUserId();
        if (retryUserId != null && retryUserId.isNotEmpty) {
          setState(() {
            _userId = retryUserId;
            _isLoading = false;
          });
          print('✅ Settings: 从缓存获取userId: $retryUserId (等待${i * 100}ms)');
          
          // 加载Google登录状态
          _loadGoogleSignInStatus();
          return;
        }
      }

      // 超时后显示错误信息
      print('❌ Settings: UserProvider初始化超时（5秒）');
      setState(() {
        _userId = 'Tap to Retry';
        _isLoading = false;
      });
    } catch (e) {
      print('Error loading user ID: $e');
      setState(() {
        _userId = 'Error: ${e.toString()}';
        _isLoading = false;
      });
    }
  }

  /// 加载Google登录状态
  Future<void> _loadGoogleSignInStatus() async {
    try {
      // 首先从后端API获取最准确的绑定状态
      final userId = _storageService.getUserId();
      if (userId != null && userId.isNotEmpty && userId != 'Loading...' && userId != 'Tap to Retry') {
        print('🔍 从后端API获取Google绑定状态...');
        final response = await _apiService.getGoogleBindingStatus(userId);
        
        if (response['success'] == true && response['data'] != null) {
          final data = response['data'];
          final isBound = data['isBound'] == true;
          final boundEmail = data['google_account'];
          
          print('✅ 后端返回绑定状态: isBound=$isBound, email=$boundEmail');
          
          if (isBound && boundEmail != null && boundEmail.isNotEmpty) {
            // 已绑定：尝试静默登录获取完整账号信息
            final account = await _googleSignIn.signInSilently();
            
            // 验证登录的账号是否与绑定的账号一致
            if (account != null && account.email == boundEmail) {
              setState(() {
                _isGoogleSignedIn = true;
                _googleAccount = account;
                _boundGoogleEmail = boundEmail;
              });
              print('✅ Google账号已绑定并成功登录: ${account.email}');
            } else {
              // 登录的账号与绑定的不一致或无法静默登录，但仍显示已绑定状态
              setState(() {
                _isGoogleSignedIn = true;
                _googleAccount = null; // 未登录，所以account为null
                _boundGoogleEmail = boundEmail; // 但保存绑定的邮箱用于显示
              });
              print('⚠️ 已绑定账号: $boundEmail（当前未登录或登录不同账号）');
            }
            
            // 保存到本地缓存
            await _storageService.saveGoogleSignInStatus(true);
            await _storageService.saveGoogleEmail(boundEmail);
            return;
          }
        }
      }
      
      // 如果后端API获取失败，回退到本地缓存
      print('ℹ️ 使用本地缓存的Google登录状态');
      final isGoogleSignedIn = _storageService.isGoogleSignedIn();
      final googleEmail = _storageService.getGoogleEmail();
      
      if (isGoogleSignedIn == true && googleEmail != null && googleEmail.isNotEmpty) {
        // 尝试静默登录
        final account = await _googleSignIn.signInSilently();
        
        setState(() {
          _isGoogleSignedIn = true;
          _googleAccount = account;
        });
        
        print('✅ 从本地缓存恢复Google登录状态: ${account?.email ?? googleEmail}');
      } else {
        setState(() {
          _isGoogleSignedIn = false;
          _googleAccount = null;
        });
        print('ℹ️ Google账号未绑定');
      }
    } catch (e) {
      print('⚠️ 加载Google登录状态失败: $e');
      // 失败时确保显示未绑定状态
      setState(() {
        _isGoogleSignedIn = false;
        _googleAccount = null;
      });
    }
  }

  /// 加载 Apple 登录状态（仅 iOS）
  Future<void> _loadAppleSignInStatus() async {
    try {
      final userId = _storageService.getUserId();
      if (userId == null || userId.isEmpty) return;
      final response = await _apiService.getAppleBindingStatus(userId);
      if (response['success'] == true && response['data'] != null) {
        final data = response['data'];
        final isBound = data['isBound'] == true;
        final email = data['apple_account'] as String?;
        if (mounted) {
          setState(() {
            _isAppleSignedIn = isBound;
            _boundAppleEmail = isBound ? email : null;
          });
        }
        print('✅ Apple 绑定状态: isBound=$isBound, email=$email');
      }
    } catch (e) {
      print('⚠️ 加载 Apple 登录状态失败: $e');
    }
  }
  
  /// 加载用户等级
  Future<void> _loadUserLevel() async {
    try {
      final userId = _storageService.getUserId();
      if (userId != null && userId.isNotEmpty) {
        final response = await _apiService.getUserLevel(userId);
        if (response['success'] == true && response['data'] != null) {
          final data = response['data'];
          setState(() {
            _userLevel = data['level'] ?? 1;
            _levelName = 'Lv.$_userLevel';
          });
          // 同步到本地存储
          await _storageService.saveUserLevel(_userLevel);
          print('✅ Settings: 等级加载成功 - $_levelName');
        }
      }
    } catch (e) {
      print('⚠️ Settings: 加载等级失败: $e');
      // 使用本地缓存
      setState(() {
        _userLevel = _storageService.getUserLevel();
        _levelName = 'Lv.$_userLevel';
      });
    }
  }

  void _openWebView(String title, String url) {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => WebViewScreen(title: title, url: url),
      ),
    );
  }

  Future<void> _openContactEmail() async {
    final emailUri = Uri(
      scheme: 'mailto',
      path: 'maguiremarks70@gmail.com',
      queryParameters: {
        'subject': 'Bitcoin_Mining_Master_Support',
      },
    );
    await launchUrl(emailUri, mode: LaunchMode.externalApplication);
  }

  Future<void> _openStoreReview() async {
    if (Platform.isAndroid) {
      const packageName = 'com.cloudminingtool.bitcoin_mining_app';
      final marketUri = Uri.parse('market://details?id=$packageName');
      final webUri = Uri.parse(
          'https://play.google.com/store/apps/details?id=$packageName');
      if (await canLaunchUrl(marketUri)) {
        await launchUrl(marketUri);
      } else {
        await launchUrl(webUri, mode: LaunchMode.externalApplication);
      }
    } else if (Platform.isIOS) {
      // App Store ID (上架后替换为正确的数字 ID，例如 '6743692060')
      const appStoreId = 'YOUR_APP_STORE_ID';
      final storeUri = Uri.parse(
          'itms-apps://apps.apple.com/app/id$appStoreId?action=write-review');
      final webUri = Uri.parse(
          'https://apps.apple.com/app/id$appStoreId?action=write-review');
      if (await canLaunchUrl(storeUri)) {
        await launchUrl(storeUri);
      } else {
        await launchUrl(webUri, mode: LaunchMode.externalApplication);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Settings'),
        automaticallyImplyLeading: false,
      ),
      body: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const SizedBox(height: 16),

            // User Info
            _buildUserCard(),

            const SizedBox(height: 16),

            // UTC Time Display
            _buildUtcTimeCard(),

            const SizedBox(height: 20),

            // General Settings
            _buildSectionTitle('General'),
            _buildSettingsCard([
              _buildNavigationItem(
                icon: Icons.language,
                iconColor: AppColors.primary,
                title: 'Language',
                subtitle: 'English',
                onTap: () {},
              ),
              _buildDivider(),
              _buildSwitchItem(
                icon: Icons.notifications,
                iconColor: AppColors.primary,
                title: 'Push Notifications',
                subtitle: 'Receive important message notifications',
                value: _pushNotifications,
                onChanged: (value) {
                  setState(() {
                    _pushNotifications = value;
                  });
                },
              ),
            ]),

            const SizedBox(height: 20),

            // Account
            _buildSectionTitle('Account'),
            _buildSettingsCard([
              // Google Sign In - Android only
              if (Platform.isAndroid)
                _buildNavigationItem(
                  icon: _isGoogleSignedIn ? Icons.account_circle : Icons.login,
                  iconColor: _isGoogleSignedIn
                      ? const Color(0xFF4CAF50)
                      : AppColors.primary,
                  title: _isGoogleSignedIn
                      ? 'Google Account'
                      : 'Sign In with Google',
                  subtitle: _isGoogleSignedIn
                      ? (_googleAccount?.email ?? _boundGoogleEmail ?? 'Bound')
                      : 'Not Connected',
                  trailing: _isGoogleSignedIn
                      ? Icon(Icons.lock, color: AppColors.textSecondary, size: 20)
                      : null,
                  onTap: () {
                    if (_isGoogleSignedIn) {
                      _showAlreadyBoundDialog();
                    } else {
                      _showBindingConfirmationDialog();
                    }
                  },
                ),
              // Apple Sign In - iOS only
              if (Platform.isIOS)
                _buildNavigationItem(
                  icon: Icons.apple,
                  iconColor: _isAppleSignedIn ? const Color(0xFF4CAF50) : AppColors.primary,
                  title: _isAppleSignedIn ? 'Apple Account' : 'Sign In with Apple',
                  subtitle: _isAppleSignedIn
                      ? (_boundAppleEmail ?? 'Bound')
                      : 'Not Connected',
                  trailing: _isAppleSignedIn
                      ? Icon(Icons.lock, color: AppColors.textSecondary, size: 20)
                      : null,
                  onTap: () {
                    if (_isAppleSignedIn) {
                      _showAppleAlreadyBoundDialog();
                    } else {
                      _showAppleBindingConfirmationDialog();
                    }
                  },
                ),
            ]),

            const SizedBox(height: 20),

            // About
            _buildSectionTitle('About'),
            _buildSettingsCard([
              _buildNavigationItem(
                icon: Icons.star_rate_rounded,
                iconColor: AppColors.primary,
                title: 'Support Us',
                subtitle: 'Your rating helps us improve',
                onTap: _openStoreReview,
              ),
              _buildDivider(),
              _buildNavigationItem(
                icon: Icons.alternate_email,
                iconColor: AppColors.primary,
                title: 'Contact Us',
                onTap: _openContactEmail,
              ),
              _buildDivider(),
              _buildNavigationItem(
                icon: Icons.description,
                iconColor: AppColors.primary,
                title: 'Terms of Service',
                onTap: () => _openWebView('Terms of Service', 'https://davidpony007.github.io/bitcoin-mining-master-legal/terms-of-service.html'),
              ),
              _buildDivider(),
              _buildNavigationItem(
                icon: Icons.privacy_tip,
                iconColor: AppColors.primary,
                title: 'Privacy Policy',
                onTap: () => _openWebView('Privacy Policy', 'https://davidpony007.github.io/bitcoin-mining-master-legal/privacy-policy.html'),
              ),
            ]),

            const SizedBox(height: 32),

            // Log Out Button
            _buildLogOutButton(),

            const SizedBox(height: 16),

            // Delete Account
            _buildDeleteAccountButton(),

            const SizedBox(height: 32),
          ],
        ),
      ),
    );
  }

  Widget _buildUserCard() {
    return InkWell(
      onTap: _showEditNameDialog,
      child: Container(
        margin: const EdgeInsets.symmetric(horizontal: 16),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: AppColors.cardDark,
          borderRadius: BorderRadius.circular(12),
        ),
        child: Row(
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: AppColors.surface,
                shape: BoxShape.circle,
              ),
              child: Icon(Icons.person, size: 24, color: AppColors.primary),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          _userName,
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 18,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                      Icon(Icons.edit, color: AppColors.textSecondary, size: 20),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      Text(
                        'User ID: ',
                        style: TextStyle(
                          color: AppColors.textSecondary,
                          fontSize: 13,
                        ),
                      ),
                      Flexible(
                        child: Text(
                          _isLoading ? 'Loading...' : _userId,
                          style: TextStyle(
                            color: AppColors.primary,
                            fontSize: 13,
                            fontWeight: FontWeight.w500,
                          ),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 8,
                      vertical: 2,
                    ),
                    decoration: BoxDecoration(
                      color: AppColors.primary.withOpacity(0.2),
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: Text(
                      _levelName,
                      style: TextStyle(
                        color: AppColors.primary,
                        fontSize: 12,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildUtcTimeCard() {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.cardDark,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.primary.withOpacity(0.3), width: 1),
      ),
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: AppColors.primary.withOpacity(0.15),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Icon(Icons.schedule, size: 24, color: AppColors.primary),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'System Time (UTC+00:00)',
                  style: TextStyle(
                    color: AppColors.textSecondary,
                    fontSize: 13,
                    fontWeight: FontWeight.w500,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  _utcTime,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 15,
                    fontWeight: FontWeight.bold,
                    letterSpacing: 0.3,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(
              color: const Color(0xFF4CAF50).withOpacity(0.2),
              borderRadius: BorderRadius.circular(6),
            ),
            child: const Text(
              'UTC',
              style: TextStyle(
                color: Color(0xFF4CAF50),
                fontSize: 12,
                fontWeight: FontWeight.bold,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSectionTitle(String title) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
      child: Text(
        title,
        style: TextStyle(color: AppColors.textSecondary, fontSize: 14),
      ),
    );
  }

  Widget _buildSettingsCard(List<Widget> children) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16),
      decoration: BoxDecoration(
        color: AppColors.cardDark,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(children: children),
    );
  }

  Widget _buildNavigationItem({
    required IconData icon,
    required Color iconColor,
    required String title,
    String? subtitle,
    Widget? trailing,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: iconColor.withOpacity(0.15),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Icon(icon, color: iconColor, size: 24),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: const TextStyle(color: Colors.white, fontSize: 16),
                  ),
                  if (subtitle != null) ...[
                    const SizedBox(height: 4),
                    Text(
                      subtitle,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: AppColors.textSecondary,
                        fontSize: 11,
                      ),
                    ),
                  ],
                ],
              ),
            ),
            trailing ?? Icon(Icons.chevron_right, color: AppColors.textSecondary),
          ],
        ),
      ),
    );
  }

  Widget _buildSwitchItem({
    required IconData icon,
    required Color iconColor,
    required String title,
    String? subtitle,
    required bool value,
    required ValueChanged<bool> onChanged,
  }) {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: iconColor.withOpacity(0.15),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Icon(icon, color: iconColor, size: 24),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(color: Colors.white, fontSize: 16),
                ),
                if (subtitle != null) ...[
                  const SizedBox(height: 4),
                  Text(
                    subtitle,
                    style: TextStyle(
                      color: AppColors.textSecondary,
                      fontSize: 13,
                    ),
                  ),
                ],
              ],
            ),
          ),
          Switch(
            value: value,
            onChanged: onChanged,
            activeThumbColor: AppColors.primary,
          ),
        ],
      ),
    );
  }

  Widget _buildDivider() {
    return Padding(
      padding: const EdgeInsets.only(left: 72),
      child: Divider(height: 1, color: AppColors.divider),
    );
  }

  Widget _buildLogOutButton() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: OutlinedButton.icon(
        onPressed: () {
          _showLogOutDialog();
        },
        icon: const Icon(Icons.logout),
        label: const Text(
          'Log Out',
          style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
        ),
        style: OutlinedButton.styleFrom(
          foregroundColor: AppColors.primary,
          side: BorderSide(color: AppColors.primary),
          padding: const EdgeInsets.symmetric(vertical: 16),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
        ),
      ),
    );
  }

  Widget _buildDeleteAccountButton() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: ElevatedButton(
        onPressed: () {
          _showDeleteAccountDialog();
        },
        style: ElevatedButton.styleFrom(
          backgroundColor: Colors.redAccent,
          foregroundColor: Colors.white,
          padding: const EdgeInsets.symmetric(vertical: 16),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
        ),
        child: const Text(
          'Delete Account',
          style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
        ),
      ),
    );
  }

  void _handleGoogleSignIn() async {
    try {
      // 先尝试静默登录
      dynamic account = await _googleSignIn?.signInSilently();

      // 如果静默登录失败，弹出登录界面
      account ??= await _googleSignIn?.signIn();

      if (account != null) {
        // 获取认证信息
        final dynamic auth = await account.authentication;

        print('✅ Google登录成功！');
        print('User ID: ${account.id}');
        print('User Name: ${account.displayName}');
        print('Email: ${account.email}');

        // 显示加载指示器
        if (mounted) {
          showDialog(
            context: context,
            barrierDismissible: false,
            builder: (context) => Center(
              child: CircularProgressIndicator(
                color: AppColors.primary,
              ),
            ),
          );
        }

        // 绑定Google账号到当前用户
        try {
          final apiService = ApiService();
          
          // 调用绑定接口：把Google账号绑定到当前user_id
          print('🔍 绑定Google账号到当前用户 - userId: $_userId, email: ${account.email}');
          final response = await apiService.bindGoogle(
            userId: _userId,
            googleAccount: account.email ?? '',
          );

          // 关闭加载指示器
          if (mounted) Navigator.of(context).pop();

          print('🔍 绑定响应: $response');

          if (response['success'] == true) {
            // 绑定成功
            print('✅ Google账号已成功绑定到当前用户: $_userId');
            
            // 保存Google登录状态
            final storageService = StorageService();
            await storageService.saveGoogleSignInStatus(true);
            await storageService.saveGoogleEmail(account.email ?? '');
            
            if (mounted) {
              setState(() {
                _isGoogleSignedIn = true;
                _googleAccount = account;
              });

              // 显示成功消息
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(
                  content: Text(
                    'Welcome, ${account.displayName ?? account.email}!',
                  ),
                  backgroundColor: const Color(0xFF4CAF50),
                  duration: const Duration(seconds: 2),
                ),
              );
            }
          } else {
            // 检查是否是"已绑定"错误
            String errorMsg = response['message'] ?? response['error'] ?? 'Failed to bind Google account';
            print('❌ 绑定响应失败: $errorMsg');
            
            if (errorMsg.contains('already bound')) {
              // 检查是否绑定的是当前Google账号
              if (errorMsg.contains(account.email ?? '')) {
                // 是同一个账号，允许登录
                print('✅ 检测到已绑定当前Google账号，允许登录');
                
                final storageService = StorageService();
                await storageService.saveGoogleSignInStatus(true);
                await storageService.saveGoogleEmail(account.email ?? '');
                
                if (mounted) {
                  setState(() {
                    _isGoogleSignedIn = true;
                    _googleAccount = account;
                  });

                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text(
                        'Welcome back, ${account.displayName ?? account.email}!',
                      ),
                      backgroundColor: const Color(0xFF4CAF50),
                      duration: const Duration(seconds: 2),
                    ),
                  );
                }
              } else {
                // 不是同一个账号，拒绝登录
                print('❌ 尝试用不同的Google账号登录已绑定的用户');
                await _googleSignIn.signOut();
                
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text(
                        'This user ID is already linked to another Google account. Each user ID can only be permanently linked to one Google account. If you want to create a new user, please log out first and then sign in with another Google account.',
                      ),
                      backgroundColor: Colors.red.shade700,
                      duration: const Duration(seconds: 6),
                    ),
                  );
                }
              }
            } else {
              // 其他错误，撤销登录
              await _googleSignIn.signOut();
              
              if (mounted) {
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                    content: Text(errorMsg),
                    backgroundColor: Colors.red.shade700,
                    duration: const Duration(seconds: 3),
                  ),
                );
              }
            }
          }
        } catch (apiError) {
          // 关闭加载指示器
          if (mounted) Navigator.of(context).pop();
          
          print('❌ 调用API失败: $apiError');
          
          // API调用失败，撤销Google登录
          await _googleSignIn.signOut();
          
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text('Failed to switch account. Please try again.'),
                backgroundColor: Colors.red.shade700,
                duration: const Duration(seconds: 3),
              ),
            );
          }
        }
      }
    } catch (error) {
      print('❌ Google登录失败: $error');

      if (mounted) {
        String errorMessage = 'Failed to sign in';
        if (error.toString().contains('DEVELOPER_ERROR') ||
            error.toString().contains('10')) {
          errorMessage = 'OAuth configuration error, please check Google Cloud Console settings';
        } else if (error.toString().contains('network')) {
          errorMessage = 'Network error, please check your connection';
        } else if (error.toString().contains('sign_in_canceled')) {
          errorMessage = 'Sign-in cancelled';
        }

        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(errorMessage),
            backgroundColor: Colors.red.shade700,
            duration: const Duration(seconds: 3),
          ),
        );
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────
  //  Apple Sign-In（仅 iOS）
  // ─────────────────────────────────────────────────────────────────

  Future<void> _handleAppleSignIn() async {
    try {
      // 请求 Apple 授权
      final credential = await SignInWithApple.getAppleIDCredential(
        scopes: [
          AppleIDAuthorizationScopes.email,
          AppleIDAuthorizationScopes.fullName,
        ],
      );

      final appleId = credential.userIdentifier;
      if (appleId == null || appleId.isEmpty) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: const Text('Failed to get Apple ID. Please try again.'),
              backgroundColor: Colors.red.shade700,
            ),
          );
        }
        return;
      }

      final appleEmail = credential.email;

      // 显示加载
      if (mounted) {
        showDialog(
          context: context,
          barrierDismissible: false,
          builder: (_) => Center(child: CircularProgressIndicator(color: AppColors.primary)),
        );
      }

      try {
        final apiService = ApiService();
        print('🍎 绑定 Apple 账号到用户: $_userId, apple_id: $appleId');
        final response = await apiService.bindApple(
          userId: _userId,
          appleId: appleId,
          appleAccount: appleEmail,
        );

        if (mounted) Navigator.of(context).pop(); // 关闭加载

        if (response['success'] == true) {
          if (mounted) {
            setState(() {
              _isAppleSignedIn = true;
              _boundAppleEmail = appleEmail;
            });
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text('Apple account linked successfully!'),
                backgroundColor: const Color(0xFF4CAF50),
                duration: const Duration(seconds: 2),
              ),
            );
          }
        } else {
          final msg = response['message'] ?? response['error'] ?? 'Failed to link Apple account';
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text(msg),
                backgroundColor: Colors.red.shade700,
                duration: const Duration(seconds: 4),
              ),
            );
          }
        }
      } catch (apiError) {
        if (mounted) Navigator.of(context).pop();
        print('❌ Apple 绑定 API 失败: $apiError');
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: const Text('Failed to link Apple account. Please try again.'),
              backgroundColor: Colors.red.shade700,
            ),
          );
        }
      }
    } on SignInWithAppleAuthorizationException catch (e) {
      if (e.code == AuthorizationErrorCode.canceled) {
        // 用户取消，不提示
        print('ℹ️ 用户取消了 Apple 登录');
        return;
      }
      print('❌ Apple 授权失败: ${e.code} - ${e.message}');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Apple sign-in failed: ${e.message}'),
            backgroundColor: Colors.red.shade700,
            duration: const Duration(seconds: 3),
          ),
        );
      }
    } catch (e) {
      print('❌ Apple 登录异常: $e');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: const Text('Apple sign-in failed. Please try again.'),
            backgroundColor: Colors.red.shade700,
          ),
        );
      }
    }
  }

  void _showAppleBindingConfirmationDialog() {
    showDialog(
      context: context,
      builder: (BuildContext context) {
        return AlertDialog(
          backgroundColor: AppColors.cardDark,
          title: Row(
            children: [
              Icon(Icons.warning_amber_rounded, color: Colors.orange, size: 28),
              const SizedBox(width: 8),
              Text('Important Notice', style: TextStyle(color: AppColors.textPrimary)),
            ],
          ),
          content: Text(
            'Each User ID can only be bound to ONE Apple account permanently. Once bound, it cannot be unbound or changed.\n\nAre you sure you want to bind your Apple account to this User ID?',
            style: TextStyle(color: AppColors.textSecondary, height: 1.5),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(),
              child: Text('Cancel', style: TextStyle(color: AppColors.textSecondary)),
            ),
            TextButton(
              onPressed: () {
                Navigator.of(context).pop();
                _handleAppleSignIn();
              },
              child: Text('I Understand',
                  style: TextStyle(color: AppColors.primary, fontWeight: FontWeight.bold)),
            ),
          ],
        );
      },
    );
  }

  void _showAppleAlreadyBoundDialog() {
    showDialog(
      context: context,
      builder: (BuildContext context) {
        return AlertDialog(
          backgroundColor: AppColors.cardDark,
          title: Row(
            children: [
              Icon(Icons.apple, color: AppColors.primary, size: 28),
              const SizedBox(width: 8),
              Text('Apple Account', style: TextStyle(color: AppColors.textPrimary)),
            ],
          ),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('This account is permanently linked to your Apple ID.',
                  style: TextStyle(color: AppColors.textSecondary)),
              if (_boundAppleEmail != null) ...[
                const SizedBox(height: 12),
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: AppColors.surface,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Row(
                    children: [
                      Icon(Icons.email, color: AppColors.primary, size: 20),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          _boundAppleEmail!,
                          style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
              const SizedBox(height: 12),
              Row(
                children: [
                  Icon(Icons.lock, color: AppColors.textSecondary, size: 16),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text('Permanent binding cannot be removed.',
                        style: TextStyle(color: AppColors.textSecondary, fontSize: 12)),
                  ),
                ],
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(),
              child: Text('OK', style: TextStyle(color: AppColors.primary, fontWeight: FontWeight.bold)),
            ),
          ],
        );
      },
    );
  }

  void _showAlreadyBoundDialog() {
    showDialog(
      context: context,
      builder: (BuildContext context) {
        return AlertDialog(
          backgroundColor: AppColors.cardDark,
          title: Row(
            children: [
              Icon(Icons.info_outline, color: AppColors.primary, size: 28),
              SizedBox(width: 8),
              Text(
                'Google Account',
                style: TextStyle(color: AppColors.textPrimary),
              ),
            ],
          ),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'This account is permanently linked to:',
                style: TextStyle(color: AppColors.textSecondary),
              ),
              SizedBox(height: 12),
              Container(
                padding: EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Row(
                  children: [
                    Icon(Icons.email, color: AppColors.primary, size: 20),
                    SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        _googleAccount?.email ?? _boundGoogleEmail ?? 'Unknown',
                        style: TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              SizedBox(height: 12),
              Text(
                'For security reasons, Google account binding is permanent and cannot be changed or removed.',
                style: TextStyle(
                  color: AppColors.textSecondary,
                  fontSize: 13,
                  height: 1.5,
                ),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(),
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

  void _showSignOutDialog() {
    showDialog(
      context: context,
      builder: (BuildContext context) {
        return AlertDialog(
          backgroundColor: AppColors.cardDark,
          title: Text(
            'Sign Out',
            style: TextStyle(color: AppColors.textPrimary),
          ),
          content: Text(
            'Sign out from your Google account?',
            style: TextStyle(color: AppColors.textSecondary),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(),
              child: Text(
                'Cancel',
                style: TextStyle(color: AppColors.textSecondary),
              ),
            ),
            TextButton(
              onPressed: () async {
                // 只做本地登出，不解绑数据库
                await _googleSignIn.signOut();
                Navigator.of(context).pop();
                setState(() {
                  _isGoogleSignedIn = false;
                  _googleAccount = null;
                });
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text(
                        'Signed out successfully. You can sign in with another Google account.',
                      ),
                      duration: Duration(seconds: 3),
                    ),
                  );
                }
              },
              child: Text(
                'Sign Out',
                style: TextStyle(color: AppColors.primary),
              ),
            ),
          ],
        );
      },
    );
  }

  void _showBindingConfirmationDialog() {
    showDialog(
      context: context,
      builder: (BuildContext context) {
        return AlertDialog(
          backgroundColor: AppColors.cardDark,
          title: Row(
            children: [
              Icon(Icons.warning_amber_rounded, color: Colors.orange, size: 28),
              SizedBox(width: 8),
              Text(
                'Important Notice',
                style: TextStyle(color: AppColors.textPrimary),
              ),
            ],
          ),
          content: Text(
            'Each User ID can only be bound to ONE Google account permanently. Once bound, it cannot be unbound or changed.\n\nAre you sure you want to bind your Google account to this User ID?',
            style: TextStyle(color: AppColors.textSecondary, height: 1.5),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(),
              child: Text(
                'Cancel',
                style: TextStyle(color: AppColors.textSecondary),
              ),
            ),
            TextButton(
              onPressed: () {
                Navigator.of(context).pop();
                _handleGoogleSignIn();
              },
              child: Text(
                'I Understand',
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

  void _showEditNameDialog() {
    final nameController = TextEditingController(text: _userName);

    showDialog(
      context: context,
      builder: (BuildContext context) {
        return AlertDialog(
          backgroundColor: AppColors.cardDark,
          title: Text(
            'Edit Username',
            style: TextStyle(color: AppColors.textPrimary),
          ),
          content: TextField(
            controller: nameController,
            style: const TextStyle(color: Colors.white),
            decoration: InputDecoration(
              hintText: 'Enter your username',
              hintStyle: TextStyle(color: AppColors.textSecondary),
              enabledBorder: UnderlineInputBorder(
                borderSide: BorderSide(color: AppColors.divider),
              ),
              focusedBorder: UnderlineInputBorder(
                borderSide: BorderSide(color: AppColors.primary),
              ),
            ),
            maxLength: 20,
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(),
              child: Text(
                'Cancel',
                style: TextStyle(color: AppColors.textSecondary),
              ),
            ),
            TextButton(
              onPressed: () {
                final newName = nameController.text.trim();
                print('🔧 [EditUsername] 点击Save按钮');
                print('🔧 [EditUsername] newName: $newName');
                print('🔧 [EditUsername] _userId: $_userId');
                
                if (newName.isEmpty) {
                  print('🔧 [EditUsername] 昵称为空，不执行操作');
                  return;
                }
                
                print('🔧 [EditUsername] 昵称验证通过，关闭对话框');
                // 先关闭输入对话框
                Navigator.of(context).pop();
                
                print('🔧 [EditUsername] 对话框已关闭，准备执行异步操作');
                // 在对话框外部执行异步操作
                _updateNicknameAsync(newName);
              },
              child: Text('Save', style: TextStyle(color: AppColors.primary)),
            ),
          ],
        );
      },
    );
  }

  // 异步更新昵称方法（在dialog外部执行）
  Future<void> _updateNicknameAsync(String newName) async {
    print('🔧 [_updateNicknameAsync] 开始执行，newName: $newName');
    
    // 等待对话框关闭动画
    await Future.delayed(const Duration(milliseconds: 200));
    
    // 检查widget是否还挂载
    if (!mounted) {
      print('🔧 [_updateNicknameAsync] Widget未挂载，终止操作');
      return;
    }
    
    print('🔧 [_updateNicknameAsync] Widget已挂载，显示加载对话框');
    
    // 显示加载指示器
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (BuildContext context) => WillPopScope(
        onWillPop: () async => false,
        child: const Center(
          child: CircularProgressIndicator(
            color: AppColors.primary,
          ),
        ),
      ),
    );
    
    // 记录显示了对话框
    bool dialogShown = true;

    try {
      print('🔧 [_updateNicknameAsync] 开始调用API...');
      // 调用API更新昵称
      final result = await _apiService.updateNickname(
        userId: _userId,
        nickname: newName,
      );
      print('🔧 [_updateNicknameAsync] API调用成功: $result');

      // 安全关闭加载对话框
      if (mounted && dialogShown) {
        Navigator.of(context, rootNavigator: true).pop();
        dialogShown = false;
      }
      
      // 等待关闭动画
      await Future.delayed(const Duration(milliseconds: 100));

      if (result['success'] == true) {
        print('🔧 [_updateNicknameAsync] 更新成功，刷新UI');
        if (mounted) {
          // 保存到本地存储
          await _storageService.saveUserNickname(newName);
          print('✅ 昵称已保存到本地: $newName');
          
          setState(() {
            _userName = newName;
          });
          
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Username updated successfully'),
              backgroundColor: Colors.green,
              duration: Duration(seconds: 2),
            ),
          );
        }
      } else {
        print('🔧 [_updateNicknameAsync] 更新失败: ${result['message']}');
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(result['message'] ?? 'Failed to update username'),
              backgroundColor: Colors.red,
              duration: const Duration(seconds: 2),
            ),
          );
        }
      }
    } catch (e) {
      print('🔧 [_updateNicknameAsync] 捕获异常: $e');
      // 安全关闭加载对话框
      if (mounted && dialogShown) {
        try {
          Navigator.of(context, rootNavigator: true).pop();
          dialogShown = false;
        } catch (navError) {
          print('🔧 [_updateNicknameAsync] 导航错误（已忽略）: $navError');
        }
      }
      
      // 等待关闭动画
      await Future.delayed(const Duration(milliseconds: 100));
      
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Update failed: ${e.toString()}'),
            backgroundColor: Colors.red,
            duration: const Duration(seconds: 3),
          ),
        );
      }
    }
  }

  void _showLogOutDialog() {
    // 检查用户是否绑定了Google账户
    if (!_isGoogleSignedIn) {
      // 游客用户 - 显示警告对话框
      _showGuestLogOutWarningDialog();
    } else {
      // 已绑定Google账户 - 显示普通退出对话框
      _showNormalLogOutDialog();
    }
  }

  /// 游客用户退出警告对话框
  void _showGuestLogOutWarningDialog() {
    showDialog(
      context: context,
      builder: (BuildContext context) {
        return AlertDialog(
          backgroundColor: AppColors.cardDark,
          title: Row(
            children: [
              Icon(Icons.warning_amber_rounded, color: Colors.orange, size: 28),
              const SizedBox(width: 8),
              Text(
                'Warning',
                style: TextStyle(color: AppColors.textPrimary),
              ),
            ],
          ),
          content: Text(
            'Your account is a guest user. To avoid losing profits, you should bind a Google account first. If you do not have a Google account, please register one first!',
            style: TextStyle(color: AppColors.textSecondary, height: 1.5),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(),
              child: Text(
                'Cancel',
                style: TextStyle(color: AppColors.textSecondary),
              ),
            ),
            TextButton(
              onPressed: () async {
                Navigator.of(context).pop();
                await _handleLogOut();
              },
              child: Text(
                'Still Log Out',
                style: TextStyle(
                  color: Colors.red,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
          ],
        );
      },
    );
  }

  /// 普通退出对话框（已绑定Google账户）
  void _showNormalLogOutDialog() {
    showDialog(
      context: context,
      builder: (BuildContext context) {
        return AlertDialog(
          backgroundColor: AppColors.cardDark,
          title: Row(
            children: [
              Icon(Icons.logout, color: AppColors.primary, size: 28),
              const SizedBox(width: 8),
              Text(
                'Log Out',
                style: TextStyle(color: AppColors.textPrimary),
              ),
            ],
          ),
          content: Text(
            'Are you sure you want to log out? You will need to sign in again to access your account.',
            style: TextStyle(color: AppColors.textSecondary, height: 1.5),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(),
              child: Text(
                'Cancel',
                style: TextStyle(color: AppColors.textSecondary),
              ),
            ),
            TextButton(
              onPressed: () async {
                Navigator.of(context).pop();
                await _handleLogOut();
              },
              child: Text(
                'Log Out',
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

  Future<void> _handleLogOut() async {
    try {
      // 1. 退出Google账号（如果已登录）
      if (_isGoogleSignedIn) {
        await _googleSignIn.signOut();
      }

      // 2. 清除登录状态（但保留 user_id 和 invitation_code 用于账号恢复）
      // 注意：不删除 user_id 和 invitation_code，这样用户下次登录时可以恢复账号
      // 也不删除昵称，每个账户的昵称独立保存
      // await _storageService.clearUserId();  // ❌ 不删除
      // await _storageService.clearInvitationCode();  // ❌ 不删除
      // await _storageService.clearUserNickname();  // ❌ 不删除
      await _storageService.saveGoogleSignInStatus(false);
      await _storageService.saveGoogleEmail('');
      await _storageService.saveIsLoggedOut(true);  // ✅ 标记为已登出状态

      // 3. 显示成功提示
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('✅ Logged out successfully'),
            backgroundColor: Colors.green,
            duration: Duration(seconds: 2),
          ),
        );

        // 4. 等待一下再跳转，让用户看到提示
        await Future.delayed(const Duration(milliseconds: 500));

        // 5. 导航到登录页面（清除所有路由栈）
        if (mounted) {
          Navigator.of(context).pushAndRemoveUntil(
            MaterialPageRoute(builder: (context) => const LoginScreen()),
            (route) => false, // 清除所有路由
          );
        }
      }
    } catch (e) {
      print('❌ Log out error: $e');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('❌ Log out failed: ${e.toString()}'),
            backgroundColor: Colors.red,
            duration: const Duration(seconds: 3),
          ),
        );
      }
    }
  }

  void _showDeleteAccountDialog() {
    showDialog(
      context: context,
      builder: (BuildContext context) {
        return AlertDialog(
          backgroundColor: AppColors.cardDark,
          title: const Text(
            'Delete Account',
            style: TextStyle(color: Colors.redAccent),
          ),
          content: Text(
            'Are you sure you want to delete your account? This action cannot be undone and all your data will be permanently deleted.',
            style: TextStyle(color: AppColors.textSecondary),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(),
              child: Text(
                'Cancel',
                style: TextStyle(color: AppColors.textSecondary),
              ),
            ),
            TextButton(
              onPressed: () {
                // TODO: Implement account deletion
                Navigator.of(context).pop();
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(
                    content: Text('Account deletion requested'),
                    backgroundColor: Colors.redAccent,
                  ),
                );
              },
              child: const Text(
                'Delete',
                style: TextStyle(
                  color: Colors.redAccent,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
          ],
        );
      },
    );
  }
}
