#!/bin/bash

# 导入云端数据库结构到本地 MySQL
# 此脚本会提示输入本地 MySQL root 密码

echo "========================================"
echo "  Bitcoin Mining Master 数据库同步工具"
echo "========================================"
echo ""
echo "📊 云端数据库表列表："
echo "  1. bitcoin_transaction_records"
echo "  2. country_config"
echo "  3. country_mining_config"
echo "  4. free_contract_records"
echo "  5. invitation_rebate"
echo "  6. invitation_relationship"
echo "  7. mining_contracts"
echo "  8. paid_products_list"
echo "  9. user_information"
echo "  10. user_log"
echo "  11. user_orders"
echo "  12. user_status"
echo "  13. withdrawal_records"
echo ""
echo "共 13 个表"
echo ""
echo "⚠️  警告："
echo "   这将删除本地 bitcoin_mining_master 数据库的所有数据！"
echo "   如需保留数据，请先备份。"
echo ""

read -p "是否继续？(yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "❌ 已取消操作"
    exit 0
fi

echo ""
echo "🔌 正在连接本地 MySQL..."

# SQL 文件路径
SQL_FILE="/Users/davidpony/Desktop/Bitcoin Mining Master/backend/cloud-database-schema.sql"

# 导入数据库结构
mysql -u root -p < "$SQL_FILE"

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ 数据库结构同步成功！"
    echo ""
    echo "📝 验证导入结果："
    mysql -u root -p -e "USE bitcoin_mining_master; SHOW TABLES;"
else
    echo ""
    echo "❌ 导入失败，请检查错误信息"
    exit 1
fi
