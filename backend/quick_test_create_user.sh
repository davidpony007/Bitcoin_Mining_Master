#!/bin/bash
# 快速测试创建用户到云服务器 MySQL
# 使用方法: bash quick_test_create_user.sh

echo "======================================"
echo "🧪 测试创建用户到云服务器 MySQL"
echo "======================================"
echo ""

# 生成测试数据
TIMESTAMP=$(date +%s)
RANDOM_NUM=$RANDOM
USER_ID="USER${TIMESTAMP}${RANDOM_NUM}"
INVITATION_CODE="INV${TIMESTAMP:5:8}"
EMAIL="test${TIMESTAMP}@example.com"
ANDROID_ID="android_${TIMESTAMP}"
GAID="gaid_${TIMESTAMP}"

echo "📝 准备创建的用户信息:"
echo "   用户ID: $USER_ID"
echo "   邀请码: $INVITATION_CODE"
echo "   邮箱: $EMAIL"
echo ""

# 服务器地址
SERVER_URL="http://47.79.232.189:8888"

# 步骤 1: 检查服务器健康状态
echo "🔍 步骤 1: 检查服务器健康状态..."
HEALTH_CHECK=$(curl -s -w "\n%{http_code}" --connect-timeout 5 "${SERVER_URL}/api/health" 2>/dev/null)
HTTP_CODE=$(echo "$HEALTH_CHECK" | tail -n 1)
RESPONSE=$(echo "$HEALTH_CHECK" | head -n -1)

if [ "$HTTP_CODE" = "200" ]; then
    echo "✅ 服务器状态正常"
    echo "   响应: $RESPONSE"
    echo ""
else
    echo "❌ 服务器无响应或异常 (HTTP $HTTP_CODE)"
    echo "   请检查:"
    echo "   1. ssh root@47.79.232.189 'pm2 list'"
    echo "   2. ssh root@47.79.232.189 'netstat -tlnp | grep 8888'"
    echo ""
    exit 1
fi

# 步骤 2: 创建用户
echo "🔍 步骤 2: 创建用户..."
CREATE_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "${SERVER_URL}/api/userInformation" \
  -H "Content-Type: application/json" \
  -d "{
    \"user_id\": \"${USER_ID}\",
    \"invitation_code\": \"${INVITATION_CODE}\",
    \"email\": \"${EMAIL}\",
    \"android_id\": \"${ANDROID_ID}\",
    \"gaid\": \"${GAID}\",
    \"register_ip\": \"192.168.1.100\",
    \"country\": \"US\"
  }" 2>/dev/null)

HTTP_CODE=$(echo "$CREATE_RESPONSE" | tail -n 1)
RESPONSE=$(echo "$CREATE_RESPONSE" | head -n -1)

if [ "$HTTP_CODE" = "201" ] || [ "$HTTP_CODE" = "200" ]; then
    echo "✅ 用户创建成功!"
    echo "   响应: $RESPONSE"
    echo ""
else
    echo "❌ 用户创建失败 (HTTP $HTTP_CODE)"
    echo "   响应: $RESPONSE"
    echo ""
    exit 1
fi

# 步骤 3: 验证用户
echo "🔍 步骤 3: 验证用户是否创建成功..."
sleep 1
VERIFY_RESPONSE=$(curl -s "${SERVER_URL}/api/userInformation" 2>/dev/null)

if echo "$VERIFY_RESPONSE" | grep -q "$USER_ID"; then
    echo "✅ 验证成功! 用户已存在于数据库中"
    echo ""
else
    echo "⚠️  警告: 无法通过API验证用户，但可能已创建成功"
    echo ""
fi

# 步骤 4: 提供后续操作建议
echo "======================================"
echo "✅ 测试完成!"
echo "======================================"
echo ""
echo "📌 创建的用户信息:"
echo "   用户ID: $USER_ID"
echo "   邀请码: $INVITATION_CODE"
echo "   邮箱: $EMAIL"
echo ""
echo "💡 验证数据的方法:"
echo ""
echo "方法 1: 通过 phpMyAdmin 查看"
echo "   http://47.79.232.189:8888/phpmyadmin"
echo "   数据库: bitcoin_mining_master"
echo "   表: user_information"
echo ""
echo "方法 2: 通过 MySQL 命令查询"
echo "   ssh root@47.79.232.189"
echo "   mysql -u root -p"
echo "   USE bitcoin_mining_master;"
echo "   SELECT * FROM user_information WHERE user_id='${USER_ID}';"
echo ""
echo "方法 3: 创建用户状态记录（可选）"
echo "   INSERT INTO user_status (user_id, bitcoin_accumulated_amount, current_bitcoin_balance, total_invitation_rebate, total_withdrawal_amount, last_login_time, user_status)"
echo "   VALUES ('${USER_ID}', 0, 0, 0, 0, NOW(), 'normal');"
echo ""
