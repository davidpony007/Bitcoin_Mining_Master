# Android 客户端集成指南 - 现有项目

## 📋 项目信息

- **包名**: `com.cloudminingtool.bitcoinminingmaster`
- **项目路径**: `android_clent/Bitcoin_Mining_Master/`
- **现有架构**: MVVM + Retrofit + 协程
- **已有依赖**: Retrofit, OkHttp, Gson, Coroutines ✅

---

## 🎯 集成步骤

### 步骤 1: 添加缺失的依赖 ⚠️

您的项目缺少以下依赖:

```gradle
// Google Sign-In SDK
implementation("com.google.android.gms:play-services-auth:20.7.0")

// Google Advertising ID
implementation("com.google.android.gms:play-services-ads-identifier:18.0.1")
```

### 步骤 2: 修改现有文件

#### 2.1 修改 `ApiClient.kt`

**当前问题**:
- BASE_URL 是占位符 `https://your-server-url.com/`
- 需要配置正确的开发/生产环境地址

**修改建议**:
```kotlin
// 开发环境 (模拟器访问本机)
private const val BASE_URL_DEV = "http://10.0.2.2:8888/"

// 生产环境
private const val BASE_URL_PROD = "http://47.79.232.189:8888/"

// 根据 BuildConfig 自动切换
private val BASE_URL = if (BuildConfig.DEBUG) BASE_URL_DEV else BASE_URL_PROD
```

#### 2.2 扩展 `ApiService.kt`

**需要添加的 API 接口**:
```kotlin
// 设备登录/自动注册
@POST("api/auth/device-login")
suspend fun deviceLogin(@Body request: DeviceLoginRequest): Response<DeviceLoginResponse>

// 绑定 Google 账号
@POST("api/auth/bind-google")
suspend fun bindGoogleAccount(@Body request: BindGoogleRequest): Response<BindGoogleResponse>

// 切换 Google 账号
@POST("api/auth/switch-google")
suspend fun switchByGoogleAccount(@Body request: SwitchGoogleRequest): Response<SwitchGoogleResponse>

// 查询用户状态
@GET("api/auth/user-status")
suspend fun getUserStatus(@Query("user_id") userId: String): Response<UserStatusResponse>

// 查询邀请信息
@GET("api/auth/invitation-info")
suspend fun getInvitationInfo(@Query("user_id") userId: String): Response<InvitationInfoResponse>
```

### 步骤 3: 创建新文件

需要创建以下文件:

1. **models/AuthModels.kt** - 认证相关数据模型
2. **repository/AuthRepository.kt** - 认证 API 调用封装
3. **manager/UserManager.kt** - 用户数据管理 (SharedPreferences)
4. **ui/settings/SettingsFragment.kt** - 设置页面 (Google 账号管理)
5. **BitcoinMiningApplication.kt** - Application 类

### 步骤 4: 修改 MainActivity

在 `onCreate()` 中添加自动登录逻辑:

```kotlin
override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    
    // 现有代码...
    
    // 添加自动登录
    autoLogin()
}

private fun autoLogin() {
    lifecycleScope.launch {
        val authRepository = AuthRepository()
        val androidId = getAndroidId()
        
        val result = authRepository.deviceLogin(
            androidId = androidId,
            country = Locale.getDefault().country
        )
        
        result.onSuccess { response ->
            UserManager.saveUserInfo(response.data)
            // 继续初始化比特币余额
            initializeBitcoinBalance()
        }
        
        result.onFailure { e ->
            Log.e("MainActivity", "Auto login failed", e)
        }
    }
}

private fun getAndroidId(): String {
    return Settings.Secure.getString(
        contentResolver,
        Settings.Secure.ANDROID_ID
    )
}
```

---

## 🚀 快速集成方案

我将为您的项目结构定制代码,保持与现有代码风格一致。

### 文件清单

| 文件 | 位置 | 操作 |
|------|------|------|
| `build.gradle.kts` | app/ | ✏️ 修改 (添加依赖) |
| `ApiClient.kt` | network/ | ✏️ 修改 (BASE_URL) |
| `ApiService.kt` | network/ | ✏️ 修改 (添加接口) |
| `AuthModels.kt` | data/ | ➕ 新建 |
| `AuthRepository.kt` | repository/ | ➕ 新建 |
| `UserManager.kt` | manager/ | ➕ 新建 |
| `MainActivity.kt` | 根目录 | ✏️ 修改 (添加自动登录) |
| `SettingsFragment.kt` | ui/settings/ | ➕ 新建 |
| `BitcoinMiningApplication.kt` | 根目录 | ➕ 新建 |
| `AndroidManifest.xml` | main/ | ✏️ 修改 (添加权限) |

---

## 📝 详细步骤

接下来我会逐个文件为您生成/修改代码,保持与您现有代码风格一致。

是否继续自动集成?
