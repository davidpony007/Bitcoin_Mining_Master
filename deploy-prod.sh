#!/bin/bash
# 部署到生产环境

SERVER="root@47.79.232.189"
REMOTE_DIR="/root/bitcoin-app"

echo "🚀 部署到生产环境..."

# 确认操作
read -p "确认要部署到生产环境？(yes/no): " confirm
if [ "$confirm" != "yes" ]; then
    echo "❌ 取消部署"
    exit 1
fi

echo "📦 打包代码..."
tar --exclude='node_modules' \
    --exclude='.git' \
    --exclude='logs' \
    --exclude='*.log' \
    -czf bitcoin-app.tar.gz .

echo "📤 上传到服务器..."
scp bitcoin-app.tar.gz $SERVER:/tmp/

echo "🔧 在服务器上部署..."
ssh $SERVER << 'ENDSSH'
cd /root
mkdir -p bitcoin-app
cd bitcoin-app
tar -xzf /tmp/bitcoin-app.tar.gz
rm /tmp/bitcoin-app.tar.gz

# 停止旧服务
docker-compose -f docker-compose.prod.yml down

# 构建新镜像
docker-compose -f docker-compose.prod.yml build

# 启动服务
docker-compose -f docker-compose.prod.yml up -d

# 查看状态
sleep 5
docker-compose -f docker-compose.prod.yml ps

echo ""
echo "✅ 部署完成！"
curl -s http://localhost:8888/api/health
ENDSSH

# 清理本地打包文件
rm bitcoin-app.tar.gz

echo ""
echo "🎉 部署成功！"
echo "访问: http://47.79.232.189:8888/api/health"
