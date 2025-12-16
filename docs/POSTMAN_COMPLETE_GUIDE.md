# Postman 用户创建测试 - 完整配置指南

## 🚨 当前状态提醒

**服务器连接问题**: 外部访问 8888 端口可能被防火墙阻止或服务未正常运行。

### 解决方案选项

#### 方案 A: 通过 SSH 隧道测试（推荐）

```bash
# 1. 建立 SSH 隧道
ssh -L 8888:localhost:8888 root@47.79.232.189

# 2. 在 Postman 中使用
URL: http://localhost:8888/api/users
```

#### 方案 B: 检查并启动服务器服务

```bash
# SSH 登录服务器
ssh root@47.79.232.189

# 进入项目目录
cd /www/wwwroot/47.79.232.189/Bitcoin_Mining_Master

# 检查 PM2 状态
pm2 status

# 如果服务未运行，启动服务
pm2 start ecosystem.config.js
# 或者
pm2 restart bmm-api

# 查看日志
pm2 logs bmm-api --lines 50

# 在服务器本地测试
curl http://127.0.0.1:8888/api/health
```

#### 方案 C: 检查阿里云安全组规则

1. 登录阿里云控制台
2. 进入 ECS 实例
3. 配置安全组规则
4. 添加入方向规则：
   - 端口: 8888
   - 源: 0.0.0.0/0
   - 协议: TCP
   - 动作: 允许

---

## 📋 Postman 测试配置

### 1️⃣ 环境变量设置

创建新环境 `Bitcoin Mining - Production`:

```json
{
  "base_url": "http://localhost:8888",
  "或": "http://47.79.232.189:8888",
  "注释": "如果使用SSH隧道则用localhost，否则用IP地址"
}
```

### 2️⃣ 创建 Collection

**Collection 名称**: `User Management API`

**Collection 变量**:
```json
{
  "timestamp": "{{$timestamp}}"
}
```

---

## 🧪 测试用例详细配置

### 测试 1: 创建用户（完整信息）

#### 请求配置
- **方法**: `POST`
- **URL**: `{{base_url}}/api/users`
- **Headers**:
  ```
  Content-Type: application/json
  ```

#### Body (raw JSON)
```json
{
  "user_id": "U1732702800001",
  "invitation_code": "INV0000000001",
  "email": "alice.wang@example.com",
  "android_id": "abc123def456789012345678901234",
  "gaid": "12345678-1234-5678-1234-123456789abc",
  "register_ip": "47.79.232.189",
  "country": "CN"
}
```

#### Tests (自动化测试脚本)
```javascript
// 检查状态码
pm.test("Status code is 201", function () {
    pm.response.to.have.status(201);
});

// 检查响应结构
pm.test("Response has success field", function () {
    var jsonData = pm.response.json();
    pm.expect(jsonData).to.have.property('success');
    pm.expect(jsonData.success).to.be.true;
});

// 检查返回数据
pm.test("Response contains user data", function () {
    var jsonData = pm.response.json();
    pm.expect(jsonData.data).to.have.property('user_id');
    pm.expect(jsonData.data.user_id).to.eql('U1732702800001');
});

// 保存用户ID到环境变量（用于后续测试）
var jsonData = pm.response.json();
if (jsonData.data && jsonData.data.id) {
    pm.environment.set("last_user_id", jsonData.data.id);
}
```

---

### 测试 2: 创建用户（动态时间戳）

#### Pre-request Script
```javascript
// 生成唯一的 user_id
const timestamp = Date.now();
pm.environment.set("dynamic_user_id", `U${timestamp}`);
pm.environment.set("dynamic_email", `test${timestamp}@example.com`);
```

#### Body (raw JSON)
```json
{
  "user_id": "{{dynamic_user_id}}",
  "email": "{{dynamic_email}}",
  "register_ip": "47.79.232.189",
  "country": "CN"
}
```

#### Tests
```javascript
pm.test("User created with unique ID", function () {
    pm.response.to.have.status(201);
    var jsonData = pm.response.json();
    pm.expect(jsonData.data.user_id).to.include('U');
});
```

---

### 测试 3: 最小信息创建

#### Body (raw JSON)
```json
{
  "user_id": "U{{$timestamp}}"
}
```

#### Tests
```javascript
pm.test("User created with minimum info", function () {
    pm.response.to.have.status(201);
    var jsonData = pm.response.json();
    pm.expect(jsonData.data.email).to.be.null;
    pm.expect(jsonData.data.country).to.be.null;
});
```

---

### 测试 4: Android 用户

#### Body (raw JSON)
```json
{
  "user_id": "U{{$timestamp}}",
  "email": "android{{$timestamp}}@gmail.com",
  "android_id": "9774d56d682e549c",
  "gaid": "38400000-8cf0-11bd-b23e-10b96e40000d",
  "register_ip": "123.56.78.90",
  "country": "CN"
}
```

---

### 测试 5: 错误处理 - 缺少必填字段

#### Body (raw JSON)
```json
{
  "email": "error@example.com",
  "country": "CN"
}
```

