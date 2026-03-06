#!/bin/bash

echo "========================================"
echo "🔍 测试 Google 登录 - GAID & Country"
echo "========================================"
echo ""
echo "请在设备上打开应用并进行Google登录"
echo "监控30秒..."
echo ""

# 清除日志
adb -s WCO7CAC6T8CA99OB logcat -c

# 后台监控Flutter日志
adb -s WCO7CAC6T8CA99OB logcat -s flutter:I 2>&1 | tee /tmp/flutter_final_test.log &
LOGCAT_PID=$!

# 等待30秒
sleep 30

# 停止监控
kill $LOGCAT_PID 2>/dev/null

echo ""
echo "========================================"
echo "📋 关键日志分析:"
echo "========================================"
cat /tmp/flutter_final_test.log | grep -E "步骤|Android ID|GAID|Country|发送参数|API.*Data"

echo ""
echo "========================================"
echo "📊 查询数据库:"
echo "========================================"
ssh root@47.79.232.189 "docker exec bitcoin_mysql_prod mysql -uroot -p'Bitcoin_MySQL_Root_2026!Secure' bitcoin_mining_master -e 'SELECT user_id, android_id, gaid, country FROM user_information ORDER BY id DESC LIMIT 2;'"

echo ""
echo "✅ 测试完成"
