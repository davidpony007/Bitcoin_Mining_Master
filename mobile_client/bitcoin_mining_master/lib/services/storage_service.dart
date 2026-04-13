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

  /// 保存用户昵称（根据userId保存，每个账户独立）
  Future<bool> saveUserNickname(String nickname) async {
    final userId = getUserId();
    if (userId == null || userId.isEmpty) {
      print('⚠️ 无法保存昵称：userId为空');
      return false;
    }
    final key = 'user_nickname_$userId';
    print('💾 保存昵称: $nickname (key: $key)');
    return await _prefs?.setString(key, nickname) ?? false;
  }

  /// 获取用户昵称（根据当前userId获取）
  String? getUserNickname() {
    final userId = getUserId();
    if (userId == null || userId.isEmpty) {
      return null;
    }
    final key = 'user_nickname_$userId';
    final nickname = _prefs?.getString(key);
    if (nickname != null) {
      print('📚 加载昵称: $nickname (key: $key)');
    }
    return nickname;
  }

  /// 清除用户昵称（根据当前userId）
  Future<bool> clearUserNickname() async {
    final userId = getUserId();
    if (userId == null || userId.isEmpty) {
      return false;
    }
    final key = 'user_nickname_$userId';
    return await _prefs?.remove(key) ?? false;
  }

  /// 设置离线用户标记
  Future<bool> setOfflineUser(bool isOffline) async {
    return await _prefs?.setBool('is_offline_user', isOffline) ?? false;
  }

  /// 检查是否是离线用户
  bool isOfflineUser() {
    return _prefs?.getBool('is_offline_user') ?? false;
  }

  /// 保存DeviceId（用于离线用户同步）
  Future<bool> saveDeviceId(String deviceId) async {
    return await _prefs?.setString('device_id', deviceId) ?? false;
  }

  /// 获取DeviceId
  String? getDeviceId() {
    return _prefs?.getString('device_id');
  }

  /// 清除用户ID
  Future<bool> clearUserId() async {
    return await _prefs?.remove(AppConstants.keyUserId) ?? false;
  }

  /// 清除邀请码
  Future<bool> clearInvitationCode() async {
    return await _prefs?.remove(AppConstants.keyInvitationCode) ?? false;
  }

  /// 保存Google登录状态
  Future<bool> saveGoogleSignInStatus(bool isSignedIn) async {
    return await _prefs?.setBool('google_signed_in', isSignedIn) ?? false;
  }

  /// 获取Google登录状态
  bool isGoogleSignedIn() {
    return _prefs?.getBool('google_signed_in') ?? false;
  }

  /// 保存Google邮箱
  Future<bool> saveGoogleEmail(String email) async {
    return await _prefs?.setString('google_email', email) ?? false;
  }

  /// 获取Google邮箱
  String? getGoogleEmail() {
    return _prefs?.getString('google_email');
  }

  /// 保存Apple用户ID（用于JWT验证，本地保留）
  Future<bool> saveAppleId(String appleId) async {
    return await _prefs?.setString('apple_id', appleId) ?? false;
  }

  /// 获取Apple用户ID（用于JWT验证）
  String? getAppleId() {
    return _prefs?.getString('apple_id');
  }

  /// 保存Apple账号邮箱（首次登录时由Apple返回）
  Future<bool> saveAppleAccount(String appleAccount) async {
    return await _prefs?.setString('apple_account', appleAccount) ?? false;
  }

  /// 获取Apple账号邮箱
  String? getAppleAccount() {
    return _prefs?.getString('apple_account');
  }

  /// 保存登出状态（用于区分"从未登录"和"已登出"）
  Future<bool> saveIsLoggedOut(bool isLoggedOut) async {
    return await _prefs?.setBool('is_logged_out', isLoggedOut) ?? false;
  }

  /// 获取登出状态
  bool isLoggedOut() {
    return _prefs?.getBool('is_logged_out') ?? false;
  }

  /// 标记评价奖励已领取（按userId隔离，永久有效）
  Future<bool> setRatingRewardClaimed(String userId) async {
    return await _prefs?.setBool('rating_reward_claimed_$userId', true) ?? false;
  }

  /// 检查评价奖励是否已领取（按userId隔离）
  bool isRatingRewardClaimed(String userId) {
    return _prefs?.getBool('rating_reward_claimed_$userId') ?? false;
  }

  /// 清除所有数据
  Future<bool> clearAll() async {
    return await _prefs?.clear() ?? false;
  }

  /// 保存账户禁用状态
  Future<bool> saveBanStatus(bool isBanned) async {
    return await _prefs?.setBool('is_banned', isBanned) ?? false;
  }

  /// 获取账户禁用状态（本地缓存）
  bool isBanned() {
    return _prefs?.getBool('is_banned') ?? false;
  }

  /// 设置"待展示被邀请方绑定成功庆祝弹窗"标志（下次进入 HomeScreen 时触发）
  Future<void> setPendingReferralSuccessDialog() async {
    await _prefs?.setBool('pending_referral_success_dialog', true);
  }

  /// 读取并清除标志
  bool consumePendingReferralSuccessDialog() {
    final has = _prefs?.getBool('pending_referral_success_dialog') ?? false;
    if (has) _prefs?.remove('pending_referral_success_dialog');
    return has;
  }

  /// 获取邀请人已"庆祝"过的 Invite Friend Reward 合约数量
  int getSeenInviteRewardCount() {
    return _prefs?.getInt('seen_invite_reward_count') ?? 0;
  }

  /// 更新邀请人已"庆祝"过的 Invite Friend Reward 合约数量
  Future<void> setSeenInviteRewardCount(int count) async {
    await _prefs?.setInt('seen_invite_reward_count', count);
  }
}
