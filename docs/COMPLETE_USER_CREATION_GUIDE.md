# 🎯 创建用户到云服务器 MySQL - 完整操作步骤

## 📋 前置检查

### 1. 检查服务器状态

```bash
# 方法1: 使用检查脚本
ssh -t root@47.79.232.189 'bash /tmp/check_services.sh'

# 方法2: 直接查看 PM2
ssh root@47.79.232.189 'pm2 list'

# 方法3: 检查端口监听
ssh root@47.79.232.189 'netstat -tlnp | grep 8888'
```

### 2. 如果服务未运行，启动服务

```bash
# 使用远程启动脚本
bash "/Users/davidpony/Desktop/Bitcoin Mining Master/server/pm2/remote_start.sh"

# 或者手动启动
ssh root@47.79.232.189 'cd /root/Bitcoin\ Mining\ Master/backend && pm2 start ecosystem.config.js'
```

---

## 🚀 方法一：使用 curl 命令（最简单）

### 步骤 1: 测试服务器健康状态

```bash
curl http://47.79.232.189:8888/api/health
```

**期望输出**:
```json
{"status":"ok","db":"connected","timestamp":1700000000000}
```

如果返回错误，说明服务未启动，请先启动服务。

---

### 步骤 2: 创建用户

复制以下命令并替换用户信息：

```bash
curl -X POST http://47.79.232.189:8888/api/userInformation \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "USER1763995900001",
    "invitation_code": "INV95900001",
    "email": "test001@example.com",
    "android_id": "android_001",
    "gaid": "gaid_001",
    "register_ip": "192.168.1.100",
    "country": "US"
  }'
```

**成功的响应示例**:
```json
{
  "id": 1,
  "user_id": "USER1763995900001",
  "invitation_code": "INV95900001",
  "email": "test001@example.com",
  "android_id": "android_001",
  "gaid": "gaid_001",
  "register_ip": "192.168.1.100",
  "country": "US",
  "user_creation_time": "2025-11-24T10:00:00.000Z"
}
```

---

### 步骤 3: 验证用户已创建

```bash
# 查看所有用户
curl http://47.79.232.189:8888/api/userInformation

# 使用 jq 美化输出（如果安装了 jq）
curl http://47.79.232.189:8888/api/userInformation | jq '.'
```

---

## 🗄️ 方法二：直接操作 MySQL（推荐用于学习）

### 步骤 1: SSH 登录服务器

```bash
ssh root@47.79.232.189
```

### 步骤 2: 登录 MySQL

```bash
mysql -u root -p
# 输入密码（你的MySQL root密码）
```

### 步骤 3: 选择数据库

```sql
USE bitcoin_mining_master;
```

### 步骤 4: 查看表结构

```sql
DESCRIBE user_information;
```

### 步骤 5: 创建用户

```sql
INSERT INTO user_information (
  user_id,
  invitation_code,
  email,
  android_id,
  gaid,
  register_ip,
  country,
  user_creation_time
) VALUES (
  'USER1763995900002',
  'INV95900002',
  'test002@example.com',
  'android_002',
  'gaid_002',
  '192.168.1.100',
  'US',
  NOW()
);
```

### 步骤 6: 验证创建成功

```sql
SELECT * FROM user_information WHERE user_id = 'USER1763995900002';
```

### 步骤 7: 创建对应的用户状态记录

```sql
INSERT INTO user_status (
  user_id,
  bitcoin_accumulated_amount,
  current_bitcoin_balance,
  total_invitation_rebate,
  total_withdrawal_amount,
  last_login_time,
  user_status
) VALUES (
  'USER1763995900002',
  0.000000000000000000,
  0.000000000000000000,
  0.000000000000000000,
  0.000000000000000000,
  NOW(),
  'normal'
);
```

### 步骤 8: 验证用户状态

```sql
SELECT * FROM user_status WHERE user_id = 'USER1763995900002';
```

### 步骤 9: 退出

```sql
EXIT;
```

---

## 🌐 方法三：使用 phpMyAdmin（最直观）

### 步骤 1: 访问 phpMyAdmin

打开浏览器访问:
```
http://47.79.232.189:8888/phpmyadmin
```

### 步骤 2: 登录

- 用户名: `root`
- 密码: `你的MySQL密码`

### 步骤 3: 选择数据库

左侧导航栏点击 `bitcoin_mining_master`

### 步骤 4: 插入数据

1. 点击 `user_information` 表
2. 点击顶部的 "插入" 标签
3. 填写表单:
   - `user_id`: USER1763995900003
   - `invitation_code`: INV95900003
   - `email`: test003@example.com
   - `android_id`: android_003
   - `gaid`: gaid_003
   - `register_ip`: 192.168.1.100
   - `country`: US
   - `user_creation_time`: (使用当前时间)
4. 点击 "执行" 按钮

### 步骤 5: 查看数据

