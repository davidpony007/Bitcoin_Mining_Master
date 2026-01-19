#!/bin/bash
# Bitcoin Mining Master - 本地开发环境快速启动脚本
# 包含：SSH 隧道、PM2 后端、Nginx 反向代理

set -e

PROJECT_ROOT="/Users/davidpony/Desktop/工程文件夹/Bitcoin_Mining_Master"
BACKEND_DIR="$PROJECT_ROOT/backend"

echo "🚀 Bitcoin Mining Master - 本地开发环境启动中..."
echo ""

# 1. 检查 SSH 隧道
echo "1️⃣  检查 SSH 隧道..."
TUNNEL_PID=$(ps aux | grep "ssh -N -L 13306:127.0.0.1:3306" | grep -v grep | awk '{print $2}' | head -1)
if [ -n "$TUNNEL_PID" ]; then
    echo "   ✅ SSH 隧道已运行 (PID: $TUNNEL_PID)"
else
    echo "   🔧 建立 SSH 隧道..."
    ssh -N -L 13306:127.0.0.1:3306 -L 16379:127.0.0.1:6379 root@47.79.232.189 &
    sleep 3
    echo "   ✅ SSH 隧道已建立"
fi
echo ""

# 2. 检查本地 Redis
echo "2️⃣  检查本地 Redis..."
if redis-cli ping >/dev/null 2>&1; then
    echo "   ✅ Redis 运行正常"
else
    echo "   ⚠️  Redis 未运行，尝试启动..."
    brew services start redis
    sleep 2
fi
echo ""

# 3. 启动 PM2 后端服务
echo "3️⃣  启动后端服务 (PM2)..."
cd "$BACKEND_DIR"
if pm2 list | grep -q "bitcoin-test"; then
    echo "   🔄 重启现有服务..."
    pm2 restart bitcoin-test
else
    echo "   🆕 启动新服务..."
    pm2 start src/index.js --name bitcoin-test -i 1
fi
echo "   ✅ 后端服务已启动 (端口 8888)"
echo ""

# 4. 启动 Nginx 反向代理
echo "4️⃣  启动 Nginx 反向代理..."
if pgrep -x nginx >/dev/null; then
    echo "   🔄 重新加载 Nginx 配置..."
    brew services restart nginx
else
    echo "   🆕 启动 Nginx..."
    brew services start nginx
fi
sleep 2
echo "   ✅ Nginx 反向代理已启动 (端口 80)"
echo ""

# 5. 健康检查
echo "5️⃣  执行健康检查..."
echo -n "   后端直连 (8888): "
if curl -s http://127.0.0.1:8888/api/health >/dev/null; then
    echo "✅"
else
    echo "❌"
fi

echo -n "   Nginx 代理 (80):  "
if curl -s http://localhost/api/health >/dev/null; then
    echo "✅"
else
    echo "❌"
fi
echo ""

# 6. 显示服务状态
echo "📊 服务状态总览："
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  🔗 SSH 隧道:     MySQL:13306 → 3306"
echo "                   Redis:16379 → 6379"
echo "  📦 Redis (本地): 127.0.0.1:6379"
echo "  ⚙️  PM2 后端:     http://127.0.0.1:8888"
echo "  🌐 Nginx 代理:   http://localhost/api/"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "🎉 所有服务已启动完成！"
echo ""
echo "📝 快速测试命令："
echo "  curl http://localhost/api/health"
echo "  pm2 logs bitcoin-test"
echo "  pm2 monit"
echo ""
