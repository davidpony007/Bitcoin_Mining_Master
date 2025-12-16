#!/bin/bash
# PM2 状态检查脚本 - Bitcoin Mining Master

cd "$(dirname "$0")/../../backend"

echo "📋 Bitcoin Mining Master 服务状态"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 显示进程列表
pm2 list

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "💾 内存使用："
pm2 describe bmm-api | grep -E "(memory|cpu)" || true

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔄 重启统计："
pm2 describe bmm-api | grep -E "restart" || true

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "⏱️  运行时长："
pm2 describe bmm-api | grep -E "uptime" || true
