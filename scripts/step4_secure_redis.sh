#!/bin/bash
# 安全配置 - 步骤4: 配置Redis安全设置

echo "🔧 步骤4: 配置Redis安全"
echo "================================"

REDIS_CONFIG="/etc/redis/redis.conf"
REDIS_PASSWORD="3hu8fds3y"

if [ ! -f $REDIS_CONFIG ]; then
    echo "❌ 未找到Redis配置文件: $REDIS_CONFIG"
    exit 1
fi

echo ""
echo "1️⃣ 配置Redis只监听本地..."

# 更新bind配置
if grep -q "^bind" $REDIS_CONFIG; then
    sed -i 's/^bind.*/bind 127.0.0.1/' $REDIS_CONFIG
    echo "✅ 已更新 bind 127.0.0.1"
else
    echo "bind 127.0.0.1" >> $REDIS_CONFIG
    echo "✅ 已添加 bind 127.0.0.1"
fi

echo ""
echo "2️⃣ 确保密码保护..."

if grep -q "^requirepass" $REDIS_CONFIG; then
    echo "✅ 已有密码配置"
else
    echo "requirepass $REDIS_PASSWORD" >> $REDIS_CONFIG
    echo "✅ 已添加密码保护"
fi

echo ""
echo "3️⃣ 重启Redis..."
if systemctl restart redis 2>/dev/null || systemctl restart redis-server 2>/dev/null; then
    echo "✅ Redis已重启"
else
    echo "⚠️  请手动重启Redis"
fi

echo ""
echo "4️⃣ 验证配置..."
echo "Bind配置:"
grep "^bind" $REDIS_CONFIG
echo ""
echo "监听端口:"
netstat -tlnp | grep 6379

echo ""
echo "================================"
echo "✅ Redis安全配置完成！"
echo ""
echo "💡 下一步："
echo "  bash step5_verify.sh"
