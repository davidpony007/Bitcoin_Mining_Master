#!/bin/bash
# PM2 停止脚本 - Bitcoin Mining Master

set -e

echo "🛑 停止 Bitcoin Mining Master 服务..."

cd "$(dirname "$0")/../../backend"

# 停止所有应用
pm2 stop ecosystem.config.js

echo ""
echo "✅ 服务已停止"
pm2 list
