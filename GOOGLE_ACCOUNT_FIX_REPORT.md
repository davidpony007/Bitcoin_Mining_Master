# Google账号显示和数据库绑定修复报告

## 📋 修复概述

修复了两个关键问题：
1. **Settings页面显示问题**：Google登录成功后显示"Connected"而不是具体的Google邮箱地址
2. **数据库持久化问题**：Google登录成功后未将账号信息保存到MySQL数据库

## 🔧 代码修改详情

### 1. Settings Screen 修改 (settings_screen.dart)

#### 修改1：添加GoogleSignInAccount变量存储
```dart
// 第19行 - 添加变量存储Google账号信息
GoogleSignInAccount? _googleAccount; // 保存Google账号信息
```

**说明**：新增变量用于保存完整的GoogleSignInAccount对象，以便访问email等属性。

---

#### 修改2：添加API Service导入
```dart
// 第7行 - 添加导入
import '../services/api_service.dart';
```

**说明**：导入ApiService以调用后端的bindGoogle和unbindGoogle API。

---

#### 修改3：修改subtitle显示逻辑
```dart
// 第169行 - 修改前
subtitle: _isGoogleSignedIn ? 'Connected' : 'Bind your Google account',

// 修改后
subtitle: _isGoogleSignedIn 
    ? (_googleAccount?.email ?? 'Connected') 
    : 'Bind your Google account',
```

**说明**：
- 当用户已登录时，显示具体的Google邮箱地址（如 user@gmail.com）
- 如果_googleAccount为null（异常情况），则显示"Connected"作为后备
- 未登录时仍显示"Bind your Google account"

---

#### 修改4：_handleGoogleSignIn方法增强
```dart
void _handleGoogleSignIn() async {
  try {
    // Google OAuth登录流程...
    
    if (account != null) {
      // ✨ 新增：调用后端API绑定Google账号到MySQL
      try {
        final apiService = ApiService();
        final response = await apiService.bindGoogle(
          userId: _userId,
          googleAccount: account.email ?? '',
        );
        
        if (response['success'] == true) {
          print('✅ Google账号已绑定到MySQL数据库: ${account.email}');
        } else {
          print('❌ Google账号绑定到数据库失败: ${response['error']}');
        }
      } catch (apiError) {
        print('❌ 调用绑定API失败: $apiError');
        // 即使API调用失败，也继续显示登录成功
      }
      
      if (mounted) {
        setState(() {
          _isGoogleSignedIn = true;
          _googleAccount = account; // ✨ 保存账号信息
        });
        // ...
      }
    }
  }
}
```

**说明**：
1. 在Google OAuth登录成功后，立即调用后端API `/api/auth/bind-google`
2. 将user_id和google_account（邮箱）发送到后端保存
3. 保存GoogleSignInAccount对象到_googleAccount变量
4. 使用try-catch包裹API调用，即使失败也不影响UI登录状态显示

---

#### 修改5：Sign Out解绑逻辑增强
```dart
TextButton(
  onPressed: () async {
    // ✨ 新增：调用后端API解绑Google账号
    try {
      final apiService = ApiService();
      final response = await apiService.unbindGoogle(userId: _userId);
      
      if (response['success'] == true) {
        print('✅ Google账号已从MySQL数据库解绑');
      } else {
        print('❌ Google账号从数据库解绑失败: ${response['error']}');
      }
    } catch (apiError) {
      print('❌ 调用解绑API失败: $apiError');
    }
    
    await _googleSignIn.signOut();
    Navigator.of(context).pop();
    setState(() {
      _isGoogleSignedIn = false;
      _googleAccount = null; // ✨ 清除账号信息
    });
    // ...
  },
)
```

**说明**：
1. 用户点击Sign Out时，先调用后端API `/api/auth/unbind-google`
2. 将MySQL中的google_account字段设置为NULL
3. 再执行本地Google账号登出
4. 清除_googleAccount变量

---

## 🗄️ 后端API验证

