# 📮 Postman 注册新用户测试 - 基于实际数据库表结构

生成时间: 2025-11-25  
数据库: 云服务器 MySQL `bitcoin_mining_master.user_information`

---

## 📊 数据库表结构

根据 `user_information` 表的实际结构:

| 字段名 | 类型 | 是否必填 | 说明 |
|--------|------|----------|------|
| `id` | INTEGER | 自动生成 | 主键，自增ID |
| `user_id` | STRING(15) | ✅ 必填 | 用户唯一标识符 |
| `invitation_code` | STRING(13) | ⚠️ 可选 | 邀请码 |
| `email` | STRING(100) | ⚠️ 可选 | 邮箱地址 |
| `android_id` | STRING(32) | ⚠️ 可选 | Android设备ID |
| `gaid` | STRING(36) | ⚠️ 可选 | Google广告ID |
| `register_ip` | STRING(45) | ⚠️ 可选 | 注册IP地址 |
| `country` | STRING(32) | ⚠️ 可选 | 国家代码 |
| `user_creation_time` | DATETIME | 自动生成 | 用户创建时间 |

---

## 🎯 Postman 测试配置

### 方案 1: 最简单测试（只用必填字段）

**请求方法**: POST  
**请求URL**: `http://localhost:8888/api/users/register`

**Headers**:
```
Content-Type: application/json
```

**Body (raw JSON)**:
```json
{
  "user_id": "USER{{$timestamp}}"
}
```

> 💡 使用 `{{$timestamp}}` 自动生成唯一的用户ID

---

### 方案 2: 推荐配置（包含常用字段）

**Body (raw JSON)**:
```json
{
  "user_id": "USER{{$timestamp}}",
  "invitation_code": "INV123456789",
  "email": "user{{$timestamp}}@example.com",
  "android_id": "android_{{$timestamp}}",
  "gaid": "{{$guid}}",
  "register_ip": "192.168.1.100",
  "country": "US"
}
```

> 💡 `{{$guid}}` 会自动生成标准的 GUID 格式

---

### 方案 3: 完整测试数据（所有字段）

**Body (raw JSON)**:
```json
{
  "user_id": "USER{{$timestamp}}",
  "invitation_code": "INV123456789",
  "email": "testuser{{$timestamp}}@bitcoin-mining.com",
  "android_id": "android_device_{{$timestamp}}",
  "gaid": "{{$guid}}",
  "register_ip": "203.0.113.42",
  "country": "CN"
}
```

---

## 🌍 国家代码参考

根据您的业务需求，`country` 字段可以使用:

| 国家 | 代码 | 英文名 |
|------|------|--------|
| 中国 | CN | China |
| 美国 | US | United States |
| 日本 | JP | Japan |
| 韩国 | KR | Korea |
| 英国 | GB | United Kingdom |
| 加拿大 | CA | Canada |
| 澳大利亚 | AU | Australia |
| 德国 | DE | Germany |
| 法国 | FR | France |
| 印度 | IN | India |

---

## 📝 实际测试示例

### 示例 1: 中国用户注册

```json
{
  "user_id": "USER1732543200",
  "invitation_code": "INV000001",
  "email": "zhangsan@qq.com",
  "android_id": "android_xiaomi_12345",
  "gaid": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "register_ip": "220.181.38.148",
  "country": "CN"
}
```

### 示例 2: 美国用户注册

```json
{
  "user_id": "USER1732543300",
  "invitation_code": "INV000002",
  "email": "john.doe@gmail.com",
  "android_id": "android_pixel_67890",
  "gaid": "f1e2d3c4-b5a6-9780-1234-567890abcdef",
  "register_ip": "8.8.8.8",
  "country": "US"
}
```

### 示例 3: 批量测试数据（用于 Collection Runner）

```json
[
  {
    "user_id": "USER1732543401",
    "email": "test001@example.com",
    "country": "US",
    "invitation_code": "INV001"
  },
  {
    "user_id": "USER1732543402",
    "email": "test002@example.com",
    "country": "CN",
    "invitation_code": "INV002"
  },
  {
    "user_id": "USER1732543403",
    "email": "test003@example.com",
    "country": "JP",
    "invitation_code": "INV003"
  }
]
```

---

## 🔍 字段验证规则

### user_id
- **长度**: 最多15个字符
- **格式建议**: `USER` + 时间戳或序列号
- **示例**: `USER1732543200`, `USER000001`
- **唯一性**: ✅ 必须唯一（数据库有唯一索引）

### invitation_code
- **长度**: 最多13个字符
- **格式建议**: `INV` + 9位数字或字母
- **示例**: `INV123456789`, `INVAB12CD34`
- **索引**: ✅ 有索引，查询快速

