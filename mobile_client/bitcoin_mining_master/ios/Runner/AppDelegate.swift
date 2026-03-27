import Flutter
import UIKit

@main
@objc class AppDelegate: FlutterAppDelegate {

  // 共享的 FlutterEngine，由 SceneDelegate 使用
  lazy var flutterEngine: FlutterEngine = FlutterEngine(name: "main_engine")

  override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
  ) -> Bool {
    NSLog("[BMM-DEBUG] AppDelegate.application didFinishLaunching START")
    // 启动引擎并注册插件，不调用 super（避免 super 在 UIScene 模式下创建无场景关联的旧式窗口）
    flutterEngine.run()
    NSLog("[BMM-DEBUG] AppDelegate: flutterEngine.run() done")
    GeneratedPluginRegistrant.register(with: flutterEngine)
    NSLog("[BMM-DEBUG] AppDelegate: plugins registered, returning true")
    return true
  }

  // 处理 URL scheme 回调 (Google Sign-In)
  override func application(
    _ app: UIApplication,
    open url: URL,
    options: [UIApplication.OpenURLOptionsKey : Any] = [:]
  ) -> Bool {
    return super.application(app, open: url, options: options)
  }

  // UIScene lifecycle — iOS 13+ / iOS 26+ 必须
  override func application(
    _ application: UIApplication,
    configurationForConnecting connectingSceneSession: UISceneSession,
    options: UIScene.ConnectionOptions
  ) -> UISceneConfiguration {
    return UISceneConfiguration(
      name: "Runner Configuration",
      sessionRole: connectingSceneSession.role
    )
  }
}