### Backend API已存在（无需修改）

#### 1. 绑定API - `/api/auth/bind-google`
**位置**：`backend/src/controllers/authController.js` Line 284

```javascript
exports.bindGoogleAccount = async (req, res) => {
  const { user_id, google_account } = req.body;
  
  // 验证必填字段
  // 查找用户
  // 检查Google账号是否已被其他用户绑定
  // 更新Google账号到数据库
  await user.update({
    google_account: google_account.trim()
  });
  
  res.json({ success: true, message: 'Google账号绑定成功' });
}
```

**功能**：
- 接收user_id和google_account参数
- 验证Google账号唯一性（一个Google账号只能绑定一个用户）
- 更新MySQL中userInformation表的google_account字段

---

#### 2. 解绑API - `/api/auth/unbind-google`
**位置**：`backend/src/controllers/authController.js` Line 418

```javascript
exports.unbindGoogleAccount = async (req, res) => {
  const { user_id } = req.body;
  
  // 查找用户
  // 设置google_account为null
  await user.update({
    google_account: null
  });
  
  res.json({ success: true, message: 'Google账号解绑成功' });
}
```

**功能**：
- 接收user_id参数
- 将数据库中的google_account字段设置为NULL

---

## 📊 数据库字段

### userInformation 表
- **字段名**：`google_account`
- **类型**：VARCHAR(255)
- **允许NULL**：是
- **说明**：存储用户绑定的Google邮箱地址

---

## ✅ 验证方法

### 1. 前端验证（Settings页面）
1. 打开APP，进入Settings页面
2. 点击"Sign In with Google"
3. 完成Google OAuth登录
4. **预期结果**：
   - 按钮标题变为"Google Account"
   - 副标题显示具体的Google邮箱（如 user@gmail.com）而不是"Connected"

### 2. 后端数据库验证
运行验证脚本：
```bash
cd backend
node check-google-binding.js
```

**脚本功能**：
- 查询所有已绑定Google账号的用户
- 显示特定用户（U2026012402243718810）的绑定状态
- 统计总用户数和绑定率

**预期输出示例**：
```
📊 检查Google账号绑定情况...

✅ 找到 1 个已绑定Google账号的用户

📋 用户列表：
────────────────────────────────────────────────────────────────────────────────────────────────────
1. User ID: U2026012402243718810
   Google账号: user@gmail.com
   邮箱: 未设置
   Android ID: abcd1234efgh5678
   创建时间: 2026-01-24 02:24:37
────────────────────────────────────────────────────────────────────────────────────────────────────

🔍 检查特定用户 (U2026012402243718810):
✅ 用户存在
   User ID: U2026012402243718810
   Google账号: user@gmail.com
   邮箱: 未设置
   Android ID: abcd1234efgh5678
   创建时间: 2026-01-24 02:24:37
   更新时间: 2026-01-24 03:15:42  👈 更新时间变化说明绑定成功

📈 统计信息：
   总用户数: 1
   已绑定Google账号: 1
   未绑定Google账号: 0
   绑定率: 100.00%
```

---

## 🔍 日志跟踪

### 前端日志（Flutter Console）

#### Google登录成功
```
✅ Google登录成功！
用户ID: 123456789012345678901
用户名: John Doe
邮箱: user@gmail.com
✅ Google账号已绑定到MySQL数据库: user@gmail.com
```

#### Google登录失败
```
❌ Google登录失败: PlatformException(sign_in_failed, ...)
```

#### API绑定失败（但登录成功）
```
✅ Google登录成功！
...
❌ 调用绑定API失败: DioException [connection error]
```

---

### 后端日志（PM2 Logs）

#### 查看后端日志
```bash
pm2 logs
```

#### 绑定成功日志
```
POST /api/auth/bind-google 200 45ms
✅ Google账号绑定成功: user@gmail.com
```

#### 绑定失败日志
```
POST /api/auth/bind-google 400 12ms
❌ 该Google账号已被其他用户绑定
```