### email
- **长度**: 最多100个字符
- **格式**: 标准邮箱格式
- **示例**: `user@example.com`
- **索引**: ✅ 有索引

### android_id
- **长度**: 最多32个字符
- **说明**: Android设备的唯一标识
- **示例**: `android_1234567890abcdef`

### gaid (Google Advertising ID)
- **长度**: 最多36个字符
- **格式**: 标准GUID格式
- **示例**: `a1b2c3d4-e5f6-7890-abcd-ef1234567890`

### register_ip
- **长度**: 最多45个字符（支持IPv6）
- **格式**: IPv4 或 IPv6
- **示例**: 
  - IPv4: `192.168.1.100`
  - IPv6: `2001:0db8:85a3:0000:0000:8a2e:0370:7334`

### country
- **长度**: 最多32个字符
- **格式**: ISO 3166-1 国家代码（2字符）或国家全称
- **示例**: `CN`, `US`, `China`, `United States`

---

## ✅ 成功响应示例

**HTTP 状态码**: `200 OK` 或 `201 Created`

```json
{
  "success": true,
  "message": "用户注册成功",
  "data": {
    "id": 123,
    "user_id": "USER1732543200",
    "invitation_code": "INV123456789",
    "email": "user@example.com",
    "android_id": "android_12345",
    "gaid": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "register_ip": "192.168.1.100",
    "country": "CN",
    "user_creation_time": "2025-11-25T01:00:00.000Z"
  }
}
```

---

## ❌ 错误响应示例

### 1. 用户ID已存在
**HTTP 状态码**: `409 Conflict`
```json
{
  "success": false,
  "error": "用户ID已存在",
  "code": "DUPLICATE_USER_ID"
}
```

### 2. 缺少必填字段
**HTTP 状态码**: `400 Bad Request`
```json
{
  "success": false,
  "error": "缺少必填字段: user_id",
  "code": "MISSING_REQUIRED_FIELD"
}
```

### 3. 字段长度超限
**HTTP 状态码**: `400 Bad Request`
```json
{
  "success": false,
  "error": "user_id 长度不能超过15个字符",
  "code": "FIELD_LENGTH_EXCEEDED"
}
```

### 4. 数据库连接失败
**HTTP 状态码**: `500 Internal Server Error`
```json
{
  "success": false,
  "error": "数据库连接失败",
  "code": "DATABASE_ERROR"
}
```

---

## 🧪 Postman 自动化测试脚本

在 Postman 的 **Tests** 标签中添加以下代码:

```javascript
// 1. 验证响应状态码
pm.test("Status code is 200 or 201", function () {
    pm.expect(pm.response.code).to.be.oneOf([200, 201]);
});

// 2. 验证响应时间
pm.test("Response time is less than 2000ms", function () {
    pm.expect(pm.response.responseTime).to.be.below(2000);
});

// 3. 验证响应格式
pm.test("Response is JSON", function () {
    pm.response.to.be.json;
});

// 4. 验证成功标志
pm.test("Response has success flag", function () {
    var jsonData = pm.response.json();
    pm.expect(jsonData.success).to.eql(true);
});

// 5. 验证返回数据包含必要字段
pm.test("Response contains user data", function () {
    var jsonData = pm.response.json();
    pm.expect(jsonData.data).to.have.property('user_id');
    pm.expect(jsonData.data).to.have.property('user_creation_time');
});

// 6. 验证user_id格式
pm.test("User ID format is correct", function () {
    var jsonData = pm.response.json();
    pm.expect(jsonData.data.user_id).to.match(/^USER\d+$/);
});

// 7. 验证email格式（如果提供）
pm.test("Email format is valid (if provided)", function () {
    var jsonData = pm.response.json();
    if (jsonData.data.email) {
        pm.expect(jsonData.data.email).to.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
    }
});

// 8. 保存user_id到环境变量（用于后续测试）
var jsonData = pm.response.json();
if (jsonData.success && jsonData.data) {
    pm.environment.set("created_user_id", jsonData.data.user_id);
    console.log("✅ 用户创建成功: " + jsonData.data.user_id);
}
```

---

## 🔄 验证数据已保存到云服务器MySQL

### 方法 1: 通过API查询（推荐）

**新建GET请求**:
```
http://localhost:8888/api/userInformation?page=1&pageSize=10
```

### 方法 2: 直接查询MySQL

```bash
# 在终端执行
ssh root@47.79.232.189 "mysql -u root -pWHfe2c82a2e5b8e2a3 bitcoin_mining_master -e 'SELECT user_id, email, country, user_creation_time FROM user_information ORDER BY user_creation_time DESC LIMIT 5;'"
```

### 方法 3: 查询特定用户

