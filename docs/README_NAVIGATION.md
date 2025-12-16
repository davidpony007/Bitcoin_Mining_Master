# 📚 快速导航 - 文档索引

## 🎯 根据您的需求选择文档

---

## 🚀 我是 Android 开发者

### 快速开始 (推荐)
👉 **[ANDROID_QUICK_START.md](ANDROID_QUICK_START.md)**
- ⏱️ 5 分钟快速集成
- 📦 依赖配置
- 💻 核心代码示例
- 🧪 快速测试方法

### 完整指南
👉 **[ANDROID_INTEGRATION_GUIDE.md](ANDROID_INTEGRATION_GUIDE.md)**
- 📖 15 KB 详细文档
- 🔧 项目配置完整说明
- 📁 文件结构详解
- 🎯 关键功能实现
- 🐛 常见问题 FAQ (6 个)

### 代码文件
👉 **[android/](android/)** 目录
- 8 个 Kotlin 源码文件
- 完整注释
- 直接复制使用

### 文件清单
👉 **[android/FILE_LIST.md](android/FILE_LIST.md)**
- 📂 所有文件列表
- 🔗 API 映射关系
- 📊 功能对照表

---

## 🔧 我是后端开发者

### API 文档
👉 **[AUTH_API.md](AUTH_API.md)**
- 6 个 API 端点规范
- 请求/响应示例
- 数据库表结构
- 完整业务流程

### 代码文件
👉 **[../backend/src/controllers/authController.js](../backend/src/controllers/authController.js)**
- 505+ 行完整实现
- 6 个核心函数
- 完整错误处理

---

## 👀 我想快速了解项目

### 功能总结
👉 **[COMPLETION_SUMMARY.md](COMPLETION_SUMMARY.md)**
- ✅ 已完成功能清单
- 📊 代码统计
- 🗄️ 数据库变更
- 🎯 业务流程验证
- 🚀 部署状态

---

## 🧪 我想测试功能

### 测试 API
```bash
# 1. 测试设备登录
curl -X POST http://localhost:8888/api/auth/device-login \
  -H "Content-Type: application/json" \
  -d '{"android_id":"test_001","country":"CN"}'

# 2. 测试用户状态查询
curl "http://localhost:8888/api/auth/user-status?user_id=U2025120722023724632"

# 3. 测试邀请信息
curl "http://localhost:8888/api/auth/invitation-info?user_id=U2025120722023724632"
```

### 查看测试数据
```bash
# 连接到云端 MySQL
ssh root@47.79.232.189
mysql -u bitcoin_mining_master -p bitcoin_mining_master

# 查看最新用户
SELECT * FROM user_information ORDER BY id DESC LIMIT 5;

# 查看邀请关系
SELECT * FROM invitation_relationship;

# 查看用户状态
SELECT * FROM user_status ORDER BY id DESC LIMIT 5;
```

---

## 📱 我想集成到 APP

### 步骤 1: 复制代码
```bash
# 复制所有 Kotlin 文件到您的项目
cp docs/android/*.kt \
   your_android_project/app/src/main/java/com/bitcoinmining/
```

### 步骤 2: 配置依赖
参考 [ANDROID_QUICK_START.md](ANDROID_QUICK_START.md) 第 1 节

### 步骤 3: 修改配置
- 修改包名为实际包名
- 配置服务器地址 (RetrofitClient.kt)
- 配置 Google OAuth (Google Cloud Console)

### 步骤 4: 运行测试
参考 [ANDROID_INTEGRATION_GUIDE.md](ANDROID_INTEGRATION_GUIDE.md) 第 5 节

---

## 🐛 我遇到问题了

### 常见问题
👉 **[ANDROID_INTEGRATION_GUIDE.md](ANDROID_INTEGRATION_GUIDE.md)** 第 6 节

包含 6 个常见问题的解决方案:
1. 无法连接到服务器
2. 无法获取 GAID
3. Google Sign-In 失败
4. 如何处理网络错误
5. 如何调试 API 请求
6. 如何配置代理抓包

---

## 📊 我想了解数据结构

### 数据库表
👉 **[AUTH_API.md](AUTH_API.md)** 第 6 节

包含 3 个核心表:
1. `user_information` - 用户基本信息
2. `invitation_relationship` - 邀请关系
3. `user_status` - 用户状态 (余额、收益)

### 数据模型
👉 **[android/DataModels.kt](android/DataModels.kt)**

包含所有请求/响应数据类:
- 4 个请求模型
- 8 个响应模型
- 完整字段注释

---

## 🔍 我想了解业务流程

