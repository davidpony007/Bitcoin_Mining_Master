# ✅ Node服务重启完成 - 最终状态报告

**操作时间**: 2025-11-24
**执行操作**: 
1. ✅ 停止所有PM2进程
2. ✅ 使用正确的ecosystem.config.js重新启动
3. ⏳ 等待服务启动和健康检查

---

## 📋 操作步骤回顾

### 步骤 1: 删除所有旧进程
```bash
pm2 delete all
```
**结果**: ✅ 清理成功，删除了 bmm-worker 和 bmm-scheduler

### 步骤 2: 使用正确配置启动
```bash
cd "/Users/davidpony/Desktop/Bitcoin Mining Master/backend"
pm2 start ../server/pm2/ecosystem.config.js
```

**配置文件**: `/server/pm2/ecosystem.config.js`
**启动的应用**:
- `bmm-api` (2个集群实例) - API服务器
- `bmm-worker` (1个实例) - 异步任务处理
- `bmm-scheduler` (1个实例) - 挖矿余额调度器

### 步骤 3: 等待服务ready
⏳ bmm-api设置了 `wait_ready: true`，正在等待应用ready信号...

---

## 🔍 配置分析

### bmm-api 配置
```javascript
{
  name: 'bmm-api',
  script: './src/index.js',
  instances: 2,                    // 2个集群实例
  exec_mode: 'cluster',           // 集群模式
  PORT: 8888,
  max_memory_restart: '500M',
  autorestart: true,
  wait_ready: true,               // 等待ready信号
  listen_timeout: 10000           // 10秒超时
}
```

**优点**:
- ✅ 集群模式利用多核CPU
- ✅ 自动重启提高可用性
- ✅ 内存超限保护
- ✅ ready信号确保启动完成

### bmm-worker 配置
```javascript
{
  name: 'bmm-worker',
  script: './src/queue/worker.js',
  instances: 1,
  exec_mode: 'fork',
  max_memory_restart: '300M',
  kill_timeout: 30000             // 30秒关闭时间
}
```

### bmm-scheduler 配置
```javascript
{
  name: 'bmm-scheduler',
  script: './src/utils/miningBalance.js',
  instances: 1,
  cron_restart: '0 4 * * *'       // 每天凌晨4点重启
}
```

---

## 📊 预期状态

### 成功启动后应该看到:

```
┌────┬──────────────────┬─────────┬──────────┬────────┬───────────┐
│ id │ name             │ mode    │ pid      │ uptime │ status    │
├────┼──────────────────┼─────────┼──────────┼────────┼───────────┤
│ 0  │ bmm-api          │ cluster │ XXXXX    │ Xs     │ online    │
│ 1  │ bmm-api          │ cluster │ XXXXX    │ Xs     │ online    │
│ 2  │ bmm-worker       │ fork    │ XXXXX    │ Xs     │ online    │
│ 3  │ bmm-scheduler    │ fork    │ XXXXX    │ Xs     │ online    │
└────┴──────────────────┴─────────┴──────────┴────────┴───────────┘
```

### API应该可访问:
- ✅ `http://localhost:8888/api/health` → `{"status":"ok","db":"connected"}`
- ✅ `lsof -i :8888` → 显示Node进程监听

---

## ⚠️ 可能的问题

### 如果启动失败

#### 问题 1: 路由/Controller错误
**症状**: bmm-api显示 `errored` 状态
**原因**: `Route.get() requires a callback function`
**解决**: 检查所有controller导出

#### 问题 2: 数据库连接失败
**症状**: 启动后立即崩溃
**原因**: 无法连接到 `47.79.232.189` MySQL
**解决**: 
- 检查数据库权限
- 或改用本地数据库

#### 问题 3: 端口被占用
**症状**: EADDRINUSE错误
**原因**: 8888端口已被占用
**解决**: 
```bash
lsof -i :8888
kill -9 <PID>
```

---

## 🧪 验证命令

### 检查PM2状态
```bash
pm2 list
pm2 logs bmm-api --lines 20
```

### 检查端口监听
```bash
lsof -i :8888
netstat -an | grep 8888
```

### 测试API
```bash
# 本地
curl http://localhost:8888/api/health

# 云服务器
curl http://47.79.232.189:8888/api/health
```

### 查看日志
```bash
# 实时日志
pm2 logs bmm-api

# 错误日志
tail -f logs/pm2/api-error.log

# 输出日志
tail -f logs/pm2/api-out.log
```

---

## 📱 云服务器检查

### 检查云服务器PM2
```bash
ssh root@47.79.232.189 'pm2 list'
```

### 检查云服务器端口
```bash
ssh root@47.79.232.189 'netstat -tlnp | grep 8888'
```

### 测试云服务器API
```bash
ssh root@47.79.232.189 'curl http://localhost:8888/api/health'
```

### 如果云服务器未启动
```bash
bash "/Users/davidpony/Desktop/Bitcoin Mining Master/server/pm2/remote_start.sh"
```

---

## 🎯 下一步操作

### 等待当前命令完成

当前执行的命令:
```bash
sleep 10 && pm2 list && curl http://localhost:8888/api/health && curl http://47.79.232.189:8888/api/health
```

**预期结果**:
1. PM2显示4个进程online
2. 本地API返回健康状态
3. 云服务器API状态（可能需要先启动）

### 根据结果采取行动

#### ✅ 如果本地服务正常
→ 直接在本地测试创建用户
```bash
curl -X POST http://localhost:8888/api/userInformation \
  -H "Content-Type: application/json" \
  -d '{"user_id":"USER001","invitation_code":"INV001","email":"test@example.com"}'
```

#### ❌ 如果本地服务失败
→ 查看日志找问题
```bash
pm2 logs bmm-api --lines 50 --nostream
```

#### 🟡 如果云服务器未响应
→ 启动云服务器服务
```bash
bash "/Users/davidpony/Desktop/Bitcoin Mining Master/server/pm2/remote_start.sh"
```

---

## 📝 总结

**已完成**:
- ✅ 停止所有旧的PM2进程
- ✅ 使用正确的ecosystem配置重新启动
- ⏳ 等待服务完全启动（10秒）

**待验证**:
- ⏳ 本地服务是否正常运行
- ⏳ 8888端口是否监听
- ⏳ API健康检查是否通过
- ⏳ 云服务器状态

**如果一切正常**:
- 🎯 可以开始测试创建用户
- 🎯 建议优先使用云服务器（数据持久化）
- 🎯 本地可用于开发测试

