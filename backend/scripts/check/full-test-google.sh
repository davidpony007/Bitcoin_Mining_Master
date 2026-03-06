#!/bin/bash

echo "============================================"
echo "🔍 完整测试 - Google 登录设备信息验证"
echo "============================================"
echo ""
echo "📱 设备系统Android ID (adb): $(adb -s WCO7CAC6T8CA99OB shell 'settings get secure android_id')"
echo "📱 设备信息APP显示的ID: 3b61aef127637ec3"
echo ""
echo "============================================"
echo "请在设备上打开应用并进行Google登录..."
echo "按Enter键开始监控日志（60秒）"
echo "============================================"
read

# 清除日志
adb -s WCO7CAC6T8CA99OB logcat -c

# 启动Flutter日志监控
echo "🔍 监控Flutter日志..."
adb -s WCO7CAC6T8CA99OB logcat -s flutter:I 2>&1 | tee /tmp/google_login_test.log &
LOGCAT_PID=$!

# 启动后端日志监控
echo "🔍 监控后端日志..."
ssh root@47.79.232.189 "docker logs -f --tail 0 bitcoin_backend_prod 2>&1" &
BACKEND_PID=$!

# 等待60秒
sleep 60

# 停止监控
kill $LOGCAT_PID 2>/dev/null
kill $BACKEND_PID 2>/dev/null

echo ""
echo "============================================"
echo "📊 分析Flutter日志:"
echo "============================================"
cat /tmp/google_login_test.log | grep -E "Native|步骤|Android ID|GAID|Country|API.*Data|发送|响应" | head -30

echo ""
echo "============================================"
echo "📊 查询数据库最新记录:"
echo "============================================"
ssh root@47.79.232.189 << 'EOF'
docker exec bitcoin_mysql_prod mysql -uroot -p'Bitcoin_MySQL_Root_2026!Secure' bitcoin_mining_master -e "SELECT user_id, google_account, android_id, gaid, country FROM user_information ORDER BY id DESC LIMIT 2;"
EOF

echo ""
echo "✅ 测试完成"
