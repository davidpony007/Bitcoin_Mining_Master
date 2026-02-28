import 'package:flutter/services.dart';

/// 原生Android ID获取服务
/// 
/// 使用Android原生API获取真实的Android ID
/// 比 device_info_plus 更可靠
class NativeDeviceIdService {
  static const MethodChannel _channel = MethodChannel('device_id_plugin');

  /// 获取真实的Android ID
  /// 
  /// 使用 Settings.Secure.ANDROID_ID 获取设备的唯一标识符
  /// 这是一个64位的16进制字符串（16个字符）
  /// 
  /// Returns: Android ID 字符串，失败则返回 null
  static Future<String?> getAndroidId() async {
    try {
      final String? androidId = await _channel.invokeMethod('getAndroidId');
      if (androidId != null && androidId.isNotEmpty) {
        print('✅ [Native] Android ID: $androidId');
        return androidId;
      } else {
        print('⚠️ [Native] Android ID 为空');
        return null;
      }
    } on PlatformException catch (e) {
      print('❌ [Native] 获取Android ID失败: ${e.message}');
      return null;
    } catch (e) {
      print('❌ [Native] 获取Android ID异常: $e');
      return null;
    }
  }
}
