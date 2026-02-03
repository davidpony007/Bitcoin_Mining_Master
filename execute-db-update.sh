#!/bin/bash
# ================================================================
# user_information 表完整更新脚本
# ================================================================
# 说明：由于SSH连接不稳定，请手动执行此脚本
# 执行方法：
#   1. 等待几分钟后SSH连接恢复
#   2. chmod +x execute-db-update.sh
#   3. ./execute-db-update.sh
# ================================================================

SERVER="root@47.79.232.189"
DB_PASSWORD="Bitcoin2024@Secure"
DB_NAME="bitcoin_mining_master"

echo "======================================"
echo "开始更新 user_information 表结构"
echo "======================================"
echo ""

# 步骤1: 删除password字段
echo "步骤1/7: 删除password字段..."
ssh $SERVER "docker exec bitcoin_mysql_prod mysql -u root -p${DB_PASSWORD} ${DB_NAME} -e 'ALTER TABLE user_information DROP COLUMN IF EXISTS password;'"
if [ $? -eq 0 ]; then
    echo "✅ password字段已删除"
else
    echo "❌ 删除password字段失败"
fi
echo ""

# 步骤2: 重命名country为country_code
echo "步骤2/7: 重命名country为country_code..."
ssh $SERVER "docker exec bitcoin_mysql_prod mysql -u root -p${DB_PASSWORD} ${DB_NAME} -e \"ALTER TABLE user_information CHANGE COLUMN country country_code VARCHAR(32) COMMENT '用户所在国家代码';\""
if [ $? -eq 0 ]; then
    echo "✅ country已重命名为country_code"
else
    echo "❌ 重命名失败"
fi
echo ""

# 步骤3: 添加country_name_cn字段
echo "步骤3/7: 添加country_name_cn字段..."
ssh $SERVER "docker exec bitcoin_mysql_prod mysql -u root -p${DB_PASSWORD} ${DB_NAME} -e \"ALTER TABLE user_information ADD COLUMN country_name_cn VARCHAR(50) DEFAULT NULL COMMENT '国家中文名称' AFTER country_code;\""
if [ $? -eq 0 ]; then
    echo "✅ country_name_cn字段已添加"
else
    echo "❌ 添加country_name_cn失败"
fi
echo ""

# 步骤4: 添加miner_level_multiplier字段
echo "步骤4/7: 添加miner_level_multiplier字段..."
ssh $SERVER "docker exec bitcoin_mysql_prod mysql -u root -p${DB_PASSWORD} ${DB_NAME} -e \"ALTER TABLE user_information ADD COLUMN miner_level_multiplier DECIMAL(4, 2) DEFAULT 1.00 COMMENT '矿工等级挖矿倍率' AFTER country_multiplier;\""
if [ $? -eq 0 ]; then
    echo "✅ miner_level_multiplier字段已添加"
else
    echo "❌ 添加miner_level_multiplier失败"
fi
echo ""

# 步骤5: 删除旧索引
echo "步骤5/7: 删除旧的country索引..."
ssh $SERVER "docker exec bitcoin_mysql_prod mysql -u root -p${DB_PASSWORD} ${DB_NAME} -e 'ALTER TABLE user_information DROP INDEX IF EXISTS idx_country;'"
if [ $? -eq 0 ]; then
    echo "✅ 旧索引已删除"
else
    echo "⚠️  删除索引失败（可能不存在）"
fi
echo ""

# 步骤6: 添加新索引
echo "步骤6/7: 添加country_code索引..."
ssh $SERVER "docker exec bitcoin_mysql_prod mysql -u root -p${DB_PASSWORD} ${DB_NAME} -e 'ALTER TABLE user_information ADD INDEX idx_country_code (country_code);'"
if [ $? -eq 0 ]; then
    echo "✅ 新索引已添加"
else
    echo "❌ 添加索引失败"
fi
echo ""

# 步骤7: 同步country_mining_config数据
echo "步骤7/7: 从country_mining_config同步数据..."
ssh $SERVER "docker exec bitcoin_mysql_prod mysql -u root -p${DB_PASSWORD} ${DB_NAME} -e \"UPDATE user_information ui LEFT JOIN country_mining_config cmc ON ui.country_code = cmc.country_code SET ui.country_name_cn = cmc.country_name_cn, ui.country_multiplier = COALESCE(cmc.mining_multiplier, 1.00) WHERE ui.country_code IS NOT NULL AND ui.country_code != '';\""
if [ $? -eq 0 ]; then
    echo "✅ 数据已同步"
else
    echo "❌ 数据同步失败"
fi
echo ""

# 显示更新结果
echo "======================================"
echo "显示更新统计..."
echo "======================================"
ssh $SERVER "docker exec bitcoin_mysql_prod mysql -u root -p${DB_PASSWORD} ${DB_NAME} -e \"SELECT COUNT(*) as total_users, COUNT(country_code) as with_code, COUNT(country_name_cn) as with_name, ROUND(AVG(country_multiplier), 2) as avg_multiplier FROM user_information;\""
echo ""

# 显示示例数据
echo "======================================"
echo "最新用户示例："
echo "======================================"
ssh $SERVER "docker exec bitcoin_mysql_prod mysql -u root -p${DB_PASSWORD} ${DB_NAME} -e \"SELECT user_id, country_code, country_name_cn, country_multiplier, miner_level_multiplier FROM user_information ORDER BY user_creation_time DESC LIMIT 5;\""
echo ""

echo "======================================"
echo "✅ 数据库更新完成！"
echo "======================================"
echo ""
echo "下一步："
echo "1. 上传更新后的模型文件"
echo "2. 重启后端服务"
echo ""
