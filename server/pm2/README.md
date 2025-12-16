# PM2 进程管理完整指南

## 📦 安装 PM2

```bash
# 全局安装 PM2
npm install -g pm2

# 安装日志轮转插件
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
pm2 set pm2-logrotate:compress true
```

---

## 🚀 快速开始

### 1. 赋予脚本执行权限
```bash
cd server/pm2
chmod +x *.sh
```

### 2. 启动服务
```bash
./start.sh
```

### 3. 查看状态
```bash
./status.sh
```

---

## 📋 核心功能

### 进程配置（ecosystem.config.js）

| 应用 | 描述 | 实例数 | 模式 |
|------|------|--------|------|
| **bmm-api** | API 服务器 | 2 | 集群 |
| **bmm-worker** | 异步任务处理 | 1 | fork |
| **bmm-scheduler** | 挖矿余额调度 | 1 | fork |

### 关键特性
- ✅ **集群模式**：API 自动负载均衡（2 实例）
- ✅ **自动重启**：异常退出自动恢复
- ✅ **内存限制**：超限自动重启（API: 500MB，Worker: 300MB）
- ✅ **日志轮转**：自动压缩，保留 7 天
- ✅ **定时重启**：调度器每天凌晨 4 点重启（清理内存）
- ✅ **优雅关闭**：支持 graceful shutdown
- ✅ **开机自启**：系统重启后自动恢复

---

## 🛠️ 常用命令

### 启动/停止/重启
```bash
./start.sh      # 启动所有服务
./stop.sh       # 停止所有服务
./restart.sh    # 优雅重启（0 秒停机）
./delete.sh     # 完全删除（需确认）
```

### 日志查看
```bash
./logs.sh           # 查看所有日志
./logs.sh api       # 查看 API 日志
./logs.sh worker    # 查看 Worker 日志
./logs.sh scheduler # 查看调度器日志
```

### 监控与状态
```bash
./monitor.sh    # 实时监控面板（CPU/内存）
./status.sh     # 查看详细状态
pm2 list        # 进程列表
pm2 monit       # 交互式监控
```

### 高级操作
```bash
# 重启单个应用
pm2 restart bmm-api

# 重启所有实例
pm2 restart all

# 查看详细信息
pm2 describe bmm-api

# 清空日志
pm2 flush

# 查看实时日志（带颜色）
pm2 logs --lines 50 --raw

# 启用/禁用自动重启
pm2 stop bmm-api
pm2 start bmm-api --no-autorestart
```

---

## 🔧 配置说明

### 环境变量（backend/.env）
```env
NODE_ENV=production
PORT=8888
DB_HOST=47.79.232.189
DB_PORT=3306
DB_NAME=bitcoin_mining_master
DB_USER=bitcoin_mining_master
DB_PASS=your-password
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_KEY_PREFIX=bmm:
JWT_SECRET=your-secret-key
```

### 日志轮转（pm2-logrotate.json）
- 单文件最大 10MB
- 保留 7 天历史
- 自动 gzip 压缩
- 每天凌晨执行

---

## 📊 监控与告警

### PM2 Plus（云端监控，可选）
```bash
# 注册账号：https://pm2.io
pm2 link <secret> <public>
```

### 自定义监控指标
```bash
# 查看内存使用
pm2 describe bmm-api | grep memory

# 查看重启次数
pm2 describe bmm-api | grep restart

# 导出指标（JSON）
pm2 jlist
```

---

## 🐛 故障排查

### 应用无法启动
```bash
# 查看错误日志
pm2 logs bmm-api --err --lines 50

# 检查配置
pm2 describe bmm-api

# 手动启动测试
cd backend
node src/index.js
```

### 内存泄漏
```bash
# 查看内存趋势
pm2 monit

# 生成堆快照（需要 heapdump 模块）
pm2 trigger bmm-api heapdump
```

### 端口冲突
```bash
# 查看端口占用
lsof -i :8888
netstat -an | grep 8888

# 杀死占用进程
kill -9 <PID>
```

---

## 🔒 生产部署检查清单

- [ ] 环境变量配置完整（.env）
- [ ] JWT_SECRET 已修改为强密钥
- [ ] 数据库密码已修改
- [ ] Redis 密码已配置
- [ ] 日志目录权限正确
- [ ] PM2 开机自启已配置（`pm2 startup`）
- [ ] 日志轮转已启用
- [ ] 防火墙已配置
- [ ] Nginx 反向代理已配置
- [ ] SSL 证书已安装

---

## 🆚 PM2 vs Docker

| 特性 | PM2 | Docker Compose |
|------|-----|----------------|
| **学习曲线** | 低 | 中 |
| **部署复杂度** | 简单 | 中等 |
| **资源隔离** | 进程级 | 容器级 |
| **扩展性** | 单机 | 多机 |
| **适用场景** | 中小项目 | 大型/微服务 |

**建议**：
- 小型单机部署：用 PM2
- 多环境/容器化：用 Docker
- 混合方案：Nginx + PM2

---

## 📚 参考资源

- [PM2 官方文档](https://pm2.keymetrics.io/docs/)
- [PM2 Ecosystem 配置](https://pm2.keymetrics.io/docs/usage/application-declaration/)
- [PM2 集群模式](https://pm2.keymetrics.io/docs/usage/cluster-mode/)
- [PM2 日志管理](https://pm2.keymetrics.io/docs/usage/log-management/)
