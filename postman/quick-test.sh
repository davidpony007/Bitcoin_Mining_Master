#!/bin/bash
# Bitcoin Mining Master API 快速测试脚本

BASE_URL="http://localhost:8888"
echo "🚀 Bitcoin Mining Master API 快速测试"
echo "========================================"
echo ""

# 1. 健康检查
echo "1️⃣  测试健康检查..."
curl -s "$BASE_URL/api/health" | python3 -m json.tool
echo ""

# 2. 公告信息
echo "2️⃣  测试公告接口..."
curl -s "$BASE_URL/api/public/announcement" | python3 -m json.tool
echo ""

# 3. 系统状态
echo "3️⃣  测试系统状态..."
curl -s "$BASE_URL/api/public/status" | python3 -m json.tool
echo ""

# 4. 用户登录
echo "4️⃣  测试用户登录..."
TOKEN=$(curl -s -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","password":"testpass123"}' | python3 -c "import sys, json; print(json.load(sys.stdin).get('token', ''))")

if [ -n "$TOKEN" ]; then
  echo "✅ 登录成功，Token: ${TOKEN:0:50}..."
else
  echo "❌ 登录失败"
fi
echo ""

# 5. 获取用户列表（需要认证）
echo "5️⃣  测试用户列表（需要认证）..."
if [ -n "$TOKEN" ]; then
  curl -s "$BASE_URL/api/users" \
    -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
else
  echo "⚠️  跳过：需要先登录"
fi
echo ""

# 6. 测试限流
echo "6️⃣  测试限流机制（发送多个快速请求）..."
for i in {1..5}; do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/public/status")
  echo "请求 $i: HTTP $STATUS"
  sleep 0.1
done
echo ""

echo "========================================"
echo "✅ 测试完成！"
echo ""
echo "📊 下一步操作："
echo "1. 打开 Postman 导入测试集合"
echo "2. 导入路径: postman/Bitcoin_Mining_Master_API_Tests.postman_collection.json"
echo "3. 导入环境: postman/Bitcoin_Mining_Master_Local.postman_environment.json"
echo "4. 查看详细文档: postman/README.md"
