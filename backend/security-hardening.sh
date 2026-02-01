#!/bin/bash
# ================================================================
# 服务器安全加固脚本
# 功能：防止挖矿病毒入侵的全方位防护
# 使用：bash security-hardening.sh
# ================================================================

set -e

echo "================================================================"
echo "           🛡️  服务器安全加固开始                                "
echo "================================================================"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# ================================================================
# 1. 修改SSH端口（从22改为自定义端口）
# ================================================================
echo ""
echo "========== 1. 修改SSH端口 =========="
read -p "是否修改SSH端口？(y/n，建议改为2222-65535之间): " change_ssh_port
if [ "$change_ssh_port" = "y" ]; then
    read -p "请输入新的SSH端口号 (2222-65535): " new_ssh_port
    
    # 备份SSH配置
    cp /etc/ssh/sshd_config /etc/ssh/sshd_config.bak.$(date +%Y%m%d)
    
    # 修改端口
    sed -i "s/#Port 22/Port $new_ssh_port/g" /etc/ssh/sshd_config
    sed -i "s/^Port 22/Port $new_ssh_port/g" /etc/ssh/sshd_config
    
    # 添加防火墙规则
    firewall-cmd --permanent --add-port=$new_ssh_port/tcp 2>/dev/null || true
    firewall-cmd --reload 2>/dev/null || true
    
    echo -e "${GREEN}✓ SSH端口已改为 $new_ssh_port${NC}"
    echo -e "${YELLOW}⚠️  请记住新端口！重启SSH服务后立即测试连接！${NC}"
fi

# ================================================================
# 2. 禁用root密码登录，强制使用密钥
# ================================================================
echo ""
echo "========== 2. 配置SSH密钥登录 =========="
read -p "是否禁用root密码登录？(y/n，高度推荐): " disable_password
if [ "$disable_password" = "y" ]; then
    # 确保有authorized_keys
    if [ ! -f /root/.ssh/authorized_keys ]; then
        echo -e "${YELLOW}⚠️  未检测到SSH密钥，请先上传公钥到 /root/.ssh/authorized_keys${NC}"
        read -p "是否现在生成并显示公钥？(y/n): " gen_key
        if [ "$gen_key" = "y" ]; then
            mkdir -p /root/.ssh
            ssh-keygen -t rsa -b 4096 -f /root/.ssh/id_rsa -N "" || true
            echo "公钥内容："
            cat /root/.ssh/id_rsa.pub
            echo ""
            echo "请将上述公钥复制到本地 ~/.ssh/authorized_keys"
        fi
    else
        # 修改SSH配置
        sed -i 's/^PasswordAuthentication yes/PasswordAuthentication no/g' /etc/ssh/sshd_config
        sed -i 's/#PasswordAuthentication yes/PasswordAuthentication no/g' /etc/ssh/sshd_config
        sed -i 's/^PermitRootLogin yes/PermitRootLogin prohibit-password/g' /etc/ssh/sshd_config
        
        echo -e "${GREEN}✓ 已禁用root密码登录${NC}"
    fi
fi

# ================================================================
# 3. 关闭不必要的端口，保护Redis/MySQL
# ================================================================
echo ""
echo "========== 3. 配置防火墙 =========="

# 检查firewalld是否安装
if ! command -v firewall-cmd &> /dev/null; then
    echo "安装firewalld..."
    yum install -y firewalld || apt install -y firewalld
    systemctl start firewalld
    systemctl enable firewalld
fi

echo "配置防火墙规则..."

# 清除所有规则重新配置
firewall-cmd --permanent --remove-service=redis 2>/dev/null || true
firewall-cmd --permanent --remove-port=6379/tcp 2>/dev/null || true
firewall-cmd --permanent --remove-port=3306/tcp 2>/dev/null || true

# 允许必要端口
firewall-cmd --permanent --add-service=http
firewall-cmd --permanent --add-service=https
firewall-cmd --permanent --add-port=8888/tcp  # 后端API
firewall-cmd --permanent --add-port=887/tcp   # 宝塔面板
firewall-cmd --permanent --add-port=8880/tcp  # 宝塔SSL

