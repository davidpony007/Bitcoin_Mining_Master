# Android 客户端集成指南

## 📋 目录

1. [项目配置](#1-项目配置)
2. [文件说明](#2-文件说明)
3. [快速开始](#3-快速开始)
4. [关键功能实现](#4-关键功能实现)
5. [测试流程](#5-测试流程)
6. [常见问题](#6-常见问题)

---

## 1. 项目配置

### 1.1 添加依赖

在 `app/build.gradle` 中添加以下依赖:

```gradle
dependencies {
    // Kotlin 协程
    implementation "org.jetbrains.kotlinx:kotlinx-coroutines-core:1.7.3"
    implementation "org.jetbrains.kotlinx:kotlinx-coroutines-android:1.7.3"
    
    // Retrofit (网络请求)
    implementation "com.squareup.retrofit2:retrofit:2.9.0"
    implementation "com.squareup.retrofit2:converter-gson:2.9.0"
    
    // OkHttp (HTTP 客户端)
    implementation "com.squareup.okhttp3:okhttp:4.11.0"
    implementation "com.squareup.okhttp3:logging-interceptor:4.11.0"
    
    // Gson (JSON 解析)
    implementation "com.google.code.gson:gson:2.10.1"
    
    // Google Sign-In (Google 账号登录)
    implementation "com.google.android.gms:play-services-auth:20.7.0"
    
    // Google Advertising ID (获取 GAID)
    implementation "com.google.android.gms:play-services-ads-identifier:18.0.1"
    
    // Lifecycle (协程支持)
    implementation "androidx.lifecycle:lifecycle-runtime-ktx:2.6.2"
}
```

### 1.2 配置 AndroidManifest.xml

在 `AndroidManifest.xml` 中添加:

```xml
<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    
    <!-- 网络权限 -->
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
    
    <!-- Google Advertising ID 权限 -->
    <uses-permission android:name="com.google.android.gms.permission.AD_ID" />
    
    <application
        android:name=".BitcoinMiningApplication"
        android:usesCleartextTraffic="true"
        android:networkSecurityConfig="@xml/network_security_config"
        ...>
        
        <activity
            android:name=".ui.MainActivity"
            android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
        
        <activity
            android:name=".ui.SettingsActivity"
            android:exported="false" />
        
    </application>
</manifest>
```

### 1.3 配置网络安全 (开发环境)

创建 `res/xml/network_security_config.xml`:

```xml
<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <!-- 开发环境允许明文 HTTP 请求 -->
    <domain-config cleartextTrafficPermitted="true">
        <domain includeSubdomains="true">10.0.2.2</domain>
        <domain includeSubdomains="true">47.79.232.189</domain>
    </domain-config>
</network-security-config>
```

**⚠️ 生产环境请使用 HTTPS!**

---

## 2. 文件说明

### 📂 项目文件结构

```
app/src/main/java/com/bitcoinmining/
├── BitcoinMiningApplication.kt    # Application 类,初始化全局单例
├── data/
│   └── UserManager.kt             # 用户数据本地存储管理
├── models/
│   └── DataModels.kt              # 所有数据模型定义
├── network/
│   ├── ApiService.kt              # Retrofit API 接口定义
│   └── RetrofitClient.kt          # Retrofit 客户端配置
├── repository/
│   └── AuthRepository.kt          # API 调用封装
└── ui/
    ├── MainActivity.kt            # 启动页,自动登录逻辑
    └── SettingsActivity.kt        # 设置页,Google 账号管理
```

### 📄 核心文件功能

| 文件 | 功能 | 说明 |
|------|------|------|
| `BitcoinMiningApplication.kt` | 应用初始化 | 初始化 UserManager 等全局单例 |
| `UserManager.kt` | 本地数据管理 | 使用 SharedPreferences 存储用户信息 |
| `DataModels.kt` | 数据模型 | 所有 API 请求/响应的数据类 |
| `ApiService.kt` | API 接口 | Retrofit 接口定义,声明所有 API 端点 |
| `RetrofitClient.kt` | 网络客户端 | 配置 Retrofit,OkHttp,日志拦截器 |
| `AuthRepository.kt` | API 调用封装 | 封装所有认证相关 API,统一错误处理 |
| `MainActivity.kt` | 自动登录 | APP 启动时自动调用 device-login |
| `SettingsActivity.kt` | Google 账号管理 | 绑定/解绑/切换 Google 账号 |

---

## 3. 快速开始

### 步骤 1: 复制代码文件

将以下文件复制到您的 Android 项目中:

1. `BitcoinMiningApplication.kt` → `app/src/main/java/com/bitcoinmining/`
2. `UserManager.kt` → `app/src/main/java/com/bitcoinmining/data/`
3. `DataModels.kt` → `app/src/main/java/com/bitcoinmining/models/`
4. `ApiService.kt` → `app/src/main/java/com/bitcoinmining/network/`
5. `RetrofitClient.kt` → `app/src/main/java/com/bitcoinmining/network/`
6. `AuthRepository.kt` → `app/src/main/java/com/bitcoinmining/repository/`
7. `MainActivity.kt` → `app/src/main/java/com/bitcoinmining/ui/`
8. `SettingsActivity.kt` → `app/src/main/java/com/bitcoinmining/ui/`

### 步骤 2: 修改包名

将所有文件中的 `com.bitcoinmining` 替换为您的实际包名。

### 步骤 3: 配置 Base URL

在 `RetrofitClient.kt` 中修改 API 地址:

```kotlin
// 开发环境 (Android 模拟器访问本机)
private const val BASE_URL_DEV = "http://10.0.2.2:8888"

// 生产环境 (实际服务器)
private const val BASE_URL_PROD = "http://47.79.232.189:8888"
```

### 步骤 4: 创建布局文件

创建 `activity_main.xml`:

```xml
<?xml version="1.0" encoding="utf-8"?>
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:gravity="center"
    android:orientation="vertical"
    android:padding="24dp">
    
    <ProgressBar
        android:id="@+id/progress_bar"
        android:layout_width="wrap_content"
        android:layout_height="wrap_content" />
    
    <TextView
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:layout_marginTop="16dp"
        android:text="正在登录..."
        android:textSize="16sp" />
    
</LinearLayout>
```

创建 `activity_settings.xml`:

```xml
<?xml version="1.0" encoding="utf-8"?>
<ScrollView xmlns:android="http://schemas.android.com/apk/res/android"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:padding="16dp">
    
    <LinearLayout
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:orientation="vertical">
        
        <!-- 用户信息 -->
        <TextView
            android:id="@+id/tv_user_id"
            android:layout_width="match_parent"
            android:layout_height="wrap_content"
            android:text="用户ID: 加载中..."
            android:textSize="16sp"
            android:padding="8dp" />
        
        <TextView
            android:id="@+id/tv_invitation_code"
            android:layout_width="match_parent"
            android:layout_height="wrap_content"
            android:text="邀请码: 加载中..."
            android:textSize="16sp"
            android:padding="8dp" />
        
        <TextView
            android:id="@+id/tv_google_account"
            android:layout_width="match_parent"
            android:layout_height="wrap_content"
            android:text="Google 账号: 未绑定"
            android:textSize="16sp"
            android:padding="8dp" />
        
        <!-- 操作按钮 -->
        <Button
            android:id="@+id/btn_bind_google"
            android:layout_width="match_parent"
            android:layout_height="wrap_content"
            android:layout_marginTop="16dp"
            android:text="绑定 Google 账号" />
        
        <Button
            android:id="@+id/btn_unbind_google"
            android:layout_width="match_parent"
            android:layout_height="wrap_content"
            android:layout_marginTop="8dp"
            android:text="解绑 Google 账号"
            android:visibility="gone" />
        
        <Button
            android:id="@+id/btn_switch_google"
            android:layout_width="match_parent"
            android:layout_height="wrap_content"
            android:layout_marginTop="8dp"
            android:text="切换 Google 账号"
            android:visibility="gone" />
        
        <ProgressBar
            android:id="@+id/progress_bar"
            android:layout_width="wrap_content"
            android:layout_height="wrap_content"
            android:layout_gravity="center"
            android:layout_marginTop="16dp"
            android:visibility="gone" />
        
    </LinearLayout>
</ScrollView>
```

### 步骤 5: 运行项目

1. 连接 Android 模拟器或真机
2. 点击 Run 按钮
3. APP 启动后会自动调用 device-login 接口
4. 查看 Logcat 日志确认登录成功

---

## 4. 关键功能实现

### 4.1 自动登录流程

**实现文件**: `MainActivity.kt`

```kotlin
// 1. 获取设备信息
val androidId = getAndroidId()
val gaid = getGaid()

// 2. 调用 device-login API
val result = authRepository.deviceLogin(
    androidId = androidId,
    country = getCountryCode(),
    deviceModel = getDeviceModel(),
    gaid = gaid
)

// 3. 保存用户信息
result.onSuccess { response ->
    UserManager.saveUserInfo(response.data)
    // 跳转到主界面
}
```

**关键点**:
- `getAndroidId()`: 获取设备唯一标识 (Settings.Secure.ANDROID_ID)
- `getGaid()`: 异步获取 Google 广告 ID (需要后台线程)
- 首次启动自动注册,再次启动自动登录

### 4.2 Google 账号绑定

**实现文件**: `SettingsActivity.kt`

```kotlin
// 1. 启动 Google Sign-In
private fun signInWithGoogle() {
    val signInIntent = googleSignInClient.signInIntent
    startActivityForResult(signInIntent, RC_SIGN_IN)
}

// 2. 处理登录结果
override fun onActivityResult(...) {
    val account = GoogleSignIn.getSignedInAccountFromIntent(data)
    bindGoogleAccount(account.email)
}

// 3. 调用绑定 API
private fun bindGoogleAccount(googleEmail: String) {
    val result = authRepository.bindGoogleAccount(
        userId = UserManager.getUserId()!!,
        googleAccount = googleEmail
    )
    result.onSuccess {
        UserManager.updateGoogleAccount(googleEmail)
    }
}
```

**关键点**:
- 使用 Google Sign-In SDK 进行 OAuth 认证
- 获取 Google 账号邮箱后调用后端绑定 API
- 绑定成功后更新本地用户信息

### 4.3 多账号切换

**业务逻辑**:

1. 用户在设置页点击"切换 Google 账号"
2. 先登出当前 Google 账号
3. 重新启动 Google Sign-In 流程
4. 用户选择另一个 Google 账号
5. 调用 `switch-google` API
6. 后端更新 android_id,返回新的 user_id
7. 客户端保存新用户信息,刷新界面

**代码示例**:

```kotlin
private fun switchGoogleAccount() {
    googleSignInClient.signOut().addOnCompleteListener {
        signInWithGoogle()
    }
}
```

### 4.4 推荐人邀请码处理

**场景**: 用户从推广链接进入 APP

**实现方式**:

```kotlin
// 1. 从 Intent 或 Deep Link 获取推荐码
val referrerCode = intent.getStringExtra("referrer_code")

// 2. 登录时传入推荐码
val result = authRepository.deviceLogin(
    androidId = androidId,
    country = country,
    referrerCode = referrerCode  // 传入推荐码
)

// 3. 后端自动创建邀请关系
```

---

## 5. 测试流程

### 5.1 测试自动登录

1. 启动 APP (首次安装)
2. 观察 Logcat 输出:
   ```
   Login success: 账号创建成功
   User ID: U2025120722023724632
   Invitation Code: INV2025120722023724632
   ```
3. 验证 Toast 提示: "欢迎! 您的邀请码是 INV..."
4. 重启 APP
5. 验证 Toast 提示: "欢迎回来! U2025120722023724632"

### 5.2 测试 Google 账号绑定

1. 进入设置页面
2. 点击"绑定 Google 账号"
3. 选择 Google 账号
4. 验证 Toast 提示: "绑定成功!"
5. 验证界面显示: "Google 账号: xxx@gmail.com"

### 5.3 测试多账号切换

**准备工作**: 需要 2 个 Google 账号

1. 使用账号 A 绑定
2. 点击"切换 Google 账号"
3. 选择账号 B
4. 验证界面显示新的 user_id 和 invitation_code
5. 再次切换回账号 A
6. 验证显示原来的 user_id

### 5.4 测试推荐人邀请码

**方法 1**: 手动传入

在 `MainActivity.kt` 中修改:

```kotlin
val result = authRepository.deviceLogin(
    androidId = androidId,
    country = country,
    referrerCode = "INV2025120722013740362"  // 测试邀请码
)
```

**方法 2**: 使用 Deep Link

配置 Deep Link:

```xml
<intent-filter>
    <action android:name="android.intent.action.VIEW" />
    <category android:name="android.intent.category.DEFAULT" />
    <category android:name="android.intent.category.BROWSABLE" />
    <data android:scheme="bitcoinmining"
          android:host="referral"
          android:pathPrefix="/invite" />
</intent-filter>
```

测试链接: `bitcoinmining://referral/invite?code=INV2025120722013740362`

---

## 6. 常见问题

### Q1: 无法连接到服务器

**现象**: Retrofit 请求超时或连接失败

**解决方案**:

1. **Android 模拟器访问本机**: 使用 `10.0.2.2` 而不是 `localhost`
   ```kotlin
   private const val BASE_URL_DEV = "http://10.0.2.2:8888"
   ```

2. **真机访问**: 确保手机和电脑在同一局域网,使用电脑的 IP 地址
   ```kotlin
   private const val BASE_URL_DEV = "http://192.168.1.100:8888"
   ```

3. **检查网络权限**: 确保 `AndroidManifest.xml` 中添加了 `INTERNET` 权限

4. **检查网络安全配置**: 开发环境需要允许 HTTP 明文传输

### Q2: 无法获取 GAID

**现象**: `getGaid()` 返回 null

**原因**:
- 设备没有安装 Google Play Services
- 用户启用了广告跟踪限制
- 在主线程调用 (必须在后台线程)

**解决方案**:

```kotlin
private suspend fun getGaid(): String? = withContext(Dispatchers.IO) {
    try {
        val adInfo = AdvertisingIdClient.getAdvertisingIdInfo(applicationContext)
        if (!adInfo.isLimitAdTrackingEnabled) {
            adInfo.id
        } else {
            null  // 用户禁用广告跟踪
        }
    } catch (e: Exception) {
        Log.e(TAG, "Failed to get GAID", e)
        null  // 设备不支持
    }
}
```

**备注**: GAID 为 null 不影响功能,后端会正常处理

### Q3: Google Sign-In 失败

**现象**: `ApiException: statusCode=10`

**原因**: 未配置 Google API Console

**解决方案**:

1. 访问 [Google Cloud Console](https://console.cloud.google.com/)
2. 创建 OAuth 2.0 客户端 ID
3. 配置 Android 应用的包名和 SHA-1 指纹
4. 获取 SHA-1:
   ```bash
   keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey
   ```
   密码: `android`

### Q4: 如何处理网络错误?

**推荐做法**: 在 Repository 层统一错误处理

```kotlin
suspend fun deviceLogin(...): Result<DeviceLoginResponse> {
    return try {
        val response = apiService.deviceLogin(request)
        
        if (response.isSuccessful && response.body() != null) {
            Result.success(response.body()!!)
        } else {
            // 解析错误信息
            val errorMsg = response.errorBody()?.string() ?: "Unknown error"
            Result.failure(Exception("Login failed: $errorMsg"))
        }
    } catch (e: Exception) {
        // 网络异常
        Result.failure(e)
    }
}
```

**UI 层处理**:

```kotlin
result.onSuccess { response ->
    // 成功处理
}

result.onFailure { exception ->
    // 错误处理
    when (exception) {
        is IOException -> showError("网络连接失败")
        is HttpException -> showError("服务器错误: ${exception.code()}")
        else -> showError("未知错误: ${exception.message}")
    }
}
```

### Q5: 如何调试 API 请求?

**方法 1**: 使用 OkHttp 日志拦截器

在 `RetrofitClient.kt` 中已配置,Debug 模式下自动启用:

```kotlin
if (BuildConfig.DEBUG) {
    val loggingInterceptor = HttpLoggingInterceptor().apply {
        level = HttpLoggingInterceptor.Level.BODY
    }
    builder.addInterceptor(loggingInterceptor)
}
```

**Logcat 输出示例**:

```
D/OkHttp: --> POST http://10.0.2.2:8888/api/auth/device-login
D/OkHttp: Content-Type: application/json
D/OkHttp: {"android_id":"test_001","country":"CN"}
D/OkHttp: --> END POST

D/OkHttp: <-- 200 OK http://10.0.2.2:8888/api/auth/device-login
D/OkHttp: {"success":true,"isNewUser":false,...}
D/OkHttp: <-- END HTTP
```

**方法 2**: 使用 Charles 或 Fiddler 抓包

1. 配置代理: 设置 → Wi-Fi → 代理
2. 安装 Charles 证书
3. 抓包查看完整请求/响应

---

## 📞 技术支持

如有问题,请参考:
- [后端 API 文档](../AUTH_API.md)
- [项目 README](../../README.md)

---

## 🎉 完成!

恭喜! 您已完成 Android 客户端集成。现在可以:

✅ 自动登录/注册  
✅ 绑定 Google 账号  
✅ 切换多个账号  
✅ 处理推荐人邀请码  
✅ 查询用户状态和邀请信息  

开始开发您的 Bitcoin Mining Master APP 吧! 🚀
