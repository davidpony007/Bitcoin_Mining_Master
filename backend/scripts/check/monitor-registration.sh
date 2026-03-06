#!/bin/bash

echo "========================================"
echo "开始监控新用户注册流程"
echo "========================================"
echo ""
echo "⏳ 监控时间: 30秒"
echo "📱 请在30秒内打开应用并完成注册"
echo ""

# 清空日志
adb -s 10AF5624QZ001QH logcat -c

# 启动后端日志监控（后台）
echo "🔍 启动后端日志监控..."
ssh root@47.79.232.189 'docker logs -f bitcoin_backend_prod 2>&1' | grep --line-buffered -E "(Device Login|完整请求体|提取的字段|android_id|gaid|country)" &
BACKEND_PID=$!

# 等待1秒
sleep 1

# 启动Flutter日志监控（前台）
echo "🔍 启动Flutter日志监控..."
echo ""
timeout 30 adb -s 10AF5624QZ001QH logcat | grep --line-buffered -E "flutter|设备ID|GAID|国家代码|正在通过后端API|deviceLogin" || true

# 停止后端监控
kill $BACKEND_PID 2>/dev/null

echo ""
echo "========================================"
echo "监控结束"
echo "========================================"