### 核心流程
👉 **[COMPLETION_SUMMARY.md](COMPLETION_SUMMARY.md)** 第 7 节

包含 5 个完整业务流程:
1. 新用户首次启动 APP
2. 老用户再次启动 APP
3. 绑定 Google 账号
4. 切换 Google 账号
5. 推荐人邀请码

每个流程包含:
- 完整步骤说明
- 数据流转示意
- 验证状态

---

## 📦 文档结构总览

```
docs/
├── 📖 README_NAVIGATION.md            ← 你在这里
├── 📄 COMPLETION_SUMMARY.md           总结文档 (最全面)
├── 📱 ANDROID_QUICK_START.md          快速开始 (5 分钟)
├── 📚 ANDROID_INTEGRATION_GUIDE.md    完整指南 (15 KB)
├── 🔌 AUTH_API.md                     API 文档
└── android/
    ├── 📝 FILE_LIST.md                文件清单
    ├── 💻 ApiService.kt               API 接口
    ├── 💻 DataModels.kt               数据模型
    ├── 💻 RetrofitClient.kt           网络配置
    ├── 💻 UserManager.kt              数据管理
    ├── 💻 AuthRepository.kt           API 封装
    ├── 💻 BitcoinMiningApplication.kt 全局初始化
    ├── 💻 MainActivity.kt             自动登录
    └── 💻 SettingsActivity.kt         Google 账号管理
```

---

## 🎯 按使用场景导航

### 场景 1: 我要快速上手 Android 集成
1. 阅读 [ANDROID_QUICK_START.md](ANDROID_QUICK_START.md)
2. 复制 `android/` 目录下的 8 个 Kotlin 文件
3. 配置依赖和权限
4. 运行测试

### 场景 2: 我要了解完整功能
1. 阅读 [COMPLETION_SUMMARY.md](COMPLETION_SUMMARY.md)
2. 查看 [AUTH_API.md](AUTH_API.md) 了解 API 规范
3. 阅读 [ANDROID_INTEGRATION_GUIDE.md](ANDROID_INTEGRATION_GUIDE.md) 了解实现细节

### 场景 3: 我要测试后端 API
1. 阅读 [AUTH_API.md](AUTH_API.md) 第 2-7 节
2. 使用 Postman 或 curl 测试 6 个端点
3. 查看 MySQL 数据验证结果

### 场景 4: 我要排查问题
1. 查看 [ANDROID_INTEGRATION_GUIDE.md](ANDROID_INTEGRATION_GUIDE.md) 第 6 节 FAQ
2. 检查后端日志: `backend/logs/combined.log`
3. 检查 PM2 状态: `pm2 list`
4. 检查 MySQL 数据: 连接到云端数据库查询

### 场景 5: 我要扩展新功能
1. 参考 [COMPLETION_SUMMARY.md](COMPLETION_SUMMARY.md) 第 10 节 "下一步建议"
2. 阅读现有代码: `authController.js` 和 Android 文件
3. 按照相同模式添加新 API 和客户端代码

---

## 🔗 快速链接

| 文档 | 用途 | 推荐对象 |
|------|------|----------|
| [ANDROID_QUICK_START.md](ANDROID_QUICK_START.md) | 5 分钟快速集成 | Android 开发者 |
| [ANDROID_INTEGRATION_GUIDE.md](ANDROID_INTEGRATION_GUIDE.md) | 完整集成指南 | Android 开发者 |
| [AUTH_API.md](AUTH_API.md) | API 规范文档 | 后端/Android 开发者 |
| [COMPLETION_SUMMARY.md](COMPLETION_SUMMARY.md) | 功能总结 | 项目管理者 |
| [android/FILE_LIST.md](android/FILE_LIST.md) | 文件清单 | 所有开发者 |

---

## 📞 技术支持

如果以上文档无法解决您的问题,请:
1. 检查后端日志 (backend/logs/)
2. 检查 PM2 状态 (pm2 list)
3. 查看 MySQL 数据是否正确
4. 使用 Postman 测试 API 端点
5. 检查 Android Logcat 日志

---

## 🎉 快速测试命令

```bash
# 测试后端服务
curl http://localhost:8888/api/auth/device-login \
  -H "Content-Type: application/json" \
  -d '{"android_id":"test_001","country":"CN"}'

# 查看 PM2 状态
pm2 list

# 查看日志
tail -f backend/logs/combined.log

# 连接 MySQL
ssh root@47.79.232.189
mysql -u bitcoin_mining_master -p bitcoin_mining_master
```

---

**更新时间**: 2025-12-07  
**版本**: v1.0  
**状态**: ✅ 完整文档
