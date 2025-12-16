#!/bin/bash
# Bitcoin Mining Master - 一键安全配置脚本
# 自动执行所有安全配置步骤

echo "🔒 Bitcoin Mining Master 安全配置"
echo "================================"
echo ""
echo "此脚本将执行以下操作："
echo "  1. ✅ 检查当前配置"
echo "  2. 📦 备份配置文件"
echo "  3. 🔧 配置MySQL安全（bind-address = 127.0.0.1）"
echo "  4. 🔧 配置Redis安全（bind 127.0.0.1）"
echo "  5. ✅ 验证配置"
echo ""
echo "⚠️  警告："
echo "  执行后，MySQL和Redis只能从本地访问"
echo "  远程连接需要使用SSH隧道"
echo ""

read -p "是否继续？(y/n): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ 已取消"
    exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo ""
echo "================================"
echo "开始执行..."
echo "================================"

# 步骤1: 检查
echo ""
bash $SCRIPT_DIR/step1_check.sh
read -p "按Enter继续..." 

# 步骤2: 备份
echo ""
bash $SCRIPT_DIR/step2_backup.sh
read -p "按Enter继续..." 

# 步骤3: MySQL安全
echo ""
bash $SCRIPT_DIR/step3_secure_mysql.sh
read -p "按Enter继续..." 

# 步骤4: Redis安全
echo ""
bash $SCRIPT_DIR/step4_secure_redis.sh
read -p "按Enter继续..." 

# 步骤5: 验证
echo ""
bash $SCRIPT_DIR/step5_verify.sh

echo ""
echo "================================"
echo "🎉 安全配置完成！"
echo "================================"
echo ""
echo "⚠️  不要忘记："
echo "  1. 在阿里云安全组中删除3306和6379端口规则"
echo "  2. 测试应用是否正常工作"
echo "  3. 如需远程连接数据库，使用SSH隧道"
echo ""
