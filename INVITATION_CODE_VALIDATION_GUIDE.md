# 邀请码验证功能说明

## ✅ 已实现功能

### 1️⃣ 登录页面邀请码验证

**位置**：`Login Screen` → `Referrer's Invitation Code (Optional)`

**验证流程**：
1. 用户在登录页输入邀请码
2. 点击 `Sign In With Google` 或 `Continue As Guest`
3. 系统先检查网络连接
4. 执行登录流程
5. **自动验证邀请码**：
   - ✅ **邀请码存在** → 建立绑定关系，推荐人享受20%返利
   - ❌ **邀请码不存在** → 弹出错误提示但不阻止登录

**错误提示**：
```
标题：Invalid Invitation Code
图标：⚠️ 橙色警告图标
内容：The invitation code you entered does not exist. Please confirm and try again.
按钮：OK
```

**重要特性**：
- ⚡ **不阻止登录**：即使邀请码无效，用户仍可正常登录
- 🔍 **智能匹配**：自动检测多种错误类型（404、not found、不存在等）
- 🎨 **友好提示**：使用对话框而非Toast，更易注意

---

### 2️⃣ Referral页面邀请码验证

**位置**：`Referral Screen` → 底部 `Add Referrer's Invitation Code`

**验证流程**：
1. 用户在Referral页面底部输入邀请码
2. 点击提交按钮
3. **显示加载动画**
4. **后端验证**：
   - ✅ **邀请码存在** → 建立绑定关系，显示成功提示
   - ❌ **邀请码不存在** → 显示错误提示

**错误提示**：
```
类型：SnackBar（底部红色提示条）
内容：The invitation code you entered does not exist. Please confirm and try again.
时长：3秒自动消失
```

**额外验证**：
- 🚫 **不能使用自己的邀请码**：如果输入自己的邀请码，显示：
  ```
  You cannot use your own invitation code. Please enter your upline referrer's code.
  ```
- 🔒 **防止重复绑定**：已有推荐人的用户无法再次绑定

---

## 🔧 后端API验证逻辑

### API端点：`POST /api/auth/add-referrer`

**请求参数**：
```json
{
  "user_id": "U202601281234567890",
  "referrer_invitation_code": "INV202601271234567890"
}
```

**验证步骤**：

1. **检查用户是否存在**
   ```javascript
   const user = await UserInformation.findOne({
     where: { user_id: user_id.trim() }
   });
   ```
   - ❌ 不存在 → 返回 404 "用户不存在"

2. **检查是否已有推荐人**
   ```javascript
   const existingRelation = await InvitationRelationship.findOne({
     where: { user_id: user_id.trim() }
   });
   ```
   - ❌ 已存在 → 返回 400 "您已经绑定过推荐人，无法重复绑定"

3. **验证邀请码是否存在** ⭐ **核心验证**
   ```javascript
   const referrer = await UserInformation.findOne({
     where: { invitation_code: referrer_invitation_code.trim() }
   });
   ```
   - ❌ 不存在 → 返回 404 "推荐人邀请码不存在"
   - ✅ 存在 → 继续下一步

4. **防止自我邀请**
   ```javascript
   if (referrer.user_id === user_id.trim()) {
     return 400 "不能使用自己的邀请码";
   }
   ```

5. **建立邀请关系**
   ```javascript
   await InvitationRelationship.create({
     user_id: user.user_id,
     invitation_code: user.invitation_code,
     referrer_user_id: referrer.user_id,
     referrer_invitation_code: referrer.invitation_code
   });
   ```

6. **触发奖励机制**
   - 🎁 推荐人获得基础奖励
   - 🏆 检查里程碑奖励（10人、50人、100人等）
   - ⛏️ 创建/延长推荐人挖矿合约（+2小时）
   - 🎉 为被邀请人创建绑定奖励合约（2小时）

---

## 📱 前端错误处理逻辑

### Login Screen (`login_screen.dart`)

```dart
Future<void> _handleReferrerCode(String userId) async {
  final referrerCode = _referrerCodeController.text.trim();
  if (referrerCode.isEmpty) return;

  try {
    final response = await _apiService.addReferrer(
      userId: userId,
      referrerInvitationCode: referrerCode,
    );
    
    if (response['success'] == true) {
      // 成功绑定
      await _apiService.createAdFreeContract(userId: userId);
    } else {
      // 失败但不阻止登录
      String errorMsg = response['message'] ?? 'Invalid invitation code';
      if (errorMsg.contains('不存在') || errorMsg.contains('not found') || 
          errorMsg.contains('not exist')) {
        errorMsg = 'The invitation code you entered does not exist...';
      }
      _showInvitationCodeError(errorMsg);
    }
  } catch (e) {
    // 捕获异常（如404）
    if (e.toString().contains('404') || ...) {
      _showInvitationCodeError('The invitation code you entered...');
    }
  }
}
```

### Referral Screen (`referral_screen.dart`)

