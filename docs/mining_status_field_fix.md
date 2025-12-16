# 数据库 mining_status 字段修复说明

## 📋 问题说明

数据库中 `mining_contracts` 表的 `mining_status` 字段定义为:
```sql
enum('completed','mining','error','')
```

包含了一个**空字符串 `''`** 枚举值,这是不规范的。

代码中已移除该枚举值,仅保留三个有意义的状态:
```javascript
ENUM('completed', 'mining', 'error')
```

---

## 🔧 数据库修复步骤

### 步骤1: 检查是否有空字符串值

```sql
-- 查询是否有使用空字符串的记录
SELECT COUNT(*) as empty_status_count 
FROM mining_contracts 
WHERE mining_status = '';

-- 查看具体记录
SELECT id, user_id, contract_type, mining_status, contract_creation_time
FROM mining_contracts 
WHERE mining_status = '';
```

### 步骤2: 清理空字符串值(如果存在)

```sql
-- 将空字符串状态改为 'mining' (合理的默认值)
UPDATE mining_contracts 
SET mining_status = 'mining' 
WHERE mining_status = '';

-- 验证是否清理完成
SELECT COUNT(*) FROM mining_contracts WHERE mining_status = '';
-- 应该返回 0
```

### 步骤3: 修改字段定义,移除空字符串

```sql
-- 修改 ENUM 定义,移除空字符串
ALTER TABLE mining_contracts 
MODIFY COLUMN mining_status 
ENUM('completed', 'mining', 'error') 
NOT NULL 
DEFAULT 'mining'
COMMENT '挖矿状态: completed=已完成, mining=挖矿中, error=错误';
```

### 步骤4: 验证修改结果

```sql
-- 查看字段定义
DESCRIBE mining_contracts;

-- 或者
SHOW COLUMNS FROM mining_contracts LIKE 'mining_status';

-- 确认 Type 列显示: enum('completed','mining','error')
```

---

## 📝 完整修复脚本

```sql
-- ============================================
-- mining_contracts 表 mining_status 字段修复脚本
-- 日期: 2025-11-24
-- 说明: 移除空字符串枚举值,规范化状态定义
-- ============================================

USE bitcoin_mining_master;

-- 1. 备份表(安全起见)
CREATE TABLE IF NOT EXISTS mining_contracts_backup_20251124 AS 
SELECT * FROM mining_contracts;

-- 2. 检查空字符串记录数量
SELECT '检查空字符串记录' as step, COUNT(*) as count 
FROM mining_contracts 
WHERE mining_status = '';

-- 3. 清理空字符串值
UPDATE mining_contracts 
SET mining_status = 'mining' 
WHERE mining_status = '';

-- 4. 验证清理结果
SELECT '验证清理结果' as step, COUNT(*) as remaining_empty_count 
FROM mining_contracts 
WHERE mining_status = '';

-- 5. 修改字段定义
ALTER TABLE mining_contracts 
MODIFY COLUMN mining_status 
ENUM('completed', 'mining', 'error') 
NOT NULL 
DEFAULT 'mining'
COMMENT '挖矿状态: completed=已完成, mining=挖矿中, error=错误';

-- 6. 验证字段定义
SHOW COLUMNS FROM mining_contracts LIKE 'mining_status';

-- 7. 显示修复后的统计信息
SELECT 
  mining_status,
  COUNT(*) as count,
  CONCAT(ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM mining_contracts), 2), '%') as percentage
FROM mining_contracts
GROUP BY mining_status
ORDER BY count DESC;

SELECT '修复完成!' as status;
```

---

## ⚠️ 执行前注意事项

### 1. 备份数据库
```bash
# 在执行修复前,先备份整个数据库
mysqldump -u root -p bitcoin_mining_master > backup_before_fix_$(date +%Y%m%d_%H%M%S).sql
```

### 2. 停止应用服务
```bash
# 停止 PM2 服务,避免修复期间数据冲突
pm2 stop all
```

### 3. 测试环境先执行
如果有测试环境,建议先在测试环境执行并验证。

---

## 🚀 执行步骤

### 方式1: 通过 SSH + MySQL 命令行

```bash
# 1. SSH 连接到服务器
ssh root@47.79.232.189

# 2. 备份数据库
mysqldump -u root -p bitcoin_mining_master > ~/backup_mining_contracts_$(date +%Y%m%d).sql

# 3. 登录 MySQL
mysql -u root -p

# 4. 切换到数据库
USE bitcoin_mining_master;

# 5. 执行修复脚本(复制上面的完整脚本)
# ... 粘贴脚本内容 ...

# 6. 退出 MySQL
exit;

# 7. 重启 PM2 服务
cd /www/wwwroot/47.79.232.189/Bitcoin_Mining_Master/backend
pm2 restart all
```

