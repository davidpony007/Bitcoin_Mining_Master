#!/bin/bash
# SSH 密钥配置脚本 - 一键配置免密登录

echo "🔐 SSH 密钥配置向导"
echo "===================="
echo ""

SERVER="root@47.79.232.189"
PASSWORD="WHfe2c82a2e5b8e2a3"

echo "📋 配置步骤:"
echo "  1. 生成 SSH 密钥对（如果不存在）"
echo "  2. 将公钥复制到服务器"
echo "  3. 测试免密登录"
echo "  4. 建立 SSH 隧道"
echo ""

# 步骤 1: 检查是否已有密钥
if [ -f ~/.ssh/id_rsa ]; then
    echo "✅ SSH 密钥已存在: ~/.ssh/id_rsa"
else
    echo "🔑 生成新的 SSH 密钥..."
    ssh-keygen -t rsa -b 4096 -f ~/.ssh/id_rsa -N "" -C "bitcoin-mining-master"
    echo "✅ SSH 密钥已生成"
fi

echo ""
echo "📤 将公钥复制到服务器..."
echo "   （需要输入服务器密码一次）"
echo ""

# 步骤 2: 安装 sshpass（用于自动输入密码）
if ! command -v sshpass &> /dev/null; then
    echo "📦 安装 sshpass..."
    if command -v brew &> /dev/null; then
        brew install hudochenkov/sshpass/sshpass
    else
        echo "⚠️  请先安装 Homebrew: /bin/bash -c \"\$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\""
        exit 1
    fi
fi

# 步骤 3: 使用 ssh-copy-id 复制公钥
if command -v sshpass &> /dev/null; then
    echo "使用 sshpass 自动复制公钥..."
    sshpass -p "$PASSWORD" ssh-copy-id -o StrictHostKeyChecking=no $SERVER
else
    echo "手动复制公钥（需要输入密码）..."
    ssh-copy-id $SERVER
fi

echo ""
echo "🧪 测试免密登录..."
if ssh -o BatchMode=yes -o ConnectTimeout=5 $SERVER "echo '✅ 免密登录成功！'" 2>/dev/null; then
    echo "✅ SSH 密钥认证配置成功！"
    echo ""
    echo "🎉 现在可以免密登录了："
    echo "   ssh $SERVER"
    echo ""
    echo "🔗 建立 SSH 隧道（无需密码）："
    echo "   ssh -N -L 8888:localhost:8888 $SERVER &"
    echo ""
    echo "是否现在建立 SSH 隧道？(y/n)"
    read -r response
    if [[ "$response" =~ ^[Yy]$ ]]; then
        ssh -N -L 8888:localhost:8888 $SERVER &
        TUNNEL_PID=$!
        echo "✅ SSH 隧道已建立（PID: $TUNNEL_PID）"
        echo ""
        echo "测试连接..."
        sleep 3
        if curl -s -m 5 http://localhost:8888/api/health > /dev/null; then
            echo "✅ API 连接成功！"
            echo ""
            echo "现在可以在 Postman 中测试了："
            echo "  URL: http://localhost:8888/api/users"
        else
            echo "⚠️  API 连接失败，请检查服务器状态"
        fi
    fi
else
    echo "❌ 免密登录失败，请检查配置"
    echo ""
    echo "手动测试命令："
    echo "  ssh $SERVER"
fi

echo ""
echo "📚 相关命令:"
echo "  - 手动建立隧道: ssh -N -L 8888:localhost:8888 $SERVER &"
echo "  - 查看隧道进程: ps aux | grep 'ssh -N -L 8888'"
echo "  - 停止隧道: kill <PID>"
echo "  - 测试 API: curl http://localhost:8888/api/health"
