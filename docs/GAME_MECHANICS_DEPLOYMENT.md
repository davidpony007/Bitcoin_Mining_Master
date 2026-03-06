# 游戏机制系统部署指南

## 📋 概述

本文档描述了如何部署和配置比特币挖矿大师的游戏机制系统，包括：
- 等级系统（9级矿工，基于积分）
- 签到系统（每日签到奖励 + 1.36x加成）
- 广告系统（观看广告获得积分）
- 邀请系统（邀请好友获得奖励和里程碑奖励）
- 积分系统（统一的积分交易记录）

## 🗂️ 系统架构

```
┌─────────────────┐
│  Android Client │
└────────┬────────┘
         │ HTTPS
         ↓
┌─────────────────┐
│   Node.js API   │
│  (Express.js)   │
└────────┬────────┘
         │
    ┌────┴────┐
    ↓         ↓
┌───────┐  ┌───────┐
│ MySQL │  │ Redis │
│  持久化 │  │  缓存  │
└───────┘  └───────┘
```

**数据层设计**:
- **MySQL**: 所有持久化数据、配置、审计日志
- **Redis**: 高频缓存、实时计数、临时状态
- **Node.js**: 所有业务逻辑、API 端点、定时任务

## 📦 新增文件清单

### 数据库迁移脚本
```
scripts/migrate/005_add_game_mechanics_tables.sql  (450行)
```

### 后端服务层（4个文件）
```
backend/src/services/levelService.js              (280行)  - 等级和积分管理
backend/src/services/checkInService.js            (330行)  - 签到系统
backend/src/services/adService.js                 (290行)  - 广告系统
backend/src/services/invitationRewardService.js   (280行)  - 邀请奖励系统
```

### API路由层（5个文件）
```
backend/src/routes/levelRoutes.js                 (140行)  - 等级API
backend/src/routes/checkInRoutes.js               (150行)  - 签到API
backend/src/routes/adRoutes.js                    (180行)  - 广告API
backend/src/routes/invitationRoutes.js            (130行)  - 邀请API
backend/src/routes/pointsRoutes.js                (90行)   - 积分API
```

### 配置和任务
```
backend/src/config/redis.js                       (350行)  - Redis客户端配置
backend/src/jobs/scheduledTasks.js                (340行)  - 定时任务
```

### 已修改文件
```
backend/src/index.js                                      - 添加路由注册和服务初始化
backend/src/controllers/authController.js                - device-login 调用邀请奖励
```

**总计**: 新增 10个文件，修改 2个文件，约 2,500+ 行代码

## 🚀 部署步骤

### 第一步：数据库迁移

1. **备份现有数据库**（强烈推荐）
```bash
cd /Users/davidpony/Desktop/Bitcoin\ Mining\ Master
mysql -u root -p -e "CREATE DATABASE bitcoin_mining_backup;"
mysqldump -u root -p bitcoin_mining > backup_$(date +%Y%m%d_%H%M%S).sql
```

2. **执行迁移脚本**
```bash
mysql -u root -p bitcoin_mining < scripts/migrate/005_add_game_mechanics_tables.sql
```

3. **验证表创建**
```sql
USE bitcoin_mining;

-- 检查新表
SHOW TABLES LIKE '%check_in%';
SHOW TABLES LIKE '%ad_watch%';
SHOW TABLES LIKE '%points%';
SHOW TABLES LIKE '%invitation_reward%';
SHOW TABLES LIKE '%level_config%';

-- 检查表结构
DESC user_check_in;
DESC ad_watch_record;
DESC points_transaction;

-- 检查初始配置数据
SELECT * FROM level_config ORDER BY level_number;
SELECT * FROM check_in_reward_config ORDER BY consecutive_days;

-- 检查存储过程
SHOW PROCEDURE STATUS WHERE Db = 'bitcoin_mining' AND Name = 'sp_add_user_points';

-- 检查视图
SHOW FULL TABLES WHERE Table_type = 'VIEW';
```

预期输出：
- 7 张新表
- 1 个存储过程
- 1 个视图
- level_config 有 9 条记录（LV.1-LV.9）
- check_in_reward_config 有 5 条记录（1/3/7/15/30天）

### 第二步：Redis 配置

