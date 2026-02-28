#!/bin/bash

# Google Play Billing 后端部署脚本
# 自动上传文件、创建数据库表、重启服务

echo "========================================="
echo "🚀 Google Play Billing 后端部署"
echo "========================================="
echo ""

# 服务器信息
SERVER="root@47.79.232.189"
BACKEND_DIR="/root/bitcoin-docker/backend"

# 步骤1: 上传后端文件
echo "📤 步骤1: 上传后端文件..."
scp ../backend/src/services/googlePlayVerifyService.js $SERVER:$BACKEND_DIR/src/services/
scp ../backend/src/routes/payment.js $SERVER:$BACKEND_DIR/src/routes/
echo "✅ 文件上传完成"
echo ""

# 步骤2: 创建数据库表
echo "💾 步骤2: 创建数据库表..."
ssh $SERVER "docker exec -i bitcoin_mysql_prod mysql -uroot -pBitcoin_MySQL_Root_2026!Secure bitcoin_mining_master" < ../backend/src/database/migrations/create_payment_transactions.sql
echo "✅ 数据库表创建完成"
echo ""

# 步骤3: 安装googleapis依赖
echo "📦 步骤3: 安装后端依赖..."
ssh $SERVER "docker exec bitcoin_backend_prod npm install googleapis"
echo "✅ 依赖安装完成"
echo ""

# 步骤4: 复制文件到容器
echo "📋 步骤4: 复制文件到Docker容器..."
ssh $SERVER << 'EOF'
docker cp $BACKEND_DIR/src/services/googlePlayVerifyService.js bitcoin_backend_prod:/app/src/services/
docker cp $BACKEND_DIR/src/routes/payment.js bitcoin_backend_prod:/app/src/routes/
echo "✅ 文件已复制到容器"
EOF
echo ""

# 步骤5: 重启后端服务
echo "🔄 步骤5: 重启后端服务..."
ssh $SERVER "docker restart bitcoin_backend_prod"
echo "✅ 服务已重启"
echo ""

# 步骤6: 查看日志验证
echo "📋 步骤6: 查看启动日志..."
sleep 5
ssh $SERVER "docker logs bitcoin_backend_prod --tail=20"
echo ""

echo "========================================="
echo "✅ 部署完成！"
echo "========================================="
echo ""
echo "⚠️  重要提醒："
echo "1. 请确保已上传 google-service-account.json 到服务器"
echo "2. 在 backend/src/app.js 中注册路由："
echo "   const paymentRoutes = require('./routes/payment');"
echo "   app.use('/api/payment', paymentRoutes);"
echo ""
echo "📝 下一步："
echo "- 构建Release APK: flutter build apk --release"
echo "- 安装到手机: adb install build/app/outputs/flutter-apk/app-release.apk"
echo "- 开始测试购买流程"
echo ""
