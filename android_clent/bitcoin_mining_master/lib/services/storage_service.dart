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

  /// 清除所有数据
  Future<bool> clearAll() async {
    return await _prefs?.clear() ?? false;
  }
}
