-- ======================================
-- 修改 free_contract_records 表的 free_contract_type 枚举值
-- 从旧值修改为新值
-- ======================================

-- 1. 首先更新现有数据
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

-- 2. 修改表结构的ENUM定义
ALTER TABLE free_contract_records 
MODIFY COLUMN free_contract_type ENUM(
  'Free Ad Reward', 
  'Daily Check-in Reward', 
  'Invite Friend Reward', 
  'Bind Referrer Reward'
) NOT NULL COMMENT '免费合约类型';

-- 3. 验证修改结果
SELECT 
  free_contract_type, 
  COUNT(*) as count 
FROM free_contract_records 
GROUP BY free_contract_type;

SELECT 
  COLUMN_TYPE 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = 'bitcoin_mining' 
  AND TABLE_NAME = 'free_contract_records' 
  AND COLUMN_NAME = 'free_contract_type';
