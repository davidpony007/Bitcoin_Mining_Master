import Flutter
import UIKit

/// UIScene lifecycle delegate — required for iOS 13+ / iOS 26+
/// 注意：不要加 @objc(SceneDelegate) 注解，否则 ObjC 运行时名称变为 "SceneDelegate"，
/// 与 Info.plist 的 $(PRODUCT_MODULE_NAME).SceneDelegate = "Runner.SceneDelegate" 不匹配，
/// 导致 iOS 找不到该类，SceneDelegate 从不被调用 → 黑屏。
class SceneDelegate: UIResponder, UIWindowSceneDelegate {

  var window: UIWindow?

  func scene(
    _ scene: UIScene,
    willConnectTo session: UISceneSession,
    options connectionOptions: UIScene.ConnectionOptions
  ) {
    NSLog("[BMM-DEBUG] SceneDelegate.scene willConnectTo called")
    guard let windowScene = scene as? UIWindowScene else {
      NSLog("[BMM-DEBUG] GUARD FAILED: scene is not UIWindowScene, type=%@", String(describing: type(of: scene)))
      return
    }
    guard let appDelegate = UIApplication.shared.delegate as? AppDelegate else {
      NSLog("[BMM-DEBUG] GUARD FAILED: delegate is not AppDelegate, type=%@", String(describing: type(of: UIApplication.shared.delegate)))
      return
    }
    NSLog("[BMM-DEBUG] SceneDelegate: guards passed, creating FlutterViewController")
    // 用 AppDelegate 提供的 FlutterEngine 创建 VC，避免 UIScene 模式下无内容黑屏
    let flutterVC = FlutterViewController(engine: appDelegate.flutterEngine, nibName: nil, bundle: nil)
    NSLog("[BMM-DEBUG] SceneDelegate: FlutterVC created, creating UIWindow")
    let window = UIWindow(windowScene: windowScene)
    window.rootViewController = flutterVC
    window.makeKeyAndVisible()
    self.window = window
    NSLog("[BMM-DEBUG] SceneDelegate: window makeKeyAndVisible done")
  }

  func sceneDidBecomeActive(_ scene: UIScene) {
    NSLog("[BMM-DEBUG] SceneDelegate.sceneDidBecomeActive")
  }

  func sceneWillEnterForeground(_ scene: UIScene) {
    NSLog("[BMM-DEBUG] SceneDelegate.sceneWillEnterForeground")
  }
}
