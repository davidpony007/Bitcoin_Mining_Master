-- 全面动态倍数系统数据迁移
-- 为现有合约填充 base_hashrate 和 has_daily_bonus 字段

-- 1. 迁移免费合约
UPDATE free_contract_records 
SET 
  base_hashrate = 0.000000000000139,
  has_daily_bonus = CASE 
    WHEN free_contract_type LIKE '%Check-in%' THEN 1 
    ELSE 0 
  END
WHERE base_hashrate IS NULL;

-- 2. 迁移付费合约
UPDATE mining_contracts 
SET base_hashrate = hashrate
WHERE base_hashrate IS NULL;

-- 3. 验证迁移结果
SELECT 
  '免费合约统计' as category,
  free_contract_type,
  COUNT(*) as count,
  MIN(base_hashrate) as min_base,
  MAX(base_hashrate) as max_base,
  SUM(CASE WHEN has_daily_bonus = 1 THEN 1 ELSE 0 END) as with_bonus
FROM free_contract_records
GROUP BY free_contract_type;

SELECT 
  '付费合约统计' as category,
  COUNT(*) as total_contracts,
  MIN(base_hashrate) as min_hashrate,
  MAX(base_hashrate) as max_hashrate
FROM mining_contracts
WHERE base_hashrate IS NOT NULL;
