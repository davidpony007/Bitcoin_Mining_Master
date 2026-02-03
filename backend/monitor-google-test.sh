#!/bin/bash
echo "========================================"
echo "🔍 实时监控测试"
echo "========================================"
echo "📱 真实Android ID: $(adb -s WCO7CAC6T8CA99OB shell 'settings get secure android_id')"
echo ""
echo "请在设备上进行Google登录，监控60秒..."
echo ""

# Flutter日志
adb -s WCO7CAC6T8CA99OB logcat -c
timeout 60 adb -s WCO7CAC6T8CA99OB logcat -s flutter:I 2>&1 &

# 后端日志  
timeout 60 ssh root@47.79.232.189 "docker logs -f --tail 0 bitcoin_backend_prod 2>&1" &

wait

echo ""
echo "查询最新记录:"
ssh root@47.79.232.189 "docker exec bitcoin_mysql_prod mysql -uroot -p'Bitcoin_MySQL_Root_2026!Secure' bitcoin_mining_master -e 'SELECT user_id, android_id, gaid, country FROM user_information ORDER BY id DESC LIMIT 2;'"
