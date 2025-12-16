# 🔍 本地Node服务状态诊断报告

**检查时间**: 2025-11-24
**检查对象**: 本地Mac服务器 Node.js 服务

---

## 📊 服务状态概览

### ✅ PM2 进程状态
```
┌────┬──────────────────┬─────────┬──────────┬────────┬───────────┐
│ id │ name             │ mode    │ pid      │ uptime │ status    │
├────┼──────────────────┼─────────┼──────────┼────────┼───────────┤
│ 0  │ bmm-api          │ cluster │ 94379    │ 29h    │ online    │
│ 3  │ bmm-api          │ cluster │ 94383    │ 29h    │ online    │
│ 2  │ bmm-scheduler    │ fork    │ 13014    │ 18h    │ online    │
│ 1  │ bmm-worker       │ fork    │ 94339    │ 29h    │ online    │
└────┴──────────────────┴─────────┴──────────┴────────┴───────────┘
```

**结论**: ✅ 4个进程都显示在线

---

## ❌ 关键问题

### 问题 1: HTTP 服务未启动
- **现象**: 8888端口没有监听
- **测试**: `lsof -i :8888` 返回空
- **影响**: API 完全不可访问

### 问题 2: 数据库查询失败
```
Error at Query.run (sequelize/lib/dialects/mysql/query.js:52:25)
at async user_information.findAll
at async Timeout._onTimeout (src/utils/miningBalance.js:151:17)
```
- **位置**: `miningBalance.js` 第151行
- **原因**: Sequelize 查询 user_information 表失败
- **影响**: 定时任务报错，可能导致服务启动失败

### 问题 3: 健康检查失败
- **测试**: `curl http://localhost:8888/api/health`
- **结果**: 无响应（连接被拒绝）

---

## 🔍 根本原因分析

### 配置检查
```properties
DB_HOST=47.79.232.189
DB_USER=bitcoin_mining_master
DB_PASSWORD=FzFbWmwMptnN3ABE
DB_NAME=bitcoin_mining_master
PORT=8888
```

**潜在问题**:
1. 🔴 **远程数据库连接** - 本地服务连接到云服务器数据库 (47.79.232.189)
2. 🔴 **网络延迟/超时** - 可能导致数据库查询失败
3. 🔴 **数据库权限** - 可能没有授权从本地IP访问
4. 🔴 **启动顺序问题** - 定时任务先启动导致查询失败，HTTP服务器未启动

---

## 🎯 启动流程问题

根据 `index.js` 的启动流程:
```javascript
sequelize.sync().then(() => {
  console.log('数据库已同步');
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    startMiningBalanceScheduler();  // 这里可能出错
    startUserStatusScheduler();
  });
})
```

**问题链**:
1. `sequelize.sync()` 可能成功
2. `app.listen()` 启动HTTP服务器
3. `startMiningBalanceScheduler()` 启动定时任务
4. 定时任务立即查询数据库 → **查询失败**
5. 未捕获的Promise rejection → **服务崩溃**
6. PM2自动重启 → **循环崩溃**

---

## ✅ 解决方案

### 方案 1: 修复数据库连接（推荐）

#### 选项 A: 检查MySQL远程访问权限
```bash
# SSH到云服务器
ssh root@47.79.232.189

# 登录MySQL
mysql -u root -p

# 检查用户权限
SELECT user, host FROM mysql.user WHERE user='bitcoin_mining_master';

# 如果没有 '%' 的host，添加权限
GRANT ALL PRIVILEGES ON bitcoin_mining_master.* TO 'bitcoin_mining_master'@'%' IDENTIFIED BY 'FzFbWmwMptnN3ABE';
FLUSH PRIVILEGES;
```

#### 选项 B: 修改为本地数据库
```bash
# 修改 .env 文件
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_local_mysql_password
DB_NAME=bitcoin_mining_master
```

---

### 方案 2: 添加错误处理

修改 `src/utils/miningBalance.js` 添加 try-catch:
```javascript
async function someFunction() {
  try {
    const users = await UserInformation.findAll();
    // ...处理逻辑
  } catch (error) {
    console.error('数据库查询失败:', error.message);
    // 不要让错误导致服务崩溃
  }
}
```

---

### 方案 3: 暂时禁用定时任务

修改 `src/index.js`:
```javascript
sequelize.sync().then(() => {
  console.log('数据库已同步');
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    // 暂时注释掉定时任务
    // startMiningBalanceScheduler();
    // startUserStatusScheduler();
  });
})
```

---

## 🚀 立即操作步骤

### 步骤 1: 停止所有服务
```bash
pm2 stop all
```

### 步骤 2: 测试数据库连接
```bash
cd /Users/davidpony/Desktop/Bitcoin\ Mining\ Master/backend
node -e "
const sequelize = require('./src/config/database');
sequelize.authenticate()
  .then(() => console.log('✅ 数据库连接成功'))
  .catch(err => console.error('❌ 数据库连接失败:', err.message));
"
```

### 步骤 3: 根据测试结果选择方案
- 如果连接失败 → 使用**方案1**修复数据库连接
- 如果连接成功但查询失败 → 使用**方案2**添加错误处理
- 临时解决 → 使用**方案3**禁用定时任务

### 步骤 4: 重新启动服务
```bash
pm2 restart all
```

### 步骤 5: 验证服务
```bash
# 检查端口
lsof -i :8888

# 测试API
curl http://localhost:8888/api/health

# 查看日志
pm2 logs bmm-api --lines 20
```

---

## 📝 快速命令参考

```bash
# 查看PM2状态
pm2 list

# 查看日志
pm2 logs bmm-api

# 重启服务
pm2 restart bmm-api

# 停止服务
pm2 stop bmm-api

# 查看端口
lsof -i :8888

# 测试健康检查
curl http://localhost:8888/api/health

# 测试数据库连接
mysql -h 47.79.232.189 -u bitcoin_mining_master -p bitcoin_mining_master
```

---

## 🎯 结论

**当前状态**: ❌ 服务虽在运行但不可用

**主要问题**: 数据库查询失败导致HTTP服务器未正常启动

**优先级**: 🔴 高 - 需要立即修复

**建议**: 先测试数据库连接，然后根据结果选择合适的解决方案

