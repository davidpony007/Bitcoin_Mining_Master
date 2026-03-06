#!/bin/bash
# 安全配置 - 步骤1: 检查当前配置
# 在执行任何修改前，先了解当前状态

echo "🔍 步骤1: 检查当前配置"
echo "================================"

echo ""
echo "1️⃣ MySQL 配置检查："
echo "---"
mysql -u root -pWHfe2c82a2e5b8e2a3 -e "SHOW VARIABLES LIKE 'bind_address';" 2>/dev/null

echo ""
echo "2️⃣ MySQL 用户权限："
echo "---"
mysql -u root -pWHfe2c82a2e5b8e2a3 -e "SELECT User, Host FROM mysql.user WHERE User='bitcoin_mining_master';" 2>/dev/null

echo ""
echo "3️⃣ Redis bind 配置："
echo "---"
cat /etc/redis/redis.conf | grep "^bind" || echo "未找到bind配置（可能被注释）"

echo ""
echo "4️⃣ 当前监听的端口："
echo "---"
netstat -tlnp | grep -E ":(3306|6379|8888)"

echo ""
echo "5️⃣ Redis 密码配置："
echo "---"
cat /etc/redis/redis.conf | grep "^requirepass" || echo "未设置密码（或被注释）"

echo ""
echo "================================"
echo "✅ 检查完成"
echo ""
echo "💡 下一步："
echo "  查看检查结果，确认配置后运行："
echo "  bash step2_backup.sh"
