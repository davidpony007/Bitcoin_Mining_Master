#!/bin/bash
# Bitcoin Mining Master - 本地开发环境停止脚本

echo "🛑 Bitcoin Mining Master - 停止本地开发环境..."
echo ""

# 1. 停止 Nginx
echo "1️⃣  停止 Nginx..."
if pgrep -x nginx >/dev/null; then
    brew services stop nginx
    echo "   ✅ Nginx 已停止"
else
    echo "   ℹ️  Nginx 未运行"
fi
echo ""

# 2. 停止 PM2 后端
echo "2️⃣  停止 PM2 后端服务..."
if pm2 list | grep -q "bitcoin-test"; then
    pm2 stop bitcoin-test
    echo "   ✅ 后端服务已停止"
else
    echo "   ℹ️  后端服务未运行"
fi
echo ""

# 3. 关闭 SSH 隧道
echo "3️⃣  关闭 SSH 隧道..."
TUNNEL_PID=$(ps aux | grep "ssh -N -L 13306" | grep -v grep | awk '{print $2}')
if [ -n "$TUNNEL_PID" ]; then
    kill $TUNNEL_PID
    echo "   ✅ SSH 隧道已关闭 (PID: $TUNNEL_PID)"
else
    echo "   ℹ️  SSH 隧道未运行"
fi
echo ""

# 4. 可选：停止本地 Redis（通常保持运行）
echo "4️⃣  本地 Redis 状态..."
if redis-cli ping >/dev/null 2>&1; then
    echo "   ℹ️  Redis 保持运行（如需停止: brew services stop redis）"
else
    echo "   ℹ️  Redis 未运行"
fi
echo ""

echo "✅ 开发环境已停止"
echo ""
echo "💡 提示："
echo "  - 重新启动: ./start-local-dev.sh"
echo "  - 查看 PM2 日志: pm2 logs bitcoin-test"
echo "  - 完全清理 PM2: pm2 delete bitcoin-test"
echo ""
