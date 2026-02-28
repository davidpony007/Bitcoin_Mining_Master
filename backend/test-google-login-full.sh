#!/bin/bash

echo "=========================================="
echo "🔍 完整测试 - Google登录设备信息收集"
echo "=========================================="
echo ""
echo "📱 设备真实Android ID:"
adb -s WCO7CAC6T8CA99OB shell "settings get secure android_id"
echo ""
echo "=========================================="
echo "📋 请在设备上进行Google登录..."
echo "⏱️  等待60秒，监控日志..."
echo "=========================================="
echo ""

# 监控Flutter应用日志
timeout 60 adb -s WCO7CAC6T8CA99OB logcat -s flutter:I 2>&1 &
LOGCAT_PID=$!

# 监控后端日志
ssh root@47.79.232.189 "timeout 60 docker logs -f --tail 0 bitcoin_backend_prod 2>&1" &
BACKEND_PID=$!

# 等待60秒
sleep 60

# 终止监控进程
kill $LOGCAT_PID 2>/dev/null
kill $BACKEND_PID 2>/dev/null

echo ""
echo "=========================================="
echo "📊 查询最新用户记录..."
echo "=========================================="
echo ""

ssh root@47.79.232.189 'docker exec bitcoin_mysql_prod mysql -uroot -p"Bitcoin_MySQL_Root_2026!Secure" --default-character-set=utf8mb4 bitcoin_mining_master -e "SELECT user_id, google_account, android_id, gaid, country, register_ip FROM user_information ORDER BY user_creation_time DESC LIMIT 2;"' 2>&1 | grep -v "Using a password"

echo ""
echo "✅ 测试完成"
