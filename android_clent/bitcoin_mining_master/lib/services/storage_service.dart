import 'package:shared_preferences/shared_preferences.dart';
import '../constants/app_constants.dart';

/// 本地存储服务 - 对应Kotlin的SharedPreferences
class StorageService {
  static final StorageService _instance = StorageService._internal();
  factory StorageService() => _instance;
  StorageService._internal();

  SharedPreferences? _prefs;

  /// 初始化
  Future<void> init() async {
    _prefs = await SharedPreferences.getInstance();
  }

  /// 保存用户ID
  Future<bool> saveUserId(String userId) async {
    return await _prefs?.setString(AppConstants.keyUserId, userId) ?? false;
  }

  /// 获取用户ID
  String? getUserId() {
    return _prefs?.getString(AppConstants.keyUserId);
  }

  /// 保存邀请码
  Future<bool> saveInvitationCode(String invitationCode) async {
    return await _prefs?.setString(AppConstants.keyInvitationCode, invitationCode) ?? false;
  }

  /// 获取邀请码
  String? getInvitationCode() {
    return _prefs?.getString(AppConstants.keyInvitationCode);
  }

  /// 保存认证Token
  Future<bool> saveAuthToken(String token) async {
    return await _prefs?.setString(AppConstants.keyAuthToken, token) ?? false;
  }

  /// 获取认证Token
  String? getAuthToken() {
    return _prefs?.getString(AppConstants.keyAuthToken);
  }

  /// 保存比特币余额
  Future<bool> saveBitcoinBalance(String balance) async {
    return await _prefs?.setString(AppConstants.keyBitcoinBalance, balance) ?? false;
  }

  /// 获取比特币余额
  String? getBitcoinBalance() {
    return _prefs?.getString(AppConstants.keyBitcoinBalance);
  }

  /// 检查是否首次启动
  bool isFirstLaunch() {
    return _prefs?.getBool(AppConstants.keyIsFirstLaunch) ?? true;
  }

  /// 设置已启动标记
  Future<bool> setLaunched() async {
    return await _prefs?.setBool(AppConstants.keyIsFirstLaunch, false) ?? false;
  }

  /// 保存最后签到日期
  Future<bool> saveLastCheckInDate(String date) async {
    return await _prefs?.setString('last_check_in_date', date) ?? false;
  }

  /// 获取最后签到日期
  String? getLastCheckInDate() {
    return _prefs?.getString('last_check_in_date');
  }

  /// 保存用户等级
  Future<bool> saveUserLevel(int level) async {
    return await _prefs?.setInt('user_level', level) ?? false;
  }

  /// 获取用户等级
  int getUserLevel() {
    return _prefs?.getInt('user_level') ?? 1;
  }

  /// 保存用户邮箱
  Future<bool> saveUserEmail(String email) async {
    return await _prefs?.setString('user_email', email) ?? false;
  }

  /// 获取用户邮箱
  String? getUserEmail() {
    return _prefs?.getString('user_email');
  }

  /// 清除所有数据
  Future<bool> clearAll() async {
    return await _prefs?.clear() ?? false;
  }
}
