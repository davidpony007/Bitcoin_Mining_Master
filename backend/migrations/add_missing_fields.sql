-- 添加缺失的字段到 free_contract_records 表
-- 执行时间: 2026-02-11
-- 目的: 支持新的挖矿收益计算系统

-- 1. 添加 base_hashrate 字段（纯基础算力，不含倍数）
ALTER TABLE free_contract_records 
ADD COLUMN base_hashrate DECIMAL(18, 18) DEFAULT 0.000000000000139000 COMMENT '基础算力（纯基础速率，不含任何倍数）' 
AFTER hashrate;

-- 2. 添加 has_daily_bonus 字段（签到加成标记）
ALTER TABLE free_contract_records 
ADD COLUMN has_daily_bonus TINYINT(1) DEFAULT 0 COMMENT '是否包含签到加成（0=无，1=有1.36倍加成）' 
AFTER base_hashrate;

-- 3. 为已存在的 Daily Check-in Reward 记录回填数据
UPDATE free_contract_records 
SET 
  base_hashrate = COALESCE(hashrate, 0.000000000000139000),
  has_daily_bonus = 1 
WHERE free_contract_type = 'Daily Check-in Reward';

-- 4. 为其他类型的合约回填 base_hashrate
UPDATE free_contract_records 
SET 
  base_hashrate = COALESCE(hashrate, 0.000000000000139000),
  has_daily_bonus = 0 
WHERE free_contract_type != 'Daily Check-in Reward' 
  AND base_hashrate IS NULL;

-- 验证添加结果
SELECT COUNT(*) as total_records,
       SUM(CASE WHEN base_hashrate IS NOT NULL THEN 1 ELSE 0 END) as has_base_hashrate,
       SUM(CASE WHEN has_daily_bonus = 1 THEN 1 ELSE 0 END) as has_bonus
FROM free_contract_records;