#### Tests
```javascript
pm.test("Returns 400 for missing required field", function () {
    pm.response.to.have.status(400);
});

pm.test("Error message is correct", function () {
    var jsonData = pm.response.json();
    pm.expect(jsonData.error).to.include('必填字段');
});
```

---

### 测试 6: 错误处理 - 重复 user_id

**前提**: 先运行测试1创建用户

#### Body (raw JSON)
```json
{
  "user_id": "U1732702800001",
  "email": "duplicate@example.com"
}
```

#### Tests
```javascript
pm.test("Returns error for duplicate user_id", function () {
    pm.response.to.have.status(500);
});

pm.test("Error contains validation message", function () {
    var jsonData = pm.response.json();
    pm.expect(jsonData.error).to.exist;
});
```

---

## 🔄 Postman Collection Runner

### 批量运行测试

1. 点击 Collection `User Management API`
2. 点击 `Run` 按钮
3. 配置运行选项：
   - Iterations: `5` (运行5次)
   - Delay: `1000ms` (每次间隔1秒)
   - Data: 可选择CSV文件批量导入

### 测试数据 CSV 示例

创建文件 `users_test_data.csv`:

```csv
user_id,email,country,invitation_code
U1732702801001,user1@example.com,CN,INV0000000001
U1732702801002,user2@example.com,US,INV0000000002
U1732702801003,user3@example.com,UK,INV0000000003
U1732702801004,user4@example.com,JP,INV0000000004
U1732702801005,user5@example.com,KR,INV0000000005
```

在 Body 中使用变量：
```json
{
  "user_id": "{{user_id}}",
  "email": "{{email}}",
  "country": "{{country}}",
  "invitation_code": "{{invitation_code}}"
}
```

---

## 🛠️ 命令行测试（curl）

### 使用 SSH 隧道测试

```bash
# 终端1: 建立隧道
ssh -N -L 8888:localhost:8888 root@47.79.232.189

# 终端2: 测试API
# 测试1: 完整信息
curl -X POST http://localhost:8888/api/users \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "U1732702800001",
    "invitation_code": "INV0000000001",
    "email": "alice.wang@example.com",
    "android_id": "abc123def456789012345678901234",
    "gaid": "12345678-1234-5678-1234-123456789abc",
    "register_ip": "47.79.232.189",
    "country": "CN"
  }'

# 测试2: 动态user_id
TIMESTAMP=$(date +%s%3N)
curl -X POST http://localhost:8888/api/users \
  -H "Content-Type: application/json" \
  -d "{
    \"user_id\": \"U${TIMESTAMP}\",
    \"email\": \"test${TIMESTAMP}@example.com\",
    \"register_ip\": \"47.79.232.189\",
    \"country\": \"CN\"
  }"

# 测试3: 最小信息
TIMESTAMP=$(date +%s%3N)
curl -X POST http://localhost:8888/api/users \
  -H "Content-Type: application/json" \
  -d "{\"user_id\": \"U${TIMESTAMP}\"}"

# 测试4: 错误测试（缺少必填字段）
curl -X POST http://localhost:8888/api/users \
  -H "Content-Type: application/json" \
  -d '{"email": "error@example.com"}'
```

### 直接在服务器上测试

```bash
# SSH到服务器
ssh root@47.79.232.189

# 测试创建用户
TIMESTAMP=$(date +%s%3N)
curl -X POST http://127.0.0.1:8888/api/users \
  -H "Content-Type: application/json" \
  -d "{
    \"user_id\": \"U${TIMESTAMP}\",
    \"email\": \"test${TIMESTAMP}@example.com\",
    \"register_ip\": \"127.0.0.1\",
    \"country\": \"CN\"
  }"
```

---

## ✅ 验证创建的用户

### 方法1: MySQL 命令行

```bash
# SSH到服务器
ssh root@47.79.232.189

# 登录MySQL
mysql -u bitcoin_mining_master -pFzFbWmwMptnN3ABE

# 查询用户
USE bitcoin_mining_master;

-- 查看所有用户
SELECT * FROM user_information ORDER BY user_creation_time DESC LIMIT 10;

-- 查看特定用户
SELECT * FROM user_information WHERE user_id = 'U1732702800001';

-- 格式化输出
SELECT 
  id,
  user_id,
  email,
  country,
  DATE_FORMAT(user_creation_time, '%Y-%m-%d %H:%i:%s') as created
FROM user_information 
ORDER BY user_creation_time DESC 
LIMIT 10;

-- 统计信息
SELECT 
  COUNT(*) as total_users,
  COUNT(DISTINCT country) as countries,
  COUNT(invitation_code) as users_with_invite_code
FROM user_information;
```

### 方法2: 通过宝塔面板

1. 访问: `http://47.79.232.189:8880`
2. 登录宝塔面板
3. 点击 `数据库` → `bitcoin_mining_master`
4. 选择 `user_information` 表
5. 点击 `查看数据`

### 方法3: MySQL Workbench（推荐）

#### 通过 SSH 隧道连接

