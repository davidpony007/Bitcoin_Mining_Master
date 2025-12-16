# 🧪 测试创建用户到云服务器 MySQL 指南

## 📋 测试步骤

### 方法一：使用测试脚本（推荐）

#### 1. 运行测试脚本

```bash
cd backend
node test_create_user.js
```

**脚本功能**:
- ✅ 自动生成测试用户数据
- ✅ 检查服务器健康状态
- ✅ 创建用户到云服务器 MySQL
- ✅ 验证用户是否创建成功
- ✅ 显示详细的成功/失败信息

---

### 方法二：使用 curl 命令

#### 1. 测试服务器健康状态

```bash
curl http://47.79.232.189:8888/api/health
```

**期望输出**:
```json
{
  "status": "ok",
  "db": "connected",
  "timestamp": 1700000000000
}
```

#### 2. 创建用户

```bash
curl -X POST http://47.79.232.189:8888/api/userInformation \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "USER1732435200123",
    "invitation_code": "INV32435200",
    "email": "test123@example.com",
    "android_id": "android_123456",
    "gaid": "gaid_123456",
    "register_ip": "192.168.1.100",
    "country": "US"
  }'
```

**期望输出**:
```json
{
  "id": 1,
  "user_id": "USER1732435200123",
  "invitation_code": "INV32435200",
  "email": "test123@example.com",
  "android_id": "android_123456",
  "gaid": "gaid_123456",
  "register_ip": "192.168.1.100",
  "country": "US",
  "user_creation_time": "2024-11-24T10:00:00.000Z"
}
```

#### 3. 验证用户已创建

```bash
curl http://47.79.232.189:8888/api/userInformation
```

---

### 方法三：使用 Postman

#### 1. 创建新的 Request

- **Method**: POST
- **URL**: `http://47.79.232.189:8888/api/userInformation`
- **Headers**:
  - `Content-Type`: `application/json`

#### 2. Body (JSON)

```json
{
  "user_id": "USER1732435200123",
  "invitation_code": "INV32435200",
  "email": "test123@example.com",
  "android_id": "android_123456",
  "gaid": "gaid_123456",
  "register_ip": "192.168.1.100",
  "country": "US"
}
```

#### 3. 发送请求

点击 **Send** 按钮

---

## 🔍 验证数据是否创建成功

### 方法 1: 通过 API 查询

```bash
curl http://47.79.232.189:8888/api/userInformation
```

### 方法 2: 登录 phpMyAdmin

1. 访问: `http://47.79.232.189:8888/phpmyadmin`
2. 登录数据库
3. 选择数据库: `bitcoin_mining_master`
4. 查看表: `user_information`
5. 检查是否有刚创建的用户

### 方法 3: SSH 直接查询 MySQL

```bash
ssh root@47.79.232.189

# 登录 MySQL
mysql -u root -p

# 选择数据库
USE bitcoin_mining_master;

# 查询用户
SELECT * FROM user_information ORDER BY id DESC LIMIT 5;

# 查看用户数量
SELECT COUNT(*) as total_users FROM user_information;

# 退出
EXIT;
```

---

## 📊 必填字段说明

| 字段 | 类型 | 必填 | 说明 |
|-----|------|-----|------|
| user_id | VARCHAR(15) | ✅ | 用户唯一ID，格式: USER + 时间戳 |
| invitation_code | VARCHAR(13) | ✅ | 邀请码，格式: INV + 8位数字 |
| email | VARCHAR(100) | ✅ | 用户邮箱地址 |
| android_id | VARCHAR(50) | ❌ | 安卓设备ID |
| gaid | VARCHAR(50) | ❌ | Google广告ID |
| register_ip | VARCHAR(20) | ❌ | 注册IP地址 |
| country | VARCHAR(30) | ❌ | 国家代码 |

---

## 🐛 常见问题排查

### 1. 连接超时

**问题**: `ECONNREFUSED` 或 `ETIMEDOUT`