```bash
# 替换 USER1732543200 为实际的 user_id
ssh root@47.79.232.189 "mysql -u root -pWHfe2c82a2e5b8e2a3 bitcoin_mining_master -e \"SELECT * FROM user_information WHERE user_id='USER1732543200';\""
```

---

## 📦 导入 Postman Collection

我已经为您创建了完整的 Postman Collection 文件:

**文件位置**: `/docs/postman_register_user_test.json`

### 导入步骤:

1. 打开 Postman
2. 点击左上角 **Import** 按钮
3. 选择 **File** 标签
4. 选择文件: `postman_register_user_test.json`
5. 点击 **Import**

### Collection 包含的请求:

1. ✅ 健康检查
2. ✅ 注册新用户 - 最小化字段
3. ✅ 注册新用户 - 完整字段
4. ✅ 查询用户列表
5. ✅ 查询单个用户

---

## 🎯 快速测试流程（5分钟完成）

### 步骤 1: 启动服务
```bash
cd "/Users/davidpony/Desktop/Bitcoin Mining Master/backend"
pm2 list  # 确认服务运行中
```

### 步骤 2: 打开 Postman
导入 `postman_register_user_test.json`

### 步骤 3: 运行健康检查
点击 "1. 健康检查" → Send

### 步骤 4: 注册新用户
点击 "3. 注册新用户 - 完整字段" → Send

### 步骤 5: 验证结果
- 查看响应状态码（应该是 200 或 201）
- 查看返回的用户数据
- 点击 "4. 查询用户列表" 确认数据已保存

### 步骤 6: 在MySQL中验证
```bash
ssh root@47.79.232.189 "mysql -u root -pWHfe2c82a2e5b8e2a3 bitcoin_mining_master -e 'SELECT COUNT(*) as total_users FROM user_information;'"
```

---

## 💡 Postman 高级技巧

### 1. 使用环境变量

创建环境变量:
- `base_url`: `http://localhost:8888`
- `api_version`: `v1`

在请求中使用:
```
{{base_url}}/api/users/register
```

### 2. 使用动态变量

Postman 内置变量:
- `{{$timestamp}}` - Unix时间戳
- `{{$guid}}` - GUID格式
- `{{$randomInt}}` - 随机整数
- `{{$randomEmail}}` - 随机邮箱

示例:
```json
{
  "user_id": "USER{{$timestamp}}",
  "email": "{{$randomEmail}}",
  "gaid": "{{$guid}}"
}
```

### 3. Pre-request Script

在发送请求前生成自定义数据:
```javascript
// 生成自定义格式的邀请码
const invCode = "INV" + Math.floor(Math.random() * 1000000000);
pm.environment.set("invitation_code", invCode);

// 生成当前日期的用户ID
const userId = "USER" + Date.now();
pm.environment.set("user_id", userId);
```

然后在Body中使用:
```json
{
  "user_id": "{{user_id}}",
  "invitation_code": "{{invitation_code}}"
}
```

---

## 🐛 常见问题

### Q1: user_id 重复怎么办？
**A**: 使用 `{{$timestamp}}` 确保每次生成唯一ID，或手动修改ID后重试。

### Q2: 邮箱格式验证失败？
**A**: 确保邮箱包含 `@` 和 `.`，如: `user@example.com`

### Q3: 无法连接到服务器？
**A**: 
```bash
# 检查服务状态
pm2 list
# 如果未运行，启动服务
pm2 start ../server/pm2/ecosystem.config.js --only bmm-api
```

### Q4: 数据库连接超时？
**A**: 
```bash
# 测试MySQL连接
cd backend
node test_mysql_only.js
```

---

## 📊 性能测试

使用 **Collection Runner** 进行性能测试:

1. 点击 Collection 右侧的 **"..."**
2. 选择 **"Run collection"**
3. 设置迭代次数: 10
4. 设置延迟: 1000ms
5. 点击 **"Run"**

查看统计:
- 平均响应时间
- 成功率
- 失败的请求

---

## 🎉 总结

根据您的云服务器 `user_information` 表结构，注册新用户的关键字段是:

✅ **必填**: `user_id`  
⚠️ **推荐填写**: `invitation_code`, `email`, `country`  
💡 **可选**: `android_id`, `gaid`, `register_ip`

**最佳实践**:
1. 使用 `{{$timestamp}}` 生成唯一ID
2. 使用 `{{$guid}}` 生成GAID
3. 填写完整的用户信息便于后续分析
4. 添加自动化测试脚本验证响应
5. 定期验证MySQL中的数据

**文件位置**:
- Postman Collection: `/docs/postman_register_user_test.json`
- 本说明文档: `/docs/POSTMAN_REGISTER_TEST_GUIDE.md`

祝测试顺利! 🚀