# SSH端口（如果修改了）
if [ ! -z "$new_ssh_port" ]; then
    firewall-cmd --permanent --add-port=$new_ssh_port/tcp
else
    firewall-cmd --permanent --add-service=ssh
fi

# 重载防火墙
firewall-cmd --reload

echo -e "${GREEN}✓ 防火墙配置完成${NC}"

# ================================================================
# 4. 修改Redis配置，禁止外网访问
# ================================================================
echo ""
echo "========== 4. 保护Redis =========="

REDIS_CONF=$(find /www/server/redis /etc/redis -name "redis.conf" 2>/dev/null | head -1)

if [ ! -z "$REDIS_CONF" ]; then
    cp $REDIS_CONF ${REDIS_CONF}.bak.$(date +%Y%m%d)
    
    # 绑定本地IP
    sed -i 's/^bind .*/bind 127.0.0.1/g' $REDIS_CONF
    
    # 启用保护模式
    sed -i 's/^protected-mode no/protected-mode yes/g' $REDIS_CONF
    
    # 重启Redis
    systemctl restart redis || /etc/init.d/redis restart
    
    echo -e "${GREEN}✓ Redis已绑定到127.0.0.1（仅本地访问）${NC}"
else
    echo -e "${YELLOW}⚠️  未找到Redis配置文件${NC}"
fi

# ================================================================
# 5. 安装并配置Fail2ban（防暴力破解）
# ================================================================
echo ""
echo "========== 5. 安装Fail2ban =========="
read -p "是否安装Fail2ban防暴力破解？(y/n): " install_fail2ban

if [ "$install_fail2ban" = "y" ]; then
    yum install -y fail2ban || apt install -y fail2ban
    systemctl enable fail2ban
    
    # 配置Fail2ban
    cat > /etc/fail2ban/jail.local <<EOF
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5

[sshd]
enabled = true
port = ${new_ssh_port:-22}
logpath = /var/log/secure
maxretry = 3
EOF

    systemctl restart fail2ban
    echo -e "${GREEN}✓ Fail2ban已安装并配置（SSH登录失败3次=封禁1小时）${NC}"
fi

# ================================================================
# 6. 安装rkhunter（rootkit检测工具）
# ================================================================
echo ""
echo "========== 6. 安装安全扫描工具 =========="
read -p "是否安装rkhunter rootkit检测工具？(y/n): " install_rkhunter

if [ "$install_rkhunter" = "y" ]; then
    yum install -y rkhunter || apt install -y rkhunter
    
    # 更新病毒库
    rkhunter --update
    
    # 初始化数据库
    rkhunter --propupd
    
    echo -e "${GREEN}✓ rkhunter已安装（使用 rkhunter --check 进行扫描）${NC}"
fi

# ================================================================
# 7. 创建安全检查定时任务
# ================================================================
echo ""
echo "========== 7. 创建定时安全检查 =========="

cat > /usr/local/bin/security-check.sh <<'EOF'
#!/bin/bash
# 每小时运行的安全检查脚本

LOG_FILE="/var/log/security-check.log"
DATE=$(date '+%Y-%m-%d %H:%M:%S')

echo "[$DATE] ========== 开始安全检查 ==========" >> $LOG_FILE

# 1. 检查高CPU进程
echo "--- 检查CPU占用 ---" >> $LOG_FILE
ps aux --sort=-%cpu | head -5 >> $LOG_FILE

# 2. 检查可疑进程名
SUSPICIOUS=$(ps aux | grep -E 'xmrig|minerd|cryptonight|pool\.|stratum|kthreadd|systemp' | grep -v grep)
if [ ! -z "$SUSPICIOUS" ]; then
    echo "⚠️  发现可疑进程：" >> $LOG_FILE
    echo "$SUSPICIOUS" >> $LOG_FILE
    
    # 自动杀掉
    echo "$SUSPICIOUS" | awk '{print $2}' | xargs -r kill -9
    echo "✓ 已杀掉可疑进程" >> $LOG_FILE
