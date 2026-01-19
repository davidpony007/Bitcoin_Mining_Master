# 比特币挖矿奖励系统实现完成报告

## 实现概述

已完成比特币余额持久化、Redis缓存管理、定时同步任务和下级返利系统的全部功能实现。

## 已完成功能

### 1. 核心定时任务

#### 余额同步任务 (BalanceSyncTask)
- **文件位置**: `backend/src/jobs/balanceSyncTask.js`
- **执行频率**: 每2小时执行一次 (Cron: `0 */2 * * *`)
- **功能**:
  - 查询所有有活跃合约的用户（免费+付费）
  - 计算每个用户自上次更新以来的挖矿收益
  - 更新用户余额到数据库 (user_status.bitcoin_balance)
  - 记录交易日志 (bitcoin_transaction_records, 类型: mining_reward)
  - 更新最后余额更新时间 (last_balance_update_time)
- **手动触发**: `BalanceSyncTask.triggerManually()`

#### 推荐返利任务 (ReferralRebateTask)
- **文件位置**: `backend/src/jobs/referralRebateTask.js`
- **执行频率**: 每2小时+5分钟执行一次 (Cron: `5 */2 * * *`)
- **功能**:
  - 查询所有有下级用户的推荐人
  - 计算每个下级在过去2小时内的广告合约挖矿收益
  - 计算时间交集：合约生效时间段 ∩ [当前时间-2h, 当前时间]
  - 应用20%返利率
  - 更新推荐人余额
  - 记录返利交易 (transaction_type: referral_rebate)
- **重要规则**: 
  - 仅计算广告合约 (ad free contract) 的收益
  - 不包括签到、邀请、绑定推荐人合约
- **手动触发**: `ReferralRebateTask.triggerManually()`

### 2. 实时余额API

#### 余额路由 (balanceRoutes)
- **文件位置**: `backend/src/routes/balanceRoutes.js`
- **路由前缀**: `/api/balance`

**API端点**:

1. **GET /api/balance/realtime/:userId**
   - 获取用户实时余额（数据库余额 + 增量挖矿收益）
   - 返回:
     ```json
     {
       "balance": 0.00000000000123,
       "speedPerSecond": 0.00000000000139,
       "lastUpdateTime": "2024-01-20T10:00:00.000Z",
       "incrementalRevenue": 0.00000000000024,
       "nextSyncIn": 6500
     }
     ```

2. **GET /api/balance/mining-speed/:userId**
   - 仅获取挖矿速率（轻量级查询）
   - 返回: `{ "speedPerSecond": 0.00000000000139 }`

3. **POST /api/balance/clear-cache/:userId**
   - 清除用户挖矿速率缓存
   - 用途: 用户合约变更时调用，确保下次查询重新计算

### 3. Redis缓存系统

#### Redis方法扩展
- **文件位置**: `backend/src/config/redis.js`
- **新增方法**:
  ```javascript
  async setMiningSpeed(userId, speedPerSecond, ttl = 60)
  async getMiningSpeed(userId) // 返回 float 或 null
  async deleteMiningSpeed(userId)
  ```
- **缓存策略**:
  - TTL: 60秒自动过期
  - Key格式: `mining_speed:${userId}`
  - 服务降级: Redis不可用时自动跳过缓存

### 4. 实时余额服务

#### RealtimeBalanceService
- **文件位置**: `backend/src/services/realtimeBalanceService.js`
- **核心方法**:
  1. `calculateUserPerSecondRevenue(userId, useCache)`:
     - 计算用户每秒BTC收益
     - 支持Redis缓存（默认开启）
     - 根据合约类型选择正确的挖矿速率:
       * 有签到合约: 使用 finalSpeedWithBonus (含1.36x)
       * 无签到合约: 使用 finalSpeedWithoutBonus
  
  2. `getUserBalance(userId)`:
     - 获取数据库余额
     - 计算增量收益 = speedPerSecond × (当前时间 - 上次更新时间)
     - 返回实时余额 = 数据库余额 + 增量收益
  
  3. `clearUserCache(userId)`:
     - 清除用户挖矿速率缓存

