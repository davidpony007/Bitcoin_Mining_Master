# 数据库连接诊断报告

生成时间: 2025-11-24

## 📋 .env配置检查

### MySQL配置
```
DB_HOST=47.79.232.189
DB_USER=bitcoin_mining_master
DB_PASSWORD=FzFbWmwMptnN3ABE
DB_NAME=bitcoin_mining_master
DB_DIALECT=mysql
DB_PORT=3306 (默认)
```

✅ **配置格式正确**

### Redis配置
```
REDIS_HOST=47.79.232.189
REDIS_PORT=6379
REDIS_DB=0
REDIS_PASSWORD=3hu8fds3y
REDIS_KEY_PREFIX=bmm:
```

✅ **配置格式正确**

---

## 🔍 网络连通性测试

### MySQL端口测试 (3306)
```bash
$ nc -zv 47.79.232.189 3306
Connection to 47.79.232.189 port 3306 [tcp/mysql] succeeded!
```

✅ **端口3306可连接** - MySQL服务正在运行

### 8888端口测试 (API)
之前测试显示:
```bash
$ nc -zv 47.79.232.189 8888
Connection to 47.79.232.189 port 8888 [tcp/ddi-tcp-1] succeeded!
```

✅ **端口8888可连接** - 但API无响应

---

## ⚠️ MySQL连接测试结果

### 测试程序
创建了 `test_mysql_only.js` 测试MySQL连接

### 测试结果
```
测试MySQL连接...
Host: 47.79.232.189
User: bitcoin_mining_master
Database: bitcoin_mining_master

正在连接...
[卡住,超时]
```

❌ **MySQL连接超时** - 虽然端口可达,但应用层连接失败

---

## 🔎 问题分析

### 症状
1. ✅ 3306端口可以连接 (TCP层面)
2. ❌ MySQL客户端连接超时 (应用层面)
3. ✅ 配置信息正确
4. ✅ 云服务器在线

### 可能的原因

#### 1. **MySQL绑定地址问题** (最可能)
MySQL可能只绑定到localhost,不接受外部连接

**检查方法**(在云服务器上):
```bash
ssh root@47.79.232.189
mysql -u root -p
mysql> SELECT User, Host FROM mysql.user WHERE User='bitcoin_mining_master';
mysql> SHOW VARIABLES LIKE 'bind_address';
```

**期望结果**:
- Host应该是 `%` (允许任何IP) 或 `47.79.232.189`
- bind_address应该是 `0.0.0.0` 或 `*` (不是127.0.0.1)

**修复方法**:
```sql
-- 授权远程访问
GRANT ALL PRIVILEGES ON bitcoin_mining_master.* TO 'bitcoin_mining_master'@'%' IDENTIFIED BY 'FzFbWmwMptnN3ABE';
FLUSH PRIVILEGES;
```

编辑MySQL配置文件 `/etc/mysql/mysql.conf.d/mysqld.cnf`:
```ini
[mysqld]
bind-address = 0.0.0.0
```

然后重启MySQL:
```bash
systemctl restart mysql
```

#### 2. **防火墙规则问题**
虽然端口可达,但可能有状态防火墙规则限制

**检查方法**:
```bash
# 在云服务器上
iptables -L -n | grep 3306
ufw status
```

#### 3. **MySQL用户权限问题**
用户可能没有远程访问权限

**检查方法**:
```sql
SELECT User, Host FROM mysql.user WHERE User='bitcoin_mining_master';
SHOW GRANTS FOR 'bitcoin_mining_master'@'%';
```

#### 4. **连接数限制**
MySQL可能达到最大连接数

**检查方法**:
```sql
SHOW VARIABLES LIKE 'max_connections';
SHOW STATUS LIKE 'Threads_connected';
SHOW PROCESSLIST;
```

---

## 💡 建议的解决步骤

### 步骤1: 登录云服务器检查MySQL配置
```bash
ssh root@47.79.232.189
```

### 步骤2: 检查MySQL是否允许远程连接
```bash
mysql -u root -p
```
```sql
-- 查看用户权限
SELECT User, Host FROM mysql.user WHERE User='bitcoin_mining_master';

-- 如果Host是'localhost',需要授权远程访问
GRANT ALL PRIVILEGES ON bitcoin_mining_master.* TO 'bitcoin_mining_master'@'%' IDENTIFIED BY 'FzFbWmwMptnN3ABE';
FLUSH PRIVILEGES;

-- 查看绑定地址
SHOW VARIABLES LIKE 'bind_address';
```

### 步骤3: 修改MySQL配置(如果bind-address是127.0.0.1)
```bash
sudo vim /etc/mysql/mysql.conf.d/mysqld.cnf
```
修改:
```ini
bind-address = 0.0.0.0
```

重启MySQL:
```bash
sudo systemctl restart mysql
```

### 步骤4: 检查防火墙
```bash
# 查看防火墙状态
sudo ufw status

# 如果启用,确保3306端口开放
sudo ufw allow 3306/tcp
```

### 步骤5: 再次测试连接
回到本地,运行:
```bash
node test_mysql_only.js
```

---

## 🚀 临时解决方案

如果无法立即修复云服务器MySQL远程连接,可以:

### 方案A: 使用SSH隧道
```bash
# 建立SSH隧道
ssh -L 3307:localhost:3306 root@47.79.232.189 -N &

# 修改.env
DB_HOST=127.0.0.1
DB_PORT=3307
```

### 方案B: 在云服务器上运行Node服务
把Node服务部署到云服务器,使用localhost连接MySQL

### 方案C: 使用phpMyAdmin测试
访问: http://47.79.232.189:8888/phpmyadmin
如果能登录,说明MySQL本身没问题,只是远程访问配置问题

---

## 📊 当前状态总结

| 项目 | 状态 | 说明 |
|------|------|------|
| .env配置 | ✅ 正确 | 所有字段格式正确 |
| 网络连通 | ✅ 正常 | 3306和8888端口可达 |
| MySQL服务 | ✅ 运行中 | 端口监听正常 |
| MySQL远程访问 | ❌ 失败 | 应用层连接超时 |
| Node服务启动 | ❌ 失败 | 依赖MySQL连接 |

**核心问题**: MySQL未配置允许远程访问

**影响**: 
- 本地Node服务无法连接数据库
- 无法启动bmm-api
- 无法测试用户创建功能

**下一步**: 
登录云服务器,修改MySQL配置允许远程访问

