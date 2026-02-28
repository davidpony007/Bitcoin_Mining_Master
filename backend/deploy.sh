#!/bin/bash

# 比特币挖矿后端服务 - 快速部署脚本
# 在云服务器上执行此脚本以自动完成所有部署步骤

set -e  # 遇到错误立即退出

echo "========================================"
echo "比特币挖矿后端服务 - 快速部署"
echo "========================================"
echo ""

# 1. 检查Node.js
echo "步骤1: 检查Node.js环境..."
if ! command -v node &> /dev/null; then
    echo "  ❌ Node.js未安装，正在安装..."
    
    # 检测操作系统
    if [ -f /etc/centos-release ]; then
        echo "  检测到CentOS/RHEL系统"
        curl -fsSL https://rpm.nodesource.com/setup_18.x | bash -
        yum install -y nodejs
    elif [ -f /etc/debian_version ]; then
        echo "  检测到Debian/Ubuntu系统"
        curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
        apt-get install -y nodejs
    else
        echo "  ❌ 不支持的操作系统，请手动安装Node.js 18+"
        exit 1
    fi
else
    echo "  ✓ Node.js已安装: $(node --version)"
fi

echo "  ✓ npm版本: $(npm --version)"
echo ""

# 2. 进入项目目录
echo "步骤2: 进入项目目录..."
cd /root/backend
echo "  ✓ 当前目录: $(pwd)"
echo ""

# 3. 安装依赖
echo "步骤3: 安装项目依赖..."
echo "  这可能需要几分钟时间..."
npm install --production
echo "  ✓ 依赖安装完成"
echo ""

# 4. 检查PM2
echo "步骤4: 检查PM2进程管理器..."
if ! command -v pm2 &> /dev/null; then
    echo "  ❌ PM2未安装，正在安装..."
    npm install -g pm2
else
    echo "  ✓ PM2已安装: $(pm2 --version)"
fi
echo ""

# 5. 检查配置文件
echo "步骤5: 检查配置文件..."
if [ ! -f ".env" ]; then
    echo "  ❌ .env文件不存在"
    exit 1
fi
echo "  ✓ .env文件存在"

# 显示数据库配置
echo "  数据库配置:"
grep "^DB_" .env | sed 's/DB_PASSWORD=.*/DB_PASSWORD=******/'
echo ""

# 6. 测试数据库连接
echo "步骤6: 测试数据库连接..."
DB_HOST=$(grep "^DB_HOST=" .env | cut -d'=' -f2)
DB_PORT=$(grep "^DB_PORT=" .env | cut -d'=' -f2)
DB_USER=$(grep "^DB_USER=" .env | cut -d'=' -f2)
DB_PASSWORD=$(grep "^DB_PASSWORD=" .env | cut -d'=' -f2)
DB_NAME=$(grep "^DB_NAME=" .env | cut -d'=' -f2)

mysql -h"${DB_HOST}" -P"${DB_PORT}" -u"${DB_USER}" -p"${DB_PASSWORD}" "${DB_NAME}" -e "SELECT 1" &> /dev/null
if [ $? -eq 0 ]; then
    echo "  ✓ 数据库连接成功"
else
    echo "  ❌ 数据库连接失败，请检查配置"
    exit 1
fi
echo ""

# 7. 停止旧服务（如果存在）
echo "步骤7: 停止旧服务..."
pm2 stop bitcoin-backend 2>/dev/null || echo "  ℹ️  没有运行中的服务"
pm2 delete bitcoin-backend 2>/dev/null || echo "  ℹ️  没有已注册的服务"
echo ""

# 8. 启动服务
echo "步骤8: 启动服务..."
pm2 start src/index.js --name bitcoin-backend --time
echo "  ✓ 服务启动成功"
echo ""

# 9. 设置开机自启
echo "步骤9: 配置开机自启..."
pm2 save
pm2 startup | grep -E "^sudo" | sh || echo "  ℹ️  已配置启动脚本"
echo "  ✓ 开机自启配置完成"
echo ""

# 10. 查看服务状态
echo "步骤10: 查看服务状态..."
sleep 2
pm2 status
echo ""

# 11. 查看最近日志
echo "步骤11: 查看最近日志（按Ctrl+C退出）..."
echo "----------------------------------------"
pm2 logs bitcoin-backend --lines 50 --nostream
echo "----------------------------------------"
echo ""

# 12. 测试API
echo "步骤12: 测试API接口..."
sleep 3

echo "  测试健康检查..."
HEALTH_RESPONSE=$(curl -s http://localhost:8888/api/health)
if echo "$HEALTH_RESPONSE" | grep -q "ok"; then
    echo "  ✓ 健康检查通过"
    echo "  响应: $HEALTH_RESPONSE"
else
    echo "  ❌ 健康检查失败"
    echo "  响应: $HEALTH_RESPONSE"
fi
echo ""

# 完成
echo "========================================"
echo "✅ 部署完成！"
echo "========================================"
echo ""
echo "📋 服务信息:"
echo "  - 服务名称: bitcoin-backend"
echo "  - 监听端口: 8888"
echo "  - 进程管理: PM2"
echo ""
echo "🔧 常用命令:"
echo "  pm2 status                    # 查看服务状态"
echo "  pm2 logs bitcoin-backend      # 查看实时日志"
echo "  pm2 restart bitcoin-backend   # 重启服务"
echo "  pm2 stop bitcoin-backend      # 停止服务"
echo "  pm2 monit                     # 监控资源使用"
echo ""
echo "📊 API测试:"
echo "  curl http://localhost:8888/api/health"
echo "  curl http://localhost:8888/api/balance/realtime/1"
echo ""
echo "📚 查看完整文档:"
echo "  cat /root/backend/DEPLOYMENT_GUIDE.md"
echo "  cat /root/backend/IMPLEMENTATION_SUMMARY.md"
echo ""
echo "⏰ 定时任务:"
echo "  - 余额同步: 每2小时整点执行 (00:00, 02:00, 04:00, ...)"
echo "  - 推荐返利: 每2小时+5分钟执行 (00:05, 02:05, 04:05, ...)"
echo ""
echo "🎉 系统已就绪，开始监控日志以验证定时任务执行！"
echo ""