1. 打开 MySQL Workbench
2. 创建新连接：
   - Connection Method: `Standard TCP/IP over SSH`
   - SSH Hostname: `47.79.232.189:22`
   - SSH Username: `root`
   - SSH Password: `WHfe2c82a2e5b8e2a3`
   - MySQL Hostname: `127.0.0.1`
   - MySQL Server Port: `3306`
   - Username: `bitcoin_mining_master`
   - Password: `FzFbWmwMptnN3ABE`
   - Default Schema: `bitcoin_mining_master`

3. 连接后运行查询：
```sql
SELECT * FROM user_information ORDER BY id DESC LIMIT 20;
```

---

## 📊 完整测试流程

### 步骤 1: 环境检查

```bash
# 检查服务状态
ssh root@47.79.232.189 "cd /www/wwwroot/47.79.232.189/Bitcoin_Mining_Master && pm2 status && curl -s http://127.0.0.1:8888/api/health"
```

### 步骤 2: 建立SSH隧道

```bash
# 在本地Mac终端运行
ssh -N -L 8888:localhost:8888 root@47.79.232.189
# 保持这个窗口打开
```

### 步骤 3: 在Postman中测试

1. 导入上面的 Collection
2. 设置环境变量 `base_url = http://localhost:8888`
3. 依次运行测试用例1-6
4. 检查测试结果（应该全部通过）

### 步骤 4: 验证数据库

```bash
# 新开一个终端
ssh root@47.79.232.189

# 查询创建的用户
mysql -u bitcoin_mining_master -pFzFbWmwMptnN3ABE -e "
USE bitcoin_mining_master;
SELECT 
  id, user_id, email, country, user_creation_time 
FROM user_information 
ORDER BY user_creation_time DESC 
LIMIT 10;
"
```

---

## 🎯 预期结果

### 成功的测试结果

```
✅ 测试1: 完整信息创建 - PASS (201)
✅ 测试2: 动态时间戳创建 - PASS (201)
✅ 测试3: 最小信息创建 - PASS (201)
✅ 测试4: Android用户创建 - PASS (201)
✅ 测试5: 缺少必填字段 - PASS (400)
✅ 测试6: 重复user_id - PASS (500)

总计: 6/6 通过
```

### MySQL 查询结果示例

```
+----+-----------------+---------------------------+---------+---------------------+
| id | user_id         | email                     | country | user_creation_time  |
+----+-----------------+---------------------------+---------+---------------------+
|  6 | U1732702801005  | user5@example.com         | KR      | 2025-11-27 15:10:05 |
|  5 | U1732702801004  | user4@example.com         | JP      | 2025-11-27 15:10:04 |
|  4 | U1732702801003  | user3@example.com         | UK      | 2025-11-27 15:10:03 |
|  3 | U1732702801002  | user2@example.com         | US      | 2025-11-27 15:10:02 |
|  2 | U1732702801001  | user1@example.com         | CN      | 2025-11-27 15:10:01 |
|  1 | U1732702800001  | alice.wang@example.com    | CN      | 2025-11-27 15:00:00 |
+----+-----------------+---------------------------+---------+---------------------+
6 rows in set (0.00 sec)
```

---

## 🔧 故障排查

### 问题1: 连接被拒绝

**症状**: `Connection refused` 或 `Connection reset by peer`

**排查步骤**:
```bash
# 1. 检查服务是否运行
ssh root@47.79.232.189 "pm2 status"

# 2. 检查端口监听
ssh root@47.79.232.189 "netstat -tlnp | grep 8888"

# 3. 查看服务日志
ssh root@47.79.232.189 "pm2 logs bmm-api --lines 50"

# 4. 重启服务
ssh root@47.79.232.189 "cd /www/wwwroot/47.79.232.189/Bitcoin_Mining_Master && pm2 restart bmm-api"
```

### 问题2: 超时

**症状**: `Request timeout`

**解决方案**:
- 使用 SSH 隧道而不是直接访问
- 检查防火墙和安全组规则
- 增加 Postman 超时设置 (Settings → Request timeout)

### 问题3: 数据库连接失败

**症状**: `ECONNREFUSED` 或 Redis/MySQL 错误

**排查步骤**:
```bash
# 检查MySQL
ssh root@47.79.232.189 "systemctl status mysql"

# 检查Redis
ssh root@47.79.232.189 "redis-cli -a 3hu8fds3y ping"

# 查看应用日志
ssh root@47.79.232.189 "tail -100 /www/wwwroot/47.79.232.189/Bitcoin_Mining_Master/logs/error.log"
```

---

## 📚 相关文档

- [完整API文档](./api.md)
- [数据库设计](./design.md)
- [Postman用户注册测试](./POSTMAN_USER_REGISTRATION_TEST.md)
- [Redis修复报告](./REDIS_FIX_REPORT.md)

---

**最后更新**: 2025-11-27  
**测试环境**: 生产服务器 47.79.232.189  
**服务端口**: 8888  
**数据库**: MySQL 5.7.40 (bitcoin_mining_master)
