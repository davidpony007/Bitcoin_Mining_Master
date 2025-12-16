#!/bin/bash
# 安全配置 - 步骤3: 配置MySQL安全设置

echo "🔧 步骤3: 配置MySQL安全"
echo "================================"

MYSQL_ROOT_PASSWORD="WHfe2c82a2e5b8e2a3"
MYSQL_USER="bitcoin_mining_master"
MYSQL_PASSWORD="FzFbWmwMptnN3ABE"
MYSQL_DATABASE="bitcoin_mining_master"

echo ""
echo "1️⃣ 配置MySQL只监听本地..."

# 查找MySQL配置文件
MYSQL_CONFIG=""
if [ -f /etc/mysql/my.cnf ]; then
    MYSQL_CONFIG="/etc/mysql/my.cnf"
elif [ -f /etc/my.cnf ]; then
    MYSQL_CONFIG="/etc/my.cnf"
fi

if [ -z "$MYSQL_CONFIG" ]; then
    echo "❌ 未找到MySQL配置文件"
    exit 1
fi

echo "📝 配置文件: $MYSQL_CONFIG"

# 添加或更新bind-address
if grep -q "^bind-address" $MYSQL_CONFIG; then
    sed -i 's/^bind-address.*/bind-address = 127.0.0.1/' $MYSQL_CONFIG
    echo "✅ 已更新 bind-address = 127.0.0.1"
else
    # 在[mysqld]后添加
    if grep -q "^\[mysqld\]" $MYSQL_CONFIG; then
        sed -i '/^\[mysqld\]/a bind-address = 127.0.0.1' $MYSQL_CONFIG
    else
        echo -e "\n[mysqld]\nbind-address = 127.0.0.1" >> $MYSQL_CONFIG
    fi
    echo "✅ 已添加 bind-address = 127.0.0.1"
fi

echo ""
echo "2️⃣ 更新用户权限..."

mysql -u root -p$MYSQL_ROOT_PASSWORD <<EOF
-- 删除远程用户
DROP USER IF EXISTS '$MYSQL_USER'@'%';

-- 创建本地用户
CREATE USER IF NOT EXISTS '$MYSQL_USER'@'localhost' IDENTIFIED BY '$MYSQL_PASSWORD';

-- 授予权限
GRANT ALL PRIVILEGES ON $MYSQL_DATABASE.* TO '$MYSQL_USER'@'localhost';

-- 刷新权限
FLUSH PRIVILEGES;
EOF

echo "✅ 已更新用户权限"

echo ""
echo "3️⃣ 重启MySQL..."
if systemctl restart mysql 2>/dev/null || systemctl restart mysqld 2>/dev/null; then
    echo "✅ MySQL已重启"
else
    echo "⚠️  请手动重启MySQL"
fi

echo ""
echo "4️⃣ 验证配置..."
mysql -u root -p$MYSQL_ROOT_PASSWORD -e "SHOW VARIABLES LIKE 'bind_address';"
mysql -u root -p$MYSQL_ROOT_PASSWORD -e "SELECT User, Host FROM mysql.user WHERE User='$MYSQL_USER';"

echo ""
echo "================================"
echo "✅ MySQL安全配置完成！"
echo ""
echo "💡 下一步："
echo "  bash step4_secure_redis.sh"
