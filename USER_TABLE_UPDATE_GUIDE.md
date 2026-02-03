# user_information 表结构更新说明

## 修改内容
1. ✅ **删除 password 字段** - 不再需要
2. ✅ **country 改为 country_code** - 存储国家代码(如:CN, US)
3. ✅ **添加 country_name_cn** - 存储国家中文名称(如:中国, 美国)
4. ✅ **country_multiplier 对应 country_mining_config.mining_multiplier** - 自动同步挖矿倍率
5. ✅ **添加 miner_level_multiplier** - 矿工等级挖矿倍率，默认1.00

## 执行步骤

### 方法1: 使用Shell脚本（推荐）

在服务器上执行：
```bash
cd /root
chmod +x update-user-table.sh
./update-user-table.sh
```

### 方法2: 手动执行SQL

登录MySQL：
```bash
docker exec -it bitcoin_mysql_prod mysql -u root -p bitcoin_mining_master
# 密码: Bitcoin2024@Secure
```

然后执行以下SQL：

```sql
-- 1. 删除password字段
ALTER TABLE user_information DROP COLUMN IF EXISTS password;

-- 2. 重命名country为country_code
ALTER TABLE user_information 
  CHANGE COLUMN country country_code VARCHAR(32) 
  COMMENT '用户所在国家代码（如：CN, US等）';

-- 3. 添加country_name_cn字段
ALTER TABLE user_information 
  ADD COLUMN country_name_cn VARCHAR(50) DEFAULT NULL 
  COMMENT '国家中文名称（对应 country_mining_config.country_name_cn）'
  AFTER country_code;

-- 4. 添加miner_level_multiplier字段
ALTER TABLE user_information 
  ADD COLUMN miner_level_multiplier DECIMAL(4, 2) DEFAULT 1.00 
  COMMENT '矿工等级挖矿倍率'
  AFTER country_multiplier;

-- 5. 更新索引
ALTER TABLE user_information DROP INDEX IF EXISTS idx_country;
ALTER TABLE user_information ADD INDEX idx_country_code (country_code);

-- 6. 从country_mining_config同步数据
UPDATE user_information ui
LEFT JOIN country_mining_config cmc ON ui.country_code = cmc.country_code
SET 
  ui.country_name_cn = cmc.country_name_cn,
  ui.country_multiplier = COALESCE(cmc.mining_multiplier, 1.00)
WHERE ui.country_code IS NOT NULL AND ui.country_code != '';

-- 7. 验证结果
SELECT 
  COUNT(*) as total_users,
  COUNT(country_code) as users_with_country_code,
  COUNT(country_name_cn) as users_with_country_name,
  AVG(country_multiplier) as avg_country_multiplier,
  AVG(miner_level_multiplier) as avg_miner_multiplier
FROM user_information;

-- 8. 查看示例数据
SELECT 
  user_id,
  country_code,
  country_name_cn,
  country_multiplier,
  miner_level_multiplier,
  user_level
FROM user_information 
WHERE country_code IS NOT NULL
LIMIT 10;
```

## 需要更新的文件

### 1. 模型文件已更新
- ✅ `/backend/src/models/userInformation.js`

### 2. 需要手动更新的控制器文件
以下文件中所有 `country` 字段需改为 `country_code`：

#### `/backend/src/controllers/authController.js`
需要修改的地方：
- Line 59: `console.log('   country:', country);` → `console.log('   country_code:', country);`
- Line 119: `country: detectedCountry || null` → `country_code: detectedCountry || null`
- Line 436: `console.log('   - country:', country);` → `console.log('   - country_code:', country);`
- Line 504: `updateData.country = ...` → `updateData.country_code = ...`
- Line 538: `country: detectedCountry ...` → `country_code: detectedCountry ...`
- Line 813, 827: `'country'` → `'country_code', 'country_name_cn'`

并在创建用户时添加：
```javascript
// 获取国家信息（中文名称和挖矿倍率）
let countryNameCn = null;
let countryMultiplier = 1.00;
if (detectedCountry) {
  try {
    const CountryMiningConfig = require('../models/countryMiningConfig');
    const countryConfig = await CountryMiningConfig.findOne({
      where: { country_code: detectedCountry.trim() }
    });
    if (countryConfig) {
      countryNameCn = countryConfig.country_name_cn;
      countryMultiplier = countryConfig.mining_multiplier || 1.00;
    }
  } catch (err) {
    console.log('获取国家配置失败:', err.message);
  }
}

// 创建用户时使用这些值
user = await UserInformation.create({
  // ... 其他字段
  country_code: detectedCountry ? detectedCountry.trim() : null,
  country_name_cn: countryNameCn,
  country_multiplier: countryMultiplier,
  miner_level_multiplier: 1.00
});
```

#### `/backend/src/services/multiplierService.js` 和 `/backend/src/services/multiplierService-new.js`
- Line 24: `'country'` → `'country_code'`
- Line 44: `country: user.country` → `country_code: user.country_code`
- Line 108: `where: { country: country }` → `where: { country_code: country }`

#### `/backend/src/services/levelService.js`
- Line 269-271: `user.country` → `user.country_code`

#### `/backend/src/services/invitationRewardService.js` 和 `/backend/src/services/adService.js`
- `u.country` → `u.country_code`
- `r.country` → `r.country_code`

## 验证步骤

执行完成后，验证：

```sql
-- 1. 检查字段是否存在
SHOW COLUMNS FROM user_information;

-- 2. 查看有国家信息的用户
SELECT country_code, country_name_cn, country_multiplier, COUNT(*) as user_count
FROM user_information
WHERE country_code IS NOT NULL
GROUP BY country_code, country_name_cn, country_multiplier
ORDER BY user_count DESC;

-- 3. 验证最新用户
SELECT 
  user_id,
  email,
  country_code,
  country_name_cn,
  country_multiplier,
  miner_level_multiplier,
  user_creation_time
FROM user_information
ORDER BY user_creation_time DESC
LIMIT 5;
```

## 预期结果

- password 字段已删除
- country 字段已改名为 country_code
- country_name_cn 字段已添加并填充（如：中国、美国）
- country_multiplier 已从 country_mining_config 同步
- miner_level_multiplier 字段已添加，默认值为 1.00
- 所有索引已正确更新

## 注意事项

1. 执行SQL前建议备份数据库
2. 更新后需要重启后端服务：`docker restart bitcoin_backend_prod`
3. 前端代码中如果有用到 country 字段，也需要相应更新为 country_code