1. **安装 Redis**（如果还未安装）
```bash
# macOS
brew install redis

# 启动 Redis
brew services start redis

# 测试连接
redis-cli ping
# 应返回: PONG
```

2. **配置环境变量**
编辑 `backend/.env` 文件（如果没有则创建）：
```env
# 数据库配置
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=bitcoin_mining
DB_DIALECT=mysql

# Redis 配置
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

# 服务器配置
PORT=8888
NODE_ENV=development
```

### 第三步：安装依赖

```bash
cd backend
npm install

# 确保这些包已安装
npm list ioredis node-cron
```

预期输出：
```
├── ioredis@5.8.2
└── node-cron@4.2.1
```

### 第四步：启动服务

```bash
cd backend
npm run dev
```

预期日志输出：
```
数据库已同步
开始初始化游戏机制...
✅ Redis 连接成功
✓ 等级配置加载成功
✓ 签到奖励配置加载成功
游戏机制初始化完成！
Server is running on port 8888

========== 启动游戏机制定时任务 ==========
✓ 每日加成过期清理任务已启动（每分钟）
✓ 每日广告计数重置任务已启动（每天凌晨0:00）
✓ 签到数据同步任务已启动（每小时）
✓ 等级缓存预热任务已启动（每天凌晨3:00）
✓ 邀请进度同步任务已启动（每6小时）
✓ 推荐人广告计数同步任务已启动（每小时）
==========================================
```

如果看到这些日志，说明系统启动成功！

## 🧪 功能测试

### 测试 1: 用户注册并邀请（自动获得邀请奖励）

```bash
# 注册新用户A（推荐人）
curl -X POST http://localhost:8888/api/auth/device-login \
  -H "Content-Type: application/json" \
  -d '{
    "android_id": "test_device_a_001",
    "country": "US"
  }'

# 记录返回的 invitation_code，例如: INV20241215120000

# 注册新用户B（被推荐人）
curl -X POST http://localhost:8888/api/auth/device-login \
  -H "Content-Type: application/json" \
  -d '{
    "android_id": "test_device_b_001",
    "referrer_invitation_code": "INV20241215120000",
    "country": "US"
  }'

# 应看到返回中包含 "rewards" 字段，显示推荐人获得 +6 积分
```

### 测试 2: 查询等级信息

```bash
# 替换 {user_id} 为实际的用户ID
curl "http://localhost:8888/api/level/info?user_id=U20241215120000"
```

预期响应：
```json
{
  "success": true,
  "data": {
    "userId": "U20241215120000",
    "level": 1,
    "points": 6,
    "speedMultiplier": 1.0,
    "progressPercentage": 24.0,
    "pointsToNextLevel": 19,
    "currentLevelMinPoints": 0,
    "currentLevelMaxPoints": 25
  }
}
```

### 测试 3: 每日签到

```bash
curl -X POST http://localhost:8888/api/checkin \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "U20241215120000"
  }'
```

预期响应：
```json
{
  "success": true,
  "message": "签到成功",
  "data": {
    "consecutiveDays": 1,
    "pointsRewarded": 4,
    "bonusActivated": true,
    "bonusMultiplier": 1.36,
    "bonusValidUntil": "2024-12-15T14:00:00.000Z",
    "totalPoints": 10,
    "newLevel": 1
  }
}
```

### 测试 4: 观看广告

```bash
curl -X POST http://localhost:8888/api/ad/watch \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "U20241215120000",
    "ad_type": "reward_video",
    "ad_unit_id": "ca-app-pub-xxx",
    "watch_duration": 30,
    "is_completed": true
  }'
```

预期响应：
```json
{
  "success": true,
  "message": "广告观看记录成功",
  "data": {
    "pointsRewarded": 20,
    "todayAdCount": 1,
    "totalPoints": 30,
    "newLevel": 2,
    "referrerReward": null
  }
}
```

### 测试 5: 查询积分历史

```bash
curl "http://localhost:8888/api/points/history?user_id=U20241215120000&page=1&limit=10"
```

