# 🚀 立即执行 - 后端服务部署

## ✅ 所有准备工作已完成

所有代码已实现、测试并上传到云服务器：
- 📦 代码位置: `/root/backend`
- 🔧 部署脚本: `/root/backend/deploy.sh`
- 📚 完整文档: `/root/backend/DEPLOYMENT_GUIDE.md`

## 📋 执行步骤（仅需2步）

### 步骤1: SSH连接到云服务器

```bash
ssh root@47.79.232.189
```

### 步骤2: 运行自动部署脚本

```bash
cd /root/backend
bash deploy.sh
```

**脚本会自动完成**:
1. ✅ 检查并安装Node.js（如需要）
2. ✅ 安装项目依赖 (`npm install`)
3. ✅ 安装PM2进程管理器
4. ✅ 测试数据库连接
5. ✅ 启动后端服务
6. ✅ 配置开机自启
7. ✅ 运行健康检查测试
8. ✅ 显示服务状态

## ⏱️ 预计耗时

- 首次安装: **3-5分钟** (需要安装Node.js和依赖)
- 后续更新: **30秒** (仅需重启服务)

## 🎯 验证服务启动

部署完成后，脚本会自动测试。你也可以手动验证：

```bash
# 1. 查看服务状态
pm2 status

# 2. 查看实时日志
pm2 logs bitcoin-backend

# 3. 测试健康检查
curl http://localhost:8888/api/health

# 4. 测试余额API (替换1为实际用户ID)
curl http://localhost:8888/api/balance/realtime/1
```

## 📊 观察定时任务

定时任务会在以下时间自动执行：

### 余额同步任务
- **执行时间**: 每2小时整点 (00:00, 02:00, 04:00, 06:00, ...)
- **日志关键词**: `余额同步` / `mining_reward`

### 推荐返利任务  
- **执行时间**: 每2小时+5分钟 (00:05, 02:05, 04:05, 06:05, ...)
- **日志关键词**: `推荐返利` / `referral_rebate`

**查看日志**:
```bash
# 实时日志
pm2 logs bitcoin-backend

# 最近500行日志
pm2 logs bitcoin-backend --lines 500

# 搜索定时任务执行记录
pm2 logs bitcoin-backend --lines 1000 | grep -E "(余额同步|推荐返利)"
```

## 🔍 常用管理命令

```bash
# 查看服务状态
pm2 status

# 重启服务
pm2 restart bitcoin-backend

# 停止服务
pm2 stop bitcoin-backend

# 查看日志
pm2 logs bitcoin-backend

# 监控CPU/内存
pm2 monit

# 查看详细信息
pm2 show bitcoin-backend
```

## 🗃️ 查看数据库记录

```bash
# 连接数据库
mysql -u root -pfe2c82a2e5b8e2a3 bitcoin_mining_master

# 查询最近的交易记录
SELECT user_id, transaction_type, amount, created_at 
FROM bitcoin_transaction_records 
WHERE transaction_type IN ('mining_reward', 'referral_rebate')
ORDER BY created_at DESC 
LIMIT 20;

# 查询活跃合约数
SELECT COUNT(*) FROM free_contract_records 
WHERE mining_status = 'active' AND free_contract_end_time > NOW();
```

## 📱 客户端集成

服务启动后，前端可以开始集成余额显示功能。

参考文档: `/root/backend/BALANCE_SYSTEM_IMPLEMENTATION.md`

关键API:
```javascript
// 获取实时余额
fetch(`http://服务器IP:8888/api/balance/realtime/${userId}`)

// 获取挖矿速率
fetch(`http://服务器IP:8888/api/balance/mining-speed/${userId}`)

// 清除缓存（用户激活合约后调用）
fetch(`http://服务器IP:8888/api/balance/clear-cache/${userId}`, {
  method: 'POST'
})
```

## 📞 技术支持

### 查看完整文档

```bash
# 部署指南
cat /root/backend/DEPLOYMENT_GUIDE.md

# 实现总结
cat /root/backend/IMPLEMENTATION_SUMMARY.md

# 技术文档
cat /root/backend/BALANCE_SYSTEM_IMPLEMENTATION.md
```

### 故障排查

如果遇到问题，请按以下步骤排查：

1. **查看PM2日志**:
   ```bash
   pm2 logs bitcoin-backend --err --lines 100
   ```

2. **测试数据库连接**:
   ```bash
   mysql -u root -pfe2c82a2e5b8e2a3 -e "SELECT 1"
   ```

3. **测试Redis连接**:
   ```bash
   redis-cli ping
   ```

4. **检查端口占用**:
   ```bash
   netstat -tuln | grep 8888
   ```

## 🎉 完成标志

当你看到以下内容时，说明部署成功：

1. ✅ PM2显示 `bitcoin-backend` 状态为 `online`
2. ✅ 健康检查返回: `{"status":"ok","db":"connected",...}`
3. ✅ 日志显示: `Server is running on port 8888`
4. ✅ 日志显示: `✓ 余额同步任务已启动`
5. ✅ 日志显示: `✓ 推荐返利任务已启动`

---

## ⚡ 快速开始

```bash
# 一键部署（复制粘贴执行）
ssh root@47.79.232.189 "cd /root/backend && bash deploy.sh"
```

**就这么简单！** 🚀
