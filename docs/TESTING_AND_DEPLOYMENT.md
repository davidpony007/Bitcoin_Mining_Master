# 🚀 Android APP 测试与发布流程

## 📋 测试阶段规划

### 阶段 1: 模拟器测试 (当前阶段) ⭐

**目标**: 验证基本功能是否正常

**步骤**:

1. **启动模拟器测试**
   ```
   点击 Android Studio 右上角绿色 ▶️ Run 按钮
   ```

2. **验证自动登录功能**
   - [ ] APP 启动成功
   - [ ] Toast 显示: "欢迎! 您的邀请码是 INV..."
   - [ ] 查看 Logcat 确认有以下日志:
     ```
     D/MainActivity: Starting auto login...
     D/MainActivity: Login success: 账号创建成功
     D/MainActivity: User ID: U2025...
     D/MainActivity: Invitation Code: INV2025...
     ```

3. **验证数据持久化**
   - [ ] 关闭 APP
   - [ ] 重新打开 APP
   - [ ] Toast 应显示: "欢迎回来! U2025..."
   - [ ] Logcat 显示: "Is New User: false"

4. **验证网络异常处理**
   - [ ] 停止后端服务: `pm2 stop bitcoin-backend`
   - [ ] 启动 APP
   - [ ] Toast 应显示: "登录失败: ..."
   - [ ] APP 不崩溃,继续运行

5. **验证比特币余额功能**
   - [ ] 查看首页余额是否正常显示
   - [ ] 测试挖矿功能
   - [ ] 测试余额更新

---

### 阶段 2: 真机测试 (建议) ⭐⭐

**为什么需要真机测试?**
- 模拟器的 GAID 是固定的 (00000000-0000-0000-0000-000000000000)
- 真机可以测试实际的设备 ID 和 GAID
- 性能更接近实际用户体验
- 可以测试网络切换 (WiFi/4G)

**准备工作**:

1. **修改 BASE_URL 为局域网地址**
   
   在 `ApiClient.kt` 中:
   ```kotlin
   // 找到您电脑的局域网 IP
   // macOS: 系统偏好设置 → 网络 → 查看 IP (如 192.168.1.100)
   // Windows: cmd → ipconfig → IPv4 地址
   
   private const val BASE_URL_DEV = "http://192.168.1.100:8888/"  // 改为您的电脑 IP
   ```

2. **连接真机**
   - USB 连接手机到电脑
   - 手机开启开发者模式和 USB 调试
   - Android Studio 会自动识别设备

3. **运行测试**
   - 点击 Run 按钮
   - 选择真实设备
   - 进行完整功能测试

**真机测试清单**:
- [ ] 自动登录成功 (应该创建新用户)
- [ ] 查看 Logcat 确认 GAID 不是全零
- [ ] 重启 APP 验证自动登录
- [ ] 测试所有主要功能
- [ ] 测试在 4G 网络下的表现
- [ ] 测试应用切换到后台再恢复

---

### 阶段 3: 打包 Debug APK (内部测试) ⭐⭐

**场景**: 分发给团队成员或测试人员

**步骤**:

1. **生成 Debug APK**
   ```
   Build → Build Bundle(s) / APK(s) → Build APK(s)
   ```

2. **找到 APK 文件**
   ```
   android_clent/Bitcoin_Mining_Master/app/build/outputs/apk/debug/app-debug.apk
   ```

3. **安装测试**
   - 通过 ADB 安装: `adb install app-debug.apk`
   - 或直接拷贝到手机安装

4. **注意事项**
   - ⚠️ Debug APK 体积较大 (包含调试符号)
   - ⚠️ 只能用于内部测试,不能发布到应用商店
   - ⚠️ 需要配置后端地址为公网 IP (47.79.232.189)

---

### 阶段 4: 打包 Release APK (正式发布) ⭐⭐⭐

**场景**: 发布到应用商店或正式分发

**前置准备**:

1. **创建签名密钥**

   在终端执行:
   ```bash
   cd android_clent/Bitcoin_Mining_Master/app
   
   keytool -genkey -v -keystore bitcoin-mining.keystore \
     -alias bitcoin-mining-key \
     -keyalg RSA -keysize 2048 -validity 10000
   ```

   提示输入信息:
   - 密钥库口令: ******** (请记住!)
   - 您的名字与姓氏: [您的名字]
   - 组织单位: [公司/团队名称]
   - 组织: [公司名称]
   - 城市: [城市]
   - 省/市/自治区: [省份]
   - 国家代码: CN

   **⚠️ 重要**: 保存好密钥文件和密码,丢失后无法更新应用!

2. **配置签名**

   创建 `app/keystore.properties`:
   ```properties
   storeFile=bitcoin-mining.keystore
   storePassword=你的密钥库密码
   keyAlias=bitcoin-mining-key
   keyPassword=你的密钥密码
   ```

   修改 `app/build.gradle.kts`:
   ```kotlin
   android {
       // 加载签名配置
       val keystorePropertiesFile = rootProject.file("app/keystore.properties")
       val keystoreProperties = Properties()
       if (keystorePropertiesFile.exists()) {
           keystoreProperties.load(FileInputStream(keystorePropertiesFile))
       }

       signingConfigs {
           create("release") {
               storeFile = file(keystoreProperties["storeFile"] as String)
               storePassword = keystoreProperties["storePassword"] as String
               keyAlias = keystoreProperties["keyAlias"] as String
               keyPassword = keystoreProperties["keyPassword"] as String
           }
       }

       buildTypes {
           release {
               signingConfig = signingConfigs.getByName("release")
               isMinifyEnabled = true  // 启用代码混淆
               proguardFiles(
                   getDefaultProguardFile("proguard-android-optimize.txt"),
                   "proguard-rules.pro"
               )
           }
       }
   }
   ```

