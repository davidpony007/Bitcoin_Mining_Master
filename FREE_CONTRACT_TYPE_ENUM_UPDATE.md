# Free Contract Type 枚举值修改报告

## 修改时间
2026-02-02

## 修改目的
将 `free_contract_records` 表中的 `free_contract_type` 字段从旧的枚举值修改为更清晰易读的新枚举值。

## 枚举值映射

| 旧值 | 新值 |
|------|------|
| `ad free contract` | `Free Ad Reward` |
| `daily sign-in free contract` | `Daily Check-in Reward` |
| `invitation free contract` | `Invite Friend Reward` |
| `bind referrer free contract` | `Bind Referrer Reward` |

## 修改的文件

### 后端服务文件（src/services/）
1. ✅ `adMiningContractService.js` - 3处修改
2. ✅ `checkInMiningContractService.js` - 4处修改
3. ✅ `invitationMiningContractService.js` - 5处修改
4. ✅ `refereeMiningContractService.js` - 5处修改
5. ✅ `contractRewardService.js` - 4处修改

### 路由文件（src/routes/）
6. ✅ `contractStatusRoutes.js` - 4处SQL查询修改
7. ✅ `miningPoolRoutes.js` - 2处SQL查询修改

### 其他文件
8. ✅ `cleanup-circular-invitations.js` - 1处修改

## 数据库修改步骤

### 1. 临时修改为VARCHAR类型
```sql
ALTER TABLE free_contract_records 
MODIFY COLUMN free_contract_type VARCHAR(50) NOT NULL 
COMMENT '免费合约类型';
```

### 2. 更新现有数据
```sql
UPDATE free_contract_records 
SET free_contract_type = 'Free Ad Reward' 
WHERE free_contract_type = 'ad free contract';

UPDATE free_contract_records 
SET free_contract_type = 'Daily Check-in Reward' 
WHERE free_contract_type = 'daily sign-in free contract';

UPDATE free_contract_records 
SET free_contract_type = 'Invite Friend Reward' 
WHERE free_contract_type = 'invitation free contract';

UPDATE free_contract_records 
SET free_contract_type = 'Bind Referrer Reward' 
WHERE free_contract_type = 'bind referrer free contract';
```

### 3. 恢复为ENUM类型
```sql
ALTER TABLE free_contract_records 
MODIFY COLUMN free_contract_type ENUM(
  'Free Ad Reward', 
  'Daily Check-in Reward', 
  'Invite Friend Reward', 
  'Bind Referrer Reward'
) NOT NULL COMMENT '免费合约类型';
```

## 数据迁移结果

```
free_contract_type          count
Bind Referrer Reward        1
Daily Check-in Reward       1
Free Ad Reward              2
Invite Friend Reward        1
```

**表结构验证**：
```
COLUMN_TYPE: enum('Free Ad Reward','Daily Check-in Reward','Invite Friend Reward','Bind Referrer Reward')
```

## 代码修改详情

### 1. adMiningContractService.js
- 修改 `findOne` 查询条件：`free_contract_type: 'Free Ad Reward'`
- 修改 `create` 语句：`free_contract_type: 'Free Ad Reward'`
- 修改 `getContractStatus` 查询条件

### 2. checkInMiningContractService.js
- 修改 `create` 语句：`free_contract_type: 'Daily Check-in Reward'`
- 修改返回对象中的 `type` 字段
- 修改 `getContractStatus` 查询条件和返回值

### 3. invitationMiningContractService.js
- 修改 `findOne` 查询条件：`free_contract_type: 'Invite Friend Reward'`
- 修改 `create` 语句
- 修改两处返回对象中的 `type` 字段

### 4. refereeMiningContractService.js
- 修改两处 `findOne` 查询条件：`free_contract_type: 'Bind Referrer Reward'`
- 修改 `create` 语句
- 修改两处返回对象中的 `type` 字段

### 5. contractRewardService.js
- 修改 `calculateFreeContractRevenue` 的4次调用
  - Ad Free Contract
  - Daily Sign-in Contract
  - Invitation Contract
  - Bind Referrer Contract

### 6. contractStatusRoutes.js
修改4个SQL查询中的 `WHERE` 条件：
- Daily Check-in: `AND free_contract_type = 'Daily Check-in Reward'`
- Ad Reward: `AND free_contract_type = 'Free Ad Reward'`
- Invite Friend: `AND free_contract_type = 'Invite Friend Reward'`
- Bind Referrer: `AND free_contract_type = 'Bind Referrer Reward'`