fi

# 3. 检查外部网络连接
echo "--- 外部连接 ---" >> $LOG_FILE
netstat -antp | grep ESTABLISHED | grep -v '127.0.0.1\|100.100' >> $LOG_FILE 2>&1 || echo "无异常" >> $LOG_FILE

# 4. 检查可疑文件
echo "--- 最近修改的系统文件 ---" >> $LOG_FILE
find /usr/local/bin /usr/bin /etc/systemd/system -type f -mtime -1 2>/dev/null >> $LOG_FILE

echo "[$DATE] ========== 检查完成 ==========\n" >> $LOG_FILE
EOF

chmod +x /usr/local/bin/security-check.sh

# 添加到crontab
(crontab -l 2>/dev/null | grep -v security-check; echo "0 * * * * /usr/local/bin/security-check.sh") | crontab -

echo -e "${GREEN}✓ 安全检查脚本已创建（每小时自动运行）${NC}"
echo -e "   日志位置: /var/log/security-check.log"

# ================================================================
# 8. 检查并删除所有可疑文件
# ================================================================
echo ""
echo "========== 8. 扫描并清理可疑文件 =========="

echo "正在扫描..."

# 查找可疑的可执行文件
find /tmp /var/tmp /dev/shm -type f -executable 2>/dev/null | while read file; do
    echo -e "${YELLOW}⚠️  可疑文件: $file${NC}"
    read -p "是否删除？(y/n): " del
    if [ "$del" = "y" ]; then
        rm -f "$file"
        echo -e "${GREEN}✓ 已删除${NC}"
    fi
done

# 查找隐藏目录
find /root /home -type d -name ".*" -not -name ".ssh" -not -name ".cache" 2>/dev/null | while read dir; do
    if [ -f "$dir/*" ]; then
        echo -e "${YELLOW}⚠️  可疑隐藏目录: $dir${NC}"
        ls -la "$dir"
    fi
done

# ================================================================
# 9. 限制系统资源（防止挖矿占用）
# ================================================================
echo ""
echo "========== 9. 配置系统资源限制 =========="

cat >> /etc/security/limits.conf <<EOF
# 限制单个进程CPU使用
* hard cpu 60
* soft cpu 50

# 限制进程数
* hard nproc 5000
* soft nproc 4000
EOF

echo -e "${GREEN}✓ 已配置资源限制（单进程CPU<60分钟）${NC}"

# ================================================================
# 10. 最终检查
# ================================================================
echo ""
echo "========== 10. 最终安全检查 =========="

echo "当前开放端口："
netstat -tuln | grep LISTEN

echo ""
echo "运行中的服务："
systemctl list-units --type=service --state=running | grep -v '@'

echo ""
echo "定时任务："
crontab -l

# ================================================================
# 完成
# ================================================================
echo ""
echo "================================================================"
echo -e "${GREEN}          ✅  安全加固完成！                                ${NC}"
echo "================================================================"
echo ""
echo "📋 已完成的安全措施："
echo "   1. SSH端口修改（如果选择）"
echo "   2. 禁用密码登录（如果选择）"
echo "   3. 防火墙配置（仅开放必要端口）"
echo "   4. Redis绑定本地（防止外部访问）"
echo "   5. Fail2ban防暴力破解（如果安装）"
echo "   6. rkhunter rootkit检测（如果安装）"
echo "   7. 每小时自动安全检查"
echo "   8. 系统资源限制"
echo ""
echo "⚠️  重要提示："
echo "   1. 如果修改了SSH端口，现在重启SSH服务："
echo "      systemctl restart sshd"
echo "   2. 测试新端口连接成功后再断开当前连接"
echo "   3. 定期查看安全日志: tail -f /var/log/security-check.log"
echo "   4. 每周运行: rkhunter --check"
echo ""
echo "================================================================"
