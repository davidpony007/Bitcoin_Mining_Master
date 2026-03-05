-- =====================================================
-- bitcoin_transaction_records 表结构完善迁移脚本
-- 执行时机：仅在生产/测试数据库首次部署时执行一次
-- =====================================================

-- 1. 添加 balance_after 列（交易后余额）
ALTER TABLE bitcoin_transaction_records
  ADD COLUMN IF NOT EXISTS balance_after DECIMAL(20, 18) DEFAULT NULL COMMENT '交易后余额（BTC）';

-- 2. 添加 description 列（交易描述）
ALTER TABLE bitcoin_transaction_records
  ADD COLUMN IF NOT EXISTS description VARCHAR(500) DEFAULT NULL COMMENT '交易描述（人类可读）';

-- 3. 补充缺失的 ENUM 值（mining_reward 类型被 balanceSyncTask 使用）
--    若原始列使用 ENUM 且不包含这些值，需扩展；若列允许字符串则跳过
ALTER TABLE bitcoin_transaction_records
  MODIFY COLUMN transaction_type VARCHAR(100) NOT NULL COMMENT '交易类型';

-- 4. 添加 description 索引（便于日志搜索）
CREATE INDEX IF NOT EXISTS idx_transaction_type_user
  ON bitcoin_transaction_records (user_id, transaction_type);

-- 验证表结构
DESCRIBE bitcoin_transaction_records;
