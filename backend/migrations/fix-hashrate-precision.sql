-- 修复hashrate字段精度问题
-- 背景：5.5Gh/s只是前端显示值，实际挖矿算力是0.000000000000139 BTC/s
-- 日期：2026-02-01

-- 1. 修改free_contract_records表的hashrate字段类型
ALTER TABLE free_contract_records 
MODIFY COLUMN hashrate DECIMAL(30,18) DEFAULT 0 
COMMENT '挖矿算力（BTC/s，实际每秒BTC收益）';

-- 2. 更新现有的邀请合约hashrate值（从5.5改为0.000000000000139）
UPDATE free_contract_records 
SET hashrate = 0.000000000000139 
WHERE free_contract_type IN ('invitation free contract', 'bind referrer free contract')
AND hashrate = 5.50;

-- 3. 验证更新结果
SELECT 
  free_contract_type,
  COUNT(*) as count,
  MIN(hashrate) as min_hashrate,
  MAX(hashrate) as max_hashrate
FROM free_contract_records
WHERE free_contract_type IN ('invitation free contract', 'bind referrer free contract')
GROUP BY free_contract_type;

-- 预期结果：
-- invitation free contract: hashrate = 0.000000000000139
-- bind referrer free contract: hashrate = 0.000000000000139

-- 说明：
-- - 前端仍然显示5.5Gh/s（通过API转换）
-- - 后端使用实际的BTC/s值进行挖矿收益计算
-- - 转换公式：BTC/s = (显示Gh/s / 5.5) × 0.000000000000139
