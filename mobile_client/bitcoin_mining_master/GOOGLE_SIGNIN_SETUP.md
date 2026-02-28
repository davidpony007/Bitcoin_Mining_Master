# Google Sign-In 配置指南

## ✅ 已完成的集成

### 1. 添加依赖
已在 `pubspec.yaml` 中添加：
```yaml
google_sign_in: ^6.2.1
```

### 2. 代码集成
- ✅ 使用官方 `GoogleSignIn` SDK
- ✅ 使用Google官方logo（从gstatic.com加载）
- ✅ 实现完整的OAuth登录流程
- ✅ 返回用户信息（displayName, email, photoUrl, tokens）
- ✅ 友好的错误提示和配置向导

## 📱 当前应用信息

```
包名: com.cloudminingtool.bitcoin_mining_master
```

## 🚀 快速开始（获取SHA-1证书指纹）

### macOS/Linux:
```bash
keytool -list -v -keystore ~/.android/debug.keystore \
  -alias androiddebugkey -storepass android -keypass android | \
  grep SHA1
```

### 正式版证书（生产环境）:
```bash
keytool -list -v -keystore /path/to/your/release.keystore \
  -alias your-key-alias
```

## 🔧 Google Cloud Console 配置步骤

### 1. 创建或选择项目
1. 访问 https://console.cloud.google.com/
2. 点击项目选择器，创建新项目或选择现有项目
3. 项目名称建议: `Bitcoin Mining Master`

### 2. 启用 Google Sign-In API
1. 在左侧菜单选择 "API和服务" > "库"
2. 搜索 "Google Sign-In API" 或 "Google+ API"
3. 点击"启用"

### 3. 配置 OAuth 同意屏幕
1. 进入 "API和服务" > "OAuth 同意屏幕"
2. 选择用户类型：
   - **外部**：任何Google账号都可以登录（推荐用于测试）
   - 内部：仅限组织内部使用
3. 填写应用信息：
   - 应用名称: `Bitcoin Mining Master`
   - 用户支持电子邮件: 你的邮箱
   - 开发者联系信息: 你的邮箱
4. 作用域：添加 `email` 和 `profile`
5. 测试用户：添加你要测试的Google账号

### 4. 创建 OAuth 2.0 客户端 ID (Android)

1. 进入 "API和服务" > "凭据"
2. 点击 "+ 创建凭据" > "OAuth 客户端 ID"
3. 应用类型选择: **Android**
4. 填写信息：
   - **名称**: `Bitcoin Mining Master - Android`
   - **软件包名称**: `com.cloudminingtool.bitcoin_mining_master`
   - **SHA-1 证书指纹**: 从上面命令获取的SHA-1值

5. 点击"创建"

### 5. （可选）创建 Web 客户端 ID
如果需要后端验证ID Token：
1. 再次点击 "+ 创建凭据" > "OAuth 客户端 ID"
2. 应用类型选择: **Web应用**
3. 名称: `Bitcoin Mining Master - Web`
4. 点击"创建"
5. 复制"客户端 ID"（用于代码中的 serverClientId）

## 📝 配置代码（可选）

如果需要后端验证，在 `google_sign_in_screen.dart` 中更新：

```dart
final GoogleSignIn _googleSignIn = GoogleSignIn(
  scopes: ['email', 'profile'],
  serverClientId: 'YOUR-WEB-CLIENT-ID.apps.googleusercontent.com',
);
```

## 🧪 测试步骤

### 1. 编译和运行
```bash
cd mobile_client/bitcoin_mining_master
flutter clean
flutter pub get
flutter run -d emulator-5554
```

### 2. 测试登录
1. 打开应用
2. 导航到 Google Sign-In 页面
3. 点击 "Sign In with Google"
4. 选择测试用户账号
5. 授权应用访问

### 3. 验证结果
查看控制台输出：
```
✅ Google登录成功！
用户ID: 123456789...
用户名: John Doe
邮箱: example@gmail.com
头像: https://...
ID Token: eyJhbGciOiJSUzI1NiIs...
```

## ⚠️ 常见错误

### 错误1: DEVELOPER_ERROR / Error 10
**原因**: OAuth客户端未配置或SHA-1不匹配

**解决方案**:
1. 确认Google Cloud Console已创建Android客户端
2. 确认包名完全匹配: `com.cloudminingtool.bitcoin_mining_master`
3. 确认SHA-1证书指纹正确
4. 等待5-10分钟让配置生效
5. 清除应用数据后重试

### 错误2: SIGN_IN_CANCELLED
**原因**: 用户取消登录

**解决方案**: 正常行为，无需处理

### 错误3: Network Error
**原因**: 网络连接问题

**解决方案**:
1. 检查设备网络连接
2. 确认模拟器可以访问外网
3. 检查防火墙设置

### 错误4: 无法显示Google账户列表
**原因**: 模拟器未登录Google账号

**解决方案**:
1. 在模拟器设置中登录Google账号
2. 确保模拟器有Google Play服务

## 🔐 安全最佳实践

1. **不要提交密钥到代码仓库**
   - 使用环境变量存储serverClientId
   - 在 `.gitignore` 中忽略 `google-services.json`

2. **分离开发和生产环境**
   - 使用不同的OAuth客户端
   - debug和release使用不同的证书

3. **后端验证**
   - 在服务器端验证 `idToken`
   - 使用 `serverClientId` 配置
   - 不要信任客户端发送的用户信息

## 📞 获取帮助

如果遇到问题：
1. 查看应用内的配置向导（点击错误提示的"查看说明"按钮）
2. 查看Flutter控制台的详细错误信息
3. 参考官方文档: https://pub.dev/packages/google_sign_in
4. Google Cloud Console文档: https://cloud.google.com/docs/authentication

## 🎯 下一步

配置完成后，可以：
1. 将Google账号信息存储到本地
2. 同步用户数据到服务器
3. 实现跨设备数据同步
4. 添加个性化推荐功能

---

**包名**: `com.cloudminingtool.bitcoin_mining_master`

**获取SHA-1命令**:
```bash
keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android | grep SHA1
```

**Google Cloud Console**: https://console.cloud.google.com/