1. 点击 "浏览" 标签
2. 找到刚创建的用户
3. 确认数据正确

### 步骤 6: 创建用户状态

1. 点击左侧 `user_status` 表
2. 点击 "插入" 标签
3. 填写表单:
   - `user_id`: USER1763995900003
   - `bitcoin_accumulated_amount`: 0.000000000000000000
   - `current_bitcoin_balance`: 0.000000000000000000
   - `total_invitation_rebate`: 0.000000000000000000
   - `total_withdrawal_amount`: 0.000000000000000000
   - `last_login_time`: (使用当前时间)
   - `user_status`: normal
4. 点击 "执行"

---

## 🧪 方法四：使用测试脚本（自动化）

### 前提条件

1. 确保服务器正在运行
2. 已安装 axios

```bash
cd /Users/davidpony/Desktop/Bitcoin\ Mining\ Master/backend
npm install axios
```

### 运行测试

```bash
node test_create_user.js
```

---

## ✅ 验证数据的方法

### 方法 1: API 查询

```bash
curl http://47.79.232.189:8888/api/userInformation
```

### 方法 2: MySQL 命令行

```bash
ssh root@47.79.232.189 "mysql -u root -p -e 'SELECT * FROM bitcoin_mining_master.user_information ORDER BY id DESC LIMIT 5;'"
```

### 方法 3: phpMyAdmin

访问 http://47.79.232.189:8888/phpmyadmin 并浏览表

---

## 📊 测试数据生成器

### 生成唯一的用户ID

```bash
echo "USER$(date +%s)$RANDOM"
```

### 生成唯一的邀请码

```bash
echo "INV$(date +%s | cut -c 5-)"
```

### 生成唯一的邮箱

```bash
echo "test$(date +%s)@example.com"
```

---

## 🐛 常见问题

### 问题 1: 连接超时

```bash
# 检查服务是否运行
ssh root@47.79.232.189 'pm2 list'

# 启动服务
ssh root@47.79.232.189 'cd /root/Bitcoin\ Mining\ Master/backend && pm2 start ecosystem.config.js'
```

### 问题 2: 端口未开放

```bash
# 检查防火墙
ssh root@47.79.232.189 'ufw status'

# 开放端口
ssh root@47.79.232.189 'ufw allow 8888'
```

### 问题 3: 数据库连接失败

```bash
# 检查 MySQL 状态
ssh root@47.79.232.189 'systemctl status mysql'

# 重启 MySQL
ssh root@47.79.232.189 'systemctl restart mysql'
```

### 问题 4: 用户ID重复

- 每次都使用新的时间戳: `USER$(date +%s)$RANDOM`
- 或者手动指定不同的ID

---

## 🎯 快速测试命令（一键执行）

```bash
# 生成随机数据
TIMESTAMP=$(date +%s)
USER_ID="USER${TIMESTAMP}$RANDOM"
INV_CODE="INV${TIMESTAMP:5:8}"
EMAIL="test${TIMESTAMP}@example.com"

# 创建用户
curl -X POST http://47.79.232.189:8888/api/userInformation \
  -H "Content-Type: application/json" \
  -d "{
    \"user_id\": \"${USER_ID}\",
    \"invitation_code\": \"${INV_CODE}\",
    \"email\": \"${EMAIL}\",
    \"android_id\": \"android_${TIMESTAMP}\",
    \"gaid\": \"gaid_${TIMESTAMP}\",
    \"register_ip\": \"192.168.1.100\",
    \"country\": \"US\"
  }"

# 显示创建的用户信息
echo ""
echo "创建的用户:"
echo "  用户ID: ${USER_ID}"
echo "  邀请码: ${INV_CODE}"
echo "  邮箱: ${EMAIL}"
```

---

## 📝 完整测试记录模板

```
测试时间: 2025-11-24 10:00:00
测试人员: [你的名字]

1. 服务器状态: ✅ 正常 / ❌ 异常
2. 数据库连接: ✅ 成功 / ❌ 失败
3. 用户创建: ✅ 成功 / ❌ 失败

创建的用户信息:
- 用户ID: USER1763995900001
- 邮箱: test001@example.com
- 创建时间: 2025-11-24 10:00:00

验证结果:
- API查询: ✅ 能查到
- MySQL查询: ✅ 数据正确
- phpMyAdmin: ✅ 显示正常

问题记录:
[无] 或 [描述遇到的问题]
```

---

## 🚀 推荐的测试流程

1. ✅ **检查服务器状态** - 确保后端服务运行中
2. ✅ **测试健康检查** - `curl http://47.79.232.189:8888/api/health`
3. ✅ **创建测试用户** - 使用 curl 或 MySQL
4. ✅ **验证数据** - 通过 API、MySQL 或 phpMyAdmin
5. ✅ **创建用户状态** - 确保数据完整性
6. ✅ **记录测试结果** - 保存测试数据

---

现在你可以选择任何一种方法来测试创建用户！