### 5. 数据库结构更新

#### 新增字段
- **表**: user_status
- **字段**: last_balance_update_time
  - 类型: TIMESTAMP
  - 默认: CURRENT_TIMESTAMP
  - 用途: 记录余额上次同步时间，用于计算增量收益

#### 新增索引
- `idx_contract_mining_status`: (user_id, mining_status, free_contract_end_time)
- `idx_contract_type_time`: (user_id, free_contract_type, free_contract_creation_time, free_contract_end_time)
- `idx_invitation_referrer`: (referrer_user_id)

### 6. 系统集成

#### 主程序修改
- **文件位置**: `backend/src/index.js`
- **新增引用**:
  ```javascript
  const balanceRoutes = require('./routes/balanceRoutes');
  const BalanceSyncTask = require('./jobs/balanceSyncTask');
  const ReferralRebateTask = require('./jobs/referralRebateTask');
  ```
- **路由注册**:
  ```javascript
  app.use('/api/balance', balanceRoutes);
  ```
- **任务启动**:
  ```javascript
  BalanceSyncTask.start();
  ReferralRebateTask.start();
  ```

## 系统架构设计

### 客户端实现方案
```javascript
// 前端实时余额计算逻辑
class MiningBalanceManager {
  constructor() {
    this.dbBalance = 0;           // 数据库余额
    this.speedPerSecond = 0;      // 挖矿速率
    this.lastUpdateTime = null;   // 上次更新时间
    this.syncInterval = null;     // 同步定时器
  }

  // 初始化：从服务器获取最新数据
  async init(userId) {
    const response = await fetch(`/api/balance/realtime/${userId}`);
    const data = await response.json();
    
    this.dbBalance = data.balance;
    this.speedPerSecond = data.speedPerSecond;
    this.lastUpdateTime = new Date(data.lastUpdateTime);
    
    // 启动30秒同步
    this.startSync(userId);
  }

  // 获取当前余额（本地计算）
  getCurrentBalance() {
    const now = new Date();
    const elapsedSeconds = (now - this.lastUpdateTime) / 1000;
    const incrementalRevenue = this.speedPerSecond * elapsedSeconds;
    return this.dbBalance + incrementalRevenue;
  }

  // 每30秒从服务器同步
  startSync(userId) {
    this.syncInterval = setInterval(async () => {
      const response = await fetch(`/api/balance/realtime/${userId}`);
      const data = await response.json();
      
      this.dbBalance = data.balance;
      this.speedPerSecond = data.speedPerSecond;
      this.lastUpdateTime = new Date(data.lastUpdateTime);
    }, 30000); // 30秒
  }

  // 用户激活合约后清除缓存
  async onContractActivated(userId) {
    await fetch(`/api/balance/clear-cache/${userId}`, { method: 'POST' });
  }
}
```

### 服务端架构流程

```
客户端请求余额
    ↓
balanceRoutes: GET /api/balance/realtime/:userId
    ↓
RealtimeBalanceService.getUserBalance()
    ↓
查询 user_status 获取:
  - bitcoin_balance (数据库余额)
  - last_balance_update_time (上次更新时间)
    ↓
RealtimeBalanceService.calculateUserPerSecondRevenue()
    ↓
Redis缓存检查 (key: mining_speed:{userId}, TTL: 60s)
    ├─ 命中 → 返回缓存速率
    └─ 未命中 → 计算并缓存
        ↓
        查询用户信息 (country_id, level)
        ↓
        查询活跃合约 (免费+付费)
        ↓
        levelService.calculateMiningSpeed()
        ↓
        判断是否有签到合约:
          ├─ 有 → 使用 finalSpeedWithBonus (1.36x)
          └─ 无 → 使用 finalSpeedWithoutBonus
        ↓
        缓存到Redis (60秒)
    ↓
计算增量收益 = speedPerSecond × (当前时间 - 上次更新时间)
    ↓
返回: { balance: dbBalance + 增量, speedPerSecond, ... }
```

