#!/bin/bash

# 本地开发环境一键启动脚本

echo "🚀 启动本地开发环境..."
echo ""

# 检查并启动 Redis
echo "📦 检查 Redis 状态..."
if redis-cli ping &>/dev/null; then
    echo "✅ Redis 已运行"
else
    echo "⚠️  Redis 未运行,正在启动..."
    redis-server --daemonize yes
    sleep 1
    if redis-cli ping &>/dev/null; then
        echo "✅ Redis 启动成功"
    else
        echo "❌ Redis 启动失败"
    fi
fi

echo ""

# 检查 MySQL
echo "🗄️  检查 MySQL 状态..."
if ps aux | grep mysqld | grep -v grep &>/dev/null; then
    echo "✅ MySQL 已运行"
else
    echo "❌ MySQL 未运行"
    echo "   请手动启动 MySQL 或使用远程数据库"
fi

echo ""
echo "📊 服务状态汇总:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Redis 状态
if redis-cli ping &>/dev/null; then
    echo "Redis:  ✅ 运行中 (localhost:6379)"
else
    echo "Redis:  ❌ 未运行"
fi

# MySQL 状态
if ps aux | grep mysqld | grep -v grep &>/dev/null; then
    echo "MySQL:  ✅ 运行中 (localhost:3306)"
else
    echo "MySQL:  ❌ 未运行"
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 检查环境配置
echo "⚙️  当前配置:"
if [ -f "backend/.env" ]; then
    DB_HOST=$(grep "^DB_HOST=" backend/.env | cut -d'=' -f2)
    REDIS_HOST=$(grep "^REDIS_HOST=" backend/.env | cut -d'=' -f2)
    echo "数据库:  $DB_HOST"
    echo "Redis:   $REDIS_HOST"
    
    if [ "$DB_HOST" = "localhost" ] || [ "$DB_HOST" = "127.0.0.1" ]; then
        echo ""
        echo "💡 使用本地数据库模式"
    else
        echo ""
        echo "🌐 使用远程数据库模式 ($DB_HOST)"
    fi
else
    echo "⚠️  未找到 backend/.env 文件"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 提供下一步操作建议
echo "📝 下一步操作:"
echo ""
echo "  1. 配置数据库连接 (如需切换到本地):"
echo "     code backend/.env"
echo ""
echo "  2. 运行数据库迁移:"
echo "     cd backend && npx sequelize-cli db:migrate"
echo ""
echo "  3. 启动后端服务:"
echo "     pm2 start ecosystem.config.js"
echo ""
echo "  4. 查看服务状态:"
echo "     pm2 status"
echo ""
echo "  5. 打开 MySQL 管理工具:"
echo "     open -a 'Sequel Ace'"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
