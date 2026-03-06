#!/bin/bash
# 查询国家挖矿配置表

echo "=========================================="
echo "国家挖矿速率配置统计"
echo "=========================================="
echo ""

# 统计信息
echo "📊 总体统计:"
docker exec bitcoin_mysql_prod mysql -uroot -p"Bitcoin_MySQL_Root_2026!Secure" --default-character-set=utf8mb4 bitcoin_mining_master -e "
SELECT 
  COUNT(*) as '总国家数',
  COUNT(DISTINCT mining_multiplier) as '倍率等级数',
  MIN(mining_multiplier) as '最低倍率',
  MAX(mining_multiplier) as '最高倍率',
  ROUND(AVG(mining_multiplier), 2) as '平均倍率'
FROM country_mining_config
WHERE is_active = TRUE;
"

echo ""
echo "=========================================="
echo "📈 倍率分布:"
docker exec bitcoin_mysql_prod mysql -uroot -p"Bitcoin_MySQL_Root_2026!Secure" --default-character-set=utf8mb4 bitcoin_mining_master -e "
SELECT 
  CONCAT(mining_multiplier, 'x') as '挖矿倍率',
  COUNT(*) as '国家数量'
FROM country_mining_config
WHERE is_active = TRUE
GROUP BY mining_multiplier
ORDER BY mining_multiplier DESC;
"

echo ""
echo "=========================================="
echo "🌍 亚太地区主要国家:"
docker exec bitcoin_mysql_prod mysql -uroot -p"Bitcoin_MySQL_Root_2026!Secure" --default-character-set=utf8mb4 bitcoin_mining_master -e "
SELECT 
  country_code as '代码',
  country_name as '英文名',
  country_name_cn as '中文名',
  CONCAT(mining_multiplier, 'x') as '倍率'
FROM country_mining_config
WHERE country_code IN ('CN', 'HK', 'TW', 'MO', 'JP', 'KR', 'SG', 'MY', 'TH', 'VN', 'PH', 'ID', 'IN', 'AU', 'NZ')
ORDER BY mining_multiplier DESC, country_code ASC;
"

echo ""
echo "=========================================="
echo "💰 最高倍率国家 (Top 20):"
docker exec bitcoin_mysql_prod mysql -uroot -p"Bitcoin_MySQL_Root_2026!Secure" --default-character-set=utf8mb4 bitcoin_mining_master -e "
SELECT 
  country_code as '代码',
  country_name_cn as '中文名',
  CONCAT(mining_multiplier, 'x') as '倍率'
FROM country_mining_config
WHERE is_active = TRUE
ORDER BY mining_multiplier DESC, country_code ASC
LIMIT 20;
"

echo ""
echo "=========================================="
