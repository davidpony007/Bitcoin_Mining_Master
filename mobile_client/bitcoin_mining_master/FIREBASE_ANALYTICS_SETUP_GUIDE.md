# Firebase 和 Google Analytics 配置指南

## 📋 配置概览

本指南将帮助你完成以下配置：
1. 创建Firebase项目
2. 添加Android应用到Firebase
3. 配置Google Analytics
4. 集成Firebase SDK到Flutter项目
5. 测试配置

---

## 🔥 第一步：创建Firebase项目

### 1.1 打开Firebase控制台
你已经打开了Firebase控制台：https://console.firebase.google.com

### 1.2 创建新项目
1. 点击"添加项目"或"创建项目"
2. 输入项目名称：**Bitcoin Mining Master**
3. 点击"继续"

### 1.3 配置Google Analytics
1. **启用Google Analytics**（推荐）
   - 选择"为此项目启用Google Analytics"
   - 点击"继续"

2. **配置Analytics账号**
   - 选择现有的Google Analytics账号，或创建新账号
   - 接受条款和条件
   - 点击"创建项目"

3. 等待项目创建完成（约30秒-1分钟）

---

## 📱 第二步：添加Android应用

### 2.1 添加应用
1. 在Firebase项目概览页面，点击**Android图标**（机器人图标）
2. 填写应用信息：

```
Android 软件包名称: com.cloudminingtool.bitcoin_mining_master
应用昵称（可选）: Bitcoin Mining Master
调试签名证书 SHA-1（可选）: [稍后添加]
```

3. 点击"注册应用"

### 2.2 获取SHA-1证书指纹（重要！）

在终端运行以下命令获取SHA-1：

```bash
# 开发环境SHA-1（用于测试Google登录等功能）
keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android

# 生产环境SHA-1（用于发布）
keytool -list -v -keystore mobile_client/bitcoin_mining_master/android/app/app-release-key.jks -alias bitcoin_mining
```

**将SHA-1证书指纹添加到Firebase：**
1. 在Firebase控制台，进入"项目设置" > "常规"
2. 找到你的Android应用
3. 点击"添加指纹"
4. 粘贴SHA-1证书指纹
5. 点击"保存"

---

## 📥 第三步：下载配置文件

### 3.1 下载google-services.json
1. 在Firebase控制台，点击"下载google-services.json"
2. 将文件保存到以下位置：

```
mobile_client/bitcoin_mining_master/android/app/google-services.json
```

**重要：不要修改文件名！**

### 3.2 验证文件内容
打开`google-services.json`，确认包含以下信息：
- `project_id`
- `project_number` (发送通知需要)
- `mobilesdk_app_id`
- `package_name`: com.cloudminingtool.bitcoin_mining_master

---

## 🔧 第四步：配置Gradle文件

### 4.1 修改项目级build.gradle
编辑 `android/build.gradle.kts`:

```kotlin
plugins {
    id("com.android.application") version "8.1.0" apply false
    id("com.android.library") version "8.1.0" apply false
    id("org.jetbrains.kotlin.android") version "1.8.0" apply false
    // 添加Google Services插件
    id("com.google.gms.google-services") version "4.4.0" apply false
}

allprojects {
    repositories {
        google()
        mavenCentral()
    }
}
```

### 4.2 修改应用级build.gradle
编辑 `android/app/build.gradle.kts`，在文件顶部添加：

```kotlin
plugins {
    id("com.android.application")
    id("kotlin-android")
    id("dev.flutter.flutter-gradle-plugin")
    // 添加Google Services插件
    id("com.google.gms.google-services")
}
```

在文件底部添加（在flutter块之后）：

```kotlin
dependencies {
    // Firebase BoM (管理所有Firebase库版本)
    implementation(platform("com.google.firebase:firebase-bom:32.7.0"))
    
    // Firebase Analytics
    implementation("com.google.firebase:firebase-analytics-ktx")
    
    // Firebase Crashlytics（可选，用于崩溃报告）
    implementation("com.google.firebase:firebase-crashlytics-ktx")
    
    // Firebase Performance Monitoring（可选，用于性能监控）
    implementation("com.google.firebase:firebase-perf-ktx")
}
```

---

## 📦 第五步：添加Flutter依赖

### 5.1 更新pubspec.yaml
编辑 `pubspec.yaml`，添加Firebase相关依赖：

```yaml
dependencies:
  flutter:
    sdk: flutter
  
  # 现有依赖...
  
  # Firebase核心
  firebase_core: ^2.24.2
  
  # Firebase Analytics
  firebase_analytics: ^10.8.0
  
  # Firebase Crashlytics（可选）
  firebase_crashlytics: ^3.4.9
  
  # Firebase Performance（可选）
  firebase_performance: ^0.9.3+9
```

