import 'package:advertising_id/advertising_id.dart';
import 'dart:ui' as ui;

/// 设备信息服务 - 获取GAID和设备地区信息
class DeviceInfoService {
  /// 获取Google Advertising ID (GAID)
  /// 
  /// GAID是Google提供的用于广告追踪的唯一标识符
  /// 注意：用户可以在设置中重置或禁用广告追踪
  static Future<String?> getGAID() async {
    try {
      // 检查是否启用了广告追踪限制
      bool? isLimited = await AdvertisingId.isLimitAdTrackingEnabled;
      
      if (isLimited == true) {
        print('⚠️ 用户已启用广告追踪限制，无法获取GAID');
        return null;
      }
      
      // 获取广告ID
      String? advertisingId = await AdvertisingId.id(true);
      
      if (advertisingId != null && advertisingId.isNotEmpty) {
        print('📱 GAID获取成功: ${advertisingId.substring(0, 8)}...');
        return advertisingId;
      } else {
        print('⚠️ GAID为空或无效');
        return null;
      }
    } catch (e) {
      print('❌ 获取GAID失败: $e');
      return null;
    }
  }
  
  /// 检查是否限制广告追踪
  /// 
  /// Returns:
  ///   - true: 已限制广告追踪
  ///   - false: 允许广告追踪
  ///   - null: 无法确定
  static Future<bool?> isLimitAdTrackingEnabled() async {
    try {
      bool? isLimited = await AdvertisingId.isLimitAdTrackingEnabled;
      print('📊 广告追踪限制状态: ${isLimited == true ? "已限制" : "允许"}');
      return isLimited;
    } catch (e) {
      print('❌ 检查广告追踪限制失败: $e');
      return null;
    }
  }
  
  /// 获取设备的国家/地区代码
  /// 
  /// 基于设备的系统语言设置获取国家代码
  /// Returns: 国家代码，如 'CN', 'US', 'JP'等
  static String? getCountryCode() {
    try {
      // 获取设备的locale
      final locale = ui.PlatformDispatcher.instance.locale;
      final countryCode = locale.countryCode;
      
      if (countryCode != null && countryCode.isNotEmpty) {
        print('📍 设备国家代码: $countryCode');
        return countryCode;
      } else {
        print('⚠️ 无法获取国家代码');
        return null;
      }
    } catch (e) {
      print('❌ 获取国家代码失败: $e');
      return null;
    }
  }
  
  /// 获取设备的语言代码
  /// 
  /// Returns: 语言代码，如 'zh', 'en', 'ja'等
  static String? getLanguageCode() {
    try {
      final locale = ui.PlatformDispatcher.instance.locale;
      final languageCode = locale.languageCode;
      
      if (languageCode.isNotEmpty) {
        print('🌐 设备语言代码: $languageCode');
        return languageCode;
      } else {
        print('⚠️ 无法获取语言代码');
        return null;
      }
    } catch (e) {
      print('❌ 获取语言代码失败: $e');
      return null;
    }
  }
  
  /// 获取完整的设备信息（用于注册/登录）
  /// 
  /// Returns: Map包含GAID、国家代码、语言代码等信息
  static Future<Map<String, String?>> getDeviceInfo() async {
    print('🔍 [DeviceInfoService] 开始获取设备信息...');
    
    final gaid = await getGAID();
    print('   → GAID: ${gaid ?? "null"}');
    
    final countryCode = getCountryCode();
    print('   → Country: ${countryCode ?? "null"}');
    
    final languageCode = getLanguageCode();
    print('   → Language: ${languageCode ?? "null"}');
    
    final result = {
      'gaid': gaid,
      'country': countryCode,
      'language': languageCode,
    };
    
    print('🔍 [DeviceInfoService] 设备信息获取完成: $result');
    return result;
  }
}
