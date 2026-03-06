# 🔧 登录失败问题诊断与修复

## 问题现象
Android APP 启动时显示 Toast: "登录失败: ..."

## 🔍 问题诊断

### 可能原因 1: 网络连接问题 (最常见) ⭐⭐⭐

**症状**: 模拟器无法访问 `http://10.0.2.2:8888`

**原因**:
- 防火墙阻止了 8888 端口
- 模拟器网络配置错误
- macOS 本地回环地址限制

**解决方案**:

#### 方法 A: 使用 localhost 代替 10.0.2.2 (快速测试)

1. 修改 `ApiClient.kt`:
```kotlin
// 临时改为 localhost 测试
private const val BASE_URL_DEV = "http://localhost:8888/"
```

2. 重新运行 APP

#### 方法 B: 检查防火墙设置

macOS 防火墙检查:
```bash
# 查看防火墙状态
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --getglobalstate

# 如果开启，临时关闭测试
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --setglobalstate off

# 测试完后记得开启
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --setglobalstate on
```

#### 方法 C: 使用电脑的实际 IP 地址

1. 查看电脑 IP:
```bash
ifconfig | grep "inet " | grep -v 127.0.0.1
```

输出示例: `inet 192.168.1.100 netmask 0xffffff00 broadcast 192.168.1.255`

2. 修改 `ApiClient.kt`:
```kotlin
private const val BASE_URL_DEV = "http://192.168.1.100:8888/"  // 替换为您的 IP
```

#### 方法 D: 配置后端允许所有来源

修改 `backend/src/index.js`:
```javascript
// CORS 配置
app.use(cors({
  origin: '*',  // 允许所有来源 (仅用于开发测试)
  credentials: true
}));

// 或更安全的配置
app.use(cors({
  origin: ['http://localhost:3000', 'http://10.0.2.2:8888', 'http://127.0.0.1:8888'],
  credentials: true
}));
```

重启后端:
```bash
pm2 restart bitcoin-backend
```

---

### 可能原因 2: 后端服务未绑定正确地址

**检查后端监听地址**:

查看 `backend/src/index.js`:
```javascript
const PORT = process.env.PORT || 8888;
const HOST = '0.0.0.0';  // 应该是 0.0.0.0 而不是 127.0.0.1

app.listen(PORT, HOST, () => {
  console.log(`服务器运行在 http://${HOST}:${PORT}`);
});
```

如果是 `127.0.0.1`，改为 `0.0.0.0` 并重启:
```bash
pm2 restart bitcoin-backend
```

---

### 可能原因 3: 序列化问题

**检查 Retrofit 是否正确序列化**

在 `MainActivity.kt` 的 `autoLogin()` 中添加调试日志:
```kotlin
// 调用设备登录接口前添加日志
Log.d(TAG, "Calling deviceLogin with:")
Log.d(TAG, "  androidId: $androidId")
Log.d(TAG, "  country: $country")
Log.d(TAG, "  deviceModel: $deviceModel")
Log.d(TAG, "  gaid: $gaid")

val result = authRepository.deviceLogin(...)
```

在 `AuthRepository.kt` 中添加请求日志:
```kotlin
suspend fun deviceLogin(...): Result<DeviceLoginResponse> {
    return try {
        val request = DeviceLoginRequest(...)
        
        // 添加日志
        Log.d("AuthRepository", "Request: $request")
        
        val response = apiService.deviceLogin(request)
        
        // 添加日志
        Log.d("AuthRepository", "Response code: ${response.code()}")
        Log.d("AuthRepository", "Response body: ${response.body()}")
        Log.d("AuthRepository", "Response error: ${response.errorBody()?.string()}")
        
        ...
    }
}
```

---

### 可能原因 4: HTTP 权限或网络安全配置

**检查 AndroidManifest.xml**:
```xml
<!-- 必须有这些权限 -->
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />

<application
    android:usesCleartextTraffic="true"  <!-- 必须开启 HTTP 明文流量 -->
    ...>
