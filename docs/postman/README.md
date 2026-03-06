# Postman 测试文件使用说明

## 📁 文件列表

```
docs/postman/
├── Bitcoin_Mining_User_API.postman_collection.json  # API测试集合
├── Bitcoin_Mining_Production.postman_environment.json  # 生产环境配置
└── README.md  # 本文件
```

---

## 🚀 快速开始

### 步骤 1: 导入 Collection

1. 打开 **Postman**
2. 点击左上角 **Import** 按钮
3. 选择 **Upload Files**
4. 导入文件: `Bitcoin_Mining_User_API.postman_collection.json`
5. 导入成功后，左侧会出现 "Bitcoin Mining Master - User API" 集合

### 步骤 2: 导入 Environment

1. 点击右上角的 **环境下拉菜单** (齿轮图标旁边)
2. 点击 **Import**
3. 导入文件: `Bitcoin_Mining_Production.postman_environment.json`
4. 选择 "Bitcoin Mining - Production" 环境

### 步骤 3: 配置 SSH 隧道

**重要**: 由于服务器 8888 端口可能不对外开放，建议使用 SSH 隧道。

#### 在 Mac/Linux 终端运行:

```bash
ssh -N -L 8888:localhost:8888 root@47.79.232.189
```

> **说明**:
> - `-N`: 不执行远程命令，只建立隧道
> - `-L 8888:localhost:8888`: 将本地 8888 端口转发到服务器的 8888 端口
> - 保持此终端窗口打开
> - 密码: `WHfe2c82a2e5b8e2a3`

#### 验证隧道是否工作:

```bash
# 新开一个终端窗口
curl http://localhost:8888/api/health
```

如果返回 JSON 数据，说明隧道正常。

### 步骤 4: 运行测试

1. 在 Postman 中选择 "Bitcoin Mining - Production" 环境
2. 展开 "Bitcoin Mining Master - User API" 集合
3. 点击任意测试用例，如 "1️⃣ 创建用户 - 完整信息"
4. 点击右上角蓝色 **Send** 按钮
5. 查看响应结果

---

## 🧪 测试用例说明

### 1️⃣ 创建用户 - 完整信息

**用途**: 测试所有字段都填写的情况

**数据**:
- user_id: `U1732702800001`
- 包含邀请码、邮箱、设备ID、IP、国家等所有字段

**预期结果**: 
- 状态码: `201`
- success: `true`
- 返回完整用户数据

**注意**: 
- ⚠️ 此user_id是固定的，第二次运行会失败（重复）
- 如需重复测试，请先删除数据库中的记录，或使用测试2

---

### 2️⃣ 创建用户 - 动态时间戳 ⭐ 推荐

**用途**: 每次运行都创建唯一用户，可重复执行

**特点**:
- ✅ 使用 `Pre-request Script` 自动生成唯一 ID
- ✅ 每次运行都是新用户
- ✅ 适合批量测试

**工作原理**:
```javascript
// Pre-request Script 会执行:
const timestamp = Date.now();
pm.environment.set("dynamic_user_id", `U${timestamp}`);
pm.environment.set("dynamic_email", `test${timestamp}@example.com`);
```

**使用方法**:
1. 直接点击 Send，无需修改
2. 可以连续运行多次
3. 每次都会创建不同的用户

---

### 3️⃣ 创建用户 - 最小信息

**用途**: 测试只填写必填字段

**数据**:
- 只有 user_id
- 其他字段全部为 null

**验证**:
- Email、Country 等字段应该是 null
- user_creation_time 会自动生成

---

### 4️⃣ 创建用户 - Android设备

**用途**: 测试 Android 用户注册场景

**特点**:
- 包含 `android_id` (Android 设备ID)
- 包含 `gaid` (Google Advertising ID)

**使用场景**: 
- Android APP 用户注册
- 设备指纹追踪

---

### 5️⃣ 创建用户 - 带邀请码

**用途**: 测试邀请机制

**特点**:
- 包含 `invitation_code`
- 可用于后续统计邀请关系

---

### 6️⃣ 错误测试 - 缺少必填字段

**用途**: 测试错误处理逻辑

**预期结果**:
- 状态码: `400`
- 错误信息: "缺少必填字段"

**验证内容**:
- 服务器正确识别缺少 user_id
- 返回友好的错误提示

---

### 7️⃣ 错误测试 - 重复user_id

**用途**: 测试唯一性约束

**前提**: 需要先运行测试1

**预期结果**:
- 状态码: `500`
- 错误信息包含 "Validation error" 或 "unique"

**验证内容**:
- 数据库唯一索引生效
- 服务器正确处理重复键错误

---

## 🔄 批量运行测试

### Collection Runner

1. 右键点击集合名称
2. 选择 **Run collection**
3. 配置运行参数:
   - **Iterations**: 1 (运行次数)
   - **Delay**: 500ms (请求间隔)
   - **Data**: 可选 CSV 文件
4. 点击 **Run**

### 建议的运行顺序

```
顺序 1: 测试2 (动态时间戳) - 创建基础用户
顺序 2: 测试3 (最小信息) - 验证最小字段
顺序 3: 测试4 (Android) - 验证设备字段
顺序 4: 测试5 (邀请码) - 验证邀请机制
顺序 5: 测试6 (缺少字段) - 验证错误处理
顺序 6: 测试1 (完整信息) - 创建固定用户
顺序 7: 测试7 (重复ID) - 验证唯一性约束
```

---

## 📊 验证创建结果

### 方法1: 通过 MySQL 客户端

