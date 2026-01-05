# 📮 Postman 测试用户创建完整指南

生成时间: 2025-11-25

## 🎯 测试目标
使用 Postman 测试创建用户到云服务器 MySQL (47.79.232.189:3306)

---

## 📋 前置准备

### 1. 确认服务运行
```bash
# 检查本地服务状态
cd "/Users/davidpony/Desktop/Bitcoin Mining Master/backend"
pm2 list

# 如果没有运行,启动服务
pm2 start ../server/pm2/ecosystem.config.js --only bmm-api

# 查看日志确认启动成功
pm2 logs bmm-api --lines 20
```

### 2. 服务信息
- **本地API地址**: `http://localhost:8888`
- **云端MySQL**: `47.79.232.189:3306`
- **数据库名**: `bitcoin_mining_master`

---

## 🚀 Postman 测试步骤

### 步骤 1: 打开 Postman
如果没有安装,请访问: https://www.postman.com/downloads/

---

### 步骤 2: 创建新请求

#### 2.1 基本设置
1. 点击 **"New"** → 选择 **"HTTP Request"**
2. 请求方法选择: **POST**
3. 请求URL输入: `http://localhost:8888/api/userInformation`

---

### 步骤 3: 配置请求头 (Headers)

| Key | Value |
|-----|-------|
| Content-Type | application/json |

**操作步骤:**
1. 点击 **Headers** 标签
2. 添加 `Content-Type`: `application/json`

---

### 步骤 4: 配置请求体 (Body)

#### 4.1 选择数据格式
1. 点击 **Body** 标签
2. 选择 **raw** 单选框
3. 右侧下拉菜单选择 **JSON**

#### 4.2 输入JSON数据

**方案 A: 最小化测试数据**
```json
{
  "user_id": "TEST1732501200",
  "invitation_code": "INV12345678",
  "email": "test1732501200@example.com",
  "android_id": "android_test_001",
  "gaid": "gaid_test_001",
  "register_ip": "192.168.1.100",
  "country": "US"
}
```

**方案 B: 完整测试数据**
```json
{
  "user_id": "USER1732501200",
  "username": "TestUser",
  "password_hash": "test_password_hash",
  "email": "testuser@example.com",
  "phone_number": "+1234567890",
  "invitation_code": "INV12345678",
  "android_id": "android_abc123",
  "gaid": "gaid_xyz789",
  "register_ip": "192.168.1.100",
  "country": "US",
  "total_balance": 0.00,
  "total_withdrawal": 0.00,
  "total_deposit": 0.00,
  "bitcoin_address": "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa",
  "bank_account_number": "123456789",
  "account_status": "active",
  "email_verified": false,
  "phone_verified": false,
  "kyc_status": "pending"
}
```

**方案 C: 动态时间戳数据 (推荐)**
```json
{
  "user_id": "USER{{$timestamp}}",
  "invitation_code": "INV12345678",
  "email": "test{{$timestamp}}@example.com",
  "android_id": "android_{{$timestamp}}",
  "gaid": "gaid_{{$timestamp}}",
  "register_ip": "192.168.1.100",
  "country": "US"
}
```
> 💡 `{{$timestamp}}` 是 Postman 的内置变量,每次请求都会生成新的时间戳,避免重复

---

### 步骤 5: 发送请求

1. 点击蓝色的 **Send** 按钮
2. 等待响应(通常1-3秒)

---

### 步骤 6: 查看响应

#### ✅ 成功响应示例
**HTTP 状态码**: `200 OK` 或 `201 Created`

```json
{
  "success": true,
  "message": "用户创建成功",
  "data": {
    "user_id": "USER1732501200",
    "email": "testuser@example.com",
    "country": "US",
    "account_status": "active",
    "created_at": "2025-11-25T00:00:00.000Z",
    "updated_at": "2025-11-25T00:00:00.000Z"
  }
}
```

#### ❌ 失败响应示例

**1. 用户已存在 (409 Conflict)**
```json
{
  "success": false,
  "error": "用户已存在"
}
```

**2. 缺少必填字段 (400 Bad Request)**
```json
{
  "success": false,
  "error": "缺少必填字段: user_id"
}
```

**3. 数据库连接失败 (500 Internal Server Error)**
```json
{
  "success": false,
  "error": "数据库连接失败"
}
```

---

## 🔍 验证数据已保存到MySQL

### 方法 1: 通过API查询

#### Postman 新请求:
- **方法**: GET
- **URL**: `http://localhost:8888/api/userInformation?page=1&pageSize=10`
- **说明**: 查询最近创建的用户列表

