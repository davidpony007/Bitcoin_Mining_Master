# 🔑 SSH 免密登录配置指南

## 📋 当前状态

你提到有 SSH 公钥，但本地 `~/.ssh/` 目录中没有找到私钥文件。

## 🎯 两种配置方式

---

### 方式 1：使用现有公钥（如果你已经有）

如果你的公钥在其他位置（如 U 盘、云盘等），请按以下步骤操作：

#### 步骤 1：找到你的私钥文件
私钥文件通常命名为：
- `id_rsa` (RSA 密钥)
- `id_ed25519` (ED25519 密钥，更安全)
- `id_ecdsa` (ECDSA 密钥)

#### 步骤 2：复制私钥到本地
```bash
# 假设你的私钥在某个位置，复制到 ~/.ssh/
cp /path/to/your/private_key ~/.ssh/id_rsa

# 设置正确的权限（重要！）
chmod 600 ~/.ssh/id_rsa
```

#### 步骤 3：测试连接
```bash
ssh -i ~/.ssh/id_rsa root@47.79.232.189
```

如果可以免密登录，说明配置成功！

---

### 方式 2：生成新的 SSH 密钥对（推荐）

如果你没有私钥或找不到，建议生成新的密钥对：

#### 步骤 1：生成 SSH 密钥对
```bash
# 生成 ED25519 密钥（更安全，推荐）
ssh-keygen -t ed25519 -C "your_email@example.com" -f ~/.ssh/id_ed25519

# 或者生成 RSA 密钥（兼容性更好）
ssh-keygen -t rsa -b 4096 -C "your_email@example.com" -f ~/.ssh/id_rsa
```

**提示：**
- 按回车使用默认路径
- 可以设置密码（更安全）或直接回车（方便）

#### 步骤 2：查看生成的公钥
```bash
# 查看 ED25519 公钥
cat ~/.ssh/id_ed25519.pub

# 或查看 RSA 公钥
cat ~/.ssh/id_rsa.pub
```

复制显示的整行内容（以 `ssh-ed25519` 或 `ssh-rsa` 开头）

#### 步骤 3：将公钥添加到服务器

**方法 A：使用 ssh-copy-id（推荐）**
```bash
# 对于 ED25519
ssh-copy-id -i ~/.ssh/id_ed25519.pub root@47.79.232.189

# 对于 RSA
ssh-copy-id -i ~/.ssh/id_rsa.pub root@47.79.232.189
```

**方法 B：手动添加**
```bash
# 1. SSH 登录到服务器
ssh root@47.79.232.189

# 2. 创建 .ssh 目录（如果不存在）
mkdir -p ~/.ssh
chmod 700 ~/.ssh

# 3. 将公钥追加到 authorized_keys
echo "你的公钥内容" >> ~/.ssh/authorized_keys

# 4. 设置正确的权限
chmod 600 ~/.ssh/authorized_keys

# 5. 退出
exit
```

#### 步骤 4：测试免密登录
```bash
ssh root@47.79.232.189
```

如果不需要密码就能登录，配置成功！✅

---

## 🚀 配置成功后的快速启动

### 一键启动脚本

配置好 SSH 免密登录后，创建以下脚本：

```bash
#!/bin/bash
# 文件：quick_restart.sh

echo "🔄 远程重启 Node 服务..."

ssh root@47.79.232.189 << 'EOF'
cd /www/wwwroot/47.79.232.189/Bitcoin_Mining_Master
echo "📊 重启前状态："
pm2 list | grep -E "name|bmm-"
echo ""
echo "🔄 重启中..."
pm2 restart all
sleep 3
echo ""
echo "✅ 重启后状态："
pm2 list | grep -E "name|bmm-"
echo ""
echo "🏥 健康检查："
curl -s http://127.0.0.1:8888/api/health | python -m json.tool 2>/dev/null || curl -s http://127.0.0.1:8888/api/health
EOF

echo ""
echo "✅ 完成！"
```

保存后执行：
```bash
chmod +x quick_restart.sh
./quick_restart.sh
```

---

## 🔧 SSH 配置文件（可选，更方便）

创建或编辑 `~/.ssh/config` 文件：

```bash
cat > ~/.ssh/config << 'EOF'
Host bmm-server
    HostName 47.79.232.189
    User root
    IdentityFile ~/.ssh/id_ed25519  # 或 id_rsa
    ServerAliveInterval 60
    ServerAliveCountMax 3
EOF

chmod 600 ~/.ssh/config
```

配置后可以简化登录：
```bash
# 原来：ssh root@47.79.232.189
# 现在：ssh bmm-server

# 原来：ssh root@47.79.232.189 "pm2 list"
# 现在：ssh bmm-server "pm2 list"
```

---

## ⚠️ 常见问题

### 问题 1：权限错误
```bash
# 确保权限正确
chmod 700 ~/.ssh
chmod 600 ~/.ssh/id_rsa  # 或 id_ed25519
chmod 644 ~/.ssh/id_rsa.pub  # 或 id_ed25519.pub
```

### 问题 2：还是要求输入密码

**检查服务器配置：**
```bash
ssh root@47.79.232.189

# 检查 SSH 配置
sudo cat /etc/ssh/sshd_config | grep -E "PubkeyAuthentication|AuthorizedKeysFile"

# 应该看到：
# PubkeyAuthentication yes
# AuthorizedKeysFile .ssh/authorized_keys

# 如果不是，修改配置：
sudo sed -i 's/#PubkeyAuthentication yes/PubkeyAuthentication yes/' /etc/ssh/sshd_config

# 重启 SSH 服务
sudo systemctl restart sshd
```

### 问题 3：密钥被拒绝

**检查服务器上的公钥：**
```bash
ssh root@47.79.232.189
cat ~/.ssh/authorized_keys
```

确保你的公钥在这个文件中。

---

## 📝 快速参考命令

```bash
# 生成密钥
ssh-keygen -t ed25519 -C "your_email@example.com"

# 查看公钥
cat ~/.ssh/id_ed25519.pub

# 复制公钥到服务器
ssh-copy-id -i ~/.ssh/id_ed25519.pub root@47.79.232.189

# 测试连接
ssh root@47.79.232.189

# 远程执行命令
ssh root@47.79.232.189 "pm2 list"

# 远程重启服务
ssh root@47.79.232.189 "cd /www/wwwroot/47.79.232.189/Bitcoin_Mining_Master && pm2 restart all"
```

---

## 🎯 下一步

1. **选择方式 1 或方式 2** 配置 SSH 密钥
2. **测试免密登录**
3. **使用一键脚本**快速管理服务

配置完成后，告诉我结果，我可以帮你创建更方便的管理脚本！

---

**文档版本：** v1.0  
**更新时间：** 2025年11月23日