```bash
# SSH 登录服务器
ssh root@47.79.232.189

# 登录 MySQL
mysql -u bitcoin_mining_master -pFzFbWmwMptnN3ABE

# 查询最新用户
USE bitcoin_mining_master;
SELECT * FROM user_information ORDER BY user_creation_time DESC LIMIT 10;
```

### 方法2: 通过宝塔面板

1. 访问: http://47.79.232.189:8880
2. 登录宝塔面板
3. 数据库 → bitcoin_mining_master → user_information
4. 查看最新记录

### 方法3: 通过 MySQL Workbench (推荐)

1. 配置 SSH 隧道连接:
   ```
   SSH: root@47.79.232.189:22 (密码: WHfe2c82a2e5b8e2a3)
   MySQL: 127.0.0.1:3306
   User: bitcoin_mining_master
   Password: FzFbWmwMptnN3ABE
   Database: bitcoin_mining_master
   ```

2. 运行查询:
   ```sql
   SELECT * FROM user_information 
   ORDER BY user_creation_time DESC 
   LIMIT 20;
   ```

---

## 🔧 环境变量说明

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| `base_url` | `http://localhost:8888` | API基础URL (使用SSH隧道时) |
| `server_ip` | `47.79.232.189` | 服务器IP地址 |
| `direct_url` | `http://47.79.232.189:8888` | 直连URL (如果端口开放) |
| `dynamic_user_id` | (动态生成) | 由Pre-request Script生成的唯一user_id |
| `dynamic_email` | (动态生成) | 动态生成的邮箱地址 |
| `last_user_id` | (运行时设置) | 最后创建的用户ID |

### 切换到直连模式

如果服务器8888端口已开放，可以直接访问：

1. 点击右上角 **环境管理**
2. 编辑 "Bitcoin Mining - Production"
3. 修改 `base_url` 为 `{{direct_url}}`
4. 保存

---

## 📝 测试数据格式参考

### user_id 生成建议

```javascript
// 格式: U + 13位数字
// 使用时间戳确保唯一性
const timestamp = Date.now();  // 例: 1732702800123
const userId = `U${timestamp}`;  // 结果: U1732702800123
```

### invitation_code 格式

```javascript
// 格式: INV + 10位数字
// 示例
"INV0000000001"
"INV0000000002"
"INV1732702800"  // 也可以用时间戳
```

### android_id 格式

```
// 16进制字符串，长度通常16字符
"9774d56d682e549c"
"abc123def456789012345678901234"  // 最长32字符
```

### gaid (Google Advertising ID) 格式

```
// UUID格式 (8-4-4-4-12)
"12345678-1234-5678-1234-123456789abc"
"38400000-8cf0-11bd-b23e-10b96e40000d"
```

---

## 🐛 常见问题

### Q1: 连接超时或拒绝

**症状**: `Connection timeout` 或 `Connection refused`

**解决方案**:
1. 确认 SSH 隧道是否建立: `lsof -i :8888`
2. 检查服务器服务状态: `ssh root@47.79.232.189 "pm2 status"`
3. 重启 SSH 隧道

### Q2: user_id 重复错误

**症状**: 测试1失败，提示 "user_id must be unique"

**解决方案**:
1. 使用测试2 (动态时间戳) 代替
2. 或修改测试1的 user_id 为新值
3. 或删除数据库中的旧记录

### Q3: 测试脚本不执行

**症状**: Pre-request Script 或 Tests 没有运行

**解决方案**:
1. 确认 Postman 版本 >= 9.0
2. 检查脚本语法是否有错误
3. 查看 Postman Console (View → Show Postman Console)

### Q4: 环境变量未生效

**症状**: `{{base_url}}` 显示为字面值

**解决方案**:
1. 确认已选择 "Bitcoin Mining - Production" 环境
2. 检查变量名拼写是否正确
3. 重启 Postman

---

## 📚 相关文档

- [完整API文档](../api.md)
- [Postman测试指南](../POSTMAN_USER_REGISTRATION_TEST.md)
- [Postman完整配置指南](../POSTMAN_COMPLETE_GUIDE.md)
- [数据库设计](../design.md)

---

## 🎓 学习资源

### Postman 自动化测试

```javascript
// 常用测试断言
pm.test("Status code is 200", function () {
    pm.response.to.have.status(200);
});

pm.test("Response time is less than 500ms", function () {
    pm.expect(pm.response.responseTime).to.be.below(500);
});

pm.test("Response has correct structure", function () {
    var jsonData = pm.response.json();
    pm.expect(jsonData).to.have.property('success');
    pm.expect(jsonData).to.have.property('data');
});

// 保存响应数据到变量
var jsonData = pm.response.json();
pm.environment.set("variable_name", jsonData.some_value);

// 获取变量
var value = pm.environment.get("variable_name");
```

### Pre-request Script 示例

```javascript
// 生成随机数据
pm.environment.set("random_email", `user${Math.floor(Math.random() * 10000)}@test.com`);

// 生成UUID
const uuid = require('uuid');
pm.environment.set("guid", uuid.v4());

// 当前时间戳
pm.environment.set("timestamp", Date.now());

// 格式化日期
const now = new Date();
pm.environment.set("date", now.toISOString());
```

---

## 📞 支持

如有问题，请联系:
- 技术文档: `docs/` 目录
- 测试脚本: `scripts/test_user_creation.sh`

---

**创建时间**: 2025-11-27  
**最后更新**: 2025-11-27  
**Postman 版本要求**: >= 9.0  
**测试环境**: Production (47.79.232.189:8888)
