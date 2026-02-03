#!/bin/bash
# ================================================================
# 上传更新后的模型文件并重启服务
# ================================================================

SERVER="root@47.79.232.189"
LOCAL_MODEL="/Users/davidpony/Desktop/工程文件夹/Bitcoin_Mining_Master/backend/src/models/userInformation.js"

echo "======================================"
echo "上传userInformation.js模型文件"
echo "======================================"
echo ""

# 上传到服务器临时目录
echo "步骤1: 上传文件到服务器..."
scp $LOCAL_MODEL $SERVER:/root/bitcoin-docker/backend/src/models/userInformation.js
if [ $? -eq 0 ]; then
    echo "✅ 文件上传成功"
else
    echo "❌ 文件上传失败"
    exit 1
fi
echo ""

# 复制到Docker容器
echo "步骤2: 复制到Docker容器..."
ssh $SERVER "docker cp /root/bitcoin-docker/backend/src/models/userInformation.js bitcoin_backend_prod:/app/src/models/userInformation.js"
if [ $? -eq 0 ]; then
    echo "✅ 文件已复制到容器"
else
    echo "❌ 复制到容器失败"
    exit 1
fi
echo ""

# 重启后端服务
echo "步骤3: 重启后端服务..."
ssh $SERVER "docker restart bitcoin_backend_prod"
if [ $? -eq 0 ]; then
    echo "✅ 后端服务重启成功"
else
    echo "❌ 重启失败"
    exit 1
fi
echo ""

# 等待服务启动
echo "等待服务启动..."
sleep 5

# 检查服务状态
echo "检查服务状态..."
ssh $SERVER "docker ps --filter name=bitcoin_backend_prod --format 'table {{.Names}}\t{{.Status}}'"
echo ""

echo "======================================"
echo "✅ 所有操作完成！"
echo "======================================"
echo ""
echo "注意：还需要手动更新以下文件中的 country → country_code："
echo "  - authController.js"
echo "  - multiplierService.js"
echo "  - levelService.js"
echo "  等其他引用了 country 字段的文件"
echo ""