### 5.2 安装依赖
在终端运行：

```bash
cd mobile_client/bitcoin_mining_master
flutter pub get
```

---

## 💻 第六步：初始化Firebase

### 6.1 修改main.dart
编辑 `lib/main.dart`：

```dart
import 'package:flutter/material.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_analytics/firebase_analytics.dart';
import 'firebase_options.dart'; // 稍后生成

void main() async {
  // 确保Flutter绑定已初始化
  WidgetsFlutterBinding.ensureInitialized();
  
  // 初始化Firebase
  await Firebase.initializeApp(
    options: DefaultFirebaseOptions.currentPlatform,
  );
  
  // 初始化Analytics
  FirebaseAnalytics analytics = FirebaseAnalytics.instance;
  
  runApp(MyApp(analytics: analytics));
}

class MyApp extends StatelessWidget {
  final FirebaseAnalytics analytics;
  
  const MyApp({Key? key, required this.analytics}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Bitcoin Mining Master',
      navigatorObservers: [
        FirebaseAnalyticsObserver(analytics: analytics),
      ],
      // ... 其他配置
    );
  }
}
```

### 6.2 生成firebase_options.dart

运行FlutterFire CLI生成配置文件：

```bash
# 安装FlutterFire CLI（如果尚未安装）
dart pub global activate flutterfire_cli

# 生成配置文件
flutterfire configure
```

按照提示选择：
1. 选择刚才创建的Firebase项目
2. 选择Android平台
3. 确认应用包名：com.cloudminingtool.bitcoin_mining_master

这会自动生成 `lib/firebase_options.dart` 文件。

---

## 🔍 第七步：创建Analytics服务类

创建 `lib/services/analytics_service.dart`：

```dart
import 'package:firebase_analytics/firebase_analytics.dart';

class AnalyticsService {
  static final AnalyticsService _instance = AnalyticsService._internal();
  factory AnalyticsService() => _instance;
  AnalyticsService._internal();

  final FirebaseAnalytics _analytics = FirebaseAnalytics.instance;
  
  // 记录页面浏览
  Future<void> logScreenView(String screenName) async {
    await _analytics.logScreenView(
      screenName: screenName,
      screenClass: screenName,
    );
  }
  
  // 记录用户登录
  Future<void> logLogin(String method) async {
    await _analytics.logLogin(loginMethod: method);
  }
  
  // 记录用户注册
  Future<void> logSignUp(String method) async {
    await _analytics.logSignUp(signUpMethod: method);
  }
  
  // 记录购买事件
  Future<void> logPurchase({
    required String itemId,
    required String itemName,
    required double value,
    required String currency,
  }) async {
    await _analytics.logPurchase(
      value: value,
      currency: currency,
      items: [
        AnalyticsEventItem(
          itemId: itemId,
          itemName: itemName,
          price: value,
        ),
      ],
    );
  }
  
  // 记录订阅开始
  Future<void> logSubscriptionStart({
    required String subscriptionId,
    required double value,
  }) async {
    await _analytics.logEvent(
      name: 'subscription_start',
      parameters: {
        'subscription_id': subscriptionId,
        'value': value,
        'currency': 'USD',
      },
    );
  }
  
  // 记录订阅取消
  Future<void> logSubscriptionCancel(String subscriptionId) async {
    await _analytics.logEvent(
      name: 'subscription_cancel',
      parameters: {
        'subscription_id': subscriptionId,
      },
    );
  }
  
  // 记录广告观看
  Future<void> logAdView(String adType) async {
    await _analytics.logEvent(
      name: 'ad_view',
      parameters: {
        'ad_type': adType,
      },
    );
  }
  
  // 设置用户属性
  Future<void> setUserProperties({
    String? userId,
    String? userLevel,
    bool? isPremium,
  }) async {
    if (userId != null) {
      await _analytics.setUserId(id: userId);
    }
    if (userLevel != null) {
      await _analytics.setUserProperty(
        name: 'user_level',
        value: userLevel,
      );
    }
    if (isPremium != null) {
      await _analytics.setUserProperty(
        name: 'is_premium',
        value: isPremium.toString(),
      );
    }
  }
}
```

---

## 🧪 第八步：测试配置

### 8.1 构建并运行应用
```bash
cd mobile_client/bitcoin_mining_master
flutter clean
flutter pub get
flutter build apk --debug
flutter run
```

### 8.2 在Firebase控制台验证

1. **检查Analytics事件**
   - 打开Firebase控制台 > Analytics > 事件
   - 等待5-10分钟，应该能看到：
     - `first_open` 事件（首次打开应用）
     - `screen_view` 事件（页面浏览）
     - 自定义事件