预期响应：
```json
{
  "success": true,
  "data": {
    "transactions": [
      {
        "id": 3,
        "userId": "U20241215120000",
        "points": 20,
        "reason": "观看广告奖励",
        "reasonType": "AD_WATCH",
        "createdAt": "2024-12-15T12:05:00.000Z"
      },
      {
        "id": 2,
        "userId": "U20241215120000",
        "points": 4,
        "reason": "连续签到1天",
        "reasonType": "CHECK_IN",
        "createdAt": "2024-12-15T12:02:00.000Z"
      },
      {
        "id": 1,
        "userId": "U20241215120000",
        "points": 6,
        "reason": "邀请新用户奖励",
        "reasonType": "INVITE_NEW",
        "createdAt": "2024-12-15T12:00:00.000Z"
      }
    ],
    "total": 3,
    "page": 1,
    "limit": 10
  }
}
```

### 测试 6: 查询排行榜

```bash
# 等级排行榜
curl "http://localhost:8888/api/level/leaderboard?limit=10"

# 邀请排行榜
curl "http://localhost:8888/api/invitation/leaderboard?limit=10"
```

## 🔧 故障排查

### 问题 1: Redis 连接失败

**症状**: 日志显示 `❌ Redis 错误: connect ECONNREFUSED`

**解决方案**:
```bash
# 检查 Redis 是否运行
redis-cli ping

# 如果没有响应，启动 Redis
brew services start redis

# 或者临时启动
redis-server
```

### 问题 2: MySQL 表不存在

**症状**: 接口返回 `Table 'bitcoin_mining.user_check_in' doesn't exist`

**解决方案**:
```bash
# 重新执行迁移脚本
mysql -u root -p bitcoin_mining < scripts/migrate/005_add_game_mechanics_tables.sql

# 检查表是否创建
mysql -u root -p -e "USE bitcoin_mining; SHOW TABLES LIKE '%check_in%';"
```

### 问题 3: 存储过程调用失败

**症状**: 日志显示 `PROCEDURE bitcoin_mining.sp_add_user_points does not exist`

**解决方案**:
```sql
-- 检查存储过程
SHOW PROCEDURE STATUS WHERE Db = 'bitcoin_mining';

-- 如果不存在，从迁移脚本中单独提取存储过程部分重新执行
-- 参见: scripts/migrate/005_add_game_mechanics_tables.sql (第330-370行)
```

### 问题 4: 用户等级字段不存在

**症状**: `Unknown column 'user_information.user_level'`

**解决方案**:
```sql
-- 检查字段是否存在
DESC user_information;

-- 如果缺失，手动添加
ALTER TABLE user_information
ADD COLUMN user_level INT DEFAULT 1 COMMENT '用户等级' AFTER invitation_code,
ADD COLUMN user_points INT DEFAULT 0 COMMENT '用户积分' AFTER user_level,
ADD COLUMN mining_speed_multiplier DECIMAL(10,4) DEFAULT 1.0000 COMMENT '挖矿速度倍数' AFTER user_points;
```

## 📊 监控指标

### MySQL 性能监控

```sql
-- 检查积分交易表大小
SELECT 
  TABLE_NAME,
  TABLE_ROWS,
  ROUND((DATA_LENGTH + INDEX_LENGTH) / 1024 / 1024, 2) AS `Size (MB)`
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = 'bitcoin_mining'
AND TABLE_NAME IN ('points_transaction', 'user_check_in', 'ad_watch_record')
ORDER BY (DATA_LENGTH + INDEX_LENGTH) DESC;

-- 查看存储过程调用统计
SELECT 
  COUNT(*) as total_transactions,
  SUM(points) as total_points_distributed,
  reason_type,
  DATE(created_at) as date
FROM points_transaction
WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
GROUP BY reason_type, DATE(created_at)
ORDER BY date DESC, total_points_distributed DESC;
```

### Redis 缓存监控

```bash
# 连接到 Redis
redis-cli

# 查看所有键
KEYS *

# 查看特定类型键的数量
KEYS user:level:* | wc -l
KEYS user:checkin:* | wc -l
KEYS user:ad:today:* | wc -l

# 查看内存使用
INFO memory

# 查看每日加成用户数
ZCARD daily:bonus:active

# 退出
exit
```

### 应用层监控

查看日志：
```bash
# 实时日志
tail -f backend/logs/combined.log

# 错误日志
tail -f backend/logs/error.log

# 定时任务日志（过滤）
tail -f backend/logs/combined.log | grep "定时任务"
```

