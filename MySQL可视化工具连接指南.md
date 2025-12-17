# MySQL 可视化工具连接失败解决方案

## 📋 问题分析

根据你的截图和系统检查，发现以下问题：

### 1. 错误信息
```
Authentication plugin 'caching_sha2_password' reported error: 
Authentication requires secure connection.
```

### 2. 根本原因
- **MySQL 版本**: 9.5.0 (Homebrew)
- **认证插件**: `caching_sha2_password` (MySQL 8.0+ 默认)
- **问题**: 该插件要求使用 SSL 加密连接，或者使用兼容的认证方式

### 3. 当前状态
- MySQL 正在运行 (PID: 539)
- root 密码认证失败
- 可能是系统默认安装的 MySQL，密码不是 `FzFbWmwMptnN3ABE`

---

## 🔧 解决方案（3 种方法）

### 方法一：使用 SSH 隧道连接（推荐）✅

这种方法最安全，适合可视化工具连接。

#### 步骤：

1. **在 Sequel Ace 中选择 "SSH" 标签页**
   - MySQL Host: `127.0.0.1`
   - Username: `root`
   - Password: `你的MySQL密码`
   - Database: `bitcoin_mining_master`
   - Port: `3306`

2. **SSH 配置**
   - SSH Host: `127.0.0.1`
   - SSH User: `你的Mac用户名`
   - SSH Password: `你的Mac登录密码`
   - SSH Port: `22`

3. **点击 "Test Connection" 测试连接**

---

### 方法二：重置 MySQL root 密码并修改认证插件

如果方法一不行，我们需要重置密码：

#### 1. 停止 MySQL
```bash
sudo /usr/local/mysql/support-files/mysql.server stop
```

#### 2. 以安全模式启动 MySQL（跳过权限验证）
```bash
sudo /usr/local/mysql/bin/mysqld_safe --skip-grant-tables &
```

#### 3. 连接 MySQL（无需密码）
```bash
mysql -u root
```

#### 4. 重置密码并修改认证插件
```sql
-- 刷新权限
FLUSH PRIVILEGES;

-- 修改 root 密码并使用 mysql_native_password 认证
ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY 'FzFbWmwMptnN3ABE';

-- 刷新权限
FLUSH PRIVILEGES;

-- 退出
EXIT;
```

#### 5. 重启 MySQL
```bash
# 停止安全模式
sudo killall mysqld

# 正常启动
sudo /usr/local/mysql/support-files/mysql.server start
```

#### 6. 测试连接
```bash
mysql -u root -pFzFbWmwMptnN3ABE -e "SELECT VERSION();"
```

---

### 方法三：在 Sequel Ace 中启用 SSL（适用于保持 caching_sha2_password）

#### 步骤：

1. **在 TCP/IP 标签页中**
   - Host: `127.0.0.1`
   - Username: `root`
   - Password: `你的密码`
   - Database: `bitcoin_mining_master`
   - Port: `3306`

2. **勾选底部的选项**
   - ✅ **Require SSL** (必须勾选！)

3. **或者勾选**
   - ✅ **Enable Cleartext plugin (insecure)** (允许明文插件)

---

## 🎯 最简单的操作步骤（推荐）

### 第一步：找出 MySQL root 真实密码

运行以下脚本查找密码：

```bash
# 查看 MySQL 初始密码（可能在日志中）
sudo grep 'temporary password' /usr/local/mysql/data/mysqld.local.err
```

### 第二步：如果找不到密码，执行重置

1. 打开终端，运行：
```bash
sudo /usr/local/mysql/support-files/mysql.server stop
sudo /usr/local/mysql/bin/mysqld_safe --skip-grant-tables &
```

2. 新开一个终端窗口，运行：
```bash
mysql -u root
```

3. 在 MySQL 提示符下执行：
```sql
FLUSH PRIVILEGES;
ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY 'FzFbWmwMptnN3ABE';
FLUSH PRIVILEGES;
EXIT;
```

4. 重启 MySQL：
```bash
sudo killall mysqld
sudo /usr/local/mysql/support-files/mysql.server start
```

### 第三步：在 Sequel Ace 中连接

1. **选择 "TCP/IP" 标签页**
2. **填写信息**：
   - Name: `本地 MySQL`
   - Host: `127.0.0.1`
   - Username: `root`
   - Password: `FzFbWmwMptnN3ABE`
   - Database: `bitcoin_mining_master`
   - Port: `3306`

3. **点击 "连接"**

---

## 🔍 如果仍然失败

### 检查 MySQL 是否有多个实例

```bash
# 查看所有 MySQL 进程
ps aux | grep mysql

# 查看端口占用
lsof -i :3306
```

如果有多个 MySQL 实例，建议：
1. 停止所有 MySQL
2. 只启动一个（建议用 Homebrew 版本）

```bash
# 停止系统 MySQL
sudo /usr/local/mysql/support-files/mysql.server stop

# 启动 Homebrew MySQL
brew services start mysql
```

---

## 📝 连接配置总结

### Sequel Ace 推荐配置

**TCP/IP 方式**：
- Host: `127.0.0.1` (不要用 localhost)
- Port: `3306`
- Username: `root`
- Password: `FzFbWmwMptnN3ABE`
- Database: `bitcoin_mining_master`
- ✅ Enable Cleartext plugin (insecure)

**或 SSH 方式**：
- MySQL Host: `127.0.0.1`
- MySQL User: `root`
- MySQL Password: `FzFbWmwMptnN3ABE`
- SSH Host: `127.0.0.1`
- SSH User: `你的Mac用户名`

---

## ⚠️ 重要提示

1. **密码问题**: 你的 .env.local 中的密码可能不是 MySQL 当前的 root 密码
2. **认证插件**: MySQL 9.5 默认使用 `caching_sha2_password`，需要 SSL 或切换为 `mysql_native_password`
3. **连接地址**: 使用 `127.0.0.1` 而不是 `localhost`（避免 socket 连接问题）

---

## 🆘 需要我帮你执行哪个方案？

请告诉我你想尝试哪个方法，我可以帮你一步步执行！