#### 预期响应:
```json
{
  "success": true,
  "data": {
    "users": [
      {
        "user_id": "USER1732501200",
        "email": "testuser@example.com",
        "country": "US",
        ...
      }
    ],
    "total": 1,
    "page": 1,
    "pageSize": 10
  }
}
```

---

### 方法 2: 通过SSH直接查询MySQL

```bash
# 连接到云服务器
ssh root@47.79.232.189

# 登录MySQL
mysql -u root -pWHfe2c82a2e5b8e2a3

# 切换数据库
USE bitcoin_mining_master;

# 查询最新创建的用户
SELECT 
  user_id, 
  email, 
  country, 
  account_status,
  created_at 
FROM user_information 
ORDER BY created_at DESC 
LIMIT 5;

# 退出MySQL
EXIT;

# 退出SSH
exit
```

---

### 方法 3: 使用终端命令一键查询

```bash
# 在本地终端执行
ssh root@47.79.232.189 "mysql -u root -pWHfe2c82a2e5b8e2a3 bitcoin_mining_master -e 'SELECT user_id, email, country, created_at FROM user_information ORDER BY created_at DESC LIMIT 5;'"
```

---

## 📦 保存为 Postman Collection

### 创建 Collection
1. 点击左侧 **Collections**
2. 点击 **"New Collection"**
3. 命名: `Bitcoin Mining Master API`

### 保存请求到 Collection
1. 发送请求后,点击 **Save** 按钮
2. Request name: `创建用户`
3. 选择刚创建的 Collection
4. 点击 **Save**

### 添加更多测试请求

#### 1. 查询用户列表
- **方法**: GET
- **URL**: `http://localhost:8888/api/userInformation?page=1&pageSize=10`
- **名称**: `查询用户列表`

#### 2. 查询单个用户
- **方法**: GET
- **URL**: `http://localhost:8888/api/userInformation/USER1732501200`
- **名称**: `查询单个用户`

#### 3. 更新用户信息
- **方法**: PUT
- **URL**: `http://localhost:8888/api/userInformation/USER1732501200`
- **Body**:
```json
{
  "email": "updated@example.com",
  "account_status": "suspended"
}
```
- **名称**: `更新用户信息`

#### 4. 删除用户
- **方法**: DELETE
- **URL**: `http://localhost:8888/api/userInformation/USER1732501200`
- **名称**: `删除用户`

#### 5. 健康检查
- **方法**: GET
- **URL**: `http://localhost:8888/api/health`
- **名称**: `健康检查`

---

## 🧪 进阶测试场景

### 场景 1: 批量创建用户

使用 Postman 的 **Collection Runner**:

1. 准备数据文件 `test_users.json`:
```json
[
  {
    "user_id": "USER001",
    "email": "user001@example.com",
    "invitation_code": "INV12345678"
  },
  {
    "user_id": "USER002",
    "email": "user002@example.com",
    "invitation_code": "INV12345678"
  },
  {
    "user_id": "USER003",
    "email": "user003@example.com",
    "invitation_code": "INV12345678"
  }
]
```

2. 在 Postman 中:
   - 点击 Collection 右侧的 **"..."**
   - 选择 **"Run collection"**
   - 上传数据文件
   - 点击 **"Run"**

---

### 场景 2: 自动化测试脚本

在 Postman 请求的 **Tests** 标签中添加:

```javascript
// 验证响应状态码
pm.test("Status code is 200", function () {
    pm.response.to.have.status(200);
});

// 验证响应包含成功标志
pm.test("Response has success flag", function () {
    var jsonData = pm.response.json();
    pm.expect(jsonData.success).to.eql(true);
});

// 验证返回的用户ID
pm.test("Response contains user_id", function () {
    var jsonData = pm.response.json();
    pm.expect(jsonData.data).to.have.property('user_id');
});

// 验证响应时间
pm.test("Response time is less than 2000ms", function () {
    pm.expect(pm.response.responseTime).to.be.below(2000);
});

// 保存用户ID到环境变量(用于后续测试)
var jsonData = pm.response.json();
if (jsonData.success && jsonData.data) {
    pm.environment.set("created_user_id", jsonData.data.user_id);
}
```

---

## 🐛 常见问题排查

### 问题 1: Connection refused (连接被拒绝)
**症状**: `Error: connect ECONNREFUSED 127.0.0.1:8888`

**解决方案**:
```bash
# 检查服务是否运行
pm2 list

# 如果没有运行,启动服务
pm2 start ../server/pm2/ecosystem.config.js --only bmm-api

# 查看日志
pm2 logs bmm-api
```

