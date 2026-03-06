# Postman 用户注册测试指南

## 📋 目录
- [接口信息](#接口信息)
- [测试数据说明](#测试数据说明)
- [Postman 配置步骤](#postman-配置步骤)
- [测试用例](#测试用例)
- [验证结果](#验证结果)

---

## 🔌 接口信息

### 创建用户接口

| 项目 | 值 |
|------|-----|
| **请求方法** | POST |
| **接口地址** | `http://47.79.232.189:8888/api/users` |
| **Content-Type** | `application/json` |
| **需要认证** | ❌ 否 |

### 数据库表结构

```sql
user_information 表字段：
- id (INT, 自增主键)
- user_id (VARCHAR(15), 必填, 唯一) - 用户唯一标识符
- invitation_code (VARCHAR(13), 可选) - 邀请码
- email (VARCHAR(100), 可选) - 邮箱
- android_id (VARCHAR(32), 可选) - Android设备ID
- gaid (VARCHAR(36), 可选) - Google广告ID
- register_ip (VARCHAR(45), 可选) - 注册IP
- country (VARCHAR(32), 可选) - 国家
- user_creation_time (DATETIME, 自动生成) - 创建时间
```

---

## 📝 测试数据说明

### 字段规则

| 字段 | 必填 | 长度限制 | 格式说明 | 示例 |
|------|------|----------|----------|------|
| **user_id** | ✅ 是 | 最多15字符 | 建议格式: `U` + 13位数字 | `U1732702800001` |
| **invitation_code** | ❌ 否 | 最多13字符 | 建议格式: `INV` + 10位数字 | `INV0000000001` |
| **email** | ❌ 否 | 最多100字符 | 标准邮箱格式 | `test@example.com` |
| **android_id** | ❌ 否 | 最多32字符 | 16进制字符串 | `abc123def456` |
| **gaid** | ❌ 否 | 最多36字符 | UUID格式 | `12345678-1234-1234-1234-123456789abc` |
| **register_ip** | ❌ 否 | 最多45字符 | IPv4或IPv6 | `192.168.1.100` |
| **country** | ❌ 否 | 最多32字符 | 国家代码或全名 | `CN` / `China` |

---

## ⚙️ Postman 配置步骤

### 1️⃣ 创建新请求

1. 打开 Postman
2. 点击 `New` → `HTTP Request`
3. 请求名称: `创建新用户 - 测试`

### 2️⃣ 配置请求

#### 请求方法和URL
```
方法: POST
URL: http://47.79.232.189:8888/api/users
```

#### Headers 配置
```
Content-Type: application/json
```

#### Body 配置
- 选择 `raw`
- 选择 `JSON` 格式

---

## 🧪 测试用例

### 测试用例 1️⃣ : 完整信息注册（推荐）

**用途**: 测试所有字段都填写的情况

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

**预期结果**:
```json
{
  "success": true,
  "message": "用户创建成功",
  "data": {
    "id": 1,
    "user_id": "U1732702800001",
    "invitation_code": "INV0000000001",
    "email": "alice.wang@example.com",
    "android_id": "abc123def456789012345678901234",
    "gaid": "12345678-1234-5678-1234-123456789abc",
    "register_ip": "47.79.232.189",
    "country": "CN",
    "user_creation_time": "2025-11-27T14:30:00.000Z"
  }
}
```

---

### 测试用例 2️⃣ : 最小必填信息注册

**用途**: 测试只填写必填字段（user_id）

```json
{
  "user_id": "U1732702800002"
}
```

**预期结果**:
```json
{
  "success": true,
  "message": "用户创建成功",
  "data": {
    "id": 2,
    "user_id": "U1732702800002",
    "invitation_code": null,
    "email": null,
    "android_id": null,
    "gaid": null,
    "register_ip": null,
    "country": null,
    "user_creation_time": "2025-11-27T14:31:00.000Z"
  }
}
```

---

### 测试用例 3️⃣ : 部分信息注册

**用途**: 测试常见的注册场景（邮箱 + IP + 国家）

```json
{
  "user_id": "U1732702800003",
  "email": "bob.chen@example.com",
  "register_ip": "118.31.104.235",
  "country": "China"
}
```

**预期结果**:
```json
{
  "success": true,
  "message": "用户创建成功",
  "data": {
    "id": 3,
    "user_id": "U1732702800003",
    "invitation_code": null,
    "email": "bob.chen@example.com",
    "android_id": null,
    "gaid": null,
    "register_ip": "118.31.104.235",
    "country": "China",
    "user_creation_time": "2025-11-27T14:32:00.000Z"
  }
}
```

---

### 测试用例 4️⃣ : Android 用户注册

**用途**: 测试 Android 设备用户注册

```json
{
  "user_id": "U1732702800004",
  "email": "charlie.li@gmail.com",
  "android_id": "9774d56d682e549c",
  "gaid": "38400000-8cf0-11bd-b23e-10b96e40000d",
  "register_ip": "123.56.78.90",
  "country": "CN"
}
```

---

### 测试用例 5️⃣ : 带邀请码注册

**用途**: 测试邀请码功能

```json
{
  "user_id": "U1732702800005",
  "invitation_code": "INV0000000001",
  "email": "david.zhang@outlook.com",
  "register_ip": "203.208.60.1",
  "country": "US"
}
```

---

### 测试用例 6️⃣ : 错误测试 - 缺少必填字段

**用途**: 测试错误处理

```json
{
  "email": "error@example.com",
  "country": "CN"
}
```

**预期结果**:
```json
{
  "error": "缺少必填字段",
  "details": "user_id 是必填字段"
}
```

---

### 测试用例 7️⃣ : 错误测试 - 重复 user_id

**用途**: 测试唯一性约束

```json
{
  "user_id": "U1732702800001",
  "email": "duplicate@example.com"
}
```

**预期结果**:
```json
{
  "error": "创建用户失败",
  "details": "Validation error: user_id must be unique"
}
```

---

## ✅ 验证结果

### 方法一: 通过 Postman 查询

创建 GET 请求查询所有用户：

```
方法: GET
URL: http://47.79.232.189:8888/api/users
Headers: 需要添加 JWT Token（从登录接口获取）
```

### 方法二: 通过 MySQL 客户端查询

#### SSH 连接服务器
```bash
ssh root@47.79.232.189
# 密码: WHfe2c82a2e5b8e2a3
```

#### 登录 MySQL
```bash
mysql -u bitcoin_mining_master -p
# 密码: FzFbWmwMptnN3ABE
```

#### 查询用户数据
```sql
-- 切换到数据库
USE bitcoin_mining_master;

-- 查看所有用户
SELECT * FROM user_information;

-- 查看最新创建的5个用户
SELECT 
  id,
  user_id,
  email,
  country,
  user_creation_time
FROM user_information 
ORDER BY user_creation_time DESC 
LIMIT 5;

-- 查看特定用户
SELECT * FROM user_information WHERE user_id = 'U1732702800001';

-- 统计用户数量
SELECT COUNT(*) as total_users FROM user_information;

-- 按国家统计用户
SELECT country, COUNT(*) as user_count 
FROM user_information 
GROUP BY country;
```

### 方法三: 通过宝塔面板查看

1. 登录宝塔面板: `http://47.79.232.189:8880`
2. 点击 `数据库` → `bitcoin_mining_master`
3. 点击 `user_information` 表
4. 查看新增的用户记录

---

## 📊 测试检查清单

### 基本功能测试
- [ ] ✅ 测试用例1 - 完整信息注册成功
- [ ] ✅ 测试用例2 - 最小信息注册成功
- [ ] ✅ 测试用例3 - 部分信息注册成功
- [ ] ✅ 测试用例4 - Android用户注册成功
- [ ] ✅ 测试用例5 - 邀请码注册成功

### 错误处理测试
- [ ] ✅ 测试用例6 - 缺少必填字段返回400错误
- [ ] ✅ 测试用例7 - 重复user_id返回500错误

### 数据验证
- [ ] ✅ MySQL中能看到新用户记录
- [ ] ✅ user_creation_time 自动填充
- [ ] ✅ user_id 唯一性约束生效
- [ ] ✅ 可选字段可以为 NULL

---

## 🎯 快速测试脚本

### 生成唯一 user_id
使用时间戳生成唯一ID：

```javascript
// JavaScript (可在 Postman Pre-request Script 中使用)
const timestamp = Date.now();
const userId = `U${timestamp}`;
pm.environment.set("user_id", userId);
```

### Postman 环境变量配置

创建环境变量：
```
base_url = http://47.79.232.189:8888
api_path = /api/users
user_id = U{{$timestamp}}
```

请求URL改为:
```
{{base_url}}{{api_path}}
```

Body 改为:
```json
{
  "user_id": "{{user_id}}",
  "email": "test{{$timestamp}}@example.com",
  "register_ip": "47.79.232.189",
  "country": "CN"
}
```

---

## 🐛 常见问题

### 1. 连接超时
**问题**: `connect ETIMEDOUT`  
**解决**: 检查服务器防火墙，确保8888端口对外开放

### 2. 401 未授权
**问题**: GET请求返回401  
**解决**: 这是正常的，GET /api/users 需要JWT认证，创建用户不需要

### 3. user_id 重复
**问题**: `user_id must be unique`  
**解决**: 修改user_id，使用新的值（如添加时间戳）

### 4. 数据库连接失败
**问题**: `Error: connect ECONNREFUSED`  
**解决**: 检查MySQL服务是否运行: `systemctl status mysql`

---

## 📚 相关文档

- [API 完整文档](./api.md)
- [数据库设计文档](./design.md)
- [Redis 修复报告](./REDIS_FIX_REPORT.md)
- [服务状态报告](./SERVICE_STATUS_REPORT.md)

---

## 🎉 测试成功示例

### 成功响应示例
```json
{
  "success": true,
  "message": "用户创建成功",
  "data": {
    "id": 1,
    "user_id": "U1732702800001",
    "invitation_code": "INV0000000001",
    "email": "alice.wang@example.com",
    "android_id": "abc123def456789012345678901234",
    "gaid": "12345678-1234-5678-1234-123456789abc",
    "register_ip": "47.79.232.189",
    "country": "CN",
    "user_creation_time": "2025-11-27T14:30:00.000Z"
  }
}
```

### MySQL 查询结果示例
```
+----+-----------------+----------------+-------------------------+----------------------------------+---------------------------------------+-----------------+---------+---------------------+
| id | user_id         | invitation_code| email                   | android_id                       | gaid                                  | register_ip     | country | user_creation_time  |
+----+-----------------+----------------+-------------------------+----------------------------------+---------------------------------------+-----------------+---------+---------------------+
|  1 | U1732702800001  | INV0000000001  | alice.wang@example.com  | abc123def456789012345678901234   | 12345678-1234-5678-1234-123456789abc  | 47.79.232.189   | CN      | 2025-11-27 14:30:00 |
|  2 | U1732702800002  | NULL           | NULL                    | NULL                             | NULL                                  | NULL            | NULL    | 2025-11-27 14:31:00 |
|  3 | U1732702800003  | NULL           | bob.chen@example.com    | NULL                             | NULL                                  | 118.31.104.235  | China   | 2025-11-27 14:32:00 |
+----+-----------------+----------------+-------------------------+----------------------------------+---------------------------------------+-----------------+---------+---------------------+
```

---

**文档创建时间**: 2025-11-27  
**最后更新**: 2025-11-27  
**测试环境**: 生产服务器 (47.79.232.189:8888)  
**数据库**: MySQL 5.7.40 (bitcoin_mining_master)
