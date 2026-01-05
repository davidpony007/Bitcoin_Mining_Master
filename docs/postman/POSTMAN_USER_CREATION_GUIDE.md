# 📝 Bitcoin Mining Master - Postman 用户创建测试指南

## 🎯 功能说明

本测试套件用于在云端 MySQL 数据库中创建真实的用户数据，通过本地 Node.js 服务连接到阿里云数据库。

### 🏗️ 架构流程

```
Postman 客户端
    ↓ HTTP POST
本地 Node.js 服务 (localhost:8888)
    ↓ Sequelize ORM
云端 MySQL 数据库 (47.79.232.189)
    ↓ 写入数据
user_information 表
```

---

## 📦 文件清单

| 文件名 | 说明 |
|--------|------|
| `Bitcoin_Mining_User_Creation_Tests.postman_collection.json` | **主测试集合** - 包含 8 个测试用例 |
| `Bitcoin_Mining_Local_2025.postman_environment.json` | **环境配置** - 本地服务器配置 |
| `POSTMAN_USER_CREATION_GUIDE.md` | **本文档** - 使用说明 |

---

## 🚀 快速开始（3 步）

### 第 1 步：确认本地服务运行

在终端中检查 PM2 状态：

```bash
pm2 status
```

**预期结果：** 看到 10 个 `bitcoin-backend` 实例状态为 `online`

如果没有运行，启动服务：

```bash
cd "/Users/davidpony/Desktop/Bitcoin Mining Master"
pm2 start ecosystem.config.js
```

验证服务健康：

```bash
curl http://localhost:8888/api/health
```

**预期响应：**
```json
{
  "status": "ok",
  "db": "connected",
  "timestamp": 1733317200000
}
```

---

### 第 2 步：导入 Postman 文件

#### 2.1 导入 Collection（测试集合）

1. 打开 Postman 应用
2. 点击左上角 **Import** 按钮
3. 拖拽文件：`Bitcoin_Mining_User_Creation_Tests.postman_collection.json`
4. 点击 **Import** 确认

✅ 导入成功后，左侧会显示：**Bitcoin Mining Master - 用户创建测试 (2025)**

#### 2.2 导入 Environment（环境配置）

1. 点击右上角 **环境图标** (齿轮旁边的眼睛图标)
2. 点击 **Import** 按钮
3. 拖拽文件：`Bitcoin_Mining_Local_2025.postman_environment.json`
4. 点击 **Import** 确认

✅ 导入成功后，环境列表中会出现：**Bitcoin Mining - Local (2025)**

#### 2.3 选择环境

在 Postman 右上角的环境下拉菜单中，选择：
```
Bitcoin Mining - Local (2025)
```

✅ 确认环境已激活（显示绿色对勾）

---

### 第 3 步：运行测试

#### 推荐测试：**1️⃣ 创建用户 - 动态时间戳（推荐）⭐**

1. 在左侧集合中展开：**Bitcoin Mining Master - 用户创建测试 (2025)**
2. 点击：**1️⃣ 创建用户 - 动态时间戳 (推荐) ⭐**
3. 点击蓝色 **Send** 按钮

**预期响应：**
```json
{
  "success": true,
  "message": "用户创建成功",
  "data": {
    "id": 1,
    "user_id": "U1733317200123",
    "email": "user_1733317200123@test.com",
    "country": "CN",
    "register_ip": "192.168.1.100",
    "user_creation_time": "2025-12-04T04:00:00.123Z",
    "invitation_code": null,
    "android_id": null,
    "gaid": null
  }
}
```

**状态码：** `201 Created`

✅ **成功标志：**
- Tests 标签页显示绿色 ✓
- Console 中输出用户数据
- 响应时间 < 1000ms

---

## 📊 测试用例说明

### 1️⃣ 创建用户 - 动态时间戳（推荐）⭐

**特点：** 
- ✅ 每次运行生成唯一 `user_id`
- ✅ 可重复运行，不会冲突
- ✅ 自动生成随机邮箱

**请求体示例：**
```json
{
  "user_id": "U1733317200123",
  "email": "user_1733317200123@test.com",
  "country": "CN",
  "register_ip": "192.168.1.100"
}
```

**适用场景：** 日常测试、批量创建用户

---

