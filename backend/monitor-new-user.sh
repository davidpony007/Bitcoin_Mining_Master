#!/bin/bash

echo "========================================"
echo "🔍 实时监控新用户注册"
echo "========================================"
echo ""
echo "📱 请在30秒内打开设备2的应用"
echo ""

# 记录开始时间
START_TIME=$(date +%s)

# 启动后端日志监控
ssh root@47.79.232.189 'docker logs -f bitcoin_backend_prod 2>&1' | while read line; do
    # 显示所有包含 Device Login 的行
    if echo "$line" | grep -q "完整请求体\|android_id\|gaid\|country"; then
        echo "$line"
    fi
    
    # 30秒后退出
    CURRENT_TIME=$(date +%s)
    ELAPSED=$((CURRENT_TIME - START_TIME))
    if [ $ELAPSED -gt 30 ]; then
        break
    fi
done

echo ""
echo "========================================"
echo "📊 查询最新用户数据"
echo "========================================"

ssh root@47.79.232.189 'docker exec bitcoin_mysql_prod mysql -uroot -p"Bitcoin_MySQL_Root_2026!Secure" --default-character-set=utf8mb4 bitcoin_mining_master -e "SELECT user_id, android_id, LEFT(gaid, 20) as gaid, country, register_ip, user_creation_time FROM user_information ORDER BY user_creation_time DESC LIMIT 3;"' 2>&1 | grep -v "Using a password"
