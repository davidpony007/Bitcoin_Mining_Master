#!/bin/bash
# 测试邀请关系API返回推荐人邀请码

echo "========================================="
echo "测试推荐人邀请码显示功能"
echo "========================================="
echo ""

API_BASE="http://47.79.232.189"

# 获取有推荐人的用户ID
echo "1️⃣ 查询有推荐人的用户"
echo "-----------------------------------"
USER_WITH_REFERRER=$(ssh root@47.79.232.189 "docker exec bitcoin_mysql_prod mysql -u bitcoin -p'Bitcoin_DB_Pass_2026!Secure' -D bitcoin_mining_master -N -e \"
SELECT user_id FROM invitation_relationship ORDER BY id DESC LIMIT 1;
\" 2>/dev/null")

echo "用户ID: $USER_WITH_REFERRER"
echo ""

# 调用API获取邀请关系信息
echo "2️⃣ 调用 /api/auth/invitation-info 接口"
echo "-----------------------------------"
RESPONSE=$(curl -s "$API_BASE/api/auth/invitation-info?user_id=$USER_WITH_REFERRER")

echo "API响应:"
echo "$RESPONSE" | jq '.'
echo ""

# 提取推荐人邀请码
echo "3️⃣ 验证推荐人邀请码"
echo "-----------------------------------"
REFERRER_CODE=$(echo "$RESPONSE" | jq -r '.data.referrer.invitation_code')

if [ "$REFERRER_CODE" != "null" ] && [ -n "$REFERRER_CODE" ]; then
  echo "✅ 成功获取推荐人邀请码: $REFERRER_CODE"
else
  echo "❌ 未能获取推荐人邀请码"
fi

echo ""
echo "========================================="
echo "测试完成"
echo "========================================="
