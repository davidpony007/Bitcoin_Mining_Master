# 🎉 Postman 用户注册测试配置完成

## 📦 交付内容

已为您创建了完整的 Postman 测试套件，包括：

### 1. 📄 文档文件

```
docs/
├── POSTMAN_USER_REGISTRATION_TEST.md      # 基础测试指南
├── POSTMAN_COMPLETE_GUIDE.md             # 完整配置指南
└── postman/
    ├── README.md                         # Postman使用说明 ⭐
    ├── Bitcoin_Mining_User_API.postman_collection.json    # API测试集合 ⭐
    └── Bitcoin_Mining_Production.postman_environment.json # 环境配置 ⭐
```

### 2. 🔧 测试脚本

```
scripts/
└── test_user_creation.sh                 # 自动化测试脚本
```

---

## 🚀 快速开始（3步即可）

### 步骤 1: 建立 SSH 隧道

在 Mac 终端运行：

```bash
ssh -N -L 8888:localhost:8888 root@47.79.232.189
```

> 保持此窗口打开，密码: `WHfe2c82a2e5b8e2a3`

### 步骤 2: 导入到 Postman

1. 打开 Postman
2. 点击 **Import**
3. 导入这两个文件：
   - `docs/postman/Bitcoin_Mining_User_API.postman_collection.json`
   - `docs/postman/Bitcoin_Mining_Production.postman_environment.json`
4. 选择 "Bitcoin Mining - Production" 环境

### 步骤 3: 运行测试

1. 展开 "Bitcoin Mining Master - User API" 集合
2. 点击 **"2️⃣ 创建用户 - 动态时间戳"** (推荐首选)
3. 点击 **Send** 按钮
4. 查看响应 (应该返回 201 状态码)

---

## ✅ 测试用例概览

| 序号 | 测试名称 | 用途 | 可重复 | 推荐度 |
|------|----------|------|--------|--------|
| 1️⃣ | 完整信息创建 | 测试所有字段 | ❌ | ⭐⭐⭐ |
| 2️⃣ | 动态时间戳创建 | 每次唯一ID | ✅ | ⭐⭐⭐⭐⭐ |
| 3️⃣ | 最小信息创建 | 测试必填字段 | ✅ | ⭐⭐⭐⭐ |
| 4️⃣ | Android用户 | 测试设备字段 | ✅ | ⭐⭐⭐⭐ |
| 5️⃣ | 带邀请码 | 测试邀请机制 | ✅ | ⭐⭐⭐⭐ |
| 6️⃣ | 错误-缺字段 | 测试错误处理 | ✅ | ⭐⭐⭐⭐⭐ |
| 7️⃣ | 错误-重复ID | 测试唯一约束 | ✅ | ⭐⭐⭐⭐ |

### 特色功能

- ✅ **自动化测试**: 每个请求都包含测试脚本，自动验证结果
- ✅ **动态数据**: 使用时间戳自动生成唯一ID，可重复运行
- ✅ **环境变量**: 支持快速切换本地/云端环境
- ✅ **批量运行**: 支持 Collection Runner 批量测试
- ✅ **详细文档**: 每个测试都有详细说明和预期结果

---

## 📋 测试数据示例

### 示例 1: 完整用户信息

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

**预期响应** (201):
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

### 示例 2: 最小用户信息

```json
{
  "user_id": "U1732702800002"
}
```

**预期响应** (201):
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

### 示例 3: 错误响应 - 缺少必填字段

```json
{
  "email": "error@example.com"
}
```

**预期响应** (400):
```json
{
  "error": "缺少必填字段",
  "details": "user_id 是必填字段"
}
```

---

## 🔍 验证创建结果

### 方法 1: MySQL 命令行查询

```bash
# SSH 到服务器
ssh root@47.79.232.189

# 查询最新用户（前10条）
mysql -u bitcoin_mining_master -pFzFbWmwMptnN3ABE -e "
USE bitcoin_mining_master;
SELECT 
  id,
  user_id,
  email,
  country,
  DATE_FORMAT(user_creation_time, '%Y-%m-%d %H:%i:%s') as created
FROM user_information 
ORDER BY user_creation_time DESC 
LIMIT 10;
"
```

### 方法 2: 宝塔面板

```
1. 访问: http://47.79.232.189:8880
2. 数据库 → bitcoin_mining_master → user_information
3. 查看数据
```

### 方法 3: MySQL Workbench (推荐)

配置 SSH 隧道连接：

