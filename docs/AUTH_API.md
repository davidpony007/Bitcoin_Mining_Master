# 无密码登录 + Google账号管理 API文档

## 📱 核心设计理念

1. **首次打开APP** → 通过 `android_id` 自动创建账号,无需注册
2. **再次打开APP** → 通过 `android_id` 自动登录
3. **可选填写推荐码** → 建立邀请关系,获得返利
4. **绑定Google账号** → 支持多设备/多账号切换
5. **切换Google账号** → 自动加载对应的 user_id 和 invitation_code

---

## 🔑 API接口列表

### 1. 设备自动登录/注册

**接口**: `POST /api/auth/device-login`

**说明**: 用户首次打开APP时自动创建账号,后续自动登录

**请求体**:
```json
{
  "android_id": "设备唯一标识(必填)",
  "referrer_invitation_code": "推荐人邀请码(可选)",
  "gaid": "Google广告ID(可选)",
  "country": "国家代码(可选)",
  "email": "邮箱(可选)"
}
```

**响应示例** (新用户):
```json
{
  "success": true,
  "isNewUser": true,
  "message": "账号创建成功",
  "data": {
    "id": 20,
    "user_id": "U2025120721463704333",
    "invitation_code": "INV2025120721463704333",
    "email": null,
    "google_account": null,
    "android_id": "test_device_001",
    "gaid": "test-gaid-12345",
    "register_ip": "::1",
    "country": "US",
    "user_creation_time": "2025-12-07T13:46:37.723Z"
  },
  "referrer": null
}
```

**响应示例** (老用户自动登录):
```json
{
  "success": true,
  "isNewUser": false,
  "message": "登录成功",
  "data": {
    "user_id": "U2025120721463704333",
    "invitation_code": "INV2025120721463704333",
    ...
  },
  "referrer": null
}
```

**响应示例** (有推荐人):
```json
{
  "success": true,
  "isNewUser": true,
  "message": "账号创建成功",
  "data": {...},
  "referrer": {
    "referrer_user_id": "U2025120712345678901",
    "referrer_invitation_code": "INV2025120712345678901"
  }
}
```

**使用场景**:
- Android客户端 `onCreate()` 时调用
- 传入 `getAndroidId()` 获取的设备ID
- 如果用户填写了推荐码,一并传入

---

### 2. 绑定Google账号

**接口**: `POST /api/auth/bind-google`

**说明**: 在系统设置中绑定Google账号,支持多设备同步

**请求体**:
```json
{
  "user_id": "U2025120721463704333",
  "google_account": "testuser@gmail.com"
}
```

**响应示例**:
```json
{
  "success": true,
  "message": "Google账号绑定成功",
  "data": {
    "user_id": "U2025120721463704333",
    "invitation_code": "INV2025120721463704333",
    "google_account": "testuser@gmail.com",
    ...
  }
}
```

**错误示例** (Google账号已被占用):
```json
{
  "success": false,
  "error": "该Google账号已被其他用户绑定"
}
```

**使用场景**:
- 用户在设置页面点击"绑定Google账号"
- 调用 `GoogleSignIn.getSignedInAccount()` 获取Google账号邮箱
- 调用此接口绑定

---

### 3. 通过Google账号切换用户

**接口**: `POST /api/auth/switch-google`

**说明**: 切换到已绑定该Google账号的用户,自动切换 user_id 和 invitation_code

**请求体**:
```json
{
  "google_account": "testuser@gmail.com",
  "android_id": "test_device_003"
}
```

**响应示例**:
```json
{
  "success": true,
  "message": "切换成功",
  "data": {
    "user_id": "U2025120721463704333",
    "invitation_code": "INV2025120721463704333",
    "google_account": "testuser@gmail.com",
    "android_id": "test_device_003",
    ...
  }
}
```

**错误示例** (Google账号未绑定):
```json
{
  "success": false,
  "error": "未找到绑定该Google账号的用户"
}
```

**使用场景**:
- 用户在设置页面切换Google账号
- 检测到 `onAccountChanged` 事件时调用
- 返回的 `user_id` 和 `invitation_code` 自动切换

---

### 4. 解绑Google账号

**接口**: `POST /api/auth/unbind-google`

**说明**: 解除Google账号绑定

**请求体**:
```json
{
  "user_id": "U2025120721463704333"
}
```

**响应示例**:
```json
{
  "success": true,
  "message": "Google账号解绑成功",
  "data": {
    "user_id": "U2025120721463704333",
    "google_account": null,
    ...
  }
}
```

---

### 5. 查询邀请信息

**接口**: `GET /api/auth/invitation-info?user_id={user_id}`

**说明**: 查询用户的邀请关系、推荐人、被邀请用户列表

**请求参数**:
- `user_id`: 用户ID (必填)

