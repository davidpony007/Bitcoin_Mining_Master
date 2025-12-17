# 🔧 Sequel Ace 连接失败解决方案

## ❌ 当前问题

**错误信息**: `Can't connect to local MySQL server through socket '/tmp/mysql.sock'`

**原因**: 
- 你选择了 "Socket" 连接方式
- 但 MySQL 的 socket 文件不在 `/tmp/mysql.sock` 这个位置
- 你的 MySQL 安装在 `/usr/local/mysql/`(旧版本)

---

## ✅ 解决方案 (推荐)

### 方案 1: 改用 TCP/IP 连接 ⭐ 最简单

在 Sequel Ace 连接界面:

1. **点击 "TCP/IP" 标签页** (不要用 Socket)

2. **填写以下信息**:
   ```
   Name: 本地MySQL
   Host: 127.0.0.1  (或 localhost)
   Username: root
   Password: (你刚才输入的那个密码)
   Database: bitcoin_mining_master  (可选)
   Port: 3306
   ```

3. **高级选项**: 三个都不勾选
   - ☐ Allow LOCAL_DATA_INFILE
   - ☐ Enable Cleartext Plugin  
   - ☐ Require SSL

4. **点击 "Connect" 按钮**

---

## 📝 详细步骤截图说明

### 当前你的界面:
```
❌ 正在连接... (Socket 方式 - 会失败)
   ↓
   Username: root
   Password: ••••••••••••••••
   Database: bitcoin_mining_master
```

### 需要改成:
```
✅ TCP/IP (点击这个标签)
   ↓
   Host: 127.0.0.1
   Username: root
   Password: (相同密码)
   Database: bitcoin_mining_master
   Port: 3306
```

---

## 🔍 方案 2: 找到正确的 Socket 路径 (高级)

如果你坚持使用 Socket 连接:

### 步骤 1: 查找 MySQL 配置文件
```bash
# 查看 MySQL 配置
cat /etc/my.cnf
# 或
cat /usr/local/mysql/my.cnf
```

### 步骤 2: 查找 socket 配置项
找到类似这样的配置:
```ini
[mysqld]
socket = /var/mysql/mysql.sock

[client]
socket = /var/mysql/mysql.sock
```

### 步骤 3: 在 Sequel Ace 中使用正确路径
- 连接方式: Socket
- Socket 路径: (从配置文件中找到的路径)
- Username: root
- Password: (你的密码)

**但这太麻烦了!建议直接用 TCP/IP**

---

## 🎯 快速对比

| 连接方式 | 难度 | 成功率 | 推荐 |
|---------|------|--------|------|
| **TCP/IP (127.0.0.1)** | ⭐ 简单 | ✅ 99% | ✅ 强烈推荐 |
| **TCP/IP (localhost)** | ⭐ 简单 | ✅ 99% | ✅ 推荐 |
| **Socket** | ⭐⭐⭐ 复杂 | ⚠️ 50% | ❌ 不推荐 (路径难找) |

---

## 💡 为什么 TCP/IP 更好?

1. ✅ **不需要知道 socket 文件路径**
2. ✅ **配置简单,就填 IP 地址**
3. ✅ **和远程连接方式一样**
4. ✅ **几乎不会出错**

Socket 虽然理论上速度快 0.001 秒,但:
- ❌ 需要找到正确的文件路径
- ❌ 不同安装方式路径不同
- ❌ 容易出错

**对于本地开发,这 0.001 秒差距完全感觉不到!**

---

## 🚀 立即操作

**现在请在 Sequel Ace 中:**

1. 关闭当前错误对话框 (点击 "好")
2. 点击顶部的 **"TCP/IP"** 标签
3. 填写:
   - Host: `127.0.0.1`
   - Username: `root`
   - Password: (你的密码)
   - Database: `bitcoin_mining_master`
   - Port: `3306`
4. 点击 "Connect"

**应该就能成功连接了!** 🎉

---

## ❓ 如果还是失败?

### 错误 1: "Access denied for user 'root'@'localhost'"
**原因**: 密码错误

**解决**:
1. 尝试留空密码 (Password 不填)
2. 尝试常见密码: `root`, `password`, `mysql`
3. 需要重置 MySQL 密码

### 错误 2: "Connection refused"
**原因**: MySQL 未运行

**解决**:
```bash
# 检查 MySQL 是否运行
ps aux | grep mysqld

# 如果没运行,启动它 (根据你的安装方式)
brew services start mysql
# 或
sudo /usr/local/mysql/support-files/mysql.server start
```

### 错误 3: "Can't connect to MySQL server on '127.0.0.1'"
**原因**: MySQL 没有监听 3306 端口

**解决**:
```bash
# 检查端口
lsof -i :3306

# 查看 MySQL 监听的端口
netstat -an | grep 3306
```

---

## 📞 需要帮助?

如果 TCP/IP 方式还是连接失败,请告诉我:
1. 错误信息是什么?
2. Password 留空能连上吗?
3. 执行命令的结果:
   ```bash
   mysql -u root -h 127.0.0.1 -p
   ```

我会进一步帮你诊断! 🔧