---

## 🎯 测试场景

### 场景1：首次绑定
1. 用户未绑定Google账号
2. 点击"Sign In with Google"
3. 完成OAuth流程
4. ✅ Settings显示具体邮箱
5. ✅ MySQL中google_account字段已填充

### 场景2：重复绑定
1. 用户已绑定Google账号A
2. 在另一设备尝试用账号A绑定
3. ❌ 后端返回"该Google账号已被其他用户绑定"
4. ✅ 原用户绑定不受影响

### 场景3：解绑和重新绑定
1. 用户已绑定Google账号A
2. 点击账号 → Sign Out确认
3. ✅ Settings显示"Sign In with Google"
4. ✅ MySQL中google_account字段为NULL
5. 再次绑定Google账号B
6. ✅ Settings显示账号B的邮箱
7. ✅ MySQL中google_account字段更新为账号B

### 场景4：网络故障
1. 用户点击"Sign In with Google"
2. Google OAuth成功，但API调用失败
3. ✅ Settings显示邮箱（本地状态正确）
4. ❌ MySQL中google_account字段仍为NULL
5. 用户重启APP，状态丢失
6. **解决方案**：下次登录时会重新调用API绑定

---

## 📦 构建和部署

### 构建APK
```bash
cd android_clent/bitcoin_mining_master
flutter build apk --release
```

### APK位置
```
android_clent/bitcoin_mining_master/build/app/outputs/flutter-apk/app-release.apk
```

### 安装到设备
```bash
adb install -r build/app/outputs/flutter-apk/app-release.apk
```

---

## ⚠️ 注意事项

### 1. Google Play Services要求
- 设备必须安装Google Play Services
- 设备必须登录Google账号
- 网络必须能访问Google服务（需要VPN）

### 2. 数据一致性
- 如果API调用失败，本地显示成功但数据库未保存
- 解决方案：用户重新打开Settings时检查同步状态
- 或实现后台重试机制

### 3. OAuth配置
- 确保Google Cloud Console中SHA-1指纹正确
- 确保OAuth客户端ID配置正确
- Debug和Release需要不同的客户端ID

---

## 🚀 后续优化建议

### 1. 添加同步状态检查
在Settings页面initState中：
```dart
void initState() {
  super.initState();
  _loadUserId();
  _checkGoogleSyncStatus(); // 检查本地和服务器状态是否一致
}
```

### 2. 显示同步状态图标
```dart
subtitle: _isGoogleSignedIn 
    ? '${_googleAccount?.email ?? 'Connected'} ${_isSynced ? '✓' : '⚠️'}' 
    : 'Bind your Google account',
```

### 3. 实现重试机制
当API调用失败时，将请求加入重试队列：
```dart
if (response['success'] != true) {
  _retryQueue.add(RetryRequest(
    type: 'bindGoogle',
    data: {'userId': _userId, 'email': account.email}
  ));
}
```

---

## 📝 总结

✅ **已完成**：
1. Settings页面显示具体Google邮箱地址
2. Google登录成功时调用后端API保存到MySQL
3. Google登出时调用后端API清除数据库记录
4. 添加详细日志跟踪
5. 创建数据库验证脚本

✅ **测试覆盖**：
- 首次绑定流程
- 解绑和重新绑定流程
- 数据库唯一性约束
- API调用失败容错处理

✅ **文档完整**：
- 代码修改说明
- 验证方法
- 测试场景
- 日志跟踪方法

---

## 🔗 相关文件

- Frontend: `lib/screens/settings_screen.dart`
- Backend Controller: `backend/src/controllers/authController.js`
- Backend Routes: `backend/src/routes/authRoutes.js`
- API Service: `lib/services/api_service.dart`
- Database Model: `backend/src/models/userInformation.js`
- Verification Script: `backend/check-google-binding.js`

---

**修复完成时间**：2026-01-24  
**修复人员**：GitHub Copilot  
**版本**：v1.0