```
Connection Method: Standard TCP/IP over SSH
SSH: root@47.79.232.189:22 (密码: WHfe2c82a2e5b8e2a3)
MySQL: 127.0.0.1:3306
User: bitcoin_mining_master
Password: FzFbWmwMptnN3ABE
Database: bitcoin_mining_master
```

查询语句：
```sql
SELECT * FROM user_information 
ORDER BY user_creation_time DESC 
LIMIT 20;
```

---

## 📊 数据库字段说明

| 字段名 | 类型 | 必填 | 说明 | 示例值 |
|--------|------|------|------|--------|
| `id` | INT | ✅ (自增) | 主键ID | 1 |
| `user_id` | VARCHAR(15) | ✅ | 用户唯一标识 | U1732702800001 |
| `invitation_code` | VARCHAR(13) | ❌ | 邀请码 | INV0000000001 |
| `email` | VARCHAR(100) | ❌ | 邮箱 | test@example.com |
| `android_id` | VARCHAR(32) | ❌ | Android设备ID | abc123def456 |
| `gaid` | VARCHAR(36) | ❌ | Google广告ID | 12345678-1234... |
| `register_ip` | VARCHAR(45) | ❌ | 注册IP | 47.79.232.189 |
| `country` | VARCHAR(32) | ❌ | 国家 | CN |
| `user_creation_time` | DATETIME | ✅ (自动) | 创建时间 | 2025-11-27 14:30:00 |

### 字段约束

- ✅ `user_id` 有 **唯一索引**，不能重复
- ✅ `invitation_code` 有普通索引，加速查询
- ✅ `email` 有普通索引，加速查询
- ✅ `user_creation_time` 自动设置为当前时间

---

## 🎯 测试建议

### 首次测试推荐顺序

```
1. 先运行 "2️⃣ 动态时间戳" - 熟悉流程
2. 然后运行 "6️⃣ 错误-缺字段" - 验证错误处理
3. 再运行 "3️⃣ 最小信息" - 验证必填字段
4. 最后运行 "4️⃣ Android用户" - 验证可选字段
5. 运行 "5️⃣ 带邀请码" - 验证邀请机制
6. 运行 "1️⃣ 完整信息" - 创建固定测试用户
7. 最后运行 "7️⃣ 重复ID" - 验证唯一性约束
```

### 批量测试

使用 Postman Collection Runner：

```
1. 右键点击集合
2. 选择 "Run collection"
3. 设置 Iterations: 1
4. 设置 Delay: 500ms
5. 点击 Run
6. 查看测试报告
```

预期结果：6/7 通过 (测试7需要测试1先运行)

---

## 🔧 故障排查

### 问题 1: 连接超时

**症状**: `Connection timeout` 或 `ETIMEDOUT`

**解决方案**:
```bash
# 1. 检查 SSH 隧道是否运行
lsof -i :8888

# 2. 如果没有输出，重新建立隧道
ssh -N -L 8888:localhost:8888 root@47.79.232.189

# 3. 验证隧道工作
curl http://localhost:8888/api/health
```

### 问题 2: 连接被拒绝

**症状**: `Connection refused` 或 `ECONNREFUSED`

**解决方案**:
```bash
# 检查服务器服务状态
ssh root@47.79.232.189 "pm2 status"

# 如果服务未运行，启动服务
ssh root@47.79.232.189 "cd /www/wwwroot/47.79.232.189/Bitcoin_Mining_Master && pm2 restart bmm-api"
```

### 问题 3: user_id 重复

**症状**: `Validation error: user_id must be unique`

**解决方案**:
- 使用 **"2️⃣ 动态时间戳"** 测试用例（自动生成唯一ID）
- 或修改固定的 user_id 值
- 或删除数据库中的旧记录

### 问题 4: 环境变量不生效

**症状**: URL显示 `{{base_url}}/api/users`

**解决方案**:
1. 确认右上角选择了 "Bitcoin Mining - Production" 环境
2. 检查环境变量 `base_url` 是否设置
3. 重启 Postman

---

## 📚 相关文档

| 文档 | 路径 | 说明 |
|------|------|------|
| **Postman使用说明** | `docs/postman/README.md` | Postman详细操作指南 |
| **基础测试指南** | `docs/POSTMAN_USER_REGISTRATION_TEST.md` | 测试用例详解 |
| **完整配置指南** | `docs/POSTMAN_COMPLETE_GUIDE.md` | 完整配置和故障排查 |
| **API文档** | `docs/api.md` | 完整API接口文档 |
| **数据库设计** | `docs/design.md` | 数据库表结构说明 |
| **测试脚本** | `scripts/test_user_creation.sh` | 自动化测试脚本 |

