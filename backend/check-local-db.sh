#!/bin/bash

# 检查本地 MySQL 数据库状态
echo "========================================"
echo "  检查本地 MySQL 数据库"
echo "========================================"
echo ""

echo "📋 请输入本地 MySQL root 密码来检查数据库："
echo ""

# 检查数据库是否存在
echo "1️⃣  检查数据库是否存在..."
mysql -u root -p -e "SHOW DATABASES LIKE 'bitcoin_mining_master';"

echo ""
echo "2️⃣  如果数据库存在，查看表列表..."
mysql -u root -p -e "USE bitcoin_mining_master; SHOW TABLES;"

echo ""
echo "✅ 检查完成"