**解决方法**:
- 检查服务器是否运行: `ssh root@47.79.232.189 "pm2 list"`
- 检查防火墙: `ssh root@47.79.232.189 "ufw status"`
- 检查端口监听: `ssh root@47.79.232.189 "netstat -tlnp | grep 8888"`

### 2. 数据库连接失败

**问题**: `db: 'disconnected'`

**解决方法**:
```bash
ssh root@47.79.232.189

# 检查 MySQL 状态
systemctl status mysql

# 重启 MySQL
systemctl restart mysql

# 检查数据库配置
cat /root/Bitcoin\ Mining\ Master/backend/.env
```

### 3. 用户ID重复

**问题**: `Duplicate entry for key 'idx_user_id'`

**解决方法**:
- 使用不同的 user_id
- 使用时间戳 + 随机数: `USER${Date.now()}${Math.floor(Math.random()*1000)}`

### 4. 字段验证失败

**问题**: `notNull Violation` 或字段错误

**解决方法**:
- 检查必填字段是否都提供
- 检查字段名称是否正确
- 检查字段长度是否超限

---

## 🎯 完整测试流程

### 步骤 1: 启动后端服务

```bash
# 本地测试
cd backend
npm install
npm start

# 或者云服务器测试（已运行则跳过）
ssh root@47.79.232.189
cd /root/Bitcoin\ Mining\ Master/backend
pm2 list
```

### 步骤 2: 运行测试脚本

```bash
# 在本地执行
cd /Users/davidpony/Desktop/Bitcoin\ Mining\ Master/backend
node test_create_user.js
```

### 步骤 3: 验证数据

```bash
# 方法 1: API 查询
curl http://47.79.232.189:8888/api/userInformation | jq

# 方法 2: MySQL 查询
ssh root@47.79.232.189 "mysql -u root -p -e 'SELECT * FROM bitcoin_mining_master.user_information ORDER BY id DESC LIMIT 3;'"
```

### 步骤 4: 创建用户状态记录

```bash
# 如果需要手动创建用户状态
ssh root@47.79.232.189

mysql -u root -p
USE bitcoin_mining_master;

INSERT INTO user_status (
  user_id,
  bitcoin_accumulated_amount,
  current_bitcoin_balance,
  total_invitation_rebate,
  total_withdrawal_amount,
  last_login_time,
  user_status
) VALUES (
  'USER1732435200123',
  0,
  0,
  0,
  0,
  NOW(),
  'normal'
);

SELECT * FROM user_status WHERE user_id = 'USER1732435200123';
EXIT;
```

---

## 📝 测试数据示例

### 示例 1: 美国用户

```json
{
  "user_id": "USER1732435201001",
  "invitation_code": "INV32435201",
  "email": "john.doe@example.com",
  "android_id": "android_us_001",
  "gaid": "gaid_us_001",
  "register_ip": "203.0.113.100",
  "country": "US"
}
```

### 示例 2: 中国用户

```json
{
  "user_id": "USER1732435202002",
  "invitation_code": "INV32435202",
  "email": "zhang.san@example.cn",
  "android_id": "android_cn_002",
  "gaid": "gaid_cn_002",
  "register_ip": "123.45.67.89",
  "country": "CN"
}
```

### 示例 3: 最小化数据（只有必填字段）

```json
{
  "user_id": "USER1732435203003",
  "invitation_code": "INV32435203",
  "email": "minimal@example.com"
}
```

---

## 🚀 快速测试命令

```bash
# 一键测试（复制粘贴即可）
cd /Users/davidpony/Desktop/Bitcoin\ Mining\ Master/backend && node test_create_user.js
```

---

## ✅ 成功标志

测试成功后你会看到:
- ✅ 服务器健康检查通过
- ✅ 用户创建成功
- ✅ 数据库中能查到用户
- ✅ 返回完整的用户信息（包含自增ID和创建时间）

---

## 📞 需要帮助？

如果遇到问题，请提供以下信息:
1. 错误信息截图
2. 服务器日志: `ssh root@47.79.232.189 "pm2 logs backend"`
3. 数据库状态: `ssh root@47.79.232.189 "systemctl status mysql"`
4. 测试命令和参数

