# Sequel Ace 连接选项详解

## 🔌 连接方式 (TCP/IP, Socket, SSH)

### 1. TCP/IP (标准连接) ⭐ 推荐日常使用

**功能**: 通过网络协议连接 MySQL

**使用场景**:
- ✅ 连接本地 MySQL (`localhost` 或 `127.0.0.1`)
- ✅ 连接远程 MySQL (如 `47.79.232.189`)
- ✅ 跨网络连接数据库

**配置示例**:
```
Host: localhost (本地) 或 47.79.232.189 (远程)
Port: 3306 (MySQL 默认端口)
Username: root
Password: 你的密码
```

**工作原理**:
```
Sequel Ace → 网络 (TCP/IP) → MySQL Server (端口 3306)
```

**优点**:
- 最常用,兼容性好
- 支持本地和远程连接
- 配置简单

**缺点**:
- 需要 MySQL 监听网络端口
- 远程连接可能有安全风险

---

### 2. Socket (套接字连接) 🚀 最快

**功能**: 通过 Unix Socket 文件连接本地 MySQL

**使用场景**:
- ✅ **仅限本地**连接 (同一台电脑)
- ✅ 速度比 TCP/IP 更快
- ✅ 当 TCP/IP 连接有问题时的备用方案

**配置示例**:
```
Username: root
Password: 你的密码
Socket: /tmp/mysql.sock (常见路径)
```

**常见 Socket 路径**:
- macOS: `/tmp/mysql.sock`
- Homebrew MySQL: `/opt/homebrew/var/mysql/mysql.sock`
- Linux: `/var/run/mysqld/mysqld.sock`

**工作原理**:
```
Sequel Ace → Unix Socket 文件 → MySQL Server (本地进程)
```

**优点**:
- ⚡ 速度最快 (无网络开销)
- 🔒 更安全 (不走网络)
- 绕过防火墙限制

**缺点**:
- ❌ 只能连接本地数据库
- 需要知道正确的 socket 文件路径

**何时使用**:
- 你看到 "localhost" 连接被拒绝时
- 需要最佳性能时
- 开发环境本地调试

---

### 3. SSH (SSH 隧道) 🔐 最安全

**功能**: 通过 SSH 加密隧道连接远程 MySQL

**使用场景**:
- ✅ 连接**生产环境**数据库 (安全第一)
- ✅ MySQL 没有开放公网访问
- ✅ 需要通过跳板机访问数据库
- ✅ 提高远程连接安全性

**配置示例**:
```
MySQL 连接信息:
  Host: localhost (或内网 IP)
  Port: 3306
  Username: bitcoin_mining_master
  Password: 数据库密码

SSH 连接信息:
  SSH Host: 47.79.232.189 (服务器 IP)
  SSH User: root (服务器用户名)
  SSH Password: 服务器密码
  或 SSH Key: /Users/davidpony/.ssh/id_rsa (推荐)
  SSH Port: 22 (默认)
```

**工作原理**:
```
Sequel Ace → SSH 加密隧道 → 远程服务器 → MySQL Server
```

**典型场景**:
假设你的 MySQL 只允许 localhost 访问 (更安全):

1. 不使用 SSH (失败):
   ```
   你的电脑 ❌ → 47.79.232.189:3306 (拒绝外网连接)
   ```

2. 使用 SSH (成功):
   ```
   你的电脑 → SSH 隧道 → 服务器内部 → localhost:3306 ✅
   ```

**优点**:
- 🔐 数据加密传输
- 🛡️ 不需要 MySQL 开放公网
- 可以访问内网数据库
- 生产环境标准做法

**缺点**:
- 配置稍复杂
- 需要 SSH 访问权限

**何时使用**:
- 连接生产环境数据库
- MySQL 只允许本地连接
- 公司内网数据库

---

## ⚙️ 高级选项详解

### 1. Allow LOCAL_DATA_INFILE (insecure) ⚠️

**中文**: 允许本地数据文件导入

**功能**: 允许使用 `LOAD DATA LOCAL INFILE` 命令从本地文件导入数据到 MySQL

