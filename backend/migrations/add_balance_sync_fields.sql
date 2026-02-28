-- 更新数据库表结构
-- 1. user_status 表增加字段（如果不存在）
ALTER TABLE user_status 
ADD COLUMN last_balance_update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '上次余额更新时间（用于增量计算）';

-- 2. 创建索引优化查询性能（如果已存在会报错但不影响）
CREATE INDEX idx_contract_mining_status 
ON free_contract_records(user_id, mining_status, free_contract_end_time);

CREATE INDEX idx_contract_type_time 
ON free_contract_records(user_id, free_contract_type, free_contract_creation_time, free_contract_end_time);

CREATE INDEX idx_invitation_referrer 
ON invitation_relationship(referrer_user_id);

-- 3. 确保 bitcoin_transaction_records 表有正确的transaction_type
-- transaction_type 可能的值：
--   'mining_reward' - 挖矿奖励（每2小时结算）
--   'referral_rebate' - 下级返利（每2小时结算）
--   'withdrawal' - 提现
--   'deposit' - 充值
--   'transfer' - 转账
