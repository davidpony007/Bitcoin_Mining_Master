#!/bin/bash
# Bitcoin Mining Master - 服务器安全配置脚本
# 生成时间: 2025-11-27
# 用途: 配置MySQL、Redis和其他服务的安全设置

set -e  # 遇到错误立即退出

echo "🔒 开始安全配置..."
echo "================================"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# MySQL配置
MYSQL_ROOT_PASSWORD="WHfe2c82a2e5b8e2a3"
MYSQL_USER="bitcoin_mining_master"
MYSQL_PASSWORD="FzFbWmwMptnN3ABE"
MYSQL_DATABASE="bitcoin_mining_master"

# Redis配置
REDIS_PASSWORD="3hu8fds3y"

echo ""
echo "📋 配置清单："
echo "  1. 关闭MySQL外网访问（bind-address = 127.0.0.1）"
echo "  2. 关闭Redis外网访问（bind 127.0.0.1）"
echo "  3. 更新MySQL用户权限（只允许localhost）"
echo "  4. 备份配置文件"
echo "  5. 重启服务"
echo ""

# 询问是否继续
read -p "是否继续执行安全配置？(y/n): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ 已取消配置"
    exit 1
fi

# ==========================================
# 1. 备份配置文件
# ==========================================
echo ""
echo "📦 1/5 备份配置文件..."

BACKUP_DIR="/root/config_backup_$(date +%Y%m%d_%H%M%S)"
mkdir -p $BACKUP_DIR

# 备份MySQL配置
if [ -f /etc/mysql/my.cnf ]; then
    cp /etc/mysql/my.cnf $BACKUP_DIR/my.cnf.backup
    echo "  ✅ 已备份 MySQL 配置"
elif [ -f /etc/my.cnf ]; then
    cp /etc/my.cnf $BACKUP_DIR/my.cnf.backup
    echo "  ✅ 已备份 MySQL 配置"
else
    echo "  ⚠️  未找到 MySQL 配置文件"
fi

# 备份Redis配置
if [ -f /etc/redis/redis.conf ]; then
    cp /etc/redis/redis.conf $BACKUP_DIR/redis.conf.backup
    echo "  ✅ 已备份 Redis 配置"
else
    echo "  ⚠️  未找到 Redis 配置文件"
fi

echo "  📁 备份位置: $BACKUP_DIR"

# ==========================================
# 2. 配置MySQL安全设置
# ==========================================
echo ""
echo "🔧 2/5 配置MySQL安全设置..."

# 查找MySQL配置文件
MYSQL_CONFIG=""
if [ -f /etc/mysql/my.cnf ]; then
    MYSQL_CONFIG="/etc/mysql/my.cnf"
elif [ -f /etc/my.cnf ]; then
    MYSQL_CONFIG="/etc/my.cnf"
fi

if [ -n "$MYSQL_CONFIG" ]; then
    # 检查是否已有bind-address配置
    if grep -q "^bind-address" $MYSQL_CONFIG; then
        echo "  ⚠️  MySQL配置文件中已有bind-address设置"
        sed -i.bak 's/^bind-address.*/bind-address = 127.0.0.1/' $MYSQL_CONFIG
        echo "  ✅ 已更新 bind-address = 127.0.0.1"
    else
        # 添加bind-address到[mysqld]部分
        if grep -q "^\[mysqld\]" $MYSQL_CONFIG; then
            sed -i.bak '/^\[mysqld\]/a bind-address = 127.0.0.1' $MYSQL_CONFIG
            echo "  ✅ 已添加 bind-address = 127.0.0.1"
        else
            echo "[mysqld]" >> $MYSQL_CONFIG
            echo "bind-address = 127.0.0.1" >> $MYSQL_CONFIG
            echo "  ✅ 已添加 [mysqld] 和 bind-address 配置"
        fi
    fi
else
    echo "  ❌ 未找到 MySQL 配置文件，跳过MySQL配置"
fi

# ==========================================
# 3. 配置Redis安全设置
# ==========================================
echo ""
echo "🔧 3/5 配置Redis安全设置..."

REDIS_CONFIG="/etc/redis/redis.conf"

