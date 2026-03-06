#!/bin/bash

# MySQL 密码重置脚本
# 使用方法: chmod +x reset-mysql-password.sh && ./reset-mysql-password.sh

echo "🔧 开始重置 MySQL root 密码..."
echo ""

# 1. 停止 MySQL
echo "1️⃣ 停止 MySQL 服务..."
sudo /usr/local/mysql/support-files/mysql.server stop
sleep 2

# 2. 以安全模式启动
echo "2️⃣ 以安全模式启动 MySQL（跳过权限验证）..."
sudo /usr/local/mysql/bin/mysqld_safe --skip-grant-tables &
sleep 5

# 3. 重置密码
echo "3️⃣ 重置 root 密码为: FzFbWmwMptnN3ABE"
mysql -u root <<EOF
FLUSH PRIVILEGES;
ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY 'FzFbWmwMptnN3ABE';
FLUSH PRIVILEGES;
EOF

# 4. 停止安全模式
echo "4️⃣ 停止安全模式..."
sudo killall mysqld
sleep 2

# 5. 正常启动 MySQL
echo "5️⃣ 正常启动 MySQL..."
sudo /usr/local/mysql/support-files/mysql.server start
sleep 2

# 6. 测试连接
echo "6️⃣ 测试连接..."
mysql -u root -pFzFbWmwMptnN3ABE -e "SELECT VERSION();" 2>&1

echo ""
echo "✅ 密码重置完成！"
echo "现在可以使用以下信息连接:"
echo "  Host: 127.0.0.1"
echo "  Port: 3306"
echo "  User: root"
echo "  Password: FzFbWmwMptnN3ABE"
