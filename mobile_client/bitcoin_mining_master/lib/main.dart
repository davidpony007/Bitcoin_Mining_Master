import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
// import 'package:firebase_core/firebase_core.dart'; // 暂时禁用
// import 'firebase_options.dart'; // 暂时禁用
import 'providers/user_provider.dart';
import 'screens/home_screen.dart';
import 'screens/login_screen.dart';
import 'constants/app_constants.dart';
import 'services/storage_service.dart';
import 'services/admob_service.dart';
import 'services/api_service.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  
  // 初始化Firebase（暂时禁用）
  // try {
  //   await Firebase.initializeApp(
  //     options: DefaultFirebaseOptions.currentPlatform,
  //   );
  // } catch (e) {
  //   if (e.toString().contains('duplicate-app')) {
  //     // Firebase已经初始化，忽略错误
  //     print('Firebase already initialized');
  //   } else {
  //     // 其他错误需要抛出
  //     rethrow;
  //   }
  // }
  
  // 初始化本地存储服务
  await StorageService().init();
  
  // 初始化AdMob SDK
  await AdMobService.initialize();
  
  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => UserProvider()..initializeUser()),
      ],
      child: MaterialApp(
        title: 'Bitcoin Mining Master',
        debugShowCheckedModeBanner: false,
        navigatorObservers: const [],
        theme: ThemeData(
          brightness: Brightness.dark,
          primaryColor: AppColors.primary,
          scaffoldBackgroundColor: AppColors.background,
          appBarTheme: AppBarTheme(
            backgroundColor: AppColors.primary,
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
        darkTheme: ThemeData.dark(),
        themeMode: ThemeMode.dark,
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

class _SplashScreenState extends State<SplashScreen> {
  final StorageService _storageService = StorageService();
  final ApiService _apiService = ApiService();

  @override
  void initState() {
    super.initState();
    _checkLoginStatus();
  }

  /// 检查登录状态，决定显示登录页还是主页
  Future<void> _checkLoginStatus() async {
    await Future.delayed(const Duration(milliseconds: 500)); // 短暂延迟显示启动画面

    try {
      // 1. 检查本地是否有用户ID
      final userId = _storageService.getUserId();
      
      // 2. 如果没有用户ID或是OFFLINE用户，显示登录页
      if (userId == null || userId.isEmpty || userId.startsWith('OFFLINE_')) {
        _navigateToLogin();
        return;
      }

      // 3. 检查MySQL数据库中是否存在该用户
      final response = await _apiService.getUserStatus(userId);
      
      if (response['success'] == true && response['data'] != null) {
        // 用户存在于数据库，直接进入主页
        print('✅ User exists in database: $userId');
        _navigateToHome();
      } else {
        // 用户不存在于数据库，显示登录页
        print('⚠️ User not found in database, showing login screen');
        _navigateToLogin();
      }
    } catch (e) {
      print('❌ Error checking login status: $e');
      // 出错时显示登录页（安全策略）
      _navigateToLogin();
    }
  }

  void _navigateToLogin() {
    if (!mounted) return;
    Navigator.of(context).pushReplacement(
      MaterialPageRoute(builder: (context) => const LoginScreen()),
    );
  }

  void _navigateToHome() {
    if (!mounted) return;
    Navigator.of(context).pushReplacement(
      MaterialPageRoute(builder: (context) => const HomeScreen()),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [
              AppColors.background,
              AppColors.surface,
            ],
          ),
        ),
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
