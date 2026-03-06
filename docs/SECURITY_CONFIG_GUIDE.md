# 🔒 服务器安全配置指南

生成时间: 2025-11-27

---

## 📋 准备工作

我已经为您创建了5个分步配置脚本和1个一键执行脚本：

### 脚本列表

| 脚本 | 功能 | 说明 |
|------|------|------|
| `run_security_config.sh` | 一键执行 | 自动执行所有步骤 |
| `step1_check.sh` | 检查配置 | 查看当前配置状态 |
| `step2_backup.sh` | 备份文件 | 备份所有配置文件 |
| `step3_secure_mysql.sh` | MySQL安全 | 配置MySQL只监听本地 |
| `step4_secure_redis.sh` | Redis安全 | 配置Redis只监听本地 |
| `step5_verify.sh` | 验证配置 | 验证安全配置是否生效 |

---

## 🚀 方案一：一键执行（推荐）

### 步骤1: 上传脚本到服务器

```bash
# 在本地Mac上执行
cd "/Users/davidpony/Desktop/Bitcoin Mining Master"

# 上传所有脚本到服务器
scp scripts/run_security_config.sh root@47.79.232.189:/root/
scp scripts/step*.sh root@47.79.232.189:/root/
```

### 步骤2: SSH连接到服务器

```bash
ssh root@47.79.232.189
```

### 步骤3: 执行安全配置

```bash
# 添加执行权限
chmod +x /root/run_security_config.sh
chmod +x /root/step*.sh

# 运行配置脚本
cd /root
./run_security_config.sh
```

### 步骤4: 按提示操作

脚本会提示您在每个步骤后确认，仔细查看输出。

---

## 🛠️ 方案二：分步执行（更安全）

如果您想更谨慎地逐步执行：

### 步骤1: 检查当前配置

```bash
ssh root@47.79.232.189
bash /root/step1_check.sh
```

**查看输出**，确认当前配置状态。

### 步骤2: 备份配置文件

```bash
bash /root/step2_backup.sh
```

**记录备份位置**，以便需要时恢复。

### 步骤3: 配置MySQL安全

```bash
bash /root/step3_secure_mysql.sh
```

这会：
- 设置 `bind-address = 127.0.0.1`
- 删除远程用户 `bitcoin_mining_master@'%'`
- 创建本地用户 `bitcoin_mining_master@'localhost'`
- 重启MySQL

### 步骤4: 配置Redis安全

```bash
bash /root/step4_secure_redis.sh
```

这会：
- 设置 `bind 127.0.0.1`
- 确保密码保护
- 重启Redis

### 步骤5: 验证配置

```bash
bash /root/step5_verify.sh
```

确认所有配置都正确生效。

---

## ⚠️ 执行后需要做的事

### 1. 更新本地代码的连接配置

**不需要修改**！因为本地代码会通过SSH隧道连接，保持原配置即可。

### 2. 测试本地应用连接

```bash
# 在本地Mac上
cd "/Users/davidpony/Desktop/Bitcoin Mining Master/backend"

# 测试MySQL连接
node test_mysql_only.js
```

**如果失败**，建立SSH隧道：

```bash
# 打开新终端，保持运行
ssh -L 3306:localhost:3306 -L 6379:localhost:6379 root@47.79.232.189
```

然后在 `.env` 中修改：
```env
DB_HOST=127.0.0.1  # 改为127.0.0.1
REDIS_HOST=127.0.0.1  # 改为127.0.0.1
```

### 3. 在阿里云安全组中删除端口规则

登录阿里云控制台：

1. 进入 **ECS控制台** → **安全组**
2. 找到您的安全组，点击**配置规则**
3. **删除**以下入站规则：
   - 端口 **3306** (MySQL)
   - 端口 **6379** (Redis)
   - 端口 **8880** (PhpMyAdmin) - 可选

**保留**以下规则：
- 端口 **80** (HTTP)
- 端口 **443** (HTTPS)
- 端口 **22** (SSH)
- 端口 **8888** (Node.js API) - 后续可以通过Nginx代理隐藏

---

## 🔄 如果需要回滚

### 恢复配置文件

```bash
# 查看备份
ls -la /root/config_backup_*

# 恢复MySQL配置
cp /root/config_backup_YYYYMMDD_HHMMSS/my.cnf /etc/mysql/my.cnf

# 恢复Redis配置
cp /root/config_backup_YYYYMMDD_HHMMSS/redis.conf /etc/redis/redis.conf

# 重启服务
systemctl restart mysql
systemctl restart redis
```

### 恢复MySQL用户权限

```bash
mysql -u root -pWHfe2c82a2e5b8e2a3 <<EOF
GRANT ALL PRIVILEGES ON bitcoin_mining_master.* 
TO 'bitcoin_mining_master'@'%' 
IDENTIFIED BY 'FzFbWmwMptnN3ABE';
FLUSH PRIVILEGES;
EOF
```

---

## 📊 执行前后对比

### 执行前（不安全）

```
MySQL: 监听 0.0.0.0:3306  ❌ 任何人都可以尝试连接
Redis: 监听 0.0.0.0:6379  ❌ 任何人都可以尝试连接
用户: bitcoin_mining_master@'%'  ❌ 允许任意IP
```

### 执行后（安全）

```
MySQL: 监听 127.0.0.1:3306  ✅ 只有本地可以连接
Redis: 监听 127.0.0.1:6379  ✅ 只有本地可以连接
用户: bitcoin_mining_master@'localhost'  ✅ 只允许本地
```

---

## 🔍 常见问题

### Q1: 执行后本地应用无法连接数据库？

**A**: 使用SSH隧道：

```bash
# 保持此终端运行
ssh -L 3306:localhost:3306 -L 6379:localhost:6379 root@47.79.232.189
```

然后修改 `backend/.env`:
```env
DB_HOST=127.0.0.1
REDIS_HOST=127.0.0.1
```

### Q2: 云服务器上的Node.js应用还能连接数据库吗？

**A**: 可以！因为应用和数据库都在同一台服务器上，使用localhost连接。

确保服务器上的配置使用 `localhost` 或 `127.0.0.1`。

### Q3: 如何在Postman中测试API？

**A**: API端口(8888)不受影响，可以直接测试：
```
POST http://47.79.232.189:8888/api/userInformation
```

后续可以配置Nginx反向代理隐藏8888端口。

### Q4: 脚本执行失败怎么办？

**A**: 
1. 查看错误信息
2. 检查备份是否已创建
3. 必要时使用备份恢复
4. 联系我获取帮助

---

## 🎯 推荐的执行时间

选择一个应用使用较少的时间执行：
- ✅ 深夜或凌晨
- ✅ 周末
- ✅ 确保有时间处理可能出现的问题

**预计耗时**: 5-10分钟

---

## ✅ 执行清单

使用此清单确保完成所有步骤：

- [ ] 上传脚本到服务器
- [ ] SSH连接到服务器
- [ ] 执行安全配置脚本
- [ ] 验证配置生效
- [ ] 测试本地应用连接
- [ ] 在阿里云删除端口规则
- [ ] 测试应用功能正常
- [ ] 记录备份文件位置
- [ ] 更新文档

---

## 📞 需要帮助？

如果在执行过程中遇到任何问题：

1. **不要慌张** - 配置文件已备份
2. **保存错误信息** - 截图或复制错误
3. **查看日志** - 使用 `systemctl status mysql` 等命令
4. **联系支持** - 提供详细的错误信息

---

**准备好了吗？让我们开始配置安全的服务器！🚀**

**下一步**: 选择方案一或方案二，开始执行！