3. **配置混淆规则**

   在 `app/proguard-rules.pro` 添加:
   ```proguard
   # Keep Retrofit
   -keepattributes Signature
   -keepattributes *Annotation*
   -keep class retrofit2.** { *; }
   
   # Keep Gson
   -keep class com.google.gson.** { *; }
   -keep class com.cloudminingtool.bitcoinminingmaster.data.** { *; }
   
   # Keep Google Services
   -keep class com.google.android.gms.** { *; }
   ```

4. **切换到生产环境**

   修改 `ApiClient.kt`:
   ```kotlin
   private const val BASE_URL = BASE_URL_PROD  // 使用生产环境
   ```

5. **生成 Release APK**
   ```
   Build → Generate Signed Bundle / APK
   → APK
   → 选择 keystore 文件
   → 输入密码
   → 选择 release
   → Finish
   ```

6. **找到 Release APK**
   ```
   android_clent/Bitcoin_Mining_Master/app/build/outputs/apk/release/app-release.apk
   ```

---

## 🧪 完整测试清单

### 功能测试

**用户认证**:
- [ ] 首次启动自动注册
- [ ] 再次启动自动登录
- [ ] 网络异常时不崩溃
- [ ] 后端恢复后能正常登录

**设备信息采集**:
- [ ] Android ID 正确获取
- [ ] GAID 正确获取 (真机测试)
- [ ] 国家代码正确
- [ ] 设备型号正确

**数据持久化**:
- [ ] 用户信息保存成功
- [ ] 重启 APP 数据不丢失
- [ ] 退出登录后数据清除

**比特币挖矿**:
- [ ] 余额显示正常
- [ ] 挖矿功能正常
- [ ] 余额实时更新

**网络请求**:
- [ ] 模拟器连接本地服务器 (10.0.2.2)
- [ ] 真机连接局域网服务器
- [ ] 真机连接公网服务器
- [ ] 超时重试机制

### 性能测试

- [ ] 启动速度 < 3 秒
- [ ] 内存占用 < 200MB
- [ ] CPU 占用 < 30%
- [ ] 电池消耗正常
- [ ] 无内存泄漏

### 兼容性测试

- [ ] Android 9 (API 28)
- [ ] Android 10 (API 29)
- [ ] Android 11 (API 30)
- [ ] Android 12 (API 31)
- [ ] Android 13 (API 33)
- [ ] Android 14 (API 34)

---

## 📦 APK 分发方式

### 方式 1: 直接安装 (最简单)

将 APK 文件发送给用户:
- 微信/QQ 发送
- 邮件发送
- U盘拷贝

用户需要:
1. 在手机设置中允许"安装未知来源应用"
2. 点击 APK 文件安装

### 方式 2: 蒲公英 / fir.im (内测分发)

优势:
- 提供下载页面
- 支持扫码下载
- 有下载统计
- 支持版本更新提醒

步骤:
1. 注册账号: https://www.pgyer.com/
2. 上传 APK
3. 获取下载链接和二维码
4. 分享给测试人员

### 方式 3: Google Play (正式发布)

步骤:
1. 注册 Google Play 开发者账号 ($25 一次性费用)
2. 创建应用
3. 上传 AAB 文件 (不是 APK)
4. 填写应用信息、截图、描述
5. 提交审核 (通常 1-3 天)

**注意**: 需要生成 AAB 文件:
```
Build → Generate Signed Bundle / APK → Android App Bundle
```

---

## 🎯 推荐流程 (根据您的情况)

### 现在立即做 (今天):

1. ✅ **模拟器测试** (30 分钟)
   - 点击 Run 按钮
   - 验证自动登录功能
   - 查看 Logcat 日志
   - 测试重启 APP

2. ✅ **修复发现的 Bug** (如有)

### 今天或明天:

3. ⭐ **真机测试** (1 小时)
   - 修改 BASE_URL 为局域网 IP
   - USB 连接手机
   - 运行完整测试
   - 验证所有功能

4. ⭐ **打包 Debug APK** (15 分钟)
   - Build → Build APK
   - 分发给团队成员测试

### 准备正式发布时:

5. 🔐 **创建签名密钥** (10 分钟)
   - 生成 keystore 文件
   - 配置签名

6. 🚀 **打包 Release APK** (20 分钟)
   - 切换到生产环境
   - 生成签名的 Release APK
   - 测试安装

7. 📱 **选择分发渠道**
   - 内测: 蒲公英/fir.im
   - 正式: Google Play / 国内应用商店

---

## 💡 现在建议您

**先做模拟器测试!** 👇

```bash
# 确保后端服务运行中
cd /Users/davidpony/Desktop/Bitcoin\ Mining\ Master/backend
pm2 status

# 如果未运行，启动服务
pm2 start ecosystem.config.js
```

然后在 Android Studio 点击 **绿色 ▶️ Run 按钮**,观察效果!

看到 Toast 消息和 Logcat 日志后,告诉我结果,我们继续下一步! 😊
