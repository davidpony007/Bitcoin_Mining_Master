#!/bin/bash
# 快速启动开发环境

echo "🚀 启动Bitcoin Mining开发环境..."

# 检查Docker是否运行
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker未运行，请先启动Docker Desktop"
    exit 1
fi

# 检查是否已有.env文件
if [ ! -f backend/.env ]; then
    echo "📝 创建环境变量文件..."
    cp .env.example backend/.env
fi

# 启动服务
echo "🐳 启动Docker容器..."
docker-compose up -d

# 等待服务启动
echo "⏳ 等待服务启动..."
sleep 10

# 检查服务状态
echo ""
echo "📊 服务状态："
docker-compose ps

echo ""
echo "✅ 开发环境已启动！"
echo ""
echo "🌐 访问地址："
echo "   后端API: http://localhost:8888/api/health"
echo "   MySQL:   localhost:3306 (用户: bitcoin, 密码: bitcoin_dev_123)"
echo "   Redis:   localhost:6379 (密码: dev_redis_123)"
echo ""
echo "📝 常用命令："
echo "   查看日志: docker-compose logs -f backend"
echo "   停止服务: docker-compose down"
echo "   重启服务: docker-compose restart"
echo ""
