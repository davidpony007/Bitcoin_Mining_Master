#!/bin/bash

echo "🔍 SSH隧道和MySQL连接状态检查"
echo "=================================="
echo ""

# 1. SSH隧道状态
echo "📡 SSH隧道状态:"
SSH_PID=$(ps aux | grep "ssh.*3307.*47.79.232.189" | grep -v grep | awk '{print $2}')
if [ ! -z "$SSH_PID" ]; then
    echo "  ✅ SSH隧道运行中 (PID: $SSH_PID)"
    echo "  📍 47.79.232.189:3306 → 127.0.0.1:3307"
else
    echo "  ❌ SSH隧道未运行"
    echo "  💡 运行: ./setup-ssh-tunnel.sh"
    exit 1
fi

echo ""

# 2. 端口监听状态
echo "🔌 端口监听状态:"
if lsof -i :3307 > /dev/null 2>&1; then
    echo "  ✅ 端口 3307 正在监听"
else
    echo "  ❌ 端口 3307 未监听"
    exit 1
fi

echo ""

# 3. MySQL连接测试
echo "💾 MySQL连接测试:"
node -e "
const mysql = require('mysql2/promise');
(async () => {
  try {
    const conn = await mysql.createConnection({
      host: '127.0.0.1',
      port: 3307,
      user: 'root',
      password: 'fe2c82a2e5b8e2a3',
      database: 'bitcoin_mining_master',
      connectTimeout: 5000
    });
    const [rows] = await conn.execute('SELECT DATABASE() as db, NOW() as time');
    console.log('  ✅ MySQL连接成功');
    console.log('  📊 数据库:', rows[0].db);
    console.log('  ⏰ 服务器时间:', rows[0].time);
    await conn.end();
  } catch (err) {
    console.log('  ❌ MySQL连接失败:', err.message);
    process.exit(1);
  }
})();
"

echo ""

# 4. 后端服务状态
echo "🚀 后端服务状态:"
pm2 list | grep bitcoin-backend > /dev/null 2>&1
if [ $? -eq 0 ]; then
    PM2_STATUS=$(pm2 jlist | jq -r '.[] | select(.name=="bitcoin-backend") | .pm2_env.status')
    echo "  ✅ PM2服务: $PM2_STATUS"
else
    echo "  ❌ PM2服务未运行"
fi

echo ""

# 5. API健康检查
echo "🏥 API健康检查:"
API_HEALTH=$(curl -s http://localhost:8888/api/health)
if [ ! -z "$API_HEALTH" ]; then
    echo "  ✅ API响应正常"
    echo "  $API_HEALTH" | jq '.'
else
    echo "  ❌ API无响应"
fi

echo ""
echo "=================================="
echo "✅ 所有检查完成！"
