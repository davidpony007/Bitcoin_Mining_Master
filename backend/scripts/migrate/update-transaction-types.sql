-- 修改 bitcoin_transaction_records 表的 transaction_type 字段

-- Step 1: 转换为VARCHAR
ALTER TABLE bitcoin_transaction_records MODIFY COLUMN transaction_type VARCHAR(50) NOT NULL;

-- Step 2: 更新现有数据
UPDATE bitcoin_transaction_records SET transaction_type = 'Free Ad Reward' WHERE transaction_type = 'ad free contract';
UPDATE bitcoin_transaction_records SET transaction_type = 'Daily Check-in Reward' WHERE transaction_type = 'daily sign-in free contract';
UPDATE bitcoin_transaction_records SET transaction_type = 'Invite Friend Reward' WHERE transaction_type = 'invitation free contract';
UPDATE bitcoin_transaction_records SET transaction_type = 'contract_4.99' WHERE transaction_type = 'paid contract';

-- Step 3: 改回ENUM，包含所有新类型
ALTER TABLE bitcoin_transaction_records MODIFY COLUMN transaction_type ENUM(
  'Free Ad Reward',
  'Daily Check-in Reward',
  'Invite Friend Reward',
  'Bind Referrer Reward',
  'contract_4.99',
  'contract_6.99',
  'contract_9.99',
  'contract_19.99',
  'withdrawal',
  'subordinate rebate',
  'refund for withdrawal failure'
) NOT NULL;

-- 验证
SELECT DISTINCT transaction_type FROM bitcoin_transaction_records;
