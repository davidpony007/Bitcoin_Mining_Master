# SSH连接失败 - 手动执行指南

## 问题诊断
- ✅ 服务器网络可达（ping通，延迟500ms）
- ✅ SSH端口22开放（nc测试成功）
- ❌ SSH连接在密钥交换阶段就被关闭

## 可能原因
1. SSH服务器达到MaxSessions或MaxStartups限制
2. 防火墙临时限制了连接频率
3. SSH服务需要重启

## 解决方案

### 方案1：使用阿里云控制台
1. 登录阿里云控制台
2. 找到ECS实例（47.79.232.189）
3. 使用"远程连接" → "VNC连接"
4. 登录后执行以下命令

### 方案2：等待后重试
等待10-30分钟后，SSH服务可能自动恢复，然后执行：
```bash
cd /Users/davidpony/Desktop/工程文件夹/Bitcoin_Mining_Master
./execute-db-update.sh
./upload-model-and-restart.sh
```

### 方案3：手动在VNC中执行（推荐）

登录VNC后，逐条执行以下命令：

```bash
# 1. 进入MySQL
docker exec -it bitcoin_mysql_prod mysql -u root -pBitcoin2024@Secure bitcoin_mining_master

# 2. 在MySQL中执行（复制粘贴全部）
ALTER TABLE user_information DROP COLUMN IF EXISTS password;

ALTER TABLE user_information CHANGE COLUMN country country_code VARCHAR(32) COMMENT '用户所在国家代码';

ALTER TABLE user_information ADD COLUMN country_name_cn VARCHAR(50) DEFAULT NULL COMMENT '国家中文名称' AFTER country_code;

ALTER TABLE user_information ADD COLUMN miner_level_multiplier DECIMAL(4, 2) DEFAULT 1.00 COMMENT '矿工等级挖矿倍率' AFTER country_multiplier;

ALTER TABLE user_information DROP INDEX IF EXISTS idx_country;

ALTER TABLE user_information ADD INDEX idx_country_code (country_code);

UPDATE user_information ui 
LEFT JOIN country_mining_config cmc ON ui.country_code = cmc.country_code
SET ui.country_name_cn = cmc.country_name_cn, 
    ui.country_multiplier = COALESCE(cmc.mining_multiplier, 1.00)
WHERE ui.country_code IS NOT NULL AND ui.country_code != '';

-- 验证结果
SELECT COUNT(*) as total, 
       COUNT(country_code) as with_code, 
       COUNT(country_name_cn) as with_name 
FROM user_information;

SELECT user_id, country_code, country_name_cn, country_multiplier, miner_level_multiplier 
FROM user_information 
ORDER BY user_creation_time DESC LIMIT 5;

exit;

# 3. 退出MySQL后，重启SSH服务（可选）
systemctl restart sshd

# 4. 检查SSH状态
systemctl status sshd
```

### 方案4：重启SSH服务后再试
在VNC中执行：
```bash
systemctl restart sshd
systemctl status sshd
```

然后在本地重试：
```bash
ssh root@47.79.232.189 "echo 'SSH已恢复'"
```

## 后续步骤

SSH恢复后执行：

```bash
# 上传模型文件
cd /Users/davidpony/Desktop/工程文件夹/Bitcoin_Mining_Master
./upload-model-and-restart.sh
```

或手动执行：
```bash
scp backend/src/models/userInformation.js root@47.79.232.189:/root/bitcoin-docker/backend/src/models/

ssh root@47.79.232.189 "docker cp /root/bitcoin-docker/backend/src/models/userInformation.js bitcoin_backend_prod:/app/src/models/ && docker restart bitcoin_backend_prod"
```

## 验证步骤

数据库更新完成后，在MySQL中验证：
```sql
SHOW COLUMNS FROM user_information;

SELECT * FROM user_information WHERE country_code IS NOT NULL LIMIT 5;
```

应该看到：
- ✅ password字段不存在
- ✅ country_code字段存在
- ✅ country_name_cn字段存在
- ✅ miner_level_multiplier字段存在
- ✅ country_code有值的记录，country_name_cn也有对应的中文名称
