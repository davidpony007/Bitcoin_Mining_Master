#!/bin/bash
# Bind Referrer Reward合约显示问题排查脚本

echo "========================================="
echo "Bind Referrer Reward 合约显示问题排查"
echo "========================================="
echo ""

# 测试用户ID（最近的被邀请人）
USER_ID="U2026020110271531302"

echo "1️⃣ 检查数据库中的合约记录"
echo "-----------------------------------"
ssh root@47.79.232.189 "docker exec bitcoin_mysql_prod mysql -u bitcoin -p'Bitcoin_DB_Pass_2026!Secure' bitcoin_mining_master -e \"
SELECT id, user_id, free_contract_type, hashrate, mining_status, 
       TIMESTAMPDIFF(SECOND, NOW(), free_contract_end_time) as remaining_seconds
FROM free_contract_records 
WHERE user_id = '$USER_ID'
AND free_contract_type = 'bind referrer free contract';
\" 2>/dev/null"

echo ""
echo "2️⃣ 检查API返回数据"
echo "-----------------------------------"
curl -s "http://47.79.232.189/api/contract-status/my-contracts/$USER_ID" | jq '.data.bindReferrerReward'

echo ""
echo "3️⃣ 完整API响应"
echo "-----------------------------------"
curl -s "http://47.79.232.189/api/contract-status/my-contracts/$USER_ID" | jq '.'

echo ""
echo "========================================="
echo "排查要点："
echo "1. 数据库是否有合约记录？"
echo "2. hashrate是否为0.000000000000139？"
echo "3. API的bindReferrerReward.exists是否为true？"
echo "4. API的bindReferrerReward.isActive是否为true？"
echo "5. API的bindReferrerReward.hashrate是否为'5.5Gh/s'字符串？"
echo "========================================="
