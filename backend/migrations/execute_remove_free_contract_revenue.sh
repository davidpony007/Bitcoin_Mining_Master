#!/bin/bash

# 删除 free_contract_revenue 字段执行脚本
# 该脚本会连接到 MySQL 数据库并删除 free_contract_revenue 字段

echo "=========================================="
echo "删除 free_contract_revenue 字段"
echo "=========================================="
echo ""

# 数据库配置
DB_HOST="localhost"
DB_USER="root"
DB_PASS="Bitcoin_MySQL_Root_2026!Secure"
DB_NAME="bitcoin_mining_master"

# 1. 显示当前表结构
echo "📋 当前表结构："
mysql -h $DB_HOST -u $DB_USER -p"$DB_PASS" $DB_NAME -e "DESCRIBE free_contract_records;" 2>&1 | grep -v "Warning"
echo ""

# 2. 确认是否继续
echo "⚠️  即将删除 free_contract_revenue 字段"
read -p "是否继续? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "❌ 操作已取消"
    exit 0
fi

echo ""
echo "🔄 开始执行..."

# 3. 执行删除
mysql -h $DB_HOST -u $DB_USER -p"$DB_PASS" $DB_NAME <<EOF 2>&1 | grep -v "Warning"
ALTER TABLE free_contract_records 
DROP COLUMN free_contract_revenue;
EOF

if [ $? -eq 0 ]; then
    echo "✅ 字段删除成功！"
else
    echo "❌ 字段删除失败，请检查错误信息"
    exit 1
fi

echo ""

# 4. 验证结果
echo "📋 更新后的表结构："
mysql -h $DB_HOST -u $DB_USER -p"$DB_PASS" $DB_NAME -e "DESCRIBE free_contract_records;" 2>&1 | grep -v "Warning"

echo ""
echo "✅ 完成！free_contract_revenue 字段已成功删除"
echo "=========================================="
