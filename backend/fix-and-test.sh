#!/bin/bash
# 完整的后端修复和测试脚本

echo "🔧 开始修复后端服务..."

cd "/Users/davidpony/iCloud Drive (Archive)/Desktop/工程文件夹/Bitcoin_Mining_Master/backend"

# 1. 停止服务
echo "1️⃣  停止现有服务..."
pm2 stop bitcoin-backend
sleep 2

# 2. 清理 Node.js 缓存
echo "2️⃣  清理 Node.js 模块缓存..."
find . -name "*.pid" -delete
rm -rf node_modules/.cache 2>/dev/null || true

# 3. 重新启动服务
echo "3️⃣  重新启动服务..."
pm2 start bitcoin-backend
sleep 5

#4. 等待服务完全启动
echo "4️⃣  等待服务启动..."
for i in {1..10}; do
  if curl -s "http://127.0.0.1:8888/api/health" > /dev/null 2>&1; then
    echo "✅ 服务已启动"
    break
  fi
  echo "   等待中... ($i/10)"
  sleep 2
done

# 5. 创建测试用户
echo "5️⃣  创建测试用户..."
TEST_USER_ID=$(node -e "
const pool = require('./src/config/database_native');
async function test() {
  const conn = await pool.getConnection();
  try {
    const userId = 'U' + Date.now();
    const androidId = 'IOS_TEST_' + Date.now();
    await conn.query(\`
      INSERT INTO user_information 
      (user_id, android_id, invitation_code, country, user_creation_time, user_level, user_points)
      VALUES (?, ?, ?, 'US', NOW(), 1, 0)
    \`, [userId, androidId, userId.substring(0, 8)]);
    console.log(userId);
    conn.release();
  } catch(e) {
    console.error('Error:', e.message);
    conn.release();
  }
  process.exit(0);
}
test();
" 2>&1 | tail -1)

if [ -z "$TEST_USER_ID" ] || [[ "$TEST_USER_ID" == Error* ]]; then
  echo "❌ 创建测试用户失败"
  exit 1
fi

echo "✅ 测试用户ID: $TEST_USER_ID"

# 6. 测试广告挖矿 API
echo ""
echo "6️⃣  测试广告挖矿 API..."
RESULT1=$(curl -s -X POST "http://127.0.0.1:8888/api/mining-pool/extend-contract" \
  -H "Content-Type: application/json" \
  -d "{\"user_id\":\"$TEST_USER_ID\",\"hours\":2}")

echo "响应: $RESULT1"

if echo "$RESULT1" | grep -q '"success":true'; then
  echo "✅ 广告挖矿 API 测试通过!"
else
  echo "❌ 广告挖矿 API 测试失败"
fi

# 7. 测试签到 API
echo ""
echo "7️⃣  测试签到 API..."
RESULT2=$(curl -s -X POST "http://127.0.0.1:8888/api/mining-contracts/checkin" \
  -H "Content-Type: application/json" \
  -d "{\"user_id\":\"$TEST_USER_ID\"}")

echo "响应: $RESULT2"

if echo "$RESULT2" | grep -q '"success":true'; then
  echo "✅ 签到 API 测试通过!"
else
  echo "❌ 签到 API 测试失败"
fi

# 8. 清理测试数据
echo ""
echo "8️⃣  清理测试数据..."
node -e "
const pool = require('./src/config/database_native');
async function cleanup() {
  const conn = await pool.getConnection();
  await conn.query('DELETE FROM free_contract_records WHERE user_id = ?', ['$TEST_USER_ID']);
  await conn.query('DELETE FROM user_information WHERE user_id = ?', ['$TEST_USER_ID']);
  conn.release();
  console.log('✅ 测试数据已清理');
  process.exit(0);
}
cleanup();
" 2>&1

echo ""
echo "🎉 修复完成！现在可以在 iPhone 上重新测试了。"
