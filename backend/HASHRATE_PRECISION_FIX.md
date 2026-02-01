# Hashrate精度修复说明

## 问题背景

之前的实现中，`free_contract_records`表的`hashrate`字段存储的是前端显示值（5.5Gh/s），但这个值被直接用于挖矿收益计算，导致收益计算错误。

## 问题详情

- **错误实现**：
  - 数据库存储：`hashrate = 5.5`（Gh/s显示值）
  - 挖矿计算：每秒增加 5.5 BTC（错误！）
  - 实际应该：每秒增加 0.000000000000139 BTC

- **正确的理解**：
  - `5.5Gh/s` 只是前端显示的友好值
  - 实际挖矿算力：`0.000000000000139 BTC/s`
  - 比例关系：`5.5Gh/s ≈ 0.000000000000139 BTC/s`

## 修复方案

### 1. 数据库层面

```sql
-- 修改字段类型以支持高精度小数
ALTER TABLE free_contract_records 
MODIFY COLUMN hashrate DECIMAL(30,18) 
COMMENT '挖矿算力（BTC/s，实际每秒BTC收益）';

-- 更新现有数据
UPDATE free_contract_records 
SET hashrate = 0.000000000000139 
WHERE free_contract_type IN ('invitation free contract', 'bind referrer free contract');
```

### 2. 后端服务层面

**invitationMiningContractService.js** 和 **refereeMiningContractService.js**：

```javascript
// 修复前：
const hashrateGhs = speedInfo.baseHashrateGhs * speedInfo.levelMultiplier * speedInfo.countryMultiplier;
await FreeContractRecord.create({
  hashrate: hashrateGhs,  // 错误：存储5.5
  ...
});

// 修复后：
const actualHashrate = speedInfo.finalSpeedWithoutBonus;  // 0.000000000000139 BTC/s
const displayHashrateGhs = speedInfo.baseHashrateGhs * speedInfo.levelMultiplier * speedInfo.countryMultiplier;
await FreeContractRecord.create({
  hashrate: actualHashrate,  // 正确：存储实际BTC/s
  ...
});
```

### 3. API返回层面

**contractStatusRoutes.js**：

```javascript
// 添加转换函数：将BTC/s转换为Gh/s显示
const btcToGhs = (btcPerSecond) => {
  if (!btcPerSecond || btcPerSecond === 0) return '0Gh/s';
  const ghs = (btcPerSecond / 0.000000000000139) * 5.5;
  return ghs.toFixed(1) + 'Gh/s';
};

// API返回时转换
inviteFriendReward: {
  hashrate: btcToGhs(contract.hashrate),  // 返回 "5.5Gh/s"
  ...
}
```

## 数据流向

```
前端显示值 ←─── API转换 ←─── 数据库实际值 ←─── 创建合约计算
  5.5Gh/s         btcToGhs()   0.000000000000139    finalSpeedWithoutBonus
                                      ↓
                              挖矿收益计算
                          (每秒增加 BTC)
```

## 影响范围

### 修复的文件
1. `backend/src/services/invitationMiningContractService.js`
2. `backend/src/services/refereeMiningContractService.js`
3. `backend/src/routes/contractStatusRoutes.js`

### 修复的合约类型
- `invitation free contract` (Invite Friend Reward)
- `bind referrer free contract` (Bind Referrer Reward)

### 不受影响的合约
- `daily sign-in free contract` (Daily Check-in) - 继续显示 7.5Gh/s
- `ad free contract` (Free Ad Reward) - 继续显示 5.5Gh/s
- 付费合约 - 不受影响

## 验证方法

### 1. 检查数据库
```sql
SELECT id, user_id, free_contract_type, hashrate, mining_status 
FROM free_contract_records 
WHERE free_contract_type IN ('invitation free contract', 'bind referrer free contract')
LIMIT 5;
```
**预期结果**：`hashrate = 0.000000000000139000`

### 2. 检查API返回
```bash
curl "http://47.79.232.189/api/contract-status/my-contracts/USER_ID" | jq '.data.inviteFriendReward.hashrate'
```
**预期结果**：`"5.5Gh/s"`

### 3. 检查挖矿速率
```bash
curl "http://47.79.232.189/api/balance/mining-speed/USER_ID" | jq '.data.speedPerSecond'
```
**预期结果**：`1.39E-13` (= 0.000000000000139)

### 4. 检查余额增长
```bash
curl "http://47.79.232.189/api/balance/realtime/USER_ID" | jq '.data | {balance, speedPerSecond}'
```
**预期结果**：`speedPerSecond` 约为 `1.39E-13`

## 注意事项

1. **字段精度**：必须使用 `DECIMAL(30,18)` 才能存储 0.000000000000139
2. **历史数据**：已有的hashrate=5.5的记录需要手动更新
3. **前端兼容**：前端代码无需修改，API返回格式保持不变
4. **挖矿计算**：`realtimeBalanceService.js` 直接使用数据库的hashrate值，现在是正确的

## 部署步骤

1. 停止后端服务（可选，建议在低峰期）
2. 执行数据库迁移脚本：`migrations/fix-hashrate-precision.sql`
3. 更新后端代码并重新构建镜像
4. 重启后端服务
5. 验证API返回和挖矿计算

## 回滚方案

如需回滚（不推荐，会导致收益计算错误）：

```sql
ALTER TABLE free_contract_records 
MODIFY COLUMN hashrate DECIMAL(10,2);

UPDATE free_contract_records 
SET hashrate = 5.50 
WHERE free_contract_type IN ('invitation free contract', 'bind referrer free contract');
```

## 修复日期

- **2026-02-01**：完成修复并部署到生产环境
- **影响用户**：所有使用邀请奖励合约的用户
- **修复人员**：开发团队

---

**总结**：此次修复确保了挖矿收益计算使用实际的BTC/s算力，而前端继续显示友好的Gh/s值。这是一个关键的精度修复，影响所有邀请奖励相关的收益计算。
