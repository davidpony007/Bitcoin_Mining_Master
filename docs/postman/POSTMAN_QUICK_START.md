# 🚀 Postman 快速开始 - 3 步创建用户

## ⚡ 快速流程

```
1️⃣ 启动服务 → 2️⃣ 导入文件 → 3️⃣ 点击 Send
```

---

## 1️⃣ 启动本地服务（1 分钟）

### 检查服务状态
```bash
pm2 status
```

### 如果没有运行，启动服务
```bash
cd "/Users/davidpony/Desktop/Bitcoin Mining Master"
pm2 start ecosystem.config.js
```

### 验证服务
```bash
curl http://localhost:8888/api/health
```

**✅ 看到 `"status": "ok", "db": "connected"` 即可继续**

---

## 2️⃣ 导入 Postman 文件（2 分钟）

### Step 1: 导入 Collection
1. 打开 Postman
2. 点击 **Import** 按钮
3. 拖入：`Bitcoin_Mining_User_Creation_Tests.postman_collection.json`

### Step 2: 导入 Environment
1. 点击右上角环境图标
2. 点击 **Import**
3. 拖入：`Bitcoin_Mining_Local_2025.postman_environment.json`

### Step 3: 选择环境
右上角下拉菜单 → 选择 **Bitcoin Mining - Local (2025)**

---

## 3️⃣ 运行测试（30 秒）

### 推荐测试：动态时间戳
1. 展开集合：**Bitcoin Mining Master - 用户创建测试 (2025)**
2. 点击：**1️⃣ 创建用户 - 动态时间戳（推荐）⭐**
3. 点击蓝色 **Send** 按钮

### ✅ 成功标志
- 状态码：`201 Created`
- Tests 显示绿色 ✓
- 响应包含 `"success": true`

---

## 📊 验证数据（可选）

### 方法 1：SSH 连接
```bash
ssh root@47.79.232.189
mysql -u bitcoin_mining_master -pFzFbWmwMptnN3ABE bitcoin_mining_master
SELECT * FROM user_information ORDER BY user_creation_time DESC LIMIT 5;
```

### 方法 2：宝塔面板
访问 `http://47.79.232.189:8880` → 数据库 → user_information

---

## 🎯 测试用例速查

| 测试名称 | 说明 | 可重复 |
|---------|------|--------|
| 1️⃣ 动态时间戳 ⭐ | **推荐**，自动生成唯一ID | ✅ |
| 2️⃣ 完整信息 | 包含所有字段 | ✅ |
| 3️⃣ 最小信息 | 仅 user_id | ✅ |
| 4️⃣ Android 用户 | 带设备信息 | ✅ |
| 5️⃣ 带邀请码 | 测试推荐系统 | ✅ |
| ❌ 缺少字段 | 错误测试 | ✅ |
| ❌ 重复ID | 错误测试 | 第2次失败 |
| 🏥 健康检查 | 验证服务 | ✅ |

---

## 🐛 常见问题快速修复

### 连接失败 (ECONNREFUSED)
```bash
pm2 restart ecosystem.config.js
```

### 重复 user_id
→ 使用 **1️⃣ 动态时间戳** 测试（自动避免重复）

### 端口被占用
```bash
lsof -i :8888
pm2 stop all
pm2 start ecosystem.config.js
```

---

## 📁 文件位置

```
docs/postman/
├── Bitcoin_Mining_User_Creation_Tests.postman_collection.json  ← 主测试
├── Bitcoin_Mining_Local_2025.postman_environment.json          ← 环境配置
├── POSTMAN_USER_CREATION_GUIDE.md                              ← 完整指南
└── POSTMAN_QUICK_START.md                                      ← 本文件
```

---

## ✨ 示例请求/响应

### 请求 (自动生成)
```json
POST http://localhost:8888/api/users

{
  "user_id": "U1733317200123",
  "email": "user_1733317200123@test.com",
  "country": "CN",
  "register_ip": "192.168.1.100"
}
```

### 响应
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

---

## 🎓 下一步

- 📖 查看 [完整使用指南](POSTMAN_USER_CREATION_GUIDE.md)
- 🔧 修改请求数据测试不同场景
- 📊 使用 Collection Runner 批量创建用户
- 🗄️ 在 MySQL 中查看真实数据

---

**祝测试顺利！🎉**
