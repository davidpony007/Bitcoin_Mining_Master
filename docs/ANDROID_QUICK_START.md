# Android 客户端快速使用指南

## 🚀 5 分钟快速集成

### 1️⃣ 添加依赖 (build.gradle)

```gradle
dependencies {
    // Retrofit + OkHttp + Gson
    implementation "com.squareup.retrofit2:retrofit:2.9.0"
    implementation "com.squareup.retrofit2:converter-gson:2.9.0"
    implementation "com.squareup.okhttp3:logging-interceptor:4.11.0"
    
    // Google Services
    implementation "com.google.android.gms:play-services-auth:20.7.0"
    implementation "com.google.android.gms:play-services-ads-identifier:18.0.1"
    
    // Kotlin 协程
    implementation "org.jetbrains.kotlinx:kotlinx-coroutines-android:1.7.3"
    implementation "androidx.lifecycle:lifecycle-runtime-ktx:2.6.2"
}
```

### 2️⃣ 配置 AndroidManifest.xml

```xml
<manifest>
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="com.google.android.gms.permission.AD_ID" />
    
    <application android:name=".BitcoinMiningApplication" ...>
        ...
    </application>
</manifest>
```

### 3️⃣ 初始化 UserManager

在 `BitcoinMiningApplication.kt`:

```kotlin
class BitcoinMiningApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        UserManager.init(this)
    }
}
```

### 4️⃣ 实现自动登录

在 `MainActivity.kt`:

```kotlin
class MainActivity : AppCompatActivity() {
    private val authRepository = AuthRepository()
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        lifecycleScope.launch {
            // 获取设备信息
            val androidId = getAndroidId()
            
            // 调用 device-login API
            val result = authRepository.deviceLogin(
                androidId = androidId,
                country = Locale.getDefault().country
            )
            
            result.onSuccess { response ->
                // 保存用户信息
                UserManager.saveUserInfo(response.data)
                
                // 跳转主界面
                Toast.makeText(this@MainActivity, 
                    if (response.isNewUser) "注册成功!" else "登录成功!",
                    Toast.LENGTH_SHORT
                ).show()
            }
        }
    }
    
    private fun getAndroidId(): String {
        return Settings.Secure.getString(
            contentResolver,
            Settings.Secure.ANDROID_ID
        )
    }
}
```

### 5️⃣ 完成! ✅

运行 APP,自动完成登录/注册。

---

## 📊 核心 API 使用示例

### 查询用户状态

```kotlin
lifecycleScope.launch {
    val userId = UserManager.getUserId()!!
    val result = authRepository.getUserStatus(userId)
    
    result.onSuccess { response ->
        val status = response.data
        println("余额: ${status.currentBitcoinBalance}")
        println("累计收益: ${status.bitcoinAccumulatedAmount}")
        println("邀请返佣: ${status.totalInvitationRebate}")
    }
}
```

### 查询邀请信息

```kotlin
lifecycleScope.launch {
    val userId = UserManager.getUserId()!!
    val result = authRepository.getInvitationInfo(userId)
    
    result.onSuccess { response ->
        val data = response.data
        println("邀请人数: ${data.totalInvitedCount}")
        println("推荐人: ${data.referrer?.userId ?: "无"}")
        
        data.invitedUsers.forEach { user ->
            println("被邀请用户: ${user.userId}")
        }
    }
}
```

### 绑定 Google 账号

```kotlin
// 1. 初始化 Google Sign-In
val gso = GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
    .requestEmail()
    .build()
val googleSignInClient = GoogleSignIn.getClient(this, gso)

// 2. 启动登录
val signInIntent = googleSignInClient.signInIntent
startActivityForResult(signInIntent, RC_SIGN_IN)

// 3. 处理结果
override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
    super.onActivityResult(requestCode, resultCode, data)
    
    if (requestCode == RC_SIGN_IN) {
        val task = GoogleSignIn.getSignedInAccountFromIntent(data)
        val account = task.getResult(ApiException::class.java)
        
        // 4. 调用绑定 API
        lifecycleScope.launch {
            val userId = UserManager.getUserId()!!
            val result = authRepository.bindGoogleAccount(
                userId = userId,
                googleAccount = account.email!!
            )
            
            result.onSuccess {
                Toast.makeText(this@MainActivity, "绑定成功!", Toast.LENGTH_SHORT).show()
                UserManager.updateGoogleAccount(account.email!!)
            }
        }
    }
}
```

---

## 🔧 配置服务器地址

在 `RetrofitClient.kt` 中修改:

```kotlin
// 开发环境 (模拟器访问本机)
private const val BASE_URL_DEV = "http://10.0.2.2:8888"

// 生产环境
private const val BASE_URL_PROD = "http://47.79.232.189:8888"

// 自动切换
private val BASE_URL = if (BuildConfig.DEBUG) BASE_URL_DEV else BASE_URL_PROD
```

**真机测试**: 将 `10.0.2.2` 改为电脑的局域网 IP (如 `192.168.1.100`)

---

## 📱 完整文件列表

已生成以下文件,直接复制到项目即可:

```
docs/android/
├── ApiService.kt                  # API 接口定义
├── DataModels.kt                  # 数据模型
├── RetrofitClient.kt              # Retrofit 配置
├── UserManager.kt                 # 用户数据管理
├── AuthRepository.kt              # API 调用封装
├── BitcoinMiningApplication.kt    # Application 类
├── MainActivity.kt                # 启动页 (自动登录)
└── SettingsActivity.kt            # 设置页 (Google 账号管理)
```

---

## 🎯 快速测试

### 测试自动登录

```bash
# 1. 清除 APP 数据
adb shell pm clear com.bitcoinmining

# 2. 重新安装
./gradlew installDebug

# 3. 查看日志
adb logcat | grep "MainActivity"
```

### 预期输出

```
Login success: 账号创建成功
User ID: U2025120722023724632
Invitation Code: INV2025120722023724632
```

---

## ❓ 常见问题

### 连接失败?

✅ Android 模拟器使用 `10.0.2.2` 访问本机  
✅ 真机使用局域网 IP (如 `192.168.1.100`)  
✅ 确保电脑防火墙允许 8888 端口

### 无法获取 GAID?

✅ 正常现象,不影响功能 (后端会处理)  
✅ 确保设备安装了 Google Play Services

### Google Sign-In 失败?

✅ 需要在 Google Cloud Console 配置 OAuth 客户端  
✅ 添加应用的包名和 SHA-1 指纹  
✅ 获取 SHA-1: `keytool -list -v -keystore ~/.android/debug.keystore`

---

## 📚 更多文档

- [完整集成指南](ANDROID_INTEGRATION_GUIDE.md) - 详细文档
- [后端 API 文档](AUTH_API.md) - API 规范
- [数据库设计](design.md) - 数据结构

---

**🎉 开始开发吧!** 如有问题,请查看详细文档。