if [ -f $REDIS_CONFIG ]; then
    # 更新bind配置
    if grep -q "^bind" $REDIS_CONFIG; then
        sed -i.bak 's/^bind.*/bind 127.0.0.1/' $REDIS_CONFIG
        echo "  ✅ 已更新 Redis bind = 127.0.0.1"
    else
        echo "bind 127.0.0.1" >> $REDIS_CONFIG
        echo "  ✅ 已添加 Redis bind = 127.0.0.1"
    fi
    
    # 确保密码配置存在
    if ! grep -q "^requirepass" $REDIS_CONFIG; then
        echo "requirepass $REDIS_PASSWORD" >> $REDIS_CONFIG
        echo "  ✅ 已添加 Redis 密码保护"
    fi
else
    echo "  ❌ 未找到 Redis 配置文件，跳过Redis配置"
fi

# ==========================================
# 4. 更新MySQL用户权限
# ==========================================
echo ""
echo "🔧 4/5 更新MySQL用户权限..."

# 撤销所有远程访问权限
mysql -u root -p$MYSQL_ROOT_PASSWORD <<EOF
-- 删除远程访问权限
DROP USER IF EXISTS '$MYSQL_USER'@'%';

-- 只允许localhost访问
GRANT ALL PRIVILEGES ON $MYSQL_DATABASE.* 
TO '$MYSQL_USER'@'localhost' 
IDENTIFIED BY '$MYSQL_PASSWORD';

-- 刷新权限
FLUSH PRIVILEGES;

-- 显示用户权限
SELECT User, Host FROM mysql.user WHERE User='$MYSQL_USER';
EOF

echo "  ✅ 已更新用户权限：只允许 localhost 访问"

# ==========================================
# 5. 重启服务
# ==========================================
echo ""
echo "🔄 5/5 重启服务..."

# 重启MySQL
if systemctl is-active --quiet mysql; then
    systemctl restart mysql
    echo "  ✅ MySQL 已重启"
elif systemctl is-active --quiet mysqld; then
    systemctl restart mysqld
    echo "  ✅ MySQL 已重启"
else
    echo "  ⚠️  MySQL 服务未运行"
fi

# 重启Redis
if systemctl is-active --quiet redis; then
    systemctl restart redis
    echo "  ✅ Redis 已重启"
elif systemctl is-active --quiet redis-server; then
    systemctl restart redis-server
    echo "  ✅ Redis 已重启"
else
    echo "  ⚠️  Redis 服务未运行"
fi

# ==========================================
# 验证配置
# ==========================================
echo ""
echo "✅ 6/6 验证配置..."

echo ""
echo "📊 MySQL 配置："
mysql -u root -p$MYSQL_ROOT_PASSWORD -e "SHOW VARIABLES LIKE 'bind_address';" 2>/dev/null || echo "  ⚠️  无法验证MySQL配置"

echo ""
echo "📊 MySQL 用户权限："
mysql -u root -p$MYSQL_ROOT_PASSWORD -e "SELECT User, Host FROM mysql.user WHERE User='$MYSQL_USER';" 2>/dev/null || echo "  ⚠️  无法验证用户权限"

echo ""
echo "📊 监听端口："
netstat -tlnp | grep -E ":(3306|6379)" || echo "  ⚠️  未找到监听端口"

# ==========================================
# 完成
# ==========================================
echo ""
echo "================================"
echo -e "${GREEN}🎉 安全配置完成！${NC}"
echo ""
echo "📋 配置总结："
echo "  ✅ MySQL bind-address: 127.0.0.1"
echo "  ✅ Redis bind: 127.0.0.1"
echo "  ✅ MySQL用户权限: $MYSQL_USER@localhost"
echo "  ✅ 配置备份: $BACKUP_DIR"
echo ""
echo -e "${YELLOW}⚠️  重要提示：${NC}"
echo "  1. MySQL和Redis现在只能从本地访问"
echo "  2. 如需远程连接，请使用SSH隧道："
echo "     ssh -L 3306:localhost:3306 root@47.79.232.189"
echo "     ssh -L 6379:localhost:6379 root@47.79.232.189"
echo ""
echo "  3. 记得在阿里云安全组中关闭3306和6379端口"
echo ""
echo -e "${GREEN}✅ 安全配置完成！服务器更安全了！${NC}"