**示例**:
```sql
-- 从本地 CSV 文件导入数据到表中
LOAD DATA LOCAL INFILE '/Users/davidpony/data.csv'
INTO TABLE users
FIELDS TERMINATED BY ','
LINES TERMINATED BY '\n'
IGNORE 1 ROWS;
```

**为什么标记 (insecure)**:
- 🚨 安全风险: 恶意 SQL 可以读取你电脑上的文件
- 攻击者可能通过注入攻击读取敏感文件
- 例如: `LOAD DATA LOCAL INFILE '/etc/passwd'`

**是否勾选**:
- ✅ **勾选**: 如果你需要从本地导入大量数据 (CSV, TXT 等)
- ❌ **不勾选**: 日常使用,更安全 (推荐)

**使用场景**:
- 批量导入 CSV 数据
- 数据迁移
- 一次性数据加载

**建议**: 
- 仅在需要时临时启用
- 使用完立即禁用
- 不要在生产环境启用

---

### 2. Enable Cleartext Plugin (insecure) ⚠️

**中文**: 启用明文密码插件

**功能**: 允许使用明文方式传输密码到 MySQL 服务器

**工作原理**:
- 默认: 密码会被加密传输 (安全)
- 启用后: 密码以明文形式传输 (不安全)

**为什么标记 (insecure)**:
- 🚨 密码可能被网络监听工具截获
- 中间人攻击风险
- 违反安全最佳实践

**何时需要**:
- 某些旧版 MySQL 或特殊配置要求
- PAM 认证 (Pluggable Authentication Modules)
- LDAP 认证集成

**是否勾选**:
- ❌ **几乎永远不需要** (99% 情况)
- 除非服务器明确要求,否则不要启用

**推荐**: 保持**不勾选**

---

### 3. Require SSL 🔐

**中文**: 要求 SSL 加密连接

**功能**: 强制使用 SSL/TLS 加密连接到 MySQL

**工作原理**:
- 不启用: 数据明文传输 (可能被窃听)
  ```
  Sequel Ace → 明文数据 → MySQL (不安全)
  ```

- 启用 SSL: 数据加密传输
  ```
  Sequel Ace → SSL 加密 → MySQL (安全) 🔒
  ```

**保护内容**:
- 用户名和密码
- 查询语句
- 查询结果数据
- 所有传输内容

**何时勾选**:
- ✅ 连接**远程生产环境**数据库 (强烈推荐)
- ✅ 在公网上传输敏感数据
- ✅ 公司安全政策要求
- ❌ 本地 localhost 连接 (不必要)

**配置要求**:
MySQL 服务器需要配置 SSL 证书:
```sql
-- 检查 MySQL 是否支持 SSL
SHOW VARIABLES LIKE '%ssl%';

-- 输出示例
have_ssl: YES
ssl_ca: /etc/mysql/ssl/ca.pem
ssl_cert: /etc/mysql/ssl/server-cert.pem
ssl_key: /etc/mysql/ssl/server-key.pem
```

**是否勾选**:
- ✅ **勾选**: 远程连接生产数据库 (47.79.232.189)
- ❌ **不勾选**: 本地开发 (localhost)

---

## 🎯 你的场景推荐配置

### 场景 1: 连接本地 MySQL (开发)

```
连接方式: TCP/IP
Host: localhost
Username: root
Password: (你的密码)
Database: bitcoin_mining_master
Port: 3306

高级选项:
☐ Allow LOCAL_DATA_INFILE (不需要)
☐ Enable Cleartext Plugin (不需要)
☐ Require SSL (本地无需加密)
```

**或者使用 Socket (更快)**:
```
连接方式: Socket
Username: root
Password: (你的密码)
Socket: /tmp/mysql.sock

高级选项: 全部不勾选
```

---

### 场景 2: 连接远程生产数据库 (47.79.232.189)

