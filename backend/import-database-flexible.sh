#!/bin/bash

# 灵活的数据库导入脚本

echo "========================================"
echo "  Bitcoin Mining Master 数据库导入"
echo "========================================"
echo ""
echo "检测到本地有多个 MySQL 实例运行"
echo "请选择导入方式："
echo ""
echo "1) 使用 root 用户（需要密码）"
echo "2) 创建新用户并导入"
echo "3) 使用其他已存在的用户"
echo "4) 仅显示 SQL 文件内容"
echo ""
read -p "请选择 (1-4): " choice

SQL_FILE="/Users/davidpony/Desktop/Bitcoin Mining Master/backend/cloud-database-schema.sql"

case $choice in
    1)
        echo ""
        echo "使用 root 用户导入..."
        echo "请输入 MySQL root 密码："
        mysql -u root -p < "$SQL_FILE"
        
        if [ $? -eq 0 ]; then
            echo ""
            echo "✅ 导入成功！验证结果："
            mysql -u root -p -e "USE bitcoin_mining_master; SHOW TABLES;"
        else
            echo "❌ 导入失败"
        fi
        ;;
        
    2)
        echo ""
        echo "创建新用户方案："
        echo ""
        read -p "请输入新用户名 (默认: btc_admin): " newuser
        newuser=${newuser:-btc_admin}
        
        read -sp "请输入新用户密码: " newpass
        echo ""
        
        read -sp "请输入 MySQL root 密码来创建用户: " rootpass
        echo ""
        
        echo ""
        echo "正在创建用户并授权..."
        mysql -u root -p"$rootpass" <<EOF
CREATE USER IF NOT EXISTS '$newuser'@'localhost' IDENTIFIED BY '$newpass';
GRANT ALL PRIVILEGES ON bitcoin_mining_master.* TO '$newuser'@'localhost';
FLUSH PRIVILEGES;
EOF
        
        if [ $? -eq 0 ]; then
            echo "✅ 用户创建成功，开始导入数据库..."
            mysql -u "$newuser" -p"$newpass" < "$SQL_FILE"
            
            if [ $? -eq 0 ]; then
                echo ""
                echo "✅ 导入成功！"
                mysql -u "$newuser" -p"$newpass" -e "USE bitcoin_mining_master; SHOW TABLES;"
            fi
        else
            echo "❌ 用户创建失败"
        fi
        ;;
        
    3)
        echo ""
        read -p "请输入用户名: " username
        echo "请输入密码："
        mysql -u "$username" -p < "$SQL_FILE"
        
        if [ $? -eq 0 ]; then
            echo ""
            echo "✅ 导入成功！"
            mysql -u "$username" -p -e "USE bitcoin_mining_master; SHOW TABLES;"
        else
            echo "❌ 导入失败"
        fi
        ;;
        
    4)
        echo ""
        echo "SQL 文件内容（前 50 行）："
        echo "----------------------------------------"
        head -50 "$SQL_FILE"
        echo "----------------------------------------"
        echo ""
        echo "完整文件位置: $SQL_FILE"
        echo "总行数: $(wc -l < "$SQL_FILE")"
        ;;
        
    *)
        echo "无效的选择"
        exit 1
        ;;
esac