### 2️⃣ 创建用户 - 完整信息

**特点：** 包含所有可选字段

**请求体示例：**
```json
{
  "user_id": "U1733317200456",
  "invitation_code": "INV3317200456",
  "email": "fullinfo_1733317200456@example.com",
  "android_id": "android_1733317200456",
  "gaid": "1733317200456-0000-0000-0000-000000000000",
  "register_ip": "203.208.60.1",
  "country": "US"
}
```

**适用场景：** 测试完整业务流程、数据完整性验证

---

### 3️⃣ 创建用户 - 最小信息

**特点：** 仅包含必填字段 `user_id`

**请求体示例：**
```json
{
  "user_id": "MIN1733317200789"
}
```

**适用场景：** 测试最小数据要求、快速创建

---

### 4️⃣ 创建用户 - Android 用户

**特点：** 包含 Android 设备信息

**请求体示例：**
```json
{
  "user_id": "AND1733317200999",
  "email": "android_1733317200999@gmail.com",
  "android_id": "a1733317200999000000000000000000",
  "gaid": "66b5a8f4-a1b2-c3d4-e5f6-317200999123",
  "register_ip": "1.2.3.4",
  "country": "CN"
}
```

**适用场景：** Android 应用用户注册、设备追踪

---

### 5️⃣ 创建用户 - 带邀请码

**特点：** 包含邀请码，用于推荐系统

**请求体示例：**
```json
{
  "user_id": "INV1733317201234",
  "invitation_code": "INV1234567890",
  "email": "invite_1733317201234@example.com",
  "country": "CN"
}
```

**适用场景：** 测试邀请返佣系统、用户来源追踪

---

### ❌ 错误测试用例

#### 6️⃣ 错误测试 - 缺少必填字段

**预期：** 返回 `400 Bad Request`

**错误信息：**
```json
{
  "error": "缺少必填字段",
  "details": "user_id 是必填字段"
}
```

---

#### 7️⃣ 错误测试 - 重复 user_id

**预期：** 第二次运行返回 `500 Internal Server Error`

**错误信息：**
```json
{
  "error": "创建用户失败",
  "details": "Duplicate entry 'DUPLICATE_TEST_001' for key 'idx_user_id'"
}
```

**使用方法：**
1. 第一次点击 Send → 成功 (201)
2. 第二次点击 Send → 失败 (500, Duplicate)

---

### 🏥 健康检查

**用途：** 在测试前验证服务和数据库连接

**端点：** `GET /api/health`

**响应示例：**
```json
{
  "status": "ok",
  "db": "connected",
  "timestamp": 1733317200000
}
```

---

## 🔍 验证数据（3 种方法）

### 方法 1：通过 SSH 连接 MySQL（推荐）

```bash
ssh root@47.79.232.189
mysql -u bitcoin_mining_master -pFzFbWmwMptnN3ABE
USE bitcoin_mining_master;
SELECT * FROM user_information ORDER BY user_creation_time DESC LIMIT 10;
```

**查询结果示例：**
```
+----+------------------+-----------------+---------------------------+------------+------+---------------+---------+---------------------+
| id | user_id          | invitation_code | email                     | android_id | gaid | register_ip   | country | user_creation_time  |
+----+------------------+-----------------+---------------------------+------------+------+---------------+---------+---------------------+
|  1 | U1733317200123   | NULL            | user_1733317200123@te...  | NULL       | NULL | 192.168.1.100 | CN      | 2025-12-04 04:00:00 |
+----+------------------+-----------------+---------------------------+------------+------+---------------+---------+---------------------+
```

---

### 方法 2：使用宝塔面板（图形界面）

1. 访问：`http://47.79.232.189:8880`
2. 登录宝塔面板
3. 点击：**数据库** → **bitcoin_mining_master**
4. 点击：**user_information** 表
5. 查看最新记录

---

### 方法 3：通过 Postman 测试（如果有查询接口）

如果后续添加了 `GET /api/users` 接口，可以直接在 Postman 中查询。

---

## 🎨 自定义测试数据

### 修改用户信息

在任意测试用例的 **Body** 标签页中，修改 JSON 内容：

```json
{
  "user_id": "CUSTOM_001",
  "email": "custom@mydomain.com",
  "country": "JP",
  "register_ip": "203.0.113.1"
}
```

