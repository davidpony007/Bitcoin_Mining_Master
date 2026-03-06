#!/bin/bash
# 安全配置 - 步骤2: 备份配置文件

echo "📦 步骤2: 备份配置文件"
echo "================================"

BACKUP_DIR="/root/config_backup_$(date +%Y%m%d_%H%M%S)"
mkdir -p $BACKUP_DIR

echo ""
echo "创建备份目录: $BACKUP_DIR"
echo ""

# 备份MySQL配置
if [ -f /etc/mysql/my.cnf ]; then
    cp /etc/mysql/my.cnf $BACKUP_DIR/
    echo "✅ 已备份: /etc/mysql/my.cnf"
elif [ -f /etc/my.cnf ]; then
    cp /etc/my.cnf $BACKUP_DIR/
    echo "✅ 已备份: /etc/my.cnf"
fi

# 备份Redis配置
if [ -f /etc/redis/redis.conf ]; then
    cp /etc/redis/redis.conf $BACKUP_DIR/
    echo "✅ 已备份: /etc/redis/redis.conf"
fi

# 备份MySQL用户权限
mysql -u root -pWHfe2c82a2e5b8e2a3 -e "SELECT User, Host FROM mysql.user;" > $BACKUP_DIR/mysql_users.txt 2>/dev/null
echo "✅ 已导出: MySQL用户列表"

echo ""
echo "================================"
echo "✅ 备份完成！"
echo "📁 备份位置: $BACKUP_DIR"
echo ""
echo "💡 下一步："
echo "  bash step3_secure_mysql.sh"