2. **检查实时用户**
   - Analytics > 实时 > 概览
   - 应该能看到1个活跃用户（你的测试设备）

3. **启用DebugView（调试视图）**
   ```bash
   # 在应用运行时，执行以下命令启用调试模式
   adb shell setprop debug.firebase.analytics.app com.cloudminingtool.bitcoin_mining_master
   
   # 查看实时事件
   # Firebase控制台 > Analytics > DebugView
   ```

---

## 📊 第九步：集成常用事件追踪

### 9.1 在登录页面添加追踪

编辑登录相关代码：

```dart
import '../services/analytics_service.dart';

// Google登录成功后
await AnalyticsService().logLogin('google');
await AnalyticsService().setUserProperties(
  userId: user.id,
  userLevel: user.level.toString(),
);
```

### 9.2 在购买页面添加追踪

```dart
// 订阅购买成功后
await AnalyticsService().logSubscriptionStart(
  subscriptionId: product.id,
  value: double.parse(product.price.replaceAll(RegExp(r'[^\d.]'), '')),
);

await AnalyticsService().logPurchase(
  itemId: product.id,
  itemName: product.title,
  value: double.parse(product.price.replaceAll(RegExp(r'[^\d.]'), '')),
  currency: 'USD',
);
```

### 9.3 在广告观看后添加追踪

```dart
// 广告观看完成后
await AnalyticsService().logAdView('rewarded_video');
```

---

## 🎯 第十步：配置Google Analytics高级功能

### 10.1 设置转化事件

1. 打开Firebase控制台 > Analytics > 事件
2. 找到重要事件（如`subscription_start`、`purchase`）
3. 点击"标记为转化"
4. 这些事件将在Google Analytics中显示为转化

### 10.2 创建受众群体

1. Analytics > 受众群体 > 新建受众群体
2. 定义条件，例如：
   - "已订阅用户"：is_premium = true
   - "高级用户"：user_level >= 10
   - "活跃用户"：最近7天内打开应用

### 10.3 设置数据流

1. Analytics > 数据流
2. 点击你的Android应用数据流
3. 启用：
   - ✅ 增强型衡量功能（自动追踪滚动、点击等）
   - ✅ Google 信号（跨设备追踪）

---

## ⚠️ 常见问题排查

### 问题1：google-services.json文件找不到
**解决方案：**
```bash
# 确认文件位置
ls -la mobile_client/bitcoin_mining_master/android/app/google-services.json

# 如果不存在，重新从Firebase控制台下载
```

### 问题2：构建失败 - "Could not resolve com.google.gms:google-services"
**解决方案：**
确保在项目级`build.gradle.kts`中添加了Google仓库：
```kotlin
repositories {
    google()
    mavenCentral()
}
```

### 问题3：Analytics没有数据
**解决方案：**
1. 等待5-10分钟（数据有延迟）
2. 确认已启用Analytics DebugView
3. 检查应用是否正确初始化Firebase
4. 查看logcat日志是否有错误

### 问题4：SHA-1证书不匹配
**解决方案：**
```bash
# 重新获取正确的SHA-1
keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android

# 在Firebase控制台添加正确的SHA-1
```

---

## 📋 配置检查清单

完成以下所有步骤后，你的Firebase配置就完成了：

- [ ] 创建Firebase项目
- [ ] 添加Android应用到Firebase
- [ ] 下载并放置google-services.json文件
- [ ] 添加SHA-1证书指纹（开发和生产）
- [ ] 配置项目级build.gradle.kts
- [ ] 配置应用级build.gradle.kts
- [ ] 添加Firebase相关Flutter依赖
- [ ] 运行flutter pub get
- [ ] 生成firebase_options.dart
- [ ] 初始化Firebase在main.dart
- [ ] 创建AnalyticsService类
- [ ] 集成Analytics事件追踪
- [ ] 测试应用构建成功
- [ ] 在Firebase控制台验证数据

---

## 🚀 下一步

配置完成后，你可以：

1. **监控应用性能**
   - Firebase > Performance
   - 查看启动时间、网络请求等

2. **追踪崩溃**
   - Firebase > Crashlytics
   - 自动收集崩溃报告

3. **分析用户行为**
   - Analytics > 行为流
   - 了解用户使用路径

4. **优化转化率**
   - Analytics > 转化
   - 分析订阅购买漏斗

---

## 📞 需要帮助？

如果在配置过程中遇到问题：

1. 检查Firebase文档：https://firebase.google.com/docs/flutter/setup
2. 查看FlutterFire文档：https://firebase.flutter.dev
3. 检查终端错误日志
4. 询问我获取帮助

---

**恭喜！Firebase和Google Analytics配置完成后，你的应用将拥有强大的分析和监控能力！** 🎉