---

### 问题 2: Timeout (请求超时)
**症状**: 请求一直pending,最终超时

**解决方案**:
```bash
# 检查端口是否被占用
lsof -i :8888

# 如果有旧进程,杀掉它
kill -9 <PID>

# 重启服务
pm2 restart bmm-api
```

---

### 问题 3: 数据库连接失败
**症状**: `Error: ER_ACCESS_DENIED_ERROR` 或 `ETIMEDOUT`

**解决方案**:
```bash
# 测试MySQL连接
cd "/Users/davidpony/Desktop/Bitcoin Mining Master/backend"
node test_mysql_only.js

# 检查.env配置
cat .env | grep DB_

# 确认MySQL远程访问权限
ssh root@47.79.232.189 "mysql -u root -pWHfe2c82a2e5b8e2a3 -e \"SELECT User, Host FROM mysql.user WHERE User='bitcoin_mining_master';\""
```

---

### 问题 4: 用户已存在
**症状**: `409 Conflict` 或 "用户已存在"

**解决方案**:
- 更改 `user_id` 或 `email` 为新的值
- 使用 Postman 的 `{{$timestamp}}` 变量自动生成唯一值
- 或先删除现有用户:
```bash
curl -X DELETE http://localhost:8888/api/userInformation/USER1732501200
```

---

## 📊 完整测试流程

### 推荐测试顺序:

1. ✅ **健康检查** - 确认服务运行
   ```
   GET http://localhost:8888/api/health
   ```

2. ✅ **创建用户** - 测试主要功能
   ```
   POST http://localhost:8888/api/userInformation
   ```

3. ✅ **查询用户列表** - 验证数据已保存
   ```
   GET http://localhost:8888/api/userInformation?page=1
   ```

4. ✅ **查询单个用户** - 验证数据完整性
   ```
   GET http://localhost:8888/api/userInformation/{user_id}
   ```

5. ✅ **更新用户** - 测试更新功能
   ```
   PUT http://localhost:8888/api/userInformation/{user_id}
   ```

6. ✅ **删除用户** - 测试删除功能(可选)
   ```
   DELETE http://localhost:8888/api/userInformation/{user_id}
   ```

---

## 🎬 快速开始 (30秒完成测试)

### 最简单的测试方法:

1. **打开 Postman**

2. **新建请求**:
   - 方法: `POST`
   - URL: `http://localhost:8888/api/userInformation`

3. **设置 Header**:
   - `Content-Type`: `application/json`

4. **粘贴 Body** (选择 raw → JSON):
```json
{
  "user_id": "TEST{{$timestamp}}",
  "invitation_code": "INV12345678",
  "email": "test{{$timestamp}}@example.com",
  "android_id": "android_{{$timestamp}}",
  "gaid": "gaid_{{$timestamp}}",
  "register_ip": "192.168.1.100",
  "country": "US"
}
```

5. **点击 Send**

6. **查看响应** - 应该看到 `200 OK` 和用户数据

✅ **完成!** 用户已创建到云服务器MySQL!

---

## 📝 测试报告模板

```markdown
## Postman 测试报告

**测试时间**: 2025-11-25
**测试人员**: Your Name
**测试环境**: 本地开发环境 → 云端MySQL

### 测试结果

| 测试项 | 状态 | 响应时间 | 备注 |
|--------|------|----------|------|
| 健康检查 | ✅ Pass | 50ms | 服务正常 |
| 创建用户 | ✅ Pass | 320ms | 数据已保存到MySQL |
| 查询用户 | ✅ Pass | 180ms | 数据正确 |
| 更新用户 | ✅ Pass | 240ms | 更新成功 |
| 删除用户 | ✅ Pass | 150ms | 删除成功 |

### 总结
✅ 所有测试通过
✅ 用户数据成功保存到云服务器MySQL
✅ API响应时间正常
```

---

## 🔗 相关资源

- **API文档**: `/docs/api.md`
- **数据库连接测试**: `backend/test_mysql_only.js`
- **快速测试脚本**: `backend/quick_test_create_user.sh`
- **服务启动指南**: `/docs/final_success_report.md`

---

## 💡 提示

1. 使用 `{{$timestamp}}` 避免重复数据
2. 先测试健康检查端点确认服务运行
3. 保存请求到 Collection 方便重复测试
4. 使用 Tests 标签添加自动化断言
5. 定期查看 PM2 日志排查问题

---

**测试愉快! 🚀**
