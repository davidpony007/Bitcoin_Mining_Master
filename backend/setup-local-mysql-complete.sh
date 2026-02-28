#!/bin/bash

echo "========================================"
echo "  本地 MySQL 完整配置脚本"
echo "========================================"
echo ""
echo "此脚本将完成以下操作:"
echo "1. 创建数据库 bitcoin_mining_master"
echo "2. 创建用户 bitcoin_mining_master"  
echo "3. 导入云端数据库结构"
echo ""
echo "⚠️  需要 MySQL root 密码"
echo ""

read -p "继续? (yes/no): " confirm
if [ "$confirm" != "yes" ]; then
    echo "已取消"
    exit 0
fi

echo ""
echo "步骤 1/3: 创建数据库和用户..."
echo "请输入 MySQL root 密码:"

mysql -u root -p < "/Users/davidpony/Desktop/Bitcoin Mining Master/backend/setup-local-mysql.sql"

if [ $? -ne 0 ]; then
    echo "❌ 创建数据库/用户失败"
    exit 1
fi

echo "✅ 数据库和用户创建成功"
echo ""

echo "步骤 2/3: 导入数据库结构..."
echo "使用新创建的用户导入..."

mysql -h 127.0.0.1 -u bitcoin_mining_master -pFzFbWmwMptnN3ABE bitcoin_mining_master < "/Users/davidpony/Desktop/Bitcoin Mining Master/backend/cloud-database-schema.sql" 2>&1 | grep -v "insecure"

if [ $? -ne 0 ]; then
    echo "❌ 导入失败"
    exit 1
fi

echo "✅ 数据库结构导入成功"
echo ""

echo "步骤 3/3: 验证结果..."
mysql -h 127.0.0.1 -u bitcoin_mining_master -pFzFbWmwMptnN3ABE -e "USE bitcoin_mining_master; SHOW TABLES;" 2>&1 | grep -v "insecure"

echo ""
echo "======================================"
echo "✅ 本地 MySQL 配置完成！"
echo "======================================"
echo ""
echo "数据库信息:"
echo "  主机: 127.0.0.1"
echo "  端口: 3306"
echo "  数据库: bitcoin_mining_master"
echo "  用户: bitcoin_mining_master"
echo "  密码: FzFbWmwMptnN3ABE"
echo ""
echo "现在可以修改 .env 文件使用本地数据库:"
echo "  DB_HOST=127.0.0.1"
echo ""