## 📈 性能优化建议

### 1. 数据库优化

```sql
-- 为高频查询字段添加索引
CREATE INDEX idx_points_user_created ON points_transaction(user_id, created_at DESC);
CREATE INDEX idx_checkin_user_date ON user_check_in(user_id, check_in_date DESC);
CREATE INDEX idx_ad_user_created ON ad_watch_record(user_id, created_at DESC);
CREATE INDEX idx_invite_referrer ON invitation_relationship(referrer_user_id);

-- 定期清理旧数据（可选，根据业务需求）
-- 例如：删除3个月前的广告观看记录
DELETE FROM ad_watch_record 
WHERE created_at < DATE_SUB(NOW(), INTERVAL 3 MONTH);
```

### 2. Redis 优化

编辑 `backend/.env`:
```env
# 增加 Redis 最大内存（例如: 256MB）
REDIS_MAX_MEMORY=268435456

# 启用 LRU 淘汰策略
REDIS_MAX_MEMORY_POLICY=allkeys-lru
```

### 3. 定时任务优化

如果服务器负载过高，可以调整定时任务频率：

编辑 `backend/src/jobs/scheduledTasks.js`:
```javascript
// 将每分钟改为每5分钟
cron.schedule('*/5 * * * *', async () => {
  // 每日加成清理
});

// 将每小时改为每2小时
cron.schedule('0 */2 * * *', async () => {
  // 签到数据同步
});
```

## 🔐 安全建议

### 1. API 访问控制

所有敏感 API 都已添加 `authenticate` 中间件，确保只有登录用户可访问：
- ✅ `/api/checkin` - 需要认证
- ✅ `/api/ad/watch` - 需要认证
- ✅ `/api/points/add` - 需要认证 + 管理员权限（TODO）

建议为管理员接口添加角色检查：
```javascript
// backend/src/routes/pointsRoutes.js
const { authenticate, requireRole } = require('../middleware/auth');

router.post('/add', authenticate, requireRole('admin'), async (req, res) => {
  // 手动增加积分
});
```

### 2. 防刷保护

建议添加限流：
```javascript
// backend/src/middleware/rateLimiter.js (示例)
const rateLimit = require('express-rate-limit');

const checkInLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24小时
  max: 1, // 每天只能签到1次
  message: '每天只能签到一次'
});

module.exports = { checkInLimiter };
```

### 3. 数据验证

所有输入都已进行基本验证，建议使用 `joi` 或 `validator` 增强：
```bash
npm install joi
```

## 📝 API 文档

详细的 API 文档请查看：`docs/API_GAME_MECHANICS.md`（待创建）

### 快速参考

| 端点 | 方法 | 描述 | 认证 |
|------|------|------|------|
| `/api/level/info` | GET | 用户等级信息 | ✅ |
| `/api/level/config` | GET | 等级配置列表 | ❌ |
| `/api/level/leaderboard` | GET | 等级排行榜 | ❌ |
| `/api/checkin` | POST | 每日签到 | ✅ |
| `/api/checkin/status` | GET | 签到状态 | ✅ |
| `/api/ad/watch` | POST | 记录广告观看 | ✅ |
| `/api/ad/count` | GET | 今日广告次数 | ✅ |
| `/api/invitation/progress` | GET | 邀请进度 | ✅ |
| `/api/invitation/leaderboard` | GET | 邀请排行榜 | ❌ |
| `/api/points/history` | GET | 积分历史 | ✅ |

## 🎯 下一步

1. **创建详细的 API 文档** - 包含所有端点的请求/响应示例
2. **编写单元测试** - 覆盖所有服务层方法
3. **集成 Android 客户端** - 实现 UI 和 API 调用
4. **添加管理后台** - 监控用户活跃度、积分分布、排行榜等
5. **数据分析** - 统计签到率、广告观看率、邀请转化率

## 📞 联系支持

如遇到问题，请：
1. 检查日志文件：`backend/logs/error.log`
2. 查看 Redis 日志：`redis-cli MONITOR`
3. 查看 MySQL 慢查询：`SHOW PROCESSLIST;`

---

**部署日期**: 2024-12-15  
**版本**: v1.0.0  
**维护人员**: Bitcoin Mining Master Team
