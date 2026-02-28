import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart';
import 'dart:io' show Platform;

/// API配置常量
class ApiConstants {
  // ====== 环境配置说明 ======
  // 
  // 【测试环境】- 本地开发调试
  // 1. 使用USB连接手机 + adb reverse端口转发（推荐）
  //    - 电脑端：后端运行在 localhost:8888
  //    - 手机端：访问 localhost:8888 会自动转发到电脑
  //    - 设置命令：adb reverse tcp:8888 tcp:8888
  //    - 优点：无需修改代码，手机和电脑用同样的URL
  //
  // 2. 使用WiFi + 局域网IP（备选方案）
  //    - 手机和电脑连接同一WiFi
  //    - 查看电脑IP：ifconfig (Mac) 或 ipconfig (Windows)
  //    - 手机访问：http://192.168.x.x:8888/api
  //    - 修改下方 _developmentUrl 为你的电脑局域网IP
  //
  // 【生产环境】- 正式上线
  // - 部署后端到云服务器（如阿里云、AWS、腾讯云）
  // - 使用域名：https://api.yourdomain.com
  // - 修改下方 _productionUrl 为你的正式域名
  // - 建议使用HTTPS确保安全
  // ========================
  
  // 生产环境URL - 云服务器地址（通过Nginx代理，无需端口号）
  static const String _productionUrl = 'http://47.79.232.189/api';
  
  // 开发环境URL - 使用adb reverse端口转发
  static const String _developmentUrl = 'http://localhost:8888/api';
  
  // 备用开发URL - WiFi局域网方案（替换为你的电脑IP）
  static const String _developmentWifiUrl = 'http://192.168.1.5:8888/api';
  
  // Cloudflare隧道URL - 用于跨网络测试（模拟真实生产环境）
  static const String _cloudflareUrl = 'https://bali-prescription-relying-labs.trycloudflare.com/api';
  
  // 自动选择环境
  static String get baseUrl {
    // 直接使用云服务器地址
    return _productionUrl;
  }
  
  // 认证相关端点
  static const String deviceLogin = '/auth/device-login';
  static const String bindGoogle = '/auth/bind-google';
  static const String googleLoginCreate = '/auth/google-login-create';
  static const String appleLoginCreate  = '/auth/apple-login-create';
  static const String bindApple          = '/auth/bind-apple';
  static const String appleBindingStatus  = '/auth/apple-binding-status';
  static const String switchGoogle = '/auth/switch-google';
  static const String unbindGoogle = '/auth/unbind-google';
  static const String googleBindingStatus = '/auth/google-binding-status'; // 获取Google绑定状态
  static const String invitationInfo = '/auth/invitation-info';
  static const String userStatus = '/auth/user-status';
  static const String addReferrer = '/auth/add-referrer';
  static const String createAdContract = '/auth/create-ad-contract';
  static const String activateAdContract = '/auth/activate-ad-contract';
  
  // 用户相关端点
  static const String getBitcoinBalance = '/balance/realtime'; // 使用实时余额API
  static const String getTransactions = '/bitcoin-transactions/records';
  static const String getReferrals = '/user/referrals';
  static const String getContracts = '/contracts';
  
  // 提现相关端点
  static const String withdrawRequest = '/withdrawal/request';
  static const String withdrawHistory = '/withdrawal/history';
  static const String withdrawDetail = '/withdrawal'; // + /{id}

  // 支付相关
  static const String paymentVerify = '/payment/verify-purchase'; // 验证IAP收据并发放合约
  
  // 请求超时时间（秒）
  static const int connectTimeout = 30;
  static const int receiveTimeout = 30;
}

/// 应用常量
class AppConstants {
  static const String appName = 'Bitcoin Mining Master';
  static const String appVersion = '1.0.0';
  
  // SharedPreferences keys
  static const String keyUserId = 'user_id';
  static const String keyInvitationCode = 'invitation_code';
  static const String keyAuthToken = 'auth_token';
  static const String keyBitcoinBalance = 'bitcoin_balance';
  static const String keyIsFirstLaunch = 'is_first_launch';
}

/// Google 登录配置
class GoogleAuthConstants {
  /// iOS OAuth Client ID
  static const String iosClientId = '1026466488683-f77ipeggp36cd2cjhd2min348n2ahio7.apps.googleusercontent.com';

  /// iOS Reversed Client ID
  static const String iosReversedClientId = 'com.googleusercontent.apps.1026466488683-f77ipeggp36cd2cjhd2min348n2ahio7';

  /// Web / Android Server Client ID（google-services.json 中 client_type=3）
  /// Android 14+ / google_sign_in v6.x 需要此 serverClientId 才能正常唤起 Credential Manager
  static const String webClientId = '1026466488683-1ps9vc7puchr9don7fmja0vrnngj78kk.apps.googleusercontent.com';
}

/// 颜色常量
class AppColors {
  static const Color primary = Color(0xFFFF9800); // 橙色主题
  static const Color secondary = Color(0xFF5C97F8); // 蓝色
  static const Color background = Color(0xFF000000); // 深黑背景
  static const Color surface = Color(0xFF2C2C2C); // 深灰表面
  static const Color cardDark = Color(0xFF1E1E1E); // 深色卡片
  static const Color error = Color(0xFFCF6679);
  static const Color success = Color(0xFF4CAF50);
  static const Color textPrimary = Color(0xFFFFFFFF);
  static const Color textSecondary = Color(0xFFB0B0B0);
  static const Color divider = Color(0xFF404040);
}