---

## 🎓 学习资源

### Postman 自动化测试示例

```javascript
// 在 Tests 标签页编写测试脚本

// 1. 检查状态码
pm.test("Status code is 201", function () {
    pm.response.to.have.status(201);
});

// 2. 检查响应时间
pm.test("Response time is less than 500ms", function () {
    pm.expect(pm.response.responseTime).to.be.below(500);
});

// 3. 检查响应结构
pm.test("Response has correct structure", function () {
    var jsonData = pm.response.json();
    pm.expect(jsonData).to.have.property('success');
    pm.expect(jsonData.success).to.be.true;
    pm.expect(jsonData.data).to.have.property('user_id');
});

// 4. 提取数据到环境变量
var jsonData = pm.response.json();
if (jsonData.data && jsonData.data.id) {
    pm.environment.set("last_user_id", jsonData.data.id);
    console.log("Saved user ID:", jsonData.data.id);
}
```

### Pre-request Script 示例

```javascript
// 在 Pre-request Script 标签页编写

// 1. 生成唯一 user_id
const timestamp = Date.now();
pm.environment.set("dynamic_user_id", `U${timestamp}`);

// 2. 生成唯一邮箱
pm.environment.set("dynamic_email", `test${timestamp}@example.com`);

// 3. 生成随机国家
const countries = ['CN', 'US', 'UK', 'JP', 'KR'];
const randomCountry = countries[Math.floor(Math.random() * countries.length)];
pm.environment.set("random_country", randomCountry);

// 4. 打印调试信息
console.log("Generated user_id:", pm.environment.get("dynamic_user_id"));
console.log("Generated email:", pm.environment.get("dynamic_email"));
```

---

## ✨ 特色功能

### 1. 智能动态数据生成

- ✅ 每次运行自动生成唯一 `user_id`
- ✅ 使用时间戳确保唯一性
- ✅ 无需手动修改测试数据

### 2. 完整的自动化测试

- ✅ 自动验证状态码
- ✅ 自动验证响应结构
- ✅ 自动验证业务逻辑
- ✅ 自动保存关键数据到环境变量

### 3. 友好的错误提示

- ✅ 测试失败时显示详细原因
- ✅ 包含预期值和实际值对比
- ✅ 便于快速定位问题

### 4. 批量测试支持

- ✅ 支持 Collection Runner 批量运行
- ✅ 支持 CSV 数据驱动测试
- ✅ 支持多次迭代运行
- ✅ 自动生成测试报告

---

## 📞 技术支持

### 服务器信息

```
服务器IP: 47.79.232.189
SSH用户: root
SSH密码: WHfe2c82a2e5b8e2a3
API端口: 8888
数据库: bitcoin_mining_master
数据库用户: bitcoin_mining_master
数据库密码: FzFbWmwMptnN3ABE
```

### 健康检查

```bash
# 检查API健康状态
curl http://localhost:8888/api/health

# 预期响应
{"status":"ok","db":"connected","timestamp":1732702800000}
```

### 查看服务日志

```bash
ssh root@47.79.232.189 "pm2 logs bmm-api --lines 50"
```

---

## 🎉 总结

✅ **已完成的工作**:

1. ✅ 创建了 7 个完整的测试用例
2. ✅ 导出了可直接导入的 Postman Collection JSON
3. ✅ 配置了 Production 环境变量
4. ✅ 编写了详细的使用文档
5. ✅ 提供了测试数据示例
6. ✅ 包含了自动化测试脚本
7. ✅ 添加了完整的故障排查指南

🎯 **下一步**:

1. 导入 Postman Collection 和 Environment
2. 建立 SSH 隧道
3. 运行 "2️⃣ 动态时间戳" 测试
4. 在 MySQL 中验证创建的用户
5. 根据需要运行其他测试用例

💡 **提示**:

- 推荐使用 **"2️⃣ 动态时间戳"** 测试，可重复运行
- 每次测试后建议在数据库中验证结果
- 遇到问题先查看 `docs/postman/README.md`

---

**祝测试顺利！** 🚀

如有任何问题，请参考 `docs/postman/` 目录下的详细文档。

---

**文档创建时间**: 2025-11-27  
**版本**: 1.0  
**测试环境**: Production (47.79.232.189)  
**Postman 版本**: >= 9.0
