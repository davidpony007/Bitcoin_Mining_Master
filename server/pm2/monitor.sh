#!/bin/bash
# PM2 监控脚本 - Bitcoin Mining Master

cd "$(dirname "$0")/../../backend"

echo "📊 Bitcoin Mining Master 实时监控"
echo "按 Ctrl+C 退出"
echo ""

# 启动 PM2 实时监控面板
pm2 monit
