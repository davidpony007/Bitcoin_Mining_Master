#!/bin/bash
# Bitcoin Mining Master - 客户端调试脚本
# 用于查看模拟器日志和调试 API 调用

echo "📱 Bitcoin Mining Master - 客户端调试工具"
echo "=========================================="
echo ""

# 检查设备连接
echo "1️⃣  检查设备连接状态..."
DEVICE=$(adb devices | grep -w "device" | awk '{print $1}' | head -1)
if [ -z "$DEVICE" ]; then
    echo "   ❌ 未检测到设备，请确保模拟器或真机已连接"
    exit 1
else
    echo "   ✅ 已连接设备: $DEVICE"
fi
echo ""

# 检查端口转发
echo "2️⃣  检查端口转发..."
adb reverse tcp:8888 tcp:8888 2>/dev/null
echo "   ✅ 端口转发已设置: localhost:8888 → 宿主机:8888"
echo ""

# 检查后端服务
echo "3️⃣  检查后端服务..."
if curl -s http://localhost:8888/api/health >/dev/null 2>&1; then
    echo "   ✅ 后端服务运行正常"
    curl -s http://localhost:8888/api/health | jq '.' 2>/dev/null || curl -s http://localhost:8888/api/health
else
    echo "   ❌ 后端服务未响应"
fi
echo ""

# 测试延长合约 API
echo "4️⃣  测试延长合约 API..."
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST http://localhost:8888/api/mining-pool/extend-contract \
    -H "Content-Type: application/json" \
    -d '{"user_id": "U2026011910532521846", "hours": 2}')

HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | head -n -1)

if [ "$HTTP_CODE" = "200" ]; then
    echo "   ✅ API 调用成功 (HTTP $HTTP_CODE)"
    echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
else
    echo "   ❌ API 调用失败 (HTTP $HTTP_CODE)"
    echo "$BODY"
fi
echo ""

# 查看应用日志
echo "5️⃣  查看应用日志 (最近50行)..."
echo "   提示: Ctrl+C 退出日志查看"
echo "   ----------------------------------------"
sleep 2
adb logcat -T 50 | grep -E "flutter|bitcoin|mining|contract|API" --color=auto

