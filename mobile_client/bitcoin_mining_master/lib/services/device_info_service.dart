// import 'package:advertising_id/advertising_id.dart'; // 暂时禁用
import 'dart:io' show Platform;
import 'dart:ui' as ui;
import 'package:flutter/foundation.dart';
import 'package:device_info_plus/device_info_plus.dart';
import 'package:app_tracking_transparency/app_tracking_transparency.dart';

/// 设备信息服务 - 获取GAID和设备地区信息
/// 注意：当前版本暂时禁用了GAID功能（Flutter SDK限制）
class DeviceInfoService {
  /// 获取Google Advertising ID (GAID)
  /// 当前版本返回null（GAID功能已禁用）
  static Future<String?> getGAID() async {
    print('ℹ️ GAID功能暂时禁用（Flutter SDK限制）');
    return null;
  }
  
  /// 检查是否限制广告追踪
  /// 当前版本返回null（GAID功能已禁用）
  static Future<bool?> isLimitAdTrackingEnabled() async {
    print('ℹ️ 广告追踪限制检查暂时禁用（Flutter SDK限制）');
    return null;
  }
  
  /// 获取设备的国家/地区代码
  /// 基于设备的系统语言设置获取国家代码
  /// Returns: 国家代码，如 'CN', 'US', 'JP'等
  static String? getCountryCode() {
    try {
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

  /// 获取 iOS 广告追踪信息：IDFV + 请求 ATT 权限 + IDFA
  ///
  /// 调用时会触发 iOS 系统 ATT 弹窗（若用户已处理则直接返回当前状态）
  /// 返回 Map 包含：
  ///   - idfv:       设备厂商标识符（永远可用）
  ///   - idfa:       广告标识符（仅 ATT 授权后有值）
  ///   - att_status: 0=notDetermined 1=restricted 2=denied 3=authorized
  static Future<Map<String, dynamic>> getIosAdInfo() async {
    if (kIsWeb || !Platform.isIOS) {
      return {'idfv': null, 'idfa': null, 'att_status': null};
    }
    try {
      // 1. IDFV — 无需权限
      final iosInfo = await DeviceInfoPlugin().iosInfo;
      final idfv = iosInfo.identifierForVendor;

      // 2. 请求 ATT（首次显示系统弹窗，已处理过则直接返回）
      final status = await AppTrackingTransparency.requestTrackingAuthorization();
      final attStatusInt = status.index;

      // 3. IDFA — 仅 authorized 时有效
      String? idfa;
      if (status == TrackingStatus.authorized) {
        final rawIdfa = await AppTrackingTransparency.getAdvertisingIdentifier();
        final idString = rawIdfa.toString();
        if (idString.isNotEmpty &&
            idString != '00000000-0000-0000-0000-000000000000') {
          idfa = idString;
        }
      }

      print('📱 [ATT] IDFV=$idfv, IDFA=$idfa, att_status=$attStatusInt');
      return {'idfv': idfv, 'idfa': idfa, 'att_status': attStatusInt};
    } catch (e) {
      print('⚠️ [ATT] 获取失败: $e');
      return {'idfv': null, 'idfa': null, 'att_status': null};
    }
  }
}
