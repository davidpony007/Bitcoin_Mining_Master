# MySQL 本地数据库配置指南

## 📊 当前状态

✅ **Sequel Ace 已安装** - MySQL 图形界面工具  
✅ **Redis 已运行** - 本地 Redis 服务正常  
❌ **MySQL 密码未知** - 需要通过 Sequel Ace 连接  

---

## 🔧 配置步骤

### 步骤 1: 使用 Sequel Ace 连接 MySQL

1. **打开 Sequel Ace** (已在应用程序文件夹)
   
2. **新建连接**, 使用以下信息尝试:
   
   **标准连接 (Standard)**:
   ```
   Name: 本地 MySQL
   Host: localhost (或 127.0.0.1)
   Username: root
   Password: (留空或尝试: root, password, mysql)
   Database: (留空)
   Port: 3306
   ```

3. **如果连接失败**, 尝试 Socket 连接:
   ```
   连接类型: Socket
   Name: 本地 MySQL (Socket)
   Username: root  
   Password: (留空或尝试常见密码)
   Socket: /tmp/mysql.sock
   ```

4. **连接成功后**:
   - 在左侧数据库列表中,点击 "选择数据库" 下拉菜单
   - 点击 "添加数据库" 按钮
   - 输入数据库名: `bitcoin_mining_master`
   - 字符集选择: `utf8mb4`
   - 排序规则: `utf8mb4_unicode_ci`
   - 点击 "添加" 按钮

---

### 步骤 2: 记录连接信息

连接成功后,记录下实际使用的密码,然后更新配置文件。

---

### 步骤 3: 修改项目配置

#### 方案 A: 使用本地数据库

编辑 `backend/.env` 文件:

```env
# 数据库配置 - 改为本地
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=在这里填写你的MySQL密码
DB_NAME=bitcoin_mining_master
DB_DIALECT=mysql

# Redis 配置 - 改为本地
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_DB=0
REDIS_PASSWORD=
REDIS_KEY_PREFIX=bmm:

# 其他配置保持不变
JWT_SECRET=your_jwt_secret_key_here_change_in_production
JWT_EXPIRES_IN=24h
PORT=8888
NODE_ENV=development
```

#### 方案 B: 继续使用远程数据库

保持 `backend/.env` 不变,继续使用:
```env
DB_HOST=47.79.232.189
REDIS_HOST=47.79.232.189
```

---

### 步骤 4: 运行数据库迁移

如果使用本地数据库,需要运行迁移:

```bash
cd backend

# 确保依赖已安装
npm install

# 运行数据库迁移
npx sequelize-cli db:migrate

# 查看数据库表
npx sequelize-cli db:migrate:status
```

---

## 🎯 快速操作命令

### 打开 Sequel Ace
```bash
open -a "Sequel Ace"
```

### 查看 MySQL 进程
```bash
ps aux | grep mysqld | grep -v grep
```

### 查看 MySQL 配置文件位置
```bash
mysql --help | grep "Default options" -A 1
```

### 测试 Redis 连接
```bash
redis-cli ping
# 应该返回: PONG
```

---

## 📝 Sequel Ace 使用技巧

### 1. 创建数据库
- 点击左下角 "选择数据库" 旁的 ⚙️ 图标
- 选择 "添加数据库"
- 输入名称和字符集

### 2. 导入 SQL 文件
- 选择数据库
- 点击顶部 "文件" → "导入"
- 选择 SQL 文件

### 3. 执行 SQL 查询
- 点击顶部 "查询" 标签
- 输入 SQL 语句
- 按 Cmd + R 执行

### 4. 导出数据库
- 选择数据库
- 点击 "文件" → "导出"
- 选择导出格式 (SQL)

### 5. 查看表结构
- 在左侧选择数据库
- 点击表名
- 查看 "结构" 标签

---

## 🔐 重置 MySQL Root 密码 (如果需要)

如果完全无法连接 MySQL,可以重置密码:

### macOS 系统 MySQL 重置密码

1. **停止 MySQL**:
   ```bash
   sudo launchctl unload -w /Library/LaunchDaemons/com.oracle.oss.mysql.mysqld.plist
   ```

2. **以安全模式启动**:
   ```bash
   sudo /usr/local/mysql/bin/mysqld_safe --skip-grant-tables &
   ```

3. **连接并重置密码**:
   ```bash
   mysql -u root
   ```
   
   在 MySQL 中执行:
   ```sql
   FLUSH PRIVILEGES;
   ALTER USER 'root'@'localhost' IDENTIFIED BY 'your_new_password';
   FLUSH PRIVILEGES;
   exit;
   ```

4. **重启 MySQL**:
   ```bash
   sudo launchctl load -w /Library/LaunchDaemons/com.oracle.oss.mysql.mysqld.plist
   ```

---

## 🌐 使用远程数据库测试连接

你也可以在 Sequel Ace 中连接远程数据库:

```
Name: 远程 Bitcoin Mining
Host: 47.79.232.189
Username: bitcoin_mining_master
Password: FzFbWmwMptnN3ABE
Database: bitcoin_mining_master
Port: 3306
```

这样可以查看生产环境的数据结构,然后在本地复制相同的结构。

---

## 📚 下一步

1. ✅ 打开 Sequel Ace
2. ✅ 尝试连接本地 MySQL
3. ✅ 创建 `bitcoin_mining_master` 数据库
4. ✅ 更新 `backend/.env` 配置
5. ✅ 运行数据库迁移
6. ✅ 启动项目测试

---

## 💡 推荐方案

### 本地开发 + 本地数据库

**优点**:
- ✅ 速度快,无网络延迟
- ✅ 可以随意测试,不影响生产数据
- ✅ 离线也能开发

**缺点**:
- ❌ 需要配置本地环境
- ❌ 数据需要手动同步

### 本地开发 + 远程数据库

**优点**:
- ✅ 配置简单,无需本地 MySQL
- ✅ 数据与生产环境一致
- ✅ 多设备共享同一数据

**缺点**:
- ❌ 依赖网络连接
- ❌ 可能影响生产数据(需谨慎)
- ❌ 速度较慢

**我的建议**: 使用本地数据库开发,定期从远程同步数据结构。

---

## ❓ 常见问题

### Q: Sequel Ace 无法连接?
A: 确保 MySQL 正在运行: `ps aux | grep mysqld`

### Q: 忘记 MySQL 密码?
A: 使用上面的 "重置密码" 步骤

### Q: 如何在 Sequel Ace 中执行迁移文件?
A: 不推荐。应该使用命令行 `npx sequelize-cli db:migrate`

### Q: 本地和远程数据库可以同时配置吗?
A: 可以创建不同的 .env 文件,如 `.env.local` 和 `.env.production`

---

需要帮助? 请参考:
- Sequel Ace 官方文档: https://sequel-ace.com/
- MySQL 官方文档: https://dev.mysql.com/doc/
