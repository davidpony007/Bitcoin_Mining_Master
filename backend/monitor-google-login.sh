#!/bin/bash

echo "=========================================="
echo "🔍 监控Google登录 - 等待新用户注册..."
echo "=========================================="
echo ""
echo "📱 请在设备上打开应用，使用 'Sign In With Google' 登录"
echo "⏱️  监控时间: 60秒"
echo ""

# 监控后端日志（60秒）
ssh root@47.79.232.189 "docker logs -f --tail 0 bitcoin_backend_prod 2>&1" &
SSH_PID=$!

# 等待60秒
sleep 60

# 终止SSH进程
kill $SSH_PID 2>/dev/null

echo ""
echo "=========================================="
echo "📊 查询最新的2条用户记录..."
echo "=========================================="
echo ""

# 查询最新的2条用户记录
ssh root@47.79.232.189 'docker exec bitcoin_mysql_prod mysql -uroot -p"Bitcoin_MySQL_Root_2026!Secure" --default-character-set=utf8mb4 bitcoin_mining_master -e "SELECT user_id, google_account, android_id, gaid, country, register_ip FROM user_information ORDER BY user_creation_time DESC LIMIT 2;"' 2>&1 | grep -v "Using a password"

echo ""
echo "=========================================="
echo "✅ 监控完成！"
echo "=========================================="
echo ""
echo "📋 检查要点："
echo "  1. android_id 应该是16位字符（如: 1b3019c689adb1bd）"
echo "  2. gaid 应该是UUID格式（如: 80cb7c21-2a74-435b-bf91-...）"
echo "  3. country 应该是2位国家代码（如: CN, US等）"
echo "  4. google_account 应该有邮箱地址"
echo ""
