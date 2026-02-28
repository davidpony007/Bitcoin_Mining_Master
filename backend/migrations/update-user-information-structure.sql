-- 修改 user_information 表结构
-- 1. 删除 password 字段
-- 2. 将 country 改为 country_code
-- 3. 添加 country_name_cn 字段
-- 4. 确保 country_multiplier 对应 country_mining_config.mining_multiplier
-- 5. 添加 miner_level_multiplier 字段

USE bitcoin_mining_master;

-- 步骤1: 删除 password 字段（如果存在）
ALTER TABLE user_information DROP COLUMN IF EXISTS password;

-- 步骤2: 将 country 重命名为 country_code
ALTER TABLE user_information CHANGE COLUMN country country_code VARCHAR(32) 
  COMMENT '用户所在国家代码（如：CN, US等）';

-- 步骤3: 添加 country_name_cn 字段
ALTER TABLE user_information ADD COLUMN IF NOT EXISTS country_name_cn VARCHAR(50) 
  DEFAULT NULL 
  COMMENT '国家中文名称（对应 country_mining_config.country_name_cn）'
  AFTER country_code;

-- 步骤4: 添加 miner_level_multiplier 字段
ALTER TABLE user_information ADD COLUMN IF NOT EXISTS miner_level_multiplier DECIMAL(4, 2) 
  DEFAULT 1.00 
  COMMENT '矿工等级挖矿倍率'
  AFTER country_multiplier;

-- 更新索引：删除旧的 country 索引，添加新的 country_code 索引
ALTER TABLE user_information DROP INDEX IF EXISTS idx_country;
ALTER TABLE user_information ADD INDEX idx_country_code (country_code);

-- 根据 country_code 从 country_mining_config 表更新 country_name_cn 和 country_multiplier
UPDATE user_information ui
LEFT JOIN country_mining_config cmc ON ui.country_code = cmc.country_code
SET 
  ui.country_name_cn = cmc.country_name_cn,
  ui.country_multiplier = COALESCE(cmc.mining_multiplier, 1.00)
WHERE ui.country_code IS NOT NULL AND ui.country_code != '';

-- 显示修改后的表结构
SHOW CREATE TABLE user_information;

-- 显示修改结果统计
SELECT 
  COUNT(*) as total_users,
  COUNT(country_code) as users_with_country,
  COUNT(country_name_cn) as users_with_country_name,
  AVG(country_multiplier) as avg_country_multiplier,
  AVG(miner_level_multiplier) as avg_miner_multiplier
FROM user_information;

SELECT 
  country_code,
  country_name_cn,
  country_multiplier,
  COUNT(*) as user_count
FROM user_information
WHERE country_code IS NOT NULL
GROUP BY country_code, country_name_cn, country_multiplier
ORDER BY user_count DESC
LIMIT 20;
