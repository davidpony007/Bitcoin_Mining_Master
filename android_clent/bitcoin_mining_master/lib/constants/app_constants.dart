import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart';
import 'dart:io' show Platform;

/// API配置常量
class ApiConstants {
  // 基础URL - 后端Node.js服务器地址
  // 使用adb reverse端口转发，所有平台统一使用localhost
  static String get baseUrl {
    return 'http://localhost:8888/api';
  }
  
  // 认证相关端点
  static const String deviceLogin = '/auth/device-login';
  static const String bindGoogle = '/auth/bind-google';
  static const String switchGoogle = '/auth/switch-google';
  static const String unbindGoogle = '/auth/unbind-google';
  static const String invitationInfo = '/auth/invitation-info';
  static const String userStatus = '/auth/user-status';
  static const String addReferrer = '/auth/add-referrer';
  static const String createAdContract = '/auth/create-ad-contract';
  static const String activateAdContract = '/auth/activate-ad-contract';
  
  // 用户相关端点
  static const String getBitcoinBalance = '/user/bitcoin-balance';
  static const String getTransactions = '/bitcoin-transactions/records';
  static const String getReferrals = '/user/referrals';
  static const String getContracts = '/contracts';
  
  // 提现相关端点
  static const String withdrawRequest = '/withdrawal/request';
  static const String withdrawHistory = '/withdrawal/history';
  static const String withdrawDetail = '/withdrawal'; // + /{id}
  
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
