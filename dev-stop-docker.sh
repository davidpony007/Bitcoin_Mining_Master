#!/bin/bash
# 停止开发环境

echo "🛑 停止Bitcoin Mining开发环境..."

docker-compose down

echo "✅ 所有服务已停止"
echo ""
echo "💡 提示："
echo "   如需删除数据: docker-compose down -v"
echo "   如需重新构建: docker-compose build --no-cache"
