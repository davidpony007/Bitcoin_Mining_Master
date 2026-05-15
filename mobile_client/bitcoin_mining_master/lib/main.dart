import 'package:flutter/material.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:provider/provider.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:url_launcher/url_launcher.dart';
import 'dart:io' show Platform;
import 'providers/user_provider.dart';
import 'screens/home_screen.dart';
import 'screens/login_screen.dart';
import 'constants/app_constants.dart';
import 'services/storage_service.dart';
import 'services/admob_service.dart';
import 'services/api_service.dart';
import 'services/push_notification_service.dart';
import 'services/analytics_service.dart';
import 'firebase_options.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // 本地存储（SplashScreen 立即需要）
  try {
    await StorageService().init().timeout(const Duration(seconds: 1));
  } catch (_) {}

  // Firebase 必须在 runApp 之前初始化
  // 因为 MaterialApp 的 navigatorObservers 构建时就会访问 FirebaseAnalytics.instance
  try {
    await Firebase.initializeApp(
      options: DefaultFirebaseOptions.currentPlatform,
    ).timeout(const Duration(seconds: 8));
  } catch (e) {
    if (!e.toString().contains('duplicate-app')) {
      debugPrint('⚠️ Firebase 初始化失败/超时: $e');
    }
  }

  runApp(const MyApp());

  // 推送 + AdMob 不影响 UI，继续异步初始化
  PushNotificationService.initialize().catchError((_) {});
  AdMobService.initialize().catchError((_) {});
}

class MyApp extends StatefulWidget {
  const MyApp({super.key});

  @override
  State<MyApp> createState() => _MyAppState();
}

/// 全局生命周期 Observer：MyApp 永不销毁，保证 notifyAppResumed() 始终有效
class _MyAppState extends State<MyApp> with WidgetsBindingObserver {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      ApiService.notifyAppResumed();
    }
  }

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => UserProvider()..initializeUser()),
      ],
      child: MaterialApp(
        title: 'Bitcoin Mining Master',
        debugShowCheckedModeBanner: false,
        navigatorObservers: [AnalyticsService.instance.observer],
        theme: ThemeData(
          brightness: Brightness.dark,
          primaryColor: AppColors.primary,
          scaffoldBackgroundColor: AppColors.background,
          appBarTheme: AppBarTheme(
            backgroundColor: const Color(0xFF1C1C1E),
            elevation: 0,
            centerTitle: true,
            titleTextStyle: const TextStyle(
              color: Colors.white,
              fontSize: 20,
              fontWeight: FontWeight.bold,
            ),
          ),
          bottomNavigationBarTheme: BottomNavigationBarThemeData(
            backgroundColor: AppColors.surface,
            selectedItemColor: AppColors.primary,
            unselectedItemColor: AppColors.textSecondary,
            type: BottomNavigationBarType.fixed,
            elevation: 8,
          ),
          cardColor: AppColors.cardDark,
          colorScheme: ColorScheme.dark(
            primary: AppColors.primary,
            secondary: AppColors.secondary,
            surface: AppColors.surface,
          ),
        ),
        home: const SplashScreen(), // 启动时显示启动页，检查登录状态
      ),
    );
  }
}

