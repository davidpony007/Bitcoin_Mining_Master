#!/bin/bash
# PM2 重启脚本 - Bitcoin Mining Master

set -e

echo "🔄 重启 Bitcoin Mining Master 服务..."

cd "$(dirname "$0")/../../backend"

# 重新加载环境变量
if [ -f .env ]; then
    echo "📝 加载 .env 环境变量..."
    export $(cat .env | grep -v '^#' | xargs)
fi

# 优雅重启（0 秒停机）
pm2 reload ../server/pm2/ecosystem.config.js --env production

echo ""
echo "✅ 重启完成！"
pm2 list
