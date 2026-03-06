-- =====================================================
-- bitcoin_transaction_records 表结构完善迁移脚本
-- 兼容 MySQL 8.0
-- =====================================================

-- 1. transaction_type: ENUM → VARCHAR(100)，支持 mining_reward 等新类型
ALTER TABLE bitcoin_transaction_records
  MODIFY COLUMN transaction_type VARCHAR(100) NOT NULL COMMENT '交易类型';

-- 2. transaction_amount: 精度扩展 DECIMAL(18,18) → DECIMAL(20,18)
ALTER TABLE bitcoin_transaction_records
  MODIFY COLUMN transaction_amount DECIMAL(20, 18) NOT NULL;

-- 3. transaction_status: ENUM → VARCHAR(20)，支持 pending 状态
ALTER TABLE bitcoin_transaction_records
  MODIFY COLUMN transaction_status VARCHAR(20) NOT NULL DEFAULT 'success';

-- 4. 添加 balance_after 列（交易后余额）
ALTER TABLE bitcoin_transaction_records
  ADD COLUMN balance_after DECIMAL(20, 18) DEFAULT NULL COMMENT '交易后余额（BTC）';

-- 5. 添加 description 列（交易描述）
ALTER TABLE bitcoin_transaction_records
  ADD COLUMN description VARCHAR(500) DEFAULT NULL COMMENT '交易描述（人类可读）';

-- 6. 复合索引
CREATE INDEX idx_txn_user_type
  ON bitcoin_transaction_records (user_id, transaction_type);

-- 验证表结构
DESCRIBE bitcoin_transaction_records;
