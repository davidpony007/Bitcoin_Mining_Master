#!/bin/bash
# 用户创建测试脚本
# 用途：在云服务器上创建测试用户并验证结果

echo "🚀 Bitcoin Mining Master - 用户创建测试"
echo "========================================"
echo ""

# 服务器信息
SERVER="47.79.232.189"
API_URL="http://127.0.0.1:8888/api/users"
DB_USER="bitcoin_mining_master"
DB_PASS="FzFbWmwMptnN3ABE"
DB_NAME="bitcoin_mining_master"

echo "📋 测试计划："
echo "  1. 创建完整信息用户"
echo "  2. 创建最小信息用户"
echo "  3. 创建Android用户"
echo "  4. 创建带邀请码用户"
echo "  5. 测试错误处理"
echo "  6. 验证MySQL数据"
echo ""

read -p "按Enter开始测试..."

# 通过SSH执行测试
ssh root@${SERVER} << 'REMOTE_SCRIPT'

echo ""
echo "1️⃣ 测试完整信息用户"
echo "-------------------"
TIMESTAMP1=$(date +%s)001
echo "User ID: U${TIMESTAMP1}"
RESULT1=$(curl -s -X POST http://127.0.0.1:8888/api/users \
  -H "Content-Type: application/json" \
  -d "{
    \"user_id\": \"U${TIMESTAMP1}\",
    \"invitation_code\": \"INV0000000001\",
    \"email\": \"alice.wang@example.com\",
    \"android_id\": \"abc123def456789012345678901234\",
    \"gaid\": \"12345678-1234-5678-1234-123456789abc\",
    \"register_ip\": \"47.79.232.189\",
    \"country\": \"CN\"
  }")
echo "$RESULT1" | python -m json.tool 2>/dev/null || echo "$RESULT1"

sleep 1

echo ""
echo "2️⃣ 测试最小信息用户"
echo "-------------------"
TIMESTAMP2=$(date +%s)002
echo "User ID: U${TIMESTAMP2}"
RESULT2=$(curl -s -X POST http://127.0.0.1:8888/api/users \
  -H "Content-Type: application/json" \
  -d "{\"user_id\": \"U${TIMESTAMP2}\"}")
echo "$RESULT2" | python -m json.tool 2>/dev/null || echo "$RESULT2"

sleep 1

echo ""
echo "3️⃣ 测试Android用户"
echo "-------------------"
TIMESTAMP3=$(date +%s)003
echo "User ID: U${TIMESTAMP3}"
RESULT3=$(curl -s -X POST http://127.0.0.1:8888/api/users \
  -H "Content-Type: application/json" \
  -d "{
    \"user_id\": \"U${TIMESTAMP3}\",
    \"email\": \"charlie.li@gmail.com\",
    \"android_id\": \"9774d56d682e549c\",
    \"gaid\": \"38400000-8cf0-11bd-b23e-10b96e40000d\",
    \"register_ip\": \"123.56.78.90\",
    \"country\": \"CN\"
  }")
echo "$RESULT3" | python -m json.tool 2>/dev/null || echo "$RESULT3"

sleep 1

echo ""
echo "4️⃣ 测试带邀请码用户"
echo "-------------------"
TIMESTAMP4=$(date +%s)004
echo "User ID: U${TIMESTAMP4}"
RESULT4=$(curl -s -X POST http://127.0.0.1:8888/api/users \
  -H "Content-Type: application/json" \
  -d "{
    \"user_id\": \"U${TIMESTAMP4}\",
    \"invitation_code\": \"INV0000000002\",
    \"email\": \"david.zhang@outlook.com\",
    \"register_ip\": \"203.208.60.1\",
    \"country\": \"US\"
  }")
echo "$RESULT4" | python -m json.tool 2>/dev/null || echo "$RESULT4"

sleep 1

echo ""
echo "5️⃣ 测试错误处理（缺少必填字段）"
echo "-------------------------------"
RESULT5=$(curl -s -X POST http://127.0.0.1:8888/api/users \
  -H "Content-Type: application/json" \
  -d '{"email": "error@example.com", "country": "CN"}')
echo "$RESULT5" | python -m json.tool 2>/dev/null || echo "$RESULT5"

echo ""
echo "6️⃣ 验证MySQL数据"
echo "-------------------"
mysql -u bitcoin_mining_master -pFzFbWmwMptnN3ABE -e "
USE bitcoin_mining_master;
SELECT 
  id,
  user_id,
  LEFT(email, 20) as email,
  country,
  DATE_FORMAT(user_creation_time, '%Y-%m-%d %H:%i:%s') as created
FROM user_information 
ORDER BY user_creation_time DESC 
LIMIT 10;
" 2>/dev/null

echo ""
echo "📊 统计信息"
echo "-----------"
mysql -u bitcoin_mining_master -pFzFbWmwMptnN3ABE -e "
USE bitcoin_mining_master;
SELECT 
  COUNT(*) as '总用户数',
  COUNT(DISTINCT country) as '国家数',
  COUNT(invitation_code) as '有邀请码的用户',
  COUNT(email) as '有邮箱的用户',
  COUNT(android_id) as 'Android用户'
FROM user_information;
" 2>/dev/null

REMOTE_SCRIPT

echo ""
echo "✅ 测试完成！"
echo ""
echo "💡 提示："
echo "  - 可以在宝塔面板查看数据库: http://47.79.232.189:8880"
echo "  - 可以使用Postman导入测试用例进行测试"
echo "  - 详细文档: docs/POSTMAN_COMPLETE_GUIDE.md"
echo ""
