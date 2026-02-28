#!/bin/bash
# 测试设备登录API

echo "🧪 测试设备登录API"
echo "===================="
echo ""

# 测试数据
ANDROID_ID="test_device_$(date +%s)"
GAID="00000000-0000-0000-0000-000000000000"
COUNTRY="CN"

echo "📱 测试参数:"
echo "   android_id: $ANDROID_ID"
echo "   gaid: $GAID"
echo "   country: $COUNTRY"
echo ""

echo "📤 发送请求..."
curl -X POST http://47.79.232.189:3000/api/auth/device-login \
  -H "Content-Type: application/json" \
  -d "{
    \"android_id\": \"$ANDROID_ID\",
    \"gaid\": \"$GAID\",
    \"country\": \"$COUNTRY\"
  }" \
  -w "\n\n状态码: %{http_code}\n" \
  -s | jq '.'

echo ""
echo "📊 查询数据库验证..."
ssh root@47.79.232.189 "docker exec bitcoin_mysql_prod mysql -uroot -p\"Bitcoin_MySQL_Root_2026!Secure\" --default-character-set=utf8mb4 bitcoin_mining_master -e \"SELECT user_id, android_id, gaid, country, register_ip FROM user_information WHERE android_id = '$ANDROID_ID';\"" 2>&1 | grep -v "Using a password"
