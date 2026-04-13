import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
import '../constants/app_constants.dart';
import 'storage_service.dart';

/// 推送通知服务
/// 负责:
///   1. 初始化 Firebase + 请求通知权限
///   2. 获取 FCM token 并上报到后端
///   3. App 进入前台时上报活跃心跳（供沉默用户召回判断）
///   4. 处理前台通知展示
///   5. 收到 invitation_accepted 推送时触发回调（邀请方庆祝弹窗）
class PushNotificationService {
  static final PushNotificationService _instance =
      PushNotificationService._internal();
  factory PushNotificationService() => _instance;
  PushNotificationService._internal();

  bool _initialized = false;

  /// 当收到「好友接受邀请」推送时调用（由 HomeScreen 注册）
  static void Function()? onInvitationAccepted;

  /// 初始化推送通知（在 main() 的 WidgetsFlutterBinding.ensureInitialized() 之后调用）
  static Future<void> initialize() async {
    if (_instance._initialized) return;
    _instance._initialized = true;

    try {
      // Firebase 已由 main() 在后台初始化，这里仅确保幂等（不重复初始化）
      if (Firebase.apps.isEmpty) {
        await Firebase.initializeApp();
      }

      final messaging = FirebaseMessaging.instance;

      // 请求 iOS 通知权限（Android 13+ 也需要请求）
      final settings = await messaging.requestPermission(
        alert: true,
        badge: true,
        sound: true,
        provisional: false, // false = 需要用户明确同意
      );

      if (settings.authorizationStatus == AuthorizationStatus.authorized ||
          settings.authorizationStatus == AuthorizationStatus.provisional) {
        // 获取 FCM token 并上报
        await _uploadToken(messaging);

        // token 刷新时重新上报
        messaging.onTokenRefresh.listen((newToken) {
          _uploadTokenRaw(newToken);
        });

        // 前台收到通知时的处理（App 在前台时 FCM 默认不弹出通知，这里可以自定义）
        FirebaseMessaging.onMessage.listen((RemoteMessage message) {
          debugPrint(
              '📲 [push] 前台通知: ${message.notification?.title} - ${message.notification?.body}');
          // 检测「好友接受邀请」事件 → 触发邀请方庆祝弹窗
          final type = message.data['type'];
          if (type == 'invitation_accepted' && onInvitationAccepted != null) {
            onInvitationAccepted!();
          }
        });

        // 后台通知被点击后打开 App 时处理
        FirebaseMessaging.onMessageOpenedApp.listen((RemoteMessage message) {
          debugPrint('📲 [push] 后台通知点击打开: ${message.data}');
          final type = message.data['type'];
          if (type == 'invitation_accepted' && onInvitationAccepted != null) {
            onInvitationAccepted!();
          }
        });

        // App 从终止状态被通知点击启动时处理
        final initialMessage = await messaging.getInitialMessage();
        if (initialMessage != null) {
          debugPrint('📲 [push] 终止状态通知启动: ${initialMessage.data}');
          final type = initialMessage.data['type'];
          if (type == 'invitation_accepted') {
            // App 刚启动，HomeScreen 的回调还未注册，延迟触发
            Future.delayed(const Duration(seconds: 2), () {
              if (onInvitationAccepted != null) {
                onInvitationAccepted!();
              }
            });
          }
        }

        debugPrint('✅ [push] 推送通知初始化完成');
      } else {
        debugPrint('⚠️ [push] 用户拒绝了通知权限，不上报 token');
      }
    } catch (e) {
      // 推送初始化失败不影响主流程
      debugPrint('❌ [push] 初始化失败（不影响主功能）: $e');
    }
  }

  /// 登录成功后补传 FCM token（在 app 启动时 initialize() 可能因用户未登录而跳过了上报）
  static Future<void> reUploadToken() async {
    try {
      final messaging = FirebaseMessaging.instance;
      await _uploadToken(messaging);
    } catch (e) {
      debugPrint('❌ [push] reUploadToken 失败: $e');
    }
  }

  /// App 进入前台时调用，更新服务器端 last_active_at
  static Future<void> reportActive() async {
    try {
      final userId = StorageService().getUserId();
      if (userId == null || userId.isEmpty) return;

      await http
          .post(
            Uri.parse('${ApiConstants.baseUrl}/notifications/active'),
            headers: {'Content-Type': 'application/json'},
            body: jsonEncode({'user_id': userId}),
          )
          .timeout(const Duration(seconds: 5));
    } catch (_) {
      // 心跳失败不影响功能
    }
  }

  // ── 内部方法 ───────────────────────────────────────────────

  static Future<void> _uploadToken(FirebaseMessaging messaging) async {
    try {
      // iOS 必须先拿 APNs token 才能获取到 FCM token
      if (Platform.isIOS) {
        await messaging.getAPNSToken();
      }
      final token = await messaging.getToken();
      if (token != null) {
        await _uploadTokenRaw(token);
      }
    } catch (e) {
      debugPrint('❌ [push] token 获取失败: $e');
    }
  }

  static Future<void> _uploadTokenRaw(String fcmToken) async {
    try {
      final userId = StorageService().getUserId();
      if (userId == null || userId.isEmpty) {
        debugPrint('⚠️ [push] 用户未登录，跳过 token 上报');
        return;
      }

      final platform = Platform.isIOS ? 'ios' : 'android';

      final response = await http
          .post(
            Uri.parse('${ApiConstants.baseUrl}/notifications/register-token'),
            headers: {'Content-Type': 'application/json'},
            body: jsonEncode({
              'user_id': userId,
              'fcm_token': fcmToken,
              'platform': platform,
              'app_version': '1.0.1',
            }),
          )
          .timeout(const Duration(seconds: 10));

      if (response.statusCode == 200) {
        debugPrint('✅ [push] FCM token 上报成功');
      } else {
        debugPrint('⚠️ [push] FCM token 上报失败: ${response.statusCode}');
      }
    } catch (e) {
      debugPrint('❌ [push] token 上报异常: $e');
    }
  }
}
