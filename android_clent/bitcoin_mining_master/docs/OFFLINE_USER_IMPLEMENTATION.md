# 离线用户自动创建功能实现文档

## 📋 功能说明

新用户首次打开应用时，系统会自动创建用户账号：
- **有网络**：通过后端API创建正式用户账号，生成正式的 user_id 和 invitation_code
- **无网络**：本地生成临时离线用户ID，当网络恢复后自动同步到后端获取正式账号

## 🔧 实现细节

### 1. 用户ID生成策略

#### 有网络（后端生成）
- **格式**: `U{年月日时分秒}{5位随机数}`
- **示例**: `U2026012423451812345`
- **特点**: 
  - 由后端统一生成，确保唯一性
  - 同时生成对应的邀请码 `INV{年月日时分秒}{5位随机数}`
  - 自动创建用户状态记录
  - 支持推荐人邀请关系绑定

#### 无网络（本地临时生成）
- **格式**: `OFFLINE_U{毫秒时间戳}{5位随机数}`
- **示例**: `OFFLINE_U170631245678912345`
- **特点**:
  - 前缀 `OFFLINE_` 标识临时离线用户
  - 使用毫秒时间戳确保本地唯一性
  - 本地临时邀请码: `OFFLINE_INV{毫秒时间戳}{5位随机数}`
  - 标记为离线用户，等待同步

### 2. 核心修改文件

#### user_repository.dart
```dart
// 主要功能：
// 1. fetchUserId() - 智能获取用户ID
//    - 优先从本地缓存读取
//    - 检测离线用户自动同步
//    - 网络失败时生成临时ID
// 2. _generateOfflineUserId() - 生成离线临时ID
// 3. _syncOfflineUserToBackend() - 同步离线用户到后端
```

**核心逻辑流程**:
```dart
fetchUserId() {
  1. 检查本地是否有已保存的用户ID
     ├─ 有 → 检查是否是离线用户
     │       ├─ 是离线用户 → 尝试同步到后端
     │       └─ 返回用户ID
     └─ 无 → 继续第2步
  
  2. 尝试通过后端API创建用户
     ├─ 成功 → 保存用户ID和邀请码，标记为在线用户
     └─ 失败 → 继续第3步
  
  3. 生成离线临时用户ID
     └─ 保存临时ID，标记为离线用户，等待网络恢复
}
```

#### storage_service.dart
```dart
// 新增方法：
// 1. setOfflineUser(bool) - 设置离线用户标记
// 2. isOfflineUser() - 检查是否是离线用户
// 3. saveAndroidId(String) - 保存设备ID用于同步
// 4. getAndroidId() - 获取设备ID
```

#### user_provider.dart
```dart
// 新增功能：
// 1. 网络状态监听 - 使用connectivity_plus插件
// 2. 自动同步逻辑 - 网络恢复时自动触发
// 3. 离线模式标记 - _isOfflineMode
// 4. dispose() - 取消网络监听订阅
```

### 3. 网络状态监听与自动同步

```dart
// 监听网络变化
_connectivity.onConnectivityChanged.listen((results) {
  if (有网络连接 && 当前是离线用户) {
    // 自动触发同步
    _syncOfflineData();
  }
});

// 同步流程
_syncOfflineData() {
  1. 重新调用 fetchUserId()
  2. Repository检测到离线用户
  3. 调用后端deviceLogin创建正式账号
  4. 用正式user_id替换临时OFFLINE_ID
  5. 标记为在线用户
  6. 刷新数据（余额、合约等）
}
```

## 📱 后端API支持

### /api/auth/device-login
```javascript
POST /api/auth/device-login

请求体:
{
  "android_id": "设备唯一标识",
  "referrer_invitation_code": "推荐人邀请码(可选)",
  "gaid": "Google广告ID(可选)",
  "country": "国家代码(可选)",
  "email": "邮箱(可选)"
}

响应:
{
  "success": true,
  "isNewUser": true/false,
  "message": "登录成功",
  "data": {
    "userId": "U2026012423451812345",
    "invitationCode": "INV2026012423451812345",
    "userLevel": 1,
    ...
  },
  "token": "JWT_TOKEN"
}
```

**后端逻辑**:
1. 检查android_id是否已存在用户
   - 存在 → 返回现有用户信息（登录）
   - 不存在 → 创建新用户（注册）
2. 自动生成 user_id 和 invitation_code
3. 自动创建 user_status 记录
4. 处理推荐人邀请关系（如有）
5. 发放邀请奖励和挖矿合约

## 🧪 测试场景

### 场景1: 有网络首次启动
```
步骤:
1. 手机连接WiFi
2. 首次打开应用
3. 应用调用后端API

期望结果:
✅ 后端创建正式用户
✅ user_id格式: U2026012423451812345
✅ invitation_code格式: INV2026012423451812345
✅ isOfflineUser() = false
✅ 显示正常数据（比特币价格、余额等）

日志输出:
"正在通过后端API创建新用户..."
"✅ 用户创建成功（在线）: U2026012423451812345"
```