### 7. miningPoolRoutes.js
修改2处SQL查询：
- 延长合约查询
- 验证合约查询

### 8. cleanup-circular-invitations.js
修改删除语句：`AND free_contract_type = 'Bind Referrer Reward'`

## 部署过程

### 1. 文件上传
```bash
# 上传所有修改的文件到生产服务器
scp src/services/*.js root@47.79.232.189:/root/bitcoin-docker/backend/src/services/
scp src/routes/*.js root@47.79.232.189:/root/bitcoin-docker/backend/src/routes/
scp cleanup-circular-invitations.js root@47.79.232.189:/root/bitcoin-docker/backend/
```

### 2. 数据库更新
```bash
# 通过SSH执行数据库修改脚本
docker exec bitcoin_mysql_prod mysql -u root -p"***" bitcoin_mining_master < update.sql
```

### 3. 服务重启
```bash
docker compose -f docker-compose.prod.yml restart backend
```

## 验证结果

### ✅ 后端服务启动成功
```
✓ 每日加成过期清理任务已启动
✓ 每日广告计数重置任务已启动
✓ 签到数据同步任务已启动
✓ 等级缓存预热任务已启动
✓ 邀请进度同步任务已启动
✓ 合约奖励发放任务已启动
⚡ 启动实时余额更新服务...
✅ 比特币价格已更新: $77,622.00 USD
```

### ✅ API测试通过
```bash
curl "http://47.79.232.189/api/contract-status/my-contracts/U2026020112193721811"
# 返回正常的合约状态数据
```

### ✅ 数据库状态正常
- 所有旧枚举值已更新为新值
- ENUM类型定义已更新
- 现有合约数据完整

## 影响范围

### 后端影响
- ✅ 所有免费合约创建逻辑已更新
- ✅ 所有合约查询逻辑已更新
- ✅ 所有合约状态返回值已更新
- ✅ 合约奖励计算逻辑已更新

### 前端影响
- ⚠️ 前端可能需要更新以显示新的枚举值名称
- ⚠️ 如果前端硬编码了旧的枚举值，需要同步更新

### 数据库影响
- ✅ 现有数据已全部迁移
- ✅ 表结构已更新为新的ENUM定义
- ✅ 数据完整性验证通过

## 回滚方案

如需回滚，执行以下步骤：

### 1. 还原数据库
```sql
-- 改为VARCHAR
ALTER TABLE free_contract_records MODIFY COLUMN free_contract_type VARCHAR(50) NOT NULL;

-- 还原数据
UPDATE free_contract_records SET free_contract_type = 'ad free contract' WHERE free_contract_type = 'Free Ad Reward';
UPDATE free_contract_records SET free_contract_type = 'daily sign-in free contract' WHERE free_contract_type = 'Daily Check-in Reward';
UPDATE free_contract_records SET free_contract_type = 'invitation free contract' WHERE free_contract_type = 'Invite Friend Reward';
UPDATE free_contract_records SET free_contract_type = 'bind referrer free contract' WHERE free_contract_type = 'Bind Referrer Reward';

-- 还原ENUM
ALTER TABLE free_contract_records MODIFY COLUMN free_contract_type ENUM('ad free contract', 'daily sign-in free contract', 'invitation free contract', 'bind referrer free contract') NOT NULL;
```

### 2. 还原代码
```bash
# 从Git回滚到上一个版本
git revert <commit-hash>
# 重新部署
```

## 注意事项

1. **向后兼容性**：新枚举值与旧枚举值完全不兼容，必须同时更新数据库和代码
2. **前端同步**：如果前端代码中硬编码了枚举值，需要同步更新
3. **测试环境**：建议在测试环境充分测试后再部署到生产环境
4. **数据备份**：修改前已备份数据库

## 后续建议

1. **前端更新**：检查前端代码是否需要同步更新枚举值
2. **文档更新**：更新API文档中的枚举值说明
3. **监控告警**：关注生产环境日志，确认无异常
4. **性能监控**：观察修改后的查询性能

## 总结

✅ **修改成功完成**
- 8个后端文件已更新
- 5条数据记录已迁移
- 数据库表结构已更新
- 后端服务运行正常
- API响应正常

此次修改将免费合约类型从技术性的命名改为更具可读性的展示名称，提升了代码可维护性和用户体验。