### 定时任务执行流程

```
Cron: 0 */2 * * * (每2小时整点)
    ↓
BalanceSyncTask.start()
    ↓
getActiveUsers(): 查询所有活跃合约用户
    ↓
对每个用户:
  settleUserRewards(userId)
    ↓
    计算挖矿速率 (RealtimeBalanceService)
    ↓
    计算增量收益 = 速率 × (当前时间 - 上次更新时间)
    ↓
    更新 user_status:
      - bitcoin_balance += 增量
      - last_balance_update_time = NOW()
    ↓
    插入 bitcoin_transaction_records:
      - transaction_type: 'mining_reward'
      - amount: 增量收益

---

Cron: 5 */2 * * * (每2小时+5分钟)
    ↓
ReferralRebateTask.start()
    ↓
查询所有推荐人 (invitation_relationship)
    ↓
对每个推荐人:
  calculateAndDistributeRebate(referrerId)
    ↓
    查询所有下级用户
    ↓
    对每个下级:
      查询广告合约 (free_contract_type = 'ad free contract')
      ↓
      过滤条件:
        - mining_status = 'active'
        - 合约在过去2小时内有生效时间
      ↓
      计算时间交集:
        intersectionStart = MAX(合约开始, 当前-2h)
        intersectionEnd = MIN(合约结束, 当前)
        intersectionSeconds = intersectionEnd - intersectionStart
      ↓
      计算收益 = speedPerSecond × intersectionSeconds × 0.2 (20%返利)
    ↓
    更新推荐人余额:
      user_status.bitcoin_balance += 总返利
    ↓
    插入 bitcoin_transaction_records:
      - transaction_type: 'referral_rebate'
      - amount: 总返利
```

## 关键实现细节

### 1. 挖矿速率计算修正
- **问题**: 所有合约都被应用1.36x签到奖励
- **修复**: 
  - levelService.calculateMiningSpeed() 返回两个速率:
    * finalSpeedWithoutBonus: baseSpeed × levelMultiplier × countryMultiplier
    * finalSpeedWithBonus: finalSpeedWithoutBonus × 1.36
  - 各合约服务使用正确的速率:
    * 签到合约: finalSpeedWithBonus ✓
    * 广告/邀请/绑定推荐人: finalSpeedWithoutBonus ✓

### 2. 推荐返利规则
- **仅计算广告合约收益**:
  ```sql
  WHERE free_contract_type = 'ad free contract'
  ```
- **时间交集计算**:
  ```javascript
  const intersectionStart = Math.max(
    new Date(contract.free_contract_creation_time).getTime(),
    twoHoursAgo.getTime()
  );
  const intersectionEnd = Math.min(
    new Date(contract.free_contract_end_time).getTime(),
    now.getTime()
  );
  const intersectionSeconds = (intersectionEnd - intersectionStart) / 1000;
  ```
- **返利率**: 20%

### 3. 缓存策略
- **缓存内容**: 挖矿速率 (BTC/秒)
- **缓存时长**: 60秒
- **失效场景**:
  - 用户激活新合约
  - 用户合约到期
  - 手动调用清除API
- **降级机制**: Redis不可用时自动跳过缓存，直接计算

### 4. 时区处理
- **数据库**: UTC (timezone: '+00:00')
- **Node.js**: 
  ```javascript
  const now = new Date(); // 自动使用系统时区
  // MySQL比较时使用NOW()，自动处理时区
  ```

## 测试建议

### 1. 手动触发测试
```javascript
// 在Node.js环境中执行
const BalanceSyncTask = require('./src/jobs/balanceSyncTask');
const ReferralRebateTask = require('./src/jobs/referralRebateTask');

// 测试余额同步
await BalanceSyncTask.triggerManually();

// 测试返利发放
await ReferralRebateTask.triggerManually();
```