#### 方案 A: 直接 TCP/IP 连接 (当前)
```
连接方式: TCP/IP
Host: 47.79.232.189
Username: bitcoin_mining_master
Password: FzFbWmwMptnN3ABE
Database: bitcoin_mining_master
Port: 3306

高级选项:
☐ Allow LOCAL_DATA_INFILE (不需要)
☐ Enable Cleartext Plugin (不需要)
☑ Require SSL (推荐,如果服务器支持)
```

#### 方案 B: SSH 隧道连接 (更安全,推荐)
```
连接方式: SSH

MySQL 信息:
  Host: localhost (通过隧道连接)
  Username: bitcoin_mining_master
  Password: FzFbWmwMptnN3ABE
  Database: bitcoin_mining_master
  Port: 3306

SSH 信息:
  SSH Host: 47.79.232.189
  SSH User: root (或你的服务器用户名)
  SSH Password: (服务器密码)
  SSH Port: 22

高级选项:
☐ Allow LOCAL_DATA_INFILE
☐ Enable Cleartext Plugin
☐ Require SSL (SSH 已加密,可选)
```

---

## 📊 对比总结

| 选项 | 安全性 | 速度 | 适用场景 | 推荐 |
|------|--------|------|----------|------|
| **TCP/IP** | ⭐⭐⭐ | ⭐⭐⭐⭐ | 本地/远程都可 | ✅ 日常使用 |
| **Socket** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | 仅本地 | ✅ 本地最快 |
| **SSH** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | 远程安全连接 | ✅ 生产环境 |
| **LOCAL_DATA_INFILE** | ⚠️ 低 | - | 导入本地文件 | ⚠️ 需要时才启用 |
| **Cleartext Plugin** | ⚠️ 很低 | - | 特殊认证 | ❌ 不推荐 |
| **Require SSL** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | 远程加密 | ✅ 远程必须 |

---

## 💡 快速决策指南

### 我应该选择哪个连接方式?

```
┌─ 连接本地 MySQL?
│   ├─ 是 → 优先选择 Socket (最快)
│   │       └─ Socket 失败? → 使用 TCP/IP (localhost)
│   │
│   └─ 否 → 连接远程 MySQL
│       ├─ 生产环境? → 使用 SSH (最安全)
│       │               └─ 勾选 Require SSL
│       │
│       └─ 开发/测试? → 使用 TCP/IP
│                       └─ 考虑勾选 Require SSL
```

### 高级选项要勾选吗?

```
Allow LOCAL_DATA_INFILE:
  ├─ 需要导入 CSV/TXT 文件? → ✅ 勾选
  └─ 日常使用? → ❌ 不勾选 (更安全)

Enable Cleartext Plugin:
  └─ 几乎永远 → ❌ 不勾选

Require SSL:
  ├─ 远程连接? → ✅ 勾选 (如果服务器支持)
  └─ 本地连接? → ❌ 不勾选 (无必要)
```

---

## 🔍 实际测试

### 测试本地连接
```bash
# 方法 1: TCP/IP
mysql -h localhost -u root -p

# 方法 2: Socket
mysql -u root -p --socket=/tmp/mysql.sock

# 查看当前 socket 路径
mysql_config --socket
# 或
mysqladmin variables | grep socket
```

### 检查 SSL 是否启用
```sql
-- 连接后执行
SHOW VARIABLES LIKE '%ssl%';

-- 查看当前连接是否使用 SSL
SHOW STATUS LIKE 'Ssl_cipher';
-- 如果返回值不为空,说明正在使用 SSL
```

---

## 🎓 总结

**你看到的界面中**:

1. **TCP/IP** = 网络连接 (最常用)
2. **Socket** = 本地文件连接 (最快)
3. **SSH** = 加密隧道连接 (最安全)

4. **Allow LOCAL_DATA_INFILE** = 允许导入本地文件 (有风险)
5. **Enable Cleartext Plugin** = 明文密码传输 (不安全,别用)
6. **Require SSL** = 强制加密连接 (远程推荐)

**对于你的项目**:
- 本地开发: `Socket` 或 `TCP/IP (localhost)` + 都不勾选
- 远程查看: `SSH` 或 `TCP/IP` + 勾选 `Require SSL`

现在可以放心连接了! 🚀