/// 启动页 - 检查用户是否需要显示登录页
class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen>
    with WidgetsBindingObserver {
  final StorageService _storageService = StorageService();
  final ApiService _apiService = ApiService();
  bool _hasNavigated = false;
  bool _isBootstrapping = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _bootstrapApp();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  /// App 从后台恢复到前台时上报活跃心跳
  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      // 记录 resume 时间：恢复后 3 秒内的网络错误为正常抖动，不弹 Toast
      ApiService.notifyAppResumed();
      PushNotificationService.reportActive();
      // 用户回到前台时重新上报 FCM token（token 可能已刷新）
      PushNotificationService.initialize();
      if (!_hasNavigated && !_isBootstrapping) {
        _bootstrapApp(skipDelay: true);
      }
    }
  }

  Future<void> _bootstrapApp({bool skipDelay = false}) async {
    if (_isBootstrapping) return;
    _isBootstrapping = true;
    try {
      if (!skipDelay) {
        await Future.delayed(const Duration(milliseconds: 300));
      }

      final canContinue = await _checkAppUpdate();
      if (!canContinue || !mounted || _hasNavigated) return;

      await _checkLoginStatus();
    } finally {
      _isBootstrapping = false;
    }
  }

  Future<bool> _checkAppUpdate() async {
    try {
      final info = await PackageInfo.fromPlatform();
      final config = await _apiService.getAppConfig(
        platform: Platform.isIOS ? 'ios' : 'android',
        currentVersion: info.version,
      );
      if (config == null || config['has_update'] != true) {
        return true;
      }

      final forceUpdate = config['force_update'] == true;
      final latestVersion = (config['latest_version'] ?? '').toString();
      final updateMessage = ((config['update_message'] ?? '') as String).trim();
      final storeUrl = _resolveStoreUrl(config['store_url'] as String?);

      if (!mounted) return false;

      if (forceUpdate) {
        await showDialog<void>(
          context: context,
          barrierDismissible: false,
          builder: (dialogContext) => AlertDialog(
            title: const Text('Update Required'),
            content: Text(
              updateMessage.isNotEmpty
                  ? updateMessage
                  : 'A newer version ($latestVersion) is required to continue using the app.',
            ),
            actions: [
              TextButton(
                onPressed: () => _openStoreUrl(storeUrl),
                child: const Text('Update Now'),
              ),
            ],
          ),
        );
        return false;
      }

      final shouldContinue = await showDialog<bool>(
        context: context,
        builder: (dialogContext) => AlertDialog(
          title: const Text('Update Available'),
          content: Text(
            updateMessage.isNotEmpty
                ? updateMessage
                : 'Version $latestVersion is available. Update now for the latest fixes and improvements.',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(dialogContext).pop(true),
              child: const Text('Later'),
            ),
            TextButton(
              onPressed: () async {
                await _openStoreUrl(storeUrl);
                if (dialogContext.mounted) {
                  Navigator.of(dialogContext).pop(true);
                }
              },
              child: const Text('Update'),
            ),
          ],
        ),
      );

      return shouldContinue ?? true;
    } catch (e) {
      print('⚠️ App version check failed (ignored): $e');
      return true;
    }
  }

  String _resolveStoreUrl(String? backendUrl) {
    if (backendUrl != null && backendUrl.trim().isNotEmpty) {
      return backendUrl.trim();
    }
    if (Platform.isIOS) {
      return 'itms-apps://apps.apple.com/app/id${StoreConstants.iosAppStoreId}';
    }
    return 'https://play.google.com/store/apps/details?id=${StoreConstants.androidPackageName}';
  }

  Future<void> _openStoreUrl(String url) async {
    final uri = Uri.parse(url);
    if (!await launchUrl(uri, mode: LaunchMode.externalApplication)) {
      print('⚠️ Failed to open store url: $url');
    }
  }

  /// 检查登录状态，决定显示登录页还是主页
  Future<void> _checkLoginStatus() async {
    // 1. 检查本地是否有用户ID
    final userId = _storageService.getUserId();

    // 2. 如果没有用户ID或是OFFLINE用户，显示登录页
    if (userId == null || userId.isEmpty || userId.startsWith('OFFLINE_')) {
      print('ℹ️ No user ID in storage, showing login screen');
      _navigateToLogin();
      return;
    }

    // 3. 有本地用户ID → 直接进入主页（乐观导航，无需等待网络确认）
    // 后台异步检查封号状态，不阻塞启动
    print('✅ User ID found in storage: $userId, navigating to home');
    _navigateToHome();
    _checkBanStatusInBackground(userId);
  }

  /// 后台异步检查用户封号状态（不阻塞启动）
  Future<void> _checkBanStatusInBackground(String userId) async {
    try {
      final response = await _apiService
          .getUserStatus(userId)
          .timeout(const Duration(seconds: 10));
      if (response['success'] == true && response['data'] != null) {
        final data = response['data'] as Map<String, dynamic>;
        if (data['user_status'] == 'banned') {
          print('🚫 User is banned, logging out');
          await _storageService.saveUserId('');
          // 已经进入 HomeScreen，通过导航回到 LoginScreen
          if (mounted) {
            Navigator.of(context).pushAndRemoveUntil(
              MaterialPageRoute(builder: (context) => const LoginScreen()),
              (route) => false,
            );
          }
        }
      }
    } catch (e) {
      // 网络错误时不影响主流程
      print('⚠️ Background ban check failed (ignored): $e');
    }
  }

  void _navigateToLogin() {
    if (!mounted) return;
    _hasNavigated = true;
    Navigator.of(context).pushReplacement(
      MaterialPageRoute(builder: (context) => const LoginScreen()),
    );
  }

  void _navigateToHome() {
    if (!mounted) return;
    _hasNavigated = true;
    // 用户成功进入主页时上报活跃心跳
    PushNotificationService.reportActive();
    Navigator.of(context).pushReplacement(
      MaterialPageRoute(builder: (context) => const HomeScreen()),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        color: AppColors.background,
        child: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                width: 120,
                height: 120,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(24),
                  boxShadow: [
                    BoxShadow(
                      color: AppColors.primary.withOpacity(0.3),
                      blurRadius: 20,
                      offset: const Offset(0, 10),
                    ),
                  ],
                ),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(24),
                  child: Image.asset(
                    'assets/images/bitcoin_chip_logo.png',
                    fit: BoxFit.cover,
                    errorBuilder: (context, error, stackTrace) {
                      // 图片加载失败时显示橙色图标兜底，避免黑屏
                      return Container(
                        color: AppColors.primary,
                        child: const Icon(
                          Icons.currency_bitcoin,
                          size: 80,
                          color: Colors.white,
                        ),
                      );
                    },
                  ),
                ),
              ),
              const SizedBox(height: 24),
              const Text(
                'Bitcoin Mining Master',
                style: TextStyle(
                  fontSize: 24,
                  fontWeight: FontWeight.bold,
                  color: Colors.white,
                ),
              ),
              const SizedBox(height: 40),
              const CircularProgressIndicator(),
            ],
          ),
        ),
      ),
    );
  }
}
