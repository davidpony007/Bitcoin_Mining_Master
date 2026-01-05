# 生产环境用户数据采集方案

## 📋 概述

本文档说明在真实生产环境中，如何采集和传递用户注册所需的各项数据。

---

## 🏗️ 整体架构

```
┌─────────────────┐                    ┌─────────────────┐
│  Android 客户端  │ ──── HTTP POST ──▶ │   后端 API      │
│                 │                    │                 │
│ • 采集设备信息   │                    │ • 提取真实IP     │
│ • 收集用户数据   │                    │ • 验证数据       │
│ • 发送注册请求   │                    │ • 存储到MySQL    │
└─────────────────┘                    └─────────────────┘
```

---

## 📱 Android客户端实现

### 1️⃣ 获取 Android ID

**Android ID** 是设备的唯一标识符（非IMEI，隐私友好）。

```kotlin
// app/src/main/java/com/example/bitcoin/utils/DeviceUtils.kt
package com.example.bitcoin.utils

import android.content.Context
import android.provider.Settings

object DeviceUtils {
    
    /**
     * 获取 Android 设备 ID
     * @param context 上下文
     * @return Android ID 字符串（最多16位字符）
     */
    fun getAndroidId(context: Context): String {
        return try {
            Settings.Secure.getString(
                context.contentResolver,
                Settings.Secure.ANDROID_ID
            ) ?: ""
        } catch (e: Exception) {
            e.printStackTrace()
            ""
        }
    }
}
```

**权限要求**：无需特殊权限

**返回示例**：`"9774d56d682e549c"`

---

### 2️⃣ 获取 GAID (Google Advertising ID)

**GAID** 用于广告追踪，符合 Google Play 政策。

```kotlin
import com.google.android.gms.ads.identifier.AdvertisingIdClient
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/**
 * 获取 Google Advertising ID（需要在后台线程执行）
 * @param context 上下文
 * @return GAID 字符串（UUID格式，36位）
 */
suspend fun getGAID(context: Context): String {
    return withContext(Dispatchers.IO) {
        try {
            val adInfo = AdvertisingIdClient.getAdvertisingIdInfo(context)
            adInfo.id ?: ""
        } catch (e: Exception) {
            e.printStackTrace()
            ""
        }
    }
}
```

**依赖配置**（`build.gradle.kts`）：
```kotlin
dependencies {
    implementation("com.google.android.gms:play-services-ads-identifier:18.0.1")
}
```

**返回示例**：`"38400000-8cf0-11bd-b23e-10b96e40000d"`

---

### 3️⃣ 获取用户国家

```kotlin
import java.util.Locale

/**
 * 获取用户所在国家代码
 * @return 国家代码（ISO 3166-1 alpha-2，如 "CN", "US"）
 */
fun getCountryCode(): String {
    return Locale.getDefault().country
}
```

**返回示例**：`"CN"`（中国）、`"US"`（美国）

---

### 4️⃣ 获取用户邮箱（可选）

```kotlin
import android.accounts.AccountManager
import android.content.Context

/**
 * 获取设备上的 Google 账户邮箱（需要权限）
 * @param context 上下文
 * @return 邮箱地址或空字符串
 */
fun getGoogleEmail(context: Context): String {
    return try {
        val accountManager = AccountManager.get(context)
        val accounts = accountManager.getAccountsByType("com.google")
        if (accounts.isNotEmpty()) {
            accounts[0].name  // 返回第一个 Google 账户的邮箱
        } else {
            ""
        }
    } catch (e: Exception) {
        e.printStackTrace()
        ""
    }
}
```

**权限配置**（`AndroidManifest.xml`）：
```xml
<uses-permission android:name="android.permission.GET_ACCOUNTS" />
```

---

### 5️⃣ 注册 API 调用示例

```kotlin
// app/src/main/java/com/example/bitcoin/api/UserApi.kt
package com.example.bitcoin.api

import retrofit2.http.Body
import retrofit2.http.POST
import retrofit2.Response

data class RegisterRequest(
    val user_id: String,
    val android_id: String,
    val gaid: String,
    val email: String?,
    val country: String,
    val invitation_code: String?
)

data class RegisterResponse(
    val success: Boolean,
    val message: String,
    val data: UserData?
)

data class UserData(
    val id: Int,
    val user_id: String,
    val user_creation_time: String
)

interface UserApi {
    @POST("/api/users")
    suspend fun register(@Body request: RegisterRequest): Response<RegisterResponse>
}
```

---

### 6️⃣ 完整注册流程

```kotlin
// app/src/main/java/com/example/bitcoin/viewmodel/RegisterViewModel.kt
package com.example.bitcoin.viewmodel

import android.content.Context
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.launch

class RegisterViewModel : ViewModel() {
    
    fun registerUser(context: Context, email: String?, invitationCode: String?) {
        viewModelScope.launch {
            try {
                // 1. 采集设备信息
                val androidId = DeviceUtils.getAndroidId(context)
                val gaid = getGAID(context)
                val country = getCountryCode()
                
                // 2. 生成用户ID（通常由客户端生成或由后端分配）
                val userId = generateUserId()  // 自定义生成逻辑
                
                // 3. 构建请求
                val request = RegisterRequest(
                    user_id = userId,
                    android_id = androidId,
                    gaid = gaid,
                    email = email,
                    country = country,
                    invitation_code = invitationCode
                )
                
                // 4. 调用 API
                val response = RetrofitClient.userApi.register(request)
                
                // 5. 处理响应
                if (response.isSuccessful && response.body()?.success == true) {
                    // 注册成功
                    println("注册成功: ${response.body()?.data}")
                } else {
                    // 注册失败
                    println("注册失败: ${response.body()?.message}")
                }
                
            } catch (e: Exception) {
                e.printStackTrace()
                println("注册异常: ${e.message}")
            }
        }
    }
    
    private fun generateUserId(): String {
        // 生成15位以内的唯一用户ID
        // 方案1: 时间戳 + 随机数
        val timestamp = System.currentTimeMillis() / 1000  // 10位
        val random = (1000..9999).random()                 // 4位
        return "$timestamp$random"  // 14位
        
        // 方案2: UUID截取
        // return UUID.randomUUID().toString().replace("-", "").take(15)
    }
}
```