### 场景2: 无网络首次启动
```
步骤:
1. 手机开启飞行模式
2. 首次打开应用
3. 网络请求失败

期望结果:
✅ 本地生成临时用户ID
✅ user_id格式: OFFLINE_U170631245678912345
✅ invitation_code格式: OFFLINE_INV170631245678912345
✅ isOfflineUser() = true
✅ 显示离线提示信息

日志输出:
"⚠️ 网络连接失败，创建离线临时用户: DioException..."
"✅ 离线临时用户创建成功: OFFLINE_U170631245678912345"
"📝 等待网络恢复后将自动同步到后端"
"⚠️ 当前为离线模式，等待网络恢复后将自动同步"
```

### 场景3: 离线用户网络恢复
```
步骤:
1. 应用以离线模式运行（user_id = OFFLINE_U...）
2. 关闭飞行模式，连接WiFi
3. connectivity_plus检测到网络变化

期望结果:
✅ 自动触发同步流程
✅ 后端创建正式用户账号
✅ 本地user_id更新为正式ID
✅ isOfflineUser()从true变为false
✅ 自动刷新数据

日志输出:
"📡 网络已恢复，开始同步离线用户数据..."
"检测到离线临时用户，尝试同步到后端..."
"开始同步离线用户到后端..."
"✅ 离线用户同步成功！"
"   旧ID: OFFLINE_U170631245678912345"
"   新ID: U2026012423451812345"
```

### 场景4: 有账号再次打开
```
步骤:
1. 应用已有正式用户ID（本地缓存）
2. 再次打开应用

期望结果:
✅ 直接从本地读取user_id
✅ 不调用后端API（节省流量）
✅ 快速进入主界面

日志输出:
无（静默读取本地缓存）
```

## 📊 数据流向图

```
┌─────────────────────────────────────────────────────────────┐
│                      首次打开应用                              │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
                    检查本地user_id
                            │
            ┌───────────────┴───────────────┐
            │                               │
       本地无ID                          本地有ID
            │                               │
            ▼                               ▼
      调用后端API                    检查是否离线用户
            │                               │
    ┌───────┴───────┐               ┌──────┴──────┐
    │               │               │             │
 API成功        API失败          离线用户       在线用户
    │               │               │             │
    ▼               ▼               ▼             ▼
保存正式ID    生成临时ID      尝试同步到后端   直接使用
isOffline=false isOffline=true      │         
    │               │               │             │
    └───────┬───────┴───────────────┘             │
            │                                     │
            ▼                                     │
      启动网络监听                                  │
            │                                     │
            └─────────────────────────────────────┘
                            │
                            ▼
                    应用正常运行
```

## ⚙️ 配置文件变更

### pubspec.yaml
```yaml
dependencies:
  connectivity_plus: ^6.1.2  # 新增：网络状态监听
```

### AndroidManifest.xml (无需修改)
connectivity_plus会自动添加网络权限声明

## 🔍 调试技巧

### 查看用户状态
```dart
// 在任何地方添加调试代码
final storage = StorageService();
print('User ID: ${storage.getUserId()}');
print('Is Offline: ${storage.isOfflineUser()}');
print('Android ID: ${storage.getAndroidId()}');
print('Invitation Code: ${storage.getInvitationCode()}');
```

### 模拟网络断开
```bash
# 方法1: 手机开启飞行模式
# 方法2: adb关闭WiFi和数据
adb shell svc wifi disable
adb shell svc data disable

# 恢复网络
adb shell svc wifi enable
adb shell svc data enable
```

### 清除应用数据重新测试
```bash
# 卸载应用（清除所有数据）
adb uninstall com.cloudminingtool.bitcoin_mining_master

# 或使用adb清除数据
adb shell pm clear com.cloudminingtool.bitcoin_mining_master
```

## 📈 性能优化

1. **首次启动优化**: 
   - 网络请求设置超时时间（15秒）
   - 超时后立即生成离线ID，不阻塞UI

2. **缓存策略**:
   - 优先读取本地缓存
   - 减少不必要的网络请求
   - 离线模式下使用缓存数据

3. **内存管理**:
   - UserProvider正确实现dispose()
   - 取消网络监听订阅，避免内存泄漏

## 🚨 注意事项

1. **离线用户限制**:
   - 无法使用需要后端验证的功能（如提现、购买合约）
   - 数据可能不是最新的（显示缓存数据）
   - 显示明显的离线提示

2. **ID迁移**:
   - 离线ID同步后会被替换为正式ID
   - 历史数据关联需要由后端处理
   - 离线期间的操作无法同步（未实现）

3. **安全考虑**:
   - 离线ID仅用于临时标识
   - 真实数据必须通过后端验证
   - 不要在离线模式下处理敏感操作

## 📝 后续优化建议

1. 离线操作队列：记录离线期间的操作，网络恢复后批量同步
2. 冲突解决：处理离线数据与服务器数据冲突
3. 离线首次签到：允许离线签到，网络恢复后补发奖励
4. 更智能的同步策略：根据操作重要性决定同步优先级

---

**文档版本**: 1.0  
**更新日期**: 2026-01-24  
**作者**: GitHub Copilot