```dart
Future<Map<String, dynamic>> _addReferrer(String referrerCode) async {
  // 1. 检查自我邀请
  if (referrerCode.trim() == _invitationCode.trim()) {
    return { 'success': false, 'error': '...' };
  }

  // 2. 调用API
  final response = await _apiService.addReferrer(...);

  // 3. 处理响应
  if (response['success'] == true) {
    // 成功
    setState(() { _hasReferrer = true; });
    await _createAdContract(userId);
    return {'success': true};
  } else {
    // 失败 - 检测错误类型
    String errorMsg = response['message'] ?? 'Failed';
    if (errorMsg.contains('不存在') || ...) {
      errorMsg = 'The invitation code you entered does not exist...';
    }
    return {'success': false, 'error': errorMsg};
  }
}
```

---

## 🧪 测试场景

### 场景1：登录页输入不存在的邀请码

**步骤**：
1. 打开APP，进入登录页
2. 输入不存在的邀请码（如：`INVALID123`）
3. 点击 `Sign In With Google`

**预期结果**：
- ✅ Google登录成功
- ✅ 进入主页面
- ⚠️ 弹出对话框提示邀请码无效
- ✅ 点击OK关闭对话框，正常使用APP

---

### 场景2：登录页输入存在的邀请码

**步骤**：
1. 打开APP，进入登录页
2. 输入真实用户的邀请码（如：`INV202601271234567890`）
3. 点击 `Continue As Guest`

**预期结果**：
- ✅ 访客登录成功
- ✅ 邀请关系建立成功
- ✅ 推荐人获得20%返利权限
- ✅ 推荐人挖矿合约延长2小时
- ✅ 被邀请人获得2小时绑定奖励合约

---

### 场景3：Referral页面输入不存在的邀请码

**步骤**：
1. 登录APP进入主页
2. 切换到 `Referral` 标签
3. 滚动到底部 `Add Referrer's Invitation Code`
4. 输入不存在的邀请码
5. 点击提交

**预期结果**：
- ⏳ 显示加载动画
- ❌ 底部弹出红色提示条
- 📝 内容：`The invitation code you entered does not exist. Please confirm and try again.`
- ⏱️ 3秒后自动消失

---

### 场景4：Referral页面输入自己的邀请码

**步骤**：
1. 在Referral页面查看 `My Invitation Code`（如：`INV202601281111111111`）
2. 复制自己的邀请码
3. 粘贴到底部 `Add Referrer's Invitation Code`
4. 点击提交

**预期结果**：
- ⏳ 不显示加载（前端直接拦截）
- ❌ 底部弹出红色提示条
- 📝 内容：`You cannot use your own invitation code. Please enter your upline referrer's code.`

---

### 场景5：重复绑定推荐人

**步骤**：
1. 用户已经绑定过推荐人
2. 尝试再次在Referral页面添加邀请码

**预期结果**：
- 🔒 `Add Referrer's Invitation Code` 区域隐藏（已有推荐人后不显示）
- ✅ 只显示推荐人信息和收益数据

---

## 📊 数据库验证

### 查看邀请关系表
```sql
SELECT 
  ir.user_id,
  ir.invitation_code,
  ir.referrer_user_id,
  ir.referrer_invitation_code,
  ir.created_at,
  u1.google_account AS user_email,
  u2.google_account AS referrer_email
FROM invitation_relationships ir
LEFT JOIN user_information u1 ON ir.user_id = u1.user_id
LEFT JOIN user_information u2 ON ir.referrer_user_id = u2.user_id
WHERE ir.user_id = 'U202601281234567890';
```

### 查看用户邀请码
```sql
SELECT user_id, invitation_code, google_account, android_id
FROM user_information
WHERE invitation_code = 'INV202601271234567890';
```

---

## 🔑 关键代码文件

### 前端
- [lib/screens/login_screen.dart](lib/screens/login_screen.dart) - 登录页验证
- [lib/screens/referral_screen.dart](lib/screens/referral_screen.dart) - Referral页验证
- [lib/services/api_service.dart](lib/services/api_service.dart) - API调用

### 后端
- [backend/src/controllers/authController.js](backend/src/controllers/authController.js) - `addReferrer` API
- [backend/src/models/invitationRelationship.js](backend/src/models/invitationRelationship.js) - 邀请关系模型

---

## 🎯 技术亮点

1. **双重验证**：前端+后端两层验证，确保数据准确
2. **用户友好**：错误不阻止登录，提升用户体验
3. **智能错误匹配**：自动识别多种错误格式
4. **防御性编程**：
   - 防止自我邀请
   - 防止重复绑定
   - 防止空值攻击
5. **事务一致性**：后端使用数据库事务确保数据完整性

---

## 📝 用户提示文案

### 英文版（已实现）
- ❌ **邀请码不存在**：`The invitation code you entered does not exist. Please confirm and try again.`
- ❌ **自我邀请**：`You cannot use your own invitation code. Please enter your upline referrer's code.`
- ❌ **重复绑定**：`You have already bound a referrer and cannot rebind.`

### 中文版（备用）
- ❌ **邀请码不存在**：`您输入的邀请码不存在，请确认后重试。`
- ❌ **自我邀请**：`不能使用自己的邀请码，请输入上级推荐人的邀请码。`
- ❌ **重复绑定**：`您已经绑定过推荐人，无法重复绑定。`

---

**更新时间：2026年1月28日**
**功能状态：✅ 已完成并测试**