---

## 🖥️ 后端实现（已完成）

### 1️⃣ 自动获取真实IP

后端代码已更新，自动从HTTP请求头中提取真实IP：

```javascript
// backend/src/controllers/userController.js

// 自动获取真实IP地址（支持代理和负载均衡）
const register_ip = 
  req.headers['x-forwarded-for']?.split(',')[0].trim() ||  // Nginx代理
  req.headers['x-real-ip'] ||                               // 其他代理
  req.ip ||                                                  // Express直接获取
  req.connection.remoteAddress ||                           // 备用方案
  '未知';
```

**工作原理**：
- **X-Forwarded-For**：Nginx/CDN 会添加此头，包含客户端真实IP
- **X-Real-IP**：某些代理服务器使用
- **req.ip**：Express 框架提供的IP获取方法
- **remoteAddress**：直连时的IP地址

**Nginx 配置**（如需启用代理支持）：
```nginx
location /api/ {
    proxy_pass http://localhost:8888;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header Host $host;
}
```

---

### 2️⃣ 字段验证和默认值

```javascript
const newUser = await UserInformation.create({
  user_id,                               // 必填
  invitation_code: invitation_code || '', // 可选，默认空字符串
  email,                                  // 可选
  android_id: android_id || '',           // 可选，默认空字符串
  gaid,                                   // 可选
  register_ip,                            // 后端自动获取
  country                                 // 可选
});
```

---

## 📊 数据字段说明

| 字段名 | 类型 | 来源 | 必填 | 说明 |
|--------|------|------|------|------|
| `user_id` | STRING(15) | 客户端生成 | ✅ | 用户唯一标识（15位以内） |
| `android_id` | STRING(32) | Android系统 | ❌ | 设备ID（隐私友好） |
| `gaid` | STRING(36) | Google Play Services | ❌ | 广告ID（UUID格式） |
| `email` | STRING(100) | 用户输入/Google账户 | ❌ | 用户邮箱 |
| `country` | STRING(32) | 系统Locale | ❌ | 国家代码（ISO标准） |
| `register_ip` | STRING(45) | **后端自动获取** | ✅ | 注册IP（支持IPv6） |
| `invitation_code` | STRING(13) | 用户输入/扫码 | ❌ | 邀请码 |
| `user_creation_time` | DATE | **数据库自动** | ✅ | 注册时间（CURRENT_TIMESTAMP） |

---

## 🔒 隐私和合规

### GDPR 合规
- ✅ Android ID：非个人身份信息（PII）
- ✅ GAID：可重置，符合广告标识符政策
- ❌ IMEI/MAC地址：**禁止使用**（侵犯隐私）

### 用户同意
在收集数据前，应显示隐私政策并获取用户同意：

```kotlin
// 显示隐私政策对话框
fun showPrivacyDialog(context: Context, onAgree: () -> Unit) {
    AlertDialog.Builder(context)
        .setTitle("隐私政策")
        .setMessage("我们将收集您的设备信息用于账户安全和服务改进...")
        .setPositiveButton("同意") { _, _ -> onAgree() }
        .setNegativeButton("拒绝") { dialog, _ -> dialog.dismiss() }
        .setCancelable(false)
        .show()
}
```

---

## 🧪 测试建议

### Postman 测试示例

```json
POST http://localhost:8888/api/users
Content-Type: application/json

{
  "user_id": "17648599111234",
  "android_id": "9774d56d682e549c",
  "gaid": "38400000-8cf0-11bd-b23e-10b96e40000d",
  "email": "test@example.com",
  "country": "CN",
  "invitation_code": "INV123456"
}
```

**注意**：`register_ip` 不需要传递，后端会自动获取！

---

## 📚 相关资源

- [Android ID 官方文档](https://developer.android.com/reference/android/provider/Settings.Secure#ANDROID_ID)
- [Google Advertising ID 指南](https://developers.google.com/android/reference/com/google/android/gms/ads/identifier/AdvertisingIdClient)
- [Express.js 获取客户端IP](https://expressjs.com/en/api.html#req.ip)
- [Nginx 代理配置](https://nginx.org/en/docs/http/ngx_http_proxy_module.html)

---

## ✅ 总结

**客户端负责**：
- 采集设备信息（Android ID、GAID）
- 获取用户数据（邮箱、国家）
- 发送注册请求

**后端负责**：
- 自动提取真实IP
- 验证数据合法性
- 存储到数据库

**数据库负责**：
- 自动设置创建时间

这样的架构确保了：
- ✅ 数据准确性（IP由后端获取，防止伪造）
- ✅ 隐私安全（使用 Android ID 而非 IMEI）
- ✅ 符合规范（GDPR、Google Play 政策）
