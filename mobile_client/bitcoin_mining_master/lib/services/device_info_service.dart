import 'package:advertising_id/advertising_id.dart';
import 'dart:io' show Platform;
import 'dart:ui' as ui;
import 'package:flutter/foundation.dart';
import 'package:device_info_plus/device_info_plus.dart';
import 'package:app_tracking_transparency/app_tracking_transparency.dart';

/// 设备信息服务 - 获取GAID和设备地区信息
/// 注意：当前版本暂时禁用了GAID功能（Flutter SDK限制）
class DeviceInfoService {
  /// 获取Google Advertising ID (GAID) - 仅 Android 适用
  /// iOS 使用 IDFA，由 getIosAdInfo() 单独处理
  static Future<String?> getGAID() async {
    if (kIsWeb || !Platform.isAndroid) {
      return null;
    }
    try {
      final gaid = await AdvertisingId.id(true);
      if (gaid != null && gaid.isNotEmpty) {
        print('✅ GAID 获取成功: ${gaid.substring(0, 8)}...');
      } else {
        print('⚠️ GAID 为空（用户可能已关闭广告追踪）');
      }
      return gaid;
    } catch (e) {
      print('⚠️ GAID 获取失败: $e');
      return null;
    }
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