**响应示例**:
```json
{
  "success": true,
  "data": {
    "myInfo": {
      "user_id": "U2025120721471479918",
      "invitation_code": "INV2025120721471479918",
      "referrer_user_id": "U2025120721463704333",
      "referrer_invitation_code": "INV2025120721463704333"
    },
    "referrer": {
      "user_id": "U2025120721463704333",
      "invitation_code": "INV2025120721463704333",
      "email": null,
      "country": "US"
    },
    "invitedUsers": [
      {
        "user_id": "U2025120721555512345",
        "invitation_code": "INV2025120721555512345",
        "email": "invited@example.com",
        "country": "CN",
        "user_creation_time": "2025-12-07T14:00:00.000Z"
      }
    ],
    "invitedCount": 1
  }
}
```

**使用场景**:
- 显示"我的推荐人"页面
- 显示"我的邀请列表"页面
- 计算邀请返利

---

## 📊 数据库表结构

### user_information 表
| 字段 | 类型 | 说明 |
|------|------|------|
| user_id | VARCHAR(30) | 用户唯一ID (格式: U+19位数字) |
| invitation_code | VARCHAR(30) | 用户邀请码 (格式: INV+19位数字) |
| email | VARCHAR(100) | 邮箱(可选) |
| google_account | VARCHAR(100) | **绑定的Google账号** |
| android_id | VARCHAR(32) | Android设备ID(可选) |
| gaid | VARCHAR(36) | Google广告ID(可选) |
| register_ip | VARCHAR(45) | 注册IP(自动获取) |
| country | VARCHAR(32) | 国家代码(可选) |
| user_creation_time | TIMESTAMP | 注册时间(自动) |

### invitation_relationship 表
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INT | 主键 |
| user_id | VARCHAR(30) | 被邀请用户ID |
| invitation_code | VARCHAR(30) | 被邀请用户的邀请码 |
| referrer_user_id | VARCHAR(30) | 推荐人用户ID |
| referrer_invitation_code | VARCHAR(30) | 推荐人邀请码 |
| invitation_creation_time | TIMESTAMP | 邀请关系建立时间 |

---

## 🔄 完整业务流程

### 场景1: 新用户首次打开APP

```kotlin
// 1. 获取设备ID
val androidId = Settings.Secure.getString(
    context.contentResolver,
    Settings.Secure.ANDROID_ID
)

// 2. 调用设备登录接口
val response = apiService.deviceLogin(
    androidId = androidId,
    referrerInvitationCode = null,  // 首次没有推荐码
    gaid = getGAID(context),
    country = Locale.getDefault().country
)

// 3. 保存用户信息到本地
if (response.isNewUser) {
    saveUserInfo(response.data)
    showWelcomeDialog()
} else {
    saveUserInfo(response.data)
}
```

### 场景2: 用户填写推荐码注册

```kotlin
// 用户在首次打开APP时填写了推荐码
val response = apiService.deviceLogin(
    androidId = androidId,
    referrerInvitationCode = "INV2025120721463704333",  // 用户填写的推荐码
    gaid = getGAID(context),
    country = Locale.getDefault().country
)

// 如果有推荐人信息
if (response.referrer != null) {
    showToast("注册成功!您的推荐人: ${response.referrer.referrerUserId}")
}
```

### 场景3: 用户绑定Google账号

```kotlin
// 1. 用户在设置页面点击"绑定Google账号"
val account = GoogleSignIn.getLastSignedInAccount(context)
val googleEmail = account?.email

// 2. 调用绑定接口
val response = apiService.bindGoogleAccount(
    userId = currentUserId,
    googleAccount = googleEmail
)

if (response.success) {
    showToast("Google账号绑定成功!")
    updateLocalUserInfo(response.data)
}
```

### 场景4: 切换Google账号

```kotlin
// 1. 检测到Google账号变化
override fun onAccountChanged(newAccount: GoogleSignInAccount) {
    val newEmail = newAccount.email
    
    // 2. 调用切换接口
    val response = apiService.switchByGoogleAccount(
        googleAccount = newEmail,
        androidId = getAndroidId(context)
    )
    
    if (response.success) {
        // 3. 更新本地存储的用户信息
        saveUserInfo(response.data)
        
        // 4. 重新加载用户数据
        reloadUserData()
        
        showToast("已切换到账号: ${response.data.userId}")
    }
}
```

---

## 🎯 Android客户端集成示例

### 1. 定义API接口

```kotlin
interface AuthApiService {
    @POST("auth/device-login")
    suspend fun deviceLogin(
        @Body request: DeviceLoginRequest
    ): DeviceLoginResponse
    
    @POST("auth/bind-google")
    suspend fun bindGoogleAccount(
        @Body request: BindGoogleRequest
    ): BindGoogleResponse
    
    @POST("auth/switch-google")
    suspend fun switchByGoogleAccount(
        @Body request: SwitchGoogleRequest
    ): SwitchGoogleResponse
    
    @GET("auth/invitation-info")
    suspend fun getInvitationInfo(
        @Query("user_id") userId: String
    ): InvitationInfoResponse
}
```

