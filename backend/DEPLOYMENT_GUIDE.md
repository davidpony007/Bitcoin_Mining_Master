# 🚀 后端服务部署指南

## 当前状态

✅ 所有功能代码已实现并集成
✅ 数据库结构已更新
✅ 定时任务已配置
⚠️ 需要在云服务器上部署才能正常运行

## 为什么需要在云服务器部署？

本地Mac无法直接连接云服务器数据库（47.79.232.189），因为：
1. 数据库只允许特定IP访问（当前IP: 123.123.45.124被拒绝）
2. Redis需要身份验证
3. 网络安全策略限制

## 部署步骤

### 方式1：直接在云服务器上运行（推荐）

#### 1. 上传代码到服务器

```bash
# 压缩backend目录
cd "/Users/davidpony/Desktop/工程文件夹/Bitcoin_Mining_Master"
tar -czf backend.tar.gz backend/

# 上传到服务器
scp backend.tar.gz root@47.79.232.189:/root/

# SSH到服务器
ssh root@47.79.232.189

# 解压
cd /root
tar -xzf backend.tar.gz
cd backend
```

#### 2. 安装Node.js和依赖

```bash
# 如果服务器没有Node.js，先安装
curl -fsSL https://rpm.nodesource.com/setup_18.x | bash -
yum install -y nodejs

# 安装项目依赖
npm install
```

#### 3. 配置环境变量

服务器上的.env已包含正确配置，确认内容：

```bash
cat /root/backend/.env
```

应该包含：
```dotenv
DB_HOST=47.79.232.189  # 或 localhost
DB_PORT=3306
DB_NAME=bitcoin_mining_master
DB_USER=root
DB_PASSWORD=fe2c82a2e5b8e2a3

REDIS_HOST=47.79.232.189  # 或 localhost
REDIS_PORT=6379
```

#### 4. 使用PM2启动服务（推荐）

```bash
# 安装PM2（进程管理器）
npm install -g pm2

# 启动服务
cd /root/backend
pm2 start src/index.js --name bitcoin-backend

# 查看日志
pm2 logs bitcoin-backend

# 查看状态
pm2 status

# 设置开机自启
pm2 startup
pm2 save
```

#### 5. 验证服务

```bash
# 检查健康状态
curl http://localhost:8888/api/health

# 测试余额API（替换1为实际用户ID）
curl http://localhost:8888/api/balance/realtime/1

# 查看PM2日志确认定时任务
pm2 logs bitcoin-backend --lines 100
```

### 方式2：使用SSH隧道（临时测试）

```bash
# 在本地Mac终端创建SSH隧道
ssh -L 3306:localhost:3306 -L 6379:localhost:6379 -L 8888:localhost:8888 root@47.79.232.189

# 保持这个终端打开，然后在另一个终端启动本地服务
cd "/Users/davidpony/Desktop/工程文件夹/Bitcoin_Mining_Master/backend"
node src/index.js
```

## 验证定时任务

### 1. 查看定时任务启动日志

服务启动时应该看到：
```
✓ 余额同步任务已启动（每2小时执行一次）
✓ 推荐返利任务已启动（每2小时执行一次）
```

### 2. 定时任务执行时间

- **余额同步**: 每2小时整点执行（00:00, 02:00, 04:00, ...）
- **推荐返利**: 每2小时+5分钟执行（00:05, 02:05, 04:05, ...）

### 3. 手动触发测试（可选）

```javascript
// SSH到服务器后，进入Node.js REPL
node

// 执行以下代码
const BalanceSyncTask = require('./src/jobs/balanceSyncTask');
const ReferralRebateTask = require('./src/jobs/referralRebateTask');

// 手动触发余额同步
await BalanceSyncTask.triggerManually();

// 手动触发推荐返利
await ReferralRebateTask.triggerManually();
```

### 4. 检查数据库交易记录