### 方式2: 通过 phpMyAdmin

1. 登录 phpMyAdmin: `http://47.79.232.189:8888/phpmyadmin`
2. 选择 `bitcoin_mining_master` 数据库
3. 点击 `mining_contracts` 表
4. 点击 `SQL` 标签
5. 粘贴完整修复脚本
6. 点击 `执行` 按钮

---

## 🔍 验证修复结果

### 1. 检查字段定义
```sql
SHOW COLUMNS FROM mining_contracts LIKE 'mining_status';
```

**期望结果:**
| Field | Type | Null | Key | Default | Extra |
|-------|------|------|-----|---------|-------|
| mining_status | enum('completed','mining','error') | NO | | mining | |

### 2. 检查数据分布
```sql
SELECT mining_status, COUNT(*) as count
FROM mining_contracts
GROUP BY mining_status;
```

**期望结果:**
| mining_status | count |
|---------------|-------|
| mining | 150 |
| completed | 80 |
| error | 2 |

(不应该有空字符串记录)

### 3. 测试新记录创建
```javascript
// 在应用中测试创建新合约
const contract = await MiningContract.create({
  user_id: 'TEST001',
  contract_type: 'paid contract',
  contract_creation_time: new Date(),
  contract_end_time: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  contract_duration: '720:00:00',
  hashrate: 0.00001,
  mining_status: 'mining'  // 应该成功
});

console.log('创建成功:', contract.id);
```

---

## 🎯 修复后的好处

1. **数据规范化**: 移除无意义的空字符串状态
2. **代码一致性**: 模型定义与数据库完全匹配
3. **减少错误**: 避免空字符串导致的逻辑判断问题
4. **更好的可维护性**: 状态值清晰明确

---

## 📊 状态值含义

修复后的三个状态:

| 状态 | 英文 | 说明 | 使用场景 |
|------|------|------|----------|
| 挖矿中 | mining | 合约正在运行,持续产生收益 | 当前时间 < contract_end_time |
| 已完成 | completed | 合约已到期,停止产生收益 | 当前时间 >= contract_end_time |
| 错误 | error | 合约遇到错误,暂停挖矿 | 支付失败、系统异常等 |

---

## 💡 相关代码更新

### 定时任务更新合约状态

```javascript
// utils/contractStatusUpdater.js
const { Op } = require('sequelize');
const MiningContract = require('../models/miningContract');

// 更新过期合约状态
async function updateExpiredContracts() {
  const now = new Date();
  
  const result = await MiningContract.update(
    { mining_status: 'completed' },
    {
      where: {
        mining_status: 'mining',
        contract_end_time: {
          [Op.lte]: now
        }
      }
    }
  );
  
  console.log(`已更新 ${result[0]} 个过期合约状态`);
  return result[0];
}

module.exports = { updateExpiredContracts };
```

### 状态查询优化

```javascript
// 查询活跃合约(不再需要检查空字符串)
const activeContracts = await MiningContract.findAll({
  where: {
    user_id: 'USER001',
    mining_status: 'mining'  // 只有三个明确的状态
  }
});

// 查询需要处理的异常合约
const errorContracts = await MiningContract.findAll({
  where: {
    mining_status: 'error'
  }
});
```

---

## 🔄 回滚方案(如果需要)

如果修复后发现问题,可以使用备份恢复:

```bash
# 恢复备份
mysql -u root -p bitcoin_mining_master < ~/backup_mining_contracts_20251124.sql

# 或者从备份表恢复
mysql -u root -p bitcoin_mining_master -e "
  DROP TABLE IF EXISTS mining_contracts;
  CREATE TABLE mining_contracts AS SELECT * FROM mining_contracts_backup_20251124;
"
```

---

## ✅ 检查清单

执行前:
- [ ] 已阅读完整说明
- [ ] 已备份数据库
- [ ] 已停止应用服务
- [ ] 已在测试环境验证(如果有)

执行中:
- [ ] 检查空字符串记录数量
- [ ] 清理空字符串值
- [ ] 修改字段定义
- [ ] 验证字段定义正确

执行后:
- [ ] 字段定义不包含空字符串
- [ ] 数据中无空字符串记录
- [ ] 应用可以正常创建新合约
- [ ] 重启应用服务成功
- [ ] 功能测试通过

---

需要我帮你执行这个修复脚本吗? 我可以通过 SSH 连接到你的服务器并执行! 🚀
