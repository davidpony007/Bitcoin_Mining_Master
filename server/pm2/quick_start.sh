#!/bin/bash
# 一键远程启动 Node 服务脚本（免密版）
# 使用方法：bash quick_start.sh

set -e

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  🚀 Bitcoin Mining Master - 快速启动"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 检查 SSH 连接
echo "🔍 检查服务器连接..."
if ! ssh -o BatchMode=yes -o ConnectTimeout=5 root@47.79.232.189 "exit" 2>/dev/null; then
    echo "❌ 无法连接到服务器，请确保："
    echo "   1. SSH 密钥已配置（运行 ssh-copy-id）"
    echo "   2. 服务器地址正确：47.79.232.189"
    echo "   3. 网络连接正常"
    exit 1
fi
echo "✅ 服务器连接正常"
echo ""

# 远程执行启动命令
echo "🔄 远程重启服务..."
ssh root@47.79.232.189 << 'EOF'
cd /www/wwwroot/47.79.232.189/Bitcoin_Mining_Master

echo "📊 重启前状态："
pm2 list | head -7

echo ""
echo "🔄 正在重启..."
pm2 restart all > /dev/null 2>&1

echo "⏳ 等待服务启动..."
sleep 3

echo ""
echo "📊 重启后状态："
pm2 list | head -7

echo ""
echo "🏥 健康检查："
HEALTH_CHECK=$(curl -s http://127.0.0.1:8888/api/health)
if echo "$HEALTH_CHECK" | grep -q "ok"; then
    echo "✅ 健康检查通过："
    echo "$HEALTH_CHECK" | python -m json.tool 2>/dev/null || echo "$HEALTH_CHECK"
else
    echo "❌ 健康检查失败："
    echo "$HEALTH_CHECK"
    exit 1
fi
EOF

if [ $? -eq 0 ]; then
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  ✅ 启动完成！服务运行正常"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "📝 验证方式："
    echo "   本地测试：curl http://47.79.232.189:8888/api/health"
    echo "   查看日志：ssh root@47.79.232.189 'pm2 logs bmm-api --lines 20'"
    echo "   查看状态：ssh root@47.79.232.189 'pm2 status'"
else
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  ❌ 启动失败，请检查日志"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "🔍 排查方法："
    echo "   ssh root@47.79.232.189 'pm2 logs bmm-api --err --lines 50'"
    exit 1
fi
