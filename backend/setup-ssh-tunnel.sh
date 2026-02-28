#!/bin/bash

# SSH隧道配置
SSH_HOST="47.79.232.189"
SSH_USER="root"
SSH_PASSWORD="WHfe2c82a2e5b8e2a3"
SSH_PORT="22"
LOCAL_PORT="3307"
REMOTE_HOST="127.0.0.1"
REMOTE_PORT="3306"

echo "🔧 建立SSH隧道到云端MySQL..."

# 检查是否已有SSH隧道
OLD_PID=$(ps aux | grep "ssh.*3307.*${SSH_HOST}" | grep -v grep | awk '{print $2}')
if [ ! -z "$OLD_PID" ]; then
    echo "🛑 关闭旧的SSH隧道 (PID: $OLD_PID)..."
    kill $OLD_PID 2>/dev/null
    sleep 1
fi

# 使用expect建立SSH隧道
expect << EOF
set timeout 30
spawn ssh -f -N -L ${LOCAL_PORT}:${REMOTE_HOST}:${REMOTE_PORT} -o StrictHostKeyChecking=no -o ServerAliveInterval=60 -o ServerAliveCountMax=3 -p ${SSH_PORT} ${SSH_USER}@${SSH_HOST}

expect {
    "password:" {
        send "${SSH_PASSWORD}\r"
        expect eof
    }
    "yes/no" {
        send "yes\r"
        expect "password:"
        send "${SSH_PASSWORD}\r"
        expect eof
    }
    timeout {
        puts "❌ SSH连接超时"
        exit 1
    }
    eof {
        puts "✅ SSH隧道已建立"
    }
}
EOF

# 等待隧道建立
sleep 2

# 验证隧道
NEW_PID=$(ps aux | grep "ssh.*3307.*${SSH_HOST}" | grep -v grep | awk '{print $2}')
if [ ! -z "$NEW_PID" ]; then
    echo "✅ SSH隧道成功建立 (PID: $NEW_PID)"
    echo "📍 本地端口: ${LOCAL_PORT} → ${SSH_HOST}:${REMOTE_PORT}"
    
    # 检查端口监听
    if lsof -i :${LOCAL_PORT} > /dev/null 2>&1; then
        echo "✅ 端口 ${LOCAL_PORT} 正在监听"
    else
        echo "⚠️ 端口 ${LOCAL_PORT} 未监听"
    fi
else
    echo "❌ SSH隧道建立失败"
    exit 1
fi
