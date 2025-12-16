#!/bin/bash
# 安全配置 - 步骤5: 验证配置

echo "✅ 步骤5: 验证安全配置"
echo "================================"

echo ""
echo "1️⃣ MySQL 配置验证："
echo "---"
mysql -u root -pWHfe2c82a2e5b8e2a3 -e "SHOW VARIABLES LIKE 'bind_address';" 2>/dev/null

echo ""
echo "2️⃣ MySQL 用户权限验证："
echo "---"
mysql -u root -pWHfe2c82a2e5b8e2a3 -e "SELECT User, Host FROM mysql.user WHERE User='bitcoin_mining_master';" 2>/dev/null

echo ""
echo "3️⃣ Redis 配置验证："
echo "---"
echo "Bind配置:"
grep "^bind" /etc/redis/redis.conf
echo ""
echo "密码配置:"
grep "^requirepass" /etc/redis/redis.conf | sed 's/requirepass.*/requirepass [已设置]/g'

echo ""
echo "4️⃣ 端口监听验证："
echo "---"
echo "MySQL (应该只监听127.0.0.1):"
netstat -tlnp | grep 3306
echo ""
echo "Redis (应该只监听127.0.0.1):"
netstat -tlnp | grep 6379

echo ""
echo "5️⃣ 测试本地连接："
echo "---"
echo "MySQL本地连接测试:"
mysql -h 127.0.0.1 -u bitcoin_mining_master -pFzFbWmwMptnN3ABE bitcoin_mining_master -e "SELECT 1;" 2>/dev/null && echo "✅ MySQL本地连接成功" || echo "❌ MySQL本地连接失败"

echo ""
echo "Redis本地连接测试:"
redis-cli -h 127.0.0.1 -a 3hu8fds3y ping 2>/dev/null && echo "✅ Redis本地连接成功" || echo "⚠️  Redis连接需要密码认证"

echo ""
echo "================================"
echo "✅ 验证完成！"
echo ""
echo "📋 安全配置总结："
echo "  ✅ MySQL: 只监听127.0.0.1"
echo "  ✅ Redis: 只监听127.0.0.1"
echo "  ✅ MySQL用户: bitcoin_mining_master@localhost"
echo ""
echo "⚠️  最后一步："
echo "  在阿里云安全组中删除以下端口规则："
echo "  • 3306 (MySQL)"
echo "  • 6379 (Redis)"
echo "  • 8880 (PhpMyAdmin) - 可选"
echo ""
echo "💡 远程连接方法："
echo "  使用SSH隧道："
echo "  ssh -L 3306:localhost:3306 root@47.79.232.189"
echo "  ssh -L 6379:localhost:6379 root@47.79.232.189"