### 生成随机数据

在 **Pre-request Script** 中添加脚本：

```javascript
// 生成随机国家代码
const countries = ['CN', 'US', 'JP', 'KR', 'GB'];
const randomCountry = countries[Math.floor(Math.random() * countries.length)];
pm.environment.set('country', randomCountry);

// 生成随机IP
const randomIP = `${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}`;
pm.environment.set('randomIP', randomIP);
```

然后在 Body 中使用：
```json
{
  "user_id": "U{{timestamp}}",
  "country": "{{country}}",
  "register_ip": "{{randomIP}}"
}
```

---

## 🐛 常见问题

### Q1: 返回 `connect ECONNREFUSED 127.0.0.1:8888`

**原因：** 本地 Node.js 服务未运行

**解决：**
```bash
pm2 start ecosystem.config.js
pm2 status
```

---

### Q2: 返回 `Unknown column 'create_time' in 'NEW'`

**原因：** MySQL 触发器字段名错误

**解决：** 需要修复数据库触发器（联系数据库管理员）

---

### Q3: 返回 `500 Internal Server Error - Duplicate entry`

**原因：** `user_id` 已存在（数据库唯一索引冲突）

**解决：** 
- 使用推荐测试 "1️⃣ 动态时间戳"（自动生成唯一ID）
- 或修改 `user_id` 为新的值

---

### Q4: Postman 无法连接到 localhost:8888

**排查步骤：**

1. 检查端口占用：
```bash
lsof -i :8888
```

2. 检查服务日志：
```bash
pm2 logs bitcoin-backend --lines 20
```

3. 测试健康检查：
```bash
curl http://localhost:8888/api/health
```

---

### Q5: 数据创建成功但在数据库中找不到

**排查：**

1. 确认返回的 `data.id` 值
2. 使用 ID 精确查询：
```sql
SELECT * FROM user_information WHERE id = 1;
```

3. 检查时间范围：
```sql
SELECT * FROM user_information 
WHERE user_creation_time >= DATE_SUB(NOW(), INTERVAL 1 HOUR);
```

---

## 📈 批量测试

### 使用 Collection Runner

1. 点击集合名称旁边的 **...** (三个点)
2. 选择 **Run collection**
3. 选择要运行的测试用例
4. 设置 **Iterations**（迭代次数，如 10）
5. 设置 **Delay**（延迟，如 500ms）
6. 点击 **Run Bitcoin Mining Master...**

**效果：** 批量创建多个用户

---

## 🔐 安全提示

⚠️ **注意事项：**

1. **本地测试环境：** 当前配置仅适用于本地开发测试
2. **密码保护：** MySQL 密码已硬编码在配置中，请勿在生产环境使用
3. **数据清理：** 测试数据应定期清理
4. **防止滥用：** 在生产环境应添加：
   - 频率限制（Rate Limiting）
   - 验证码验证
   - JWT 认证

---

## 📚 相关文档

- [API 完整文档](../api.md)
- [数据库设计文档](../design.md)
- [Postman 故障排查](../POSTMAN_TROUBLESHOOTING.md)

---

## ✅ 测试清单

运行完整测试流程：

- [ ] 1. 确认 PM2 服务运行 (`pm2 status`)
- [ ] 2. 测试健康检查接口 (🏥 健康检查)
- [ ] 3. 创建用户 - 动态时间戳 (1️⃣)
- [ ] 4. 验证 MySQL 数据 (SSH 或宝塔)
- [ ] 5. 创建用户 - 完整信息 (2️⃣)
- [ ] 6. 创建用户 - 最小信息 (3️⃣)
- [ ] 7. 创建用户 - Android 用户 (4️⃣)
- [ ] 8. 创建用户 - 带邀请码 (5️⃣)
- [ ] 9. 错误测试 - 缺少字段 (6️⃣)
- [ ] 10. 错误测试 - 重复ID (7️⃣)

---

## 📞 支持

如有问题，请检查：
- PM2 日志：`pm2 logs bitcoin-backend`
- MySQL 日志：SSH 登录服务器查看
- Postman Console：查看详细请求/响应

---

**最后更新：** 2025-12-04  
**版本：** v2.0  
**作者：** Bitcoin Mining Master 开发团队
