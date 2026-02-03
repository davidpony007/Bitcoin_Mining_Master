#!/bin/bash

# =================================================================
# user_information 表结构更新脚本
# =================================================================
# 修改内容：
# 1. 删除 password 字段
# 2. country 改为 country_code  
# 3. 添加 country_name_cn 字段
# 4. country_multiplier 对应 country_mining_config.mining_multiplier
# 5. 添加 miner_level_multiplier 字段
# =================================================================

echo "开始更新 user_information 表结构..."

# 1. 删除 password 字段
echo "步骤1: 删除 password 字段"
docker exec bitcoin_mysql_prod mysql -u root -pBitcoin2024@Secure bitcoin_mining_master -e \
"ALTER TABLE user_information DROP COLUMN IF EXISTS password;"

# 2. 将 country 改为 country_code
echo "步骤2: 将 country 改为 country_code"
docker exec bitcoin_mysql_prod mysql -u root -pBitcoin2024@Secure bitcoin_mining_master -e \
"ALTER TABLE user_information CHANGE COLUMN country country_code VARCHAR(32) COMMENT '用户所在国家代码';"

# 3. 添加 country_name_cn 字段
echo "步骤3: 添加 country_name_cn 字段"
docker exec bitcoin_mysql_prod mysql -u root -pBitcoin2024@Secure bitcoin_mining_master -e \
"ALTER TABLE user_information ADD COLUMN country_name_cn VARCHAR(50) DEFAULT NULL COMMENT '国家中文名称' AFTER country_code;"

# 4. 添加 miner_level_multiplier 字段
echo "步骤4: 添加 miner_level_multiplier 字段"
docker exec bitcoin_mysql_prod mysql -u root -pBitcoin2024@Secure bitcoin_mining_master -e \
"ALTER TABLE user_information ADD COLUMN miner_level_multiplier DECIMAL(4, 2) DEFAULT 1.00 COMMENT '矿工等级挖矿倍率' AFTER country_multiplier;"

# 5. 更新索引
echo "步骤5: 更新索引"
docker exec bitcoin_mysql_prod mysql -u root -pBitcoin2024@Secure bitcoin_mining_master -e \
"ALTER TABLE user_information DROP INDEX IF EXISTS idx_country;"

docker exec bitcoin_mysql_prod mysql -u root -pBitcoin2024@Secure bitcoin_mining_master -e \
"ALTER TABLE user_information ADD INDEX idx_country_code (country_code);"

# 6. 从 country_mining_config 同步数据
echo "步骤6: 同步国家配置数据"
docker exec bitcoin_mysql_prod mysql -u root -pBitcoin2024@Secure bitcoin_mining_master -e \
"UPDATE user_information ui 
LEFT JOIN country_mining_config cmc ON ui.country_code = cmc.country_code
SET 
  ui.country_name_cn = cmc.country_name_cn,
  ui.country_multiplier = COALESCE(cmc.mining_multiplier, 1.00)
WHERE ui.country_code IS NOT NULL AND ui.country_code != '';"

# 7. 显示更新结果
echo "步骤7: 显示更新结果"
docker exec bitcoin_mysql_prod mysql -u root -pBitcoin2024@Secure bitcoin_mining_master -e \
"SELECT 
  COUNT(*) as total_users,
  COUNT(country_code) as users_with_country_code,
  COUNT(country_name_cn) as users_with_country_name,
  AVG(country_multiplier) as avg_country_multiplier,
  AVG(miner_level_multiplier) as avg_miner_multiplier
FROM user_information;"

echo "更新完成！"

# 8. 显示部分用户数据
echo ""
echo "用户数据示例："
docker exec bitcoin_mysql_prod mysql -u root -pBitcoin2024@Secure bitcoin_mining_master -e \
"SELECT 
  user_id,
  country_code,
  country_name_cn,
  country_multiplier,
  miner_level_multiplier
FROM user_information 
WHERE country_code IS NOT NULL
LIMIT 10;"
