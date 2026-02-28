# SSH隧道 + MySQL配置指南

## 📋 配置概览

已成功配置SSH隧道连接到云端MySQL数据库。

## 🔧 连接架构

```
本地后端服务 (Node.js)
    ↓
127.0.0.1:3307 (本地端口)
    ↓
SSH隧道 (加密通道)
    ↓
47.79.232.189:22 (云端SSH服务器)
    ↓
127.0.0.1:3306 (云端MySQL服务)
```

## 🔐 连接凭据

### SSH配置
- **SSH主机**: 47.79.232.189
- **SSH端口**: 22
- **SSH用户**: root
- **SSH密码**: WHfe2c82a2e5b8e2a3

### MySQL配置（通过隧道）
- **MySQL主机**: 127.0.0.1（本地通过隧道）
- **MySQL端口**: 3307（本地转发端口）
- **MySQL用户**: root
- **MySQL密码**: fe2c82a2e5b8e2a3
- **数据库名**: bitcoin_mining_master

## 📁 配置文件

### backend/.env
```env
DB_HOST=127.0.0.1
DB_PORT=3307
DB_NAME=bitcoin_mining_master
DB_USER=root
DB_PASSWORD=fe2c82a2e5b8e2a3
```

## 🚀 使用方法

### 1. 建立SSH隧道
```bash
cd backend
./setup-ssh-tunnel.sh
```

### 2. 检查连接状态
```bash
cd backend
./check-ssh-status.sh
```

### 3. 测试MySQL连接
```bash
cd backend
node test-tunnel-connection.js
```

### 4. 重启后端服务
```bash
pm2 restart bitcoin-backend --update-env
```

## 🔍 状态检查

### 检查SSH隧道进程
```bash
ps aux | grep "ssh.*3307" | grep -v grep
```

### 检查端口监听
```bash
lsof -i :3307
```

### 检查后端服务
```bash
pm2 status bitcoin-backend
```

### 测试API健康
```bash
curl http://localhost:8888/api/health | jq '.'
```

## 📊 当前状态

✅ **SSH隧道**: 运行中 (PID: 79131)
✅ **端口3307**: 正在监听
✅ **MySQL连接**: 正常
✅ **后端服务**: online
✅ **API响应**: 正常
✅ **数据库**: bitcoin_mining_master (20张表, 3个用户)

## 🛠️ 故障排查

### SSH隧道断开
```bash
# 重新建立隧道
cd backend
./setup-ssh-tunnel.sh
```

### 后端连接失败
```bash
# 1. 检查隧道状态
./check-ssh-status.sh

# 2. 重启后端服务
pm2 restart bitcoin-backend --update-env

# 3. 查看日志
pm2 logs bitcoin-backend --lines 50
```

### 端口被占用
```bash
# 查找占用进程
lsof -i :3307

# 杀死进程
kill <PID>

# 重新建立隧道
./setup-ssh-tunnel.sh
```

## 🔄 自动重连

SSH隧道配置了自动保活机制：
- **ServerAliveInterval**: 60秒（每60秒发送保活包）
- **ServerAliveCountMax**: 3次（3次失败后断开）

如果隧道断开，需要手动重新执行：
```bash
cd backend
./setup-ssh-tunnel.sh
```

## 📝 维护建议

1. **开发环境启动流程**:
   ```bash
   # 1. 建立SSH隧道
   cd backend
   ./setup-ssh-tunnel.sh
   
   # 2. 启动后端服务
   pm2 start bitcoin-backend
   
   # 3. 启动Cloudflare隧道（如需公网访问）
   cloudflared tunnel --url http://localhost:8888/api
   ```

2. **定期检查状态**:
   ```bash
   # 每小时检查一次
   ./check-ssh-status.sh
   ```

3. **日志监控**:
   ```bash
   # 实时监控后端日志
   pm2 logs bitcoin-backend
   ```

## 🔒 安全说明

- SSH隧道提供了加密通道，保护MySQL通信安全
- 本地端口3307只监听127.0.0.1，不对外暴露
- 建议定期更换SSH和MySQL密码
- 生产环境建议使用SSH密钥认证替代密码

## 📞 技术支持

如遇问题，请提供以下信息：
1. `./check-ssh-status.sh` 输出
2. `pm2 logs bitcoin-backend --lines 50` 输出
3. 错误截图或详细描述

---

**最后更新**: 2026-01-29
**状态**: ✅ 生产就绪