### 2. 数据类定义

```kotlin
data class DeviceLoginRequest(
    val android_id: String,
    val referrer_invitation_code: String? = null,
    val gaid: String? = null,
    val country: String? = null,
    val email: String? = null
)

data class DeviceLoginResponse(
    val success: Boolean,
    val isNewUser: Boolean,
    val message: String,
    val data: UserInfo,
    val referrer: ReferrerInfo?
)

data class UserInfo(
    val user_id: String,
    val invitation_code: String,
    val email: String?,
    val google_account: String?,
    val android_id: String,
    val country: String?,
    val user_creation_time: String
)

data class ReferrerInfo(
    val referrer_user_id: String,
    val referrer_invitation_code: String
)
```

### 3. UserManager 单例

```kotlin
object UserManager {
    private const val PREF_NAME = "user_prefs"
    private const val KEY_USER_ID = "user_id"
    private const val KEY_INVITATION_CODE = "invitation_code"
    private const val KEY_GOOGLE_ACCOUNT = "google_account"
    
    private lateinit var prefs: SharedPreferences
    
    fun init(context: Context) {
        prefs = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE)
    }
    
    fun saveUserInfo(userInfo: UserInfo) {
        prefs.edit {
            putString(KEY_USER_ID, userInfo.user_id)
            putString(KEY_INVITATION_CODE, userInfo.invitation_code)
            putString(KEY_GOOGLE_ACCOUNT, userInfo.google_account)
        }
    }
    
    fun getUserId(): String? = prefs.getString(KEY_USER_ID, null)
    
    fun getInvitationCode(): String? = prefs.getString(KEY_INVITATION_CODE, null)
    
    fun getGoogleAccount(): String? = prefs.getString(KEY_GOOGLE_ACCOUNT, null)
    
    fun isLoggedIn(): Boolean = getUserId() != null
}
```

### 4. Application 启动时自动登录

```kotlin
class MyApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        
        UserManager.init(this)
        
        // 启动时自动登录
        lifecycleScope.launch {
            autoLogin()
        }
    }
    
    private suspend fun autoLogin() {
        val androidId = Settings.Secure.getString(
            contentResolver,
            Settings.Secure.ANDROID_ID
        )
        
        try {
            val response = RetrofitClient.authApi.deviceLogin(
                DeviceLoginRequest(
                    android_id = androidId,
                    gaid = getGAID(this),
                    country = Locale.getDefault().country
                )
            )
            
            if (response.success) {
                UserManager.saveUserInfo(response.data)
                Log.d("AutoLogin", "自动登录成功: ${response.data.user_id}")
            }
        } catch (e: Exception) {
            Log.e("AutoLogin", "自动登录失败", e)
        }
    }
}
```

---

## ✅ 功能验证清单

- [x] 设备首次登录自动创建账号
- [x] 相同设备再次登录自动返回已有账号
- [x] 填写推荐码建立邀请关系
- [x] 邀请关系正确记录到数据库
- [x] 绑定Google账号功能正常
- [x] 通过Google账号切换用户
- [x] 切换时自动更新设备绑定
- [x] 查询邀请信息接口正常
- [x] 云端MySQL数据同步正常

---

## 🔒 安全建议

1. **HTTPS**: 生产环境必须使用HTTPS加密传输
2. **API限流**: 防止暴力注册攻击
3. **设备指纹**: 除了android_id,可增加设备指纹验证
4. **邀请码验证**: 推荐码不存在时给出友好提示
5. **Google账号验证**: 生产环境应验证Google账号真实性

---

## 📝 注意事项

1. **android_id 可变性**: 
   - Android 8.0+ 每个应用的android_id不同
   - 重置设备/清除数据后会改变
   - 建议结合GAID使用

2. **Google账号切换**:
   - 一个Google账号只能绑定一个user_id
   - 切换Google账号会更新当前设备的绑定
   - 旧设备下次启动会通过android_id自动登录

3. **邀请关系**:
   - 每个用户只能有一个推荐人
   - 邀请关系建立后不可修改
   - referrer_invitation_code 填错不影响注册

4. **多设备同步**:
   - 同一Google账号可在多个设备使用
   - 每次切换会更新 android_id 字段
   - 不影响 user_id 和 invitation_code

---

## 🚀 后续扩展

1. **JWT Token认证**: 生成token用于后续API调用
2. **用户状态管理**: 自动创建user_status记录
3. **邀请返利**: 实现邀请奖励计算
4. **多级邀请**: 支持二级、三级返利
5. **设备管理**: 查看已绑定的设备列表

---

**文档版本**: 1.0  
**更新时间**: 2025-12-07  
**API基础路径**: `http://your-domain/api/auth`
