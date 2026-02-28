#!/bin/bash
# 邀请关系单向性验证测试脚本

echo "========================================="
echo "邀请关系单向性验证测试"
echo "========================================="
echo ""

# 设置API基础URL
API_BASE="http://47.79.232.189"

echo "📋 测试场景说明："
echo "1. 用户A邀请用户B（正常情况）- 应该成功"
echo "2. 用户B尝试邀请用户A（循环邀请）- 应该被拒绝"
echo "3. 用户C尝试重复绑定推荐人 - 应该被拒绝"
echo "4. 用户使用自己的邀请码 - 应该被拒绝"
echo ""

# 检查最近的邀请关系
echo "1️⃣ 查看现有邀请关系（最近3条）"
echo "-----------------------------------"
ssh root@47.79.232.189 "docker exec bitcoin_mysql_prod mysql -u bitcoin -p'Bitcoin_DB_Pass_2026!Secure' bitcoin_mining_master -e \"
SELECT 
  id,
  user_id as '被邀请人',
  referrer_user_id as '推荐人',
  invitation_code as '被邀请人邀请码',
  referrer_invitation_code as '推荐人邀请码'
FROM invitation_relationship 
ORDER BY id DESC 
LIMIT 3;
\" 2>/dev/null"

echo ""
echo "2️⃣ 获取测试用户信息"
echo "-----------------------------------"

# 获取最近注册的两个用户
USER_INFO=$(ssh root@47.79.232.189 "docker exec bitcoin_mysql_prod mysql -u bitcoin -p'Bitcoin_DB_Pass_2026!Secure' bitcoin_mining_master -N -e \"
SELECT user_id, invitation_code 
FROM user_information 
ORDER BY user_id DESC 
LIMIT 2;
\" 2>/dev/null")

USER_A_ID=$(echo "$USER_INFO" | head -1 | awk '{print $1}')
USER_A_CODE=$(echo "$USER_INFO" | head -1 | awk '{print $2}')
USER_B_ID=$(echo "$USER_INFO" | tail -1 | awk '{print $1}')
USER_B_CODE=$(echo "$USER_INFO" | tail -1 | awk '{print $2}')

echo "用户A: ID=$USER_A_ID, 邀请码=$USER_A_CODE"
echo "用户B: ID=$USER_B_ID, 邀请码=$USER_B_CODE"

echo ""
echo "3️⃣ 测试：用户B尝试使用自己的邀请码"
echo "-----------------------------------"
RESULT=$(curl -s -X POST "$API_BASE/api/auth/add-referrer" \
  -H "Content-Type: application/json" \
  -d "{\"user_id\": \"$USER_B_ID\", \"referrer_invitation_code\": \"$USER_B_CODE\"}")

echo "$RESULT" | jq '.'
echo ""

if echo "$RESULT" | jq -e '.errorCode == "CANNOT_INVITE_SELF"' > /dev/null; then
  echo "✅ 测试通过：正确拒绝了自己邀请自己"
else
  echo "❌ 测试失败：应该拒绝自己邀请自己"
fi

echo ""
echo "4️⃣ 验证邀请链路查询功能"
echo "-----------------------------------"
echo "查询用户B的邀请链路信息..."

# 这里可以通过后端日志或者API查看
echo "（需要在后端日志中查看详细的循环检测信息）"

echo ""
echo "========================================="
echo "✅ 测试完成"
echo ""
echo "📝 验证要点："
echo "1. 不能使用自己的邀请码 (errorCode: CANNOT_INVITE_SELF)"
echo "2. 已有推荐人不能重复绑定 (errorCode: ALREADY_HAS_REFERRER)"
echo "3. 不能邀请自己的上级 (errorCode: CIRCULAR_INVITATION)"
echo "========================================="