```

如果没有 `android:usesCleartextTraffic="true"`，添加后重新运行。

---

## 🛠️ 快速修复步骤

### 立即尝试 (5 分钟):

**步骤 1**: 修改 API 地址
```bash
# 打开文件
# mobile_client/Bitcoin_Mining_Master/app/src/main/java/com/cloudminingtool/bitcoinminingmaster/network/ApiClient.kt
```

修改为:
```kotlin
private const val BASE_URL_DEV = "http://10.0.2.2:8888/"

// 或者使用您的电脑局域网 IP
// private const val BASE_URL_DEV = "http://192.168.1.100:8888/"
```

**步骤 2**: 确保后端监听 0.0.0.0
```bash
cd backend
grep -n "app.listen" src/index.js
```

应该看到:
```javascript
app.listen(PORT, '0.0.0.0', ...)
```

**步骤 3**: 添加网络日志到 ApiClient

修改 `ApiClient.kt`:
```kotlin
object ApiClient {
    
    private const val BASE_URL_DEV = "http://10.0.2.2:8888/"
    private const val BASE_URL = BASE_URL_DEV
    
    private val loggingInterceptor = HttpLoggingInterceptor().apply {
        level = HttpLoggingInterceptor.Level.BODY  // 改为 BODY 查看完整请求
    }
    
    private val client = OkHttpClient.Builder()
        .addInterceptor(loggingInterceptor)
        .connectTimeout(30, TimeUnit.SECONDS)  // 增加超时时间
        .readTimeout(30, TimeUnit.SECONDS)
        .writeTimeout(30, TimeUnit.SECONDS)
        .build()
    
    // ... 其余代码
}
```

**步骤 4**: 重新运行并查看 Logcat

在 Android Studio 的 Logcat 中筛选:
- Tag: `OkHttp` - 查看网络请求日志
- Tag: `MainActivity` - 查看您的日志
- Tag: `AuthRepository` - 查看 API 调用日志

---

## 📋 Logcat 关键信息

查看 Logcat 时重点关注:

### 成功的日志应该是:
```
D/MainActivity: Starting auto login...
D/MainActivity: Android ID: xxx
D/OkHttp: --> POST http://10.0.2.2:8888/api/auth/device-login
D/OkHttp: Content-Type: application/json; charset=UTF-8
D/OkHttp: {"android_id":"xxx","country":"US",...}
D/OkHttp: --> END POST
D/OkHttp: <-- 200 OK http://10.0.2.2:8888/api/auth/device-login
D/OkHttp: {"success":true,"isNewUser":true,...}
D/MainActivity: Login success: 账号创建成功
```

### 失败的日志可能是:
```
D/OkHttp: --> POST http://10.0.2.2:8888/api/auth/device-login
E/OkHttp: java.net.ConnectException: Failed to connect to /10.0.2.2:8888
```
→ 说明网络无法连接

或:
```
D/OkHttp: <-- 400 Bad Request
D/OkHttp: {"success":false,"error":"android_id 是必填字段"}
```
→ 说明请求参数错误

---

## 🎯 推荐操作

**现在立即做**:

1. 修改 `ApiClient.kt`，将日志级别改为 `BODY`
2. 重新运行 APP
3. 打开 Logcat，筛选 "OkHttp"
4. 截图或复制 Logcat 日志发给我
5. 我会根据日志精确定位问题

**临时测试方案**:

如果 `10.0.2.2` 不通，先改为您的局域网 IP:
```kotlin
// 先查看您的 IP
// 终端运行: ifconfig | grep "inet "

// 假设您的 IP 是 192.168.1.100
private const val BASE_URL_DEV = "http://192.168.1.100:8888/"
```

---

## 📞 需要更多帮助

如果以上方法都不行，请提供:
1. Logcat 完整日志 (筛选 OkHttp 和 MainActivity)
2. 后端日志: `pm2 logs bitcoin-backend --lines 50`
3. 您的 macOS 版本
4. Android 模拟器版本和 API 级别

我会帮您精确定位问题! 😊
