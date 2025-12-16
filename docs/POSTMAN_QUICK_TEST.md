# 🎯 Postman 注册新用户 - 精简版测试代码

## 📋 基于实际数据库表结构的测试配置

---

## 🚀 方法 1: 创建用户 (推荐)

### API信息
- **请求方法**: `POST`
- **请求URL**: `http://localhost:8888/api/userInformation`
- **说明**: 这是实际存在的API端点

### Headers 配置
```
Content-Type: application/json
```

### Body 配置 (选择 raw → JSON)

#### ⭐ 推荐配置（完整字段）
```json
{
  "user_id": "USER{{$timestamp}}",
  "invitation_code": "INV123456789",
  "email": "user{{$timestamp}}@example.com",
  "android_id": "android_{{$timestamp}}",
  "gaid": "{{$guid}}",
  "register_ip": "192.168.1.100",
  "country": "CN"
}
```

#### 💡 最简配置（仅必填字段）
```json
{
  "user_id": "USER{{$timestamp}}"
}
```

#### 🎨 中国用户示例
```json
{
  "user_id": "USER1732543600",
  "invitation_code": "INV000001",
  "email": "zhangsan@qq.com",
  "android_id": "android_xiaomi_001",
  "gaid": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "register_ip": "220.181.38.148",
  "country": "CN"
}
```

#### 🎨 美国用户示例
```json
{
  "user_id": "USER1732543700",
  "invitation_code": "INV000002",
  "email": "john.doe@gmail.com",
  "android_id": "android_pixel_001",
  "gaid": "f1e2d3c4-b5a6-9780-1234-567890abcdef",
  "register_ip": "8.8.8.8",
  "country": "US"
}
```

---

## 📊 方法 2: 查询用户列表

### API信息
- **请求方法**: `GET`
- **请求URL**: `http://localhost:8888/api/userInformation?page=1&pageSize=10`

### 说明
查询最近注册的用户，验证数据是否成功保存

---

## ✅ 成功响应示例

```json
{
  "success": true,
  "message": "用户创建成功",
  "data": {
    "id": 1,
    "user_id": "USER1732543600",
    "invitation_code": "INV123456789",
    "email": "user@example.com",
    "android_id": "android_001",
    "gaid": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "register_ip": "192.168.1.100",
    "country": "CN",
    "user_creation_time": "2025-11-25T01:00:00.000Z"
  }
}
```

---

## 🧪 Postman 自动化测试脚本

在 **Tests** 标签添加:

```javascript
// 验证状态码
pm.test("Status code is 200", function () {
    pm.response.to.have.status(200);
});

// 验证响应包含用户数据
pm.test("Response contains user_id", function () {
    var jsonData = pm.response.json();
    pm.expect(jsonData.data).to.have.property('user_id');
});

// 保存user_id供后续使用
var jsonData = pm.response.json();
if (jsonData.success && jsonData.data) {
    pm.environment.set("created_user_id", jsonData.data.user_id);
}
```

---

## 🔍 验证数据保存到云服务器MySQL

### 终端命令验证
```bash
ssh root@47.79.232.189 "mysql -u root -pWHfe2c82a2e5b8e2a3 bitcoin_mining_master -e 'SELECT user_id, email, country, user_creation_time FROM user_information ORDER BY user_creation_time DESC LIMIT 5;'"
```

---

## 💡 快速开始（3步完成）

1. **打开 Postman**
2. **新建 POST 请求**: `http://localhost:8888/api/userInformation`
3. **粘贴 JSON 代码**（使用上面的推荐配置）
4. **点击 Send** ✅

---

## 📝 字段说明

| 字段 | 类型 | 必填 | 最大长度 | 说明 |
|------|------|------|----------|------|
| user_id | String | ✅ | 15 | 用户唯一标识，建议格式: USER + 时间戳 |
| invitation_code | String | ⚠️ | 13 | 邀请码，建议格式: INV + 9位数字 |
| email | String | ⚠️ | 100 | 邮箱地址 |
| android_id | String | ⚠️ | 32 | Android设备ID |
| gaid | String | ⚠️ | 36 | Google广告ID，标准GUID格式 |
| register_ip | String | ⚠️ | 45 | 注册IP（支持IPv6） |
| country | String | ⚠️ | 32 | 国家代码，如: CN, US, JP |

---

## 🎉 完成！

现在您可以:
1. ✅ 在 Postman 中创建用户
2. ✅ 数据自动保存到云服务器 MySQL
3. ✅ 通过查询接口验证数据

祝测试顺利! 🚀
