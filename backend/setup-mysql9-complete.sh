#!/bin/bash

echo "========================================"
echo "  MySQL 9.x 用户配置脚本"
echo "========================================"
echo ""
echo "本脚本将："
echo "1. 创建 bitcoin_mining_master 数据库"
echo "2. 创建 bitcoin_mining_master 用户（使用 MySQL 9.x 兼容的认证方式）"
echo "3. 导入数据库结构"
echo ""

read -p "请输入 MySQL root 密码: " -s ROOT_PASSWORD
echo ""
echo ""

# 步骤 1: 创建用户和数据库
echo "步骤 1/3: 创建数据库和用户..."
mysql -u root -p"$ROOT_PASSWORD" < "/Users/davidpony/Desktop/Bitcoin Mining Master/backend/create-mysql9-user.sql"

if [ $? -ne 0 ]; then
    echo "❌ 失败"
    exit 1
fi

echo "✅ 用户创建成功"
echo ""

# 步骤 2: 导入数据库结构
echo "步骤 2/3: 导入数据库结构..."
mysql -u bitcoin_mining_master -pFzFbWmwMptnN3ABE bitcoin_mining_master < "/Users/davidpony/Desktop/Bitcoin Mining Master/backend/cloud-database-schema.sql" 2>&1 | grep -v "insecure"

if [ $? -ne 0 ]; then
    echo "❌ 导入失败"
    exit 1
fi

echo "✅ 数据库结构导入成功"
echo ""

# 步骤 3: 验证
echo "步骤 3/3: 验证结果..."
mysql -u bitcoin_mining_master -pFzFbWmwMptnN3ABE -e "USE bitcoin_mining_master; SHOW TABLES;" 2>&1 | grep -v "insecure"

echo ""
echo "========================================"
echo "✅ 配置完成！"
echo "========================================"
echo ""
echo "数据库连接信息:"
echo "  主机: 127.0.0.1"
echo "  端口: 3306"
echo "  用户: bitcoin_mining_master"
echo "  密码: FzFbWmwMptnN3ABE"
echo "  数据库: bitcoin_mining_master"
echo ""
echo "测试连接: node test_mysql_only.js"
echo ""
