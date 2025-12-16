# ⚡ 快速集成指南

## 🎯 只需 3 步完成集成

### ✅ 第 1 步: 已自动完成的工作

我已经帮您完成了以下配置:

1. ✅ **AndroidManifest.xml** - 已添加 Application 类和权限
2. ✅ **build.gradle.kts** - 已添加 Google Services 依赖
3. ✅ **ApiClient.kt** - 已配置服务器地址
4. ✅ **ApiService.kt** - 已添加认证接口
5. ✅ 已创建 8 个新文件 (AuthModels, UserManager, AuthRepository 等)

---

### 🔧 第 2 步: 您需要手动替换 MainActivity.kt

**重要**: 由于技术限制,我无法直接修改您的 MainActivity.kt 文件,请您手动操作:

#### 方法 1: 完整替换 (推荐) ⭐

1. 打开 Android Studio
2. 在项目中找到 **`MainActivity_Final.kt`** (我刚创建的)
3. 复制全部内容 (Ctrl+A → Ctrl+C)
4. 找到原来的 **`MainActivity.kt`**
5. 粘贴替换全部内容 (Ctrl+A → Ctrl+V)
6. 保存文件 (Ctrl+S)
7. 删除 `MainActivity_Final.kt` 和 `MainActivity_New.kt`

#### 方法 2: 手动添加代码

如果您想保留原有注释,可以只添加以下内容:

1. **添加字段** (在 class MainActivity 内部):
```kotlin
private val authRepository = AuthRepository()
private val TAG = "MainActivity"
```

2. **修改 onCreate()**: 将 `initializeBitcoinBalance()` 改为 `autoLogin()`

3. **复制 3 个新方法** (从 MainActivity_Final.kt):
   - `autoLogin()`
   - `getAndroidId()`
   - `getGaid()`

---

### 🚀 第 3 步: 同步并运行

1. **Gradle Sync**: 
   - 点击 Android Studio 顶部的 **"Sync Now"** 按钮
   - 或 File → Sync Project with Gradle Files

2. **编译项目**:
   - Build → Make Project
   - 等待编译完成

3. **运行测试**:
   - 连接模拟器或真机
   - 点击 Run 按钮 (绿色三角)

---

## 📊 预期结果

### 首次运行 (自动注册)

**Logcat 输出**:
```
D/MainActivity: Starting auto login...
D/MainActivity: Android ID: 1234567890abcdef
D/MainActivity: Login success: 账号创建成功
D/MainActivity: User ID: U2025120722050012345
D/MainActivity: Invitation Code: INV2025120722050012345
D/MainActivity: Is New User: true
```

**Toast 消息**:
```
欢迎! 您的邀请码是 INV2025120722050012345
```

### 再次运行 (自动登录)

**Logcat 输出**:
```
D/MainActivity: Starting auto login...
D/MainActivity: Login success: 登录成功
D/MainActivity: Is New User: false
```

**Toast 消息**:
```
欢迎回来! U2025120722050012345
```

---

## 🐛 快速排查

### 问题: 编译错误 "Unresolved reference"

**解决**:
1. 确认 `MainActivity_Final.kt` 中的代码已复制到 `MainActivity.kt`
2. 点击 "Sync Now"
3. Build → Clean Project
4. Build → Rebuild Project

### 问题: 运行时错误 "ClassNotFoundException"

**原因**: AndroidManifest.xml 未配置 Application 类

**解决**: 打开 AndroidManifest.xml,确认 `<application>` 标签有:
```xml
android:name=".BitcoinMiningApplication"
```

### 问题: Toast 显示 "登录失败"

**解决**:
1. 确认后端服务运行中: `pm2 list`
2. 检查 Logcat 日志查看具体错误
3. 测试 API: `curl http://10.0.2.2:8888/api/auth/user-status?user_id=test`

---

## ✅ 完成检查

- [ ] MainActivity.kt 已替换为新代码
- [ ] Gradle Sync 成功
- [ ] 项目编译通过
- [ ] APP 运行成功
- [ ] 首次启动看到 "欢迎! 您的邀请码是..."
- [ ] Logcat 显示 user_id 和 invitation_code

---

## 📞 需要帮助?

如果遇到问题:
1. 查看详细文档: `docs/ANDROID_INTEGRATION_SUMMARY.md`
2. 检查后端状态: `pm2 logs bitcoin-backend`
3. 查看 Logcat: Android Studio → Logcat → 筛选 "MainActivity"

**集成状态**: ✅ 90% 完成,只需替换 MainActivity.kt 即可运行!
