#!/bin/bash

echo "================================"
echo "📱 设备真实Android ID:"
echo "================================"
adb -s WCO7CAC6T8CA99OB shell "settings get secure android_id"
echo ""

echo "================================"
echo "📊 查询最新2条用户记录:"
echo "================================"
ssh root@47.79.232.189 << 'EOF'
docker exec bitcoin_mysql_prod mysql -uroot -p'Bitcoin_MySQL_Root_2026!Secure' bitcoin_mining_master << 'SQL'
SELECT user_id, google_account, android_id, gaid, country 
FROM user_information 
ORDER BY id DESC 
LIMIT 2\G
SQL
EOF

echo ""
echo "================================"
echo "🔍 查看后端最近日志:"
echo "================================"
ssh root@47.79.232.189 "docker logs --tail 30 bitcoin_backend_prod 2>&1" | grep -E "Google Login|android_id|gaid|country" | tail -20
