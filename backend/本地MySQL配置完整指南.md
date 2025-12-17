# 本地 MySQL 数据库配置 - 完整指南

## 📋 当前状态

✅ MySQL 服务运行中（检测到 2 个实例）
✅ Redis 服务运行中  
✅ 云端数据库结构已导出 (13个表)
⚠️ 本地 MySQL 需要 root 密码才能操作

## 🎯 三种配置方案

### 方案一：配置本地 MySQL（推荐用于开发）

#### 优点
- 开发速度快，不依赖网络
- 可以自由测试，不影响云端数据
- 本地调试更方便

#### 执行步骤

```bash
cd "/Users/davidpony/Desktop/Bitcoin Mining Master/backend"

# 运行完整配置脚本
./setup-local-mysql-complete.sh

# 脚本会提示输入 root 密码，然后自动完成：
# 1. 创建数据库 bitcoin_mining_master
# 2. 创建用户 bitcoin_mining_master (密码: FzFbWmwMptnN3ABE)
# 3. 导入所有表结构
```

#### 配置完成后修改 .env

```bash
# 修改为本地数据库
DB_HOST=127.0.0.1
DB_USER=bitcoin_mining_master
DB_PASSWORD=FzFbWmwMptnN3ABE
DB_NAME=bitcoin_mining_master

# 本地 Redis
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_DB=0
REDIS_PASSWORD=
REDIS_KEY_PREFIX=bmm:
```

---

### 方案二：继续使用云端数据库

#### 优点
- 无需配置本地数据库
- 数据与云端保持一致
- 适合快速开发和测试

#### 当前配置（无需修改）

```bash
DB_HOST=47.79.232.189
DB_USER=bitcoin_mining_master
DB_PASSWORD=FzFbWmwMptnN3ABE
DB_NAME=bitcoin_mining_master
```

#### 注意事项
- 需要稳定的网络连接
- 小心操作，避免影响生产数据
- 可能会有网络延迟

---

### 方案三：使用 Sequelize 自动初始化

#### 适用场景
- MySQL root 密码复杂或忘记
- 想通过代码创建表结构
- 已有数据库访问权限

#### 执行步骤

1. 先手动创建数据库（如果可以登录 MySQL）：
```sql
CREATE DATABASE bitcoin_mining_master CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

2. 运行 Sequelize 同步脚本：
```bash
node init-database-from-models.js
```

---

## 🛠️ 可用工具和脚本

### 已创建的脚本文件

| 文件名 | 用途 | 使用方法 |
|--------|------|----------|
| `setup-local-mysql-complete.sh` | 一键配置本地 MySQL | `./setup-local-mysql-complete.sh` |
| `setup-local-mysql.sql` | 创建数据库和用户的 SQL | `mysql -u root -p < setup-local-mysql.sql` |
| `cloud-database-schema.sql` | 云端完整数据库结构 | `mysql -u xxx -p < cloud-database-schema.sql` |
| `check-local-db.sh` | 检查本地数据库状态 | `./check-local-db.sh` |
| `init-database-from-models.js` | 使用模型初始化数据库 | `node init-database-from-models.js` |
| `sync-database-schema.js` | 对比云端和本地差异 | `node sync-database-schema.js` |

### 手动命令

```bash
# 检查 MySQL 服务
brew services list | grep mysql

# 检查 MySQL 进程  
ps aux | grep mysqld

# 直接导入（需要先创建用户）
mysql -h 127.0.0.1 -u bitcoin_mining_master -p < cloud-database-schema.sql

# 测试连接
mysql -h 127.0.0.1 -u bitcoin_mining_master -p -e "SHOW DATABASES;"
```

---

## 📊 云端数据库表结构

已导出的 13 个表：

1. **bitcoin_transaction_records** - 比特币交易记录
2. **country_config** - 国家配置（旧版）
3. **country_mining_config** - 国家挖矿配置
4. **free_contract_records** - 免费合约记录
5. **invitation_rebate** - 邀请返利
6. **invitation_relationship** - 邀请关系
7. **mining_contracts** - 挖矿合约
8. **paid_products_list** - 付费产品列表
9. **user_information** - 用户信息
10. **user_log** - 用户日志
11. **user_orders** - 用户订单
12. **user_status** - 用户状态
13. **withdrawal_records** - 提现记录

---

## 🔧 常见问题解决

### Q1: 忘记 MySQL root 密码？

**方案 A**: 重置密码
```bash
# 停止 MySQL
brew services stop mysql

# 安全模式启动
mysqld_safe --skip-grant-tables &

# 重置密码
mysql -u root
mysql> FLUSH PRIVILEGES;
mysql> ALTER USER 'root'@'localhost' IDENTIFIED BY 'new_password';
mysql> FLUSH PRIVILEGES;
mysql> quit;

# 重启 MySQL
brew services restart mysql
```

**方案 B**: 使用云端数据库（方案二）

### Q2: 有两个 MySQL 实例，用哪个？

查看：
```bash
ps aux | grep mysqld
```

- `/opt/homebrew/opt/mysql/bin/mysqld` - Homebrew 安装（推荐）
- `/usr/local/mysql/bin/mysqld` - 官方安装包

建议停止一个：
```bash
# 停止系统 MySQL
sudo /usr/local/mysql/support-files/mysql.server stop

# 只使用 Homebrew MySQL
brew services restart mysql
```

### Q3: 数据库导入失败？

检查：
1. MySQL 版本兼容性（你的是 9.5.0）
2. 用户权限是否足够
3. 磁盘空间是否充足
4. SQL 文件是否完整

---

## ✅ 推荐流程

**对于本地开发，建议按以下步骤操作：**

```bash
# 1. 进入后端目录
cd "/Users/davidpony/Desktop/Bitcoin Mining Master/backend"

# 2. 运行完整配置脚本（需要 root 密码）
./setup-local-mysql-complete.sh

# 3. 修改 .env 文件指向本地数据库
# 编辑器打开 .env，修改 DB_HOST=127.0.0.1

# 4. 测试连接
node test_mysql_only.js

# 5. 启动服务
npm run dev
```

**如果没有 root 密码或配置复杂，建议：**

- 继续使用云端数据库（已经配置好）
- 确保网络连接稳定
- 小心操作避免影响生产数据

---

## 📞 获取帮助

如果遇到问题：
1. 查看日志：`tail -f logs/combined.log`
2. 测试连接：`node test_mysql_only.js`
3. 检查服务：`brew services list`