### 2. API测试
```bash
# 获取实时余额
curl http://localhost:8888/api/balance/realtime/1

# 获取挖矿速率
curl http://localhost:8888/api/balance/mining-speed/1

# 清除缓存
curl -X POST http://localhost:8888/api/balance/clear-cache/1
```

### 3. 数据库验证
```sql
-- 查询活跃合约用户
SELECT DISTINCT user_id
FROM (
  SELECT user_id FROM free_contract_records 
  WHERE mining_status = 'active' AND free_contract_end_time > NOW()
  UNION
  SELECT user_id FROM mining_contracts 
  WHERE contract_status = 'active' AND contract_end_time > NOW()
) AS active_users;

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

-- 检查返利计算
SELECT 
  ir.referrer_user_id,
  COUNT(DISTINCT ir.invited_user_id) as subordinates,
  COUNT(fcr.free_contract_id) as ad_contracts,
  SUM(CASE WHEN fcr.mining_status = 'active' THEN 1 ELSE 0 END) as active_contracts
FROM invitation_relationship ir
LEFT JOIN free_contract_records fcr ON ir.invited_user_id = fcr.user_id 
  AND fcr.free_contract_type = 'ad free contract'
GROUP BY ir.referrer_user_id;
```

## 生产环境部署清单

- [x] 安装依赖: `npm install node-cron`
- [x] 创建 .env 文件，配置数据库和Redis连接
- [x] 数据库表结构更新: 
  - [x] 添加 last_balance_update_time 字段
  - [x] 创建性能优化索引
- [x] 路由注册: `app.use('/api/balance', balanceRoutes)`
- [x] 启动定时任务: `BalanceSyncTask.start()`, `ReferralRebateTask.start()`
- [ ] 监控日志: 确认定时任务按时执行
- [ ] 性能测试: 大量用户场景下的响应时间
- [ ] 负载测试: Redis缓存命中率监控

## 监控指标建议

1. **定时任务监控**:
   - 执行成功/失败次数
   - 处理用户数量
   - 执行耗时
   - 发放奖励总额

2. **API性能监控**:
   - 请求响应时间
   - Redis缓存命中率
   - 数据库查询耗时

3. **业务指标监控**:
   - 活跃合约数量
   - 每小时发放奖励总额
   - 返利发放总额
   - 用户余额增长趋势

## 相关文件清单

### 新增文件
- `backend/src/jobs/balanceSyncTask.js` - 余额同步定时任务
- `backend/src/jobs/referralRebateTask.js` - 推荐返利定时任务
- `backend/src/routes/balanceRoutes.js` - 余额API路由
- `backend/src/config/database_native.js` - 原生MySQL连接池
- `backend/add_balance_sync_fields.sql` - 数据库迁移脚本
- `backend/test-complete-system.js` - 完整系统测试脚本
- `backend/test-server-simple.js` - 简化服务器测试脚本
- `backend/.env` - 环境变量配置

### 修改文件
- `backend/src/index.js` - 注册路由和启动任务
- `backend/src/config/redis.js` - 新增挖矿速率缓存方法
- `backend/src/services/levelService.js` - 修复挖矿速率计算（之前完成）
- 各合约服务文件 - 使用正确的挖矿速率（之前完成）

## 总结

✅ **所有功能已实现并集成到主程序**

系统已具备完整的挖矿奖励发放和余额管理能力:
- 客户端可通过本地计算实现流畅的余额显示
- 服务端每2小时批量持久化所有用户余额
- Redis缓存显著降低数据库负载
- 推荐返利系统准确计算广告合约收益的20%返利
- 所有交易记录完整存档，便于审计和统计

下一步建议: 启动后端服务器，观察定时任务执行日志，验证系统运行状况。