```sql
-- SSH到服务器后连接MySQL
mysql -u root -pfe2c82a2e5b8e2a3 bitcoin_mining_master

-- 查询最近的交易记录
SELECT 
  user_id,
  transaction_type,
  amount,
  created_at,
  description
FROM bitcoin_transaction_records
WHERE transaction_type IN ('mining_reward', 'referral_rebate')
ORDER BY created_at DESC
LIMIT 20;
```

## API测试命令

### 1. 健康检查
```bash
curl http://localhost:8888/api/health
```

### 2. 实时余额查询
```bash
# 替换{userId}为实际用户ID
curl http://localhost:8888/api/balance/realtime/{userId}

# 示例
curl http://localhost:8888/api/balance/realtime/1
```

### 3. 挖矿速率查询
```bash
curl http://localhost:8888/api/balance/mining-speed/1
```

### 4. 清除缓存
```bash
curl -X POST http://localhost:8888/api/balance/clear-cache/1
```

## 监控和维护

### PM2常用命令

```bash
# 查看所有进程
pm2 list

# 查看实时日志
pm2 logs bitcoin-backend

# 重启服务
pm2 restart bitcoin-backend

# 停止服务
pm2 stop bitcoin-backend

# 删除进程
pm2 delete bitcoin-backend

# 查看详细信息
pm2 show bitcoin-backend

# 监控CPU和内存
pm2 monit
```

### 查看定时任务执行情况

```bash
# 查看最近的日志（包含定时任务执行记录）
pm2 logs bitcoin-backend --lines 200 | grep -E "(余额同步|推荐返利|mining_reward|referral_rebate)"
```

### 数据库监控

```sql
-- 统计今日交易
SELECT 
  transaction_type,
  COUNT(*) as count,
  SUM(amount) as total_amount
FROM bitcoin_transaction_records
WHERE DATE(created_at) = CURDATE()
GROUP BY transaction_type;

-- 活跃合约统计
SELECT 
  COUNT(*) as free_contracts
FROM free_contract_records
WHERE mining_status = 'active' AND free_contract_end_time > NOW();

SELECT 
  COUNT(*) as paid_contracts
FROM mining_contracts
WHERE contract_status = 'active' AND contract_end_time > NOW();
```

## 故障排查

### 1. 服务无法启动

**检查端口占用**:
```bash
netstat -tuln | grep 8888
```

**检查数据库连接**:
```bash
mysql -u root -pfe2c82a2e5b8e2a3 -e "SELECT 1"
```

**检查Redis连接**:
```bash
redis-cli ping
```

### 2. 定时任务未执行

**查看PM2日志**:
```bash
pm2 logs bitcoin-backend --lines 500
```

**检查系统时间**:
```bash
date
```

### 3. API返回错误

**查看最近的错误日志**:
```bash
pm2 logs bitcoin-backend --err --lines 100
```

**检查数据库连接**:
```bash
curl http://localhost:8888/api/health
```

## 安全建议

1. **修改默认端口**: 将8888改为其他端口
2. **配置防火墙**: 只允许必要的IP访问
3. **使用HTTPS**: 配置Nginx反向代理+SSL证书
4. **定期备份**: 数据库和Redis数据定期备份
5. **日志轮转**: 配置PM2日志文件自动清理

## 性能优化建议

1. **Redis缓存**: 已实现60秒缓存挖矿速率
2. **数据库索引**: 已创建必要的索引
3. **连接池**: 使用数据库连接池（已配置）
4. **定时任务错峰**: 返利任务延迟5分钟执行
5. **批量处理**: 余额同步采用批量处理策略

## 下一步优化

- [ ] 配置Nginx反向代理
- [ ] 启用HTTPS
- [ ] 添加监控告警（如Prometheus+Grafana）
- [ ] 配置日志收集系统
- [ ] 实现服务高可用（负载均衡）

---

📝 **注意**: 完整的实现说明和架构设计请参考 [BALANCE_SYSTEM_IMPLEMENTATION.md](BALANCE_SYSTEM_IMPLEMENTATION.md)
