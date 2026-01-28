# 🔧 设备登录逻辑修复方案

## 修复清单

### ✅ P0 - 立即修复
- [ ] 添加 android_id 唯一索引
- [ ] 添加 invitation_code 唯一约束  
- [ ] 使用 findOrCreate 防止并发重复

### ⏳ P1 - 近期修复
- [ ] android_id 字段长度扩展
- [ ] 增强错误处理

---

## 一、数据库迁移脚本

### 文件：`backend/migrations/20260124_add_android_id_unique_index.sql`

```sql
-- =============================================================================
-- 迁移：添加 android_id 和 invitation_code 唯一索引
-- 创建时间：2026-01-24
-- 目的：
--   1. 确保 android_id 唯一性（一个设备对应一个账号）
--   2. 确保 invitation_code 唯一性（防止邀请码冲突）
--   3. 提升查询性能
-- =============================================================================

USE bitcoin_mining_db;

-- 1️⃣ 先检查是否有重复数据
SELECT '检查重复的 android_id...' AS step;
SELECT android_id, COUNT(*) as count
FROM user_information
WHERE android_id IS NOT NULL AND android_id != ''
GROUP BY android_id
HAVING COUNT(*) > 1;

SELECT '检查重复的 invitation_code...' AS step;
SELECT invitation_code, COUNT(*) as count
FROM user_information
WHERE invitation_code IS NOT NULL AND invitation_code != ''
GROUP BY invitation_code
HAVING COUNT(*) > 1;

-- 如果有重复数据，需要先清理
-- ⚠️ 以下是清理脚本，请根据实际情况调整

-- 清理重复的 android_id（保留最早的记录）
-- DELETE t1 FROM user_information t1
-- INNER JOIN user_information t2 
-- WHERE t1.id > t2.id 
--   AND t1.android_id = t2.android_id
--   AND t1.android_id IS NOT NULL;

-- 2️⃣ 删除旧索引（如果存在）
SELECT '删除旧索引...' AS step;
DROP INDEX IF EXISTS idx_android_id ON user_information;
DROP INDEX IF EXISTS idx_invitation_code ON user_information;

-- 3️⃣ 增加 android_id 字段长度（支持更长的设备指纹）
SELECT '扩展 android_id 字段长度...' AS step;
ALTER TABLE user_information
MODIFY COLUMN android_id VARCHAR(255) NULL
COMMENT 'Android设备ID（支持长指纹）';

-- 4️⃣ 添加 android_id 唯一索引
-- 注意：使用 WHERE 条件允许多个 NULL 值，但非空值必须唯一
SELECT '添加 android_id 唯一索引...' AS step;
CREATE UNIQUE INDEX idx_android_id_unique 
ON user_information(android_id)
WHERE android_id IS NOT NULL AND android_id != '';

-- MySQL 8.0+ 语法（如果上面的语法不支持，使用这个）
-- 注意：这会要求所有 android_id 必须唯一（包括 NULL）
-- CREATE UNIQUE INDEX idx_android_id_unique ON user_information(android_id);

-- 5️⃣ 添加 invitation_code 唯一约束
SELECT '添加 invitation_code 唯一索引...' AS step;
CREATE UNIQUE INDEX idx_invitation_code_unique 
ON user_information(invitation_code);

-- 6️⃣ 添加普通索引（优化查询性能）
SELECT '添加普通索引...' AS step;
CREATE INDEX idx_gaid ON user_information(gaid);
CREATE INDEX idx_register_ip ON user_information(register_ip);
CREATE INDEX idx_country ON user_information(country);
CREATE INDEX idx_user_creation_time ON user_information(user_creation_time);

-- 7️⃣ 验证索引创建成功
SELECT '验证索引创建...' AS step;
SHOW INDEX FROM user_information;

-- 8️⃣ 显示最终表结构
SELECT '显示表结构...' AS step;
DESCRIBE user_information;

SELECT '✅ 迁移完成！' AS result;
```

### 回滚脚本：`backend/migrations/20260124_rollback_android_id_unique_index.sql`

```sql
-- =============================================================================
-- 回滚：删除 android_id 和 invitation_code 唯一索引
-- =============================================================================

USE bitcoin_mining_db;

-- 删除唯一索引
DROP INDEX IF EXISTS idx_android_id_unique ON user_information;
DROP INDEX IF EXISTS idx_invitation_code_unique ON user_information;
DROP INDEX IF EXISTS idx_gaid ON user_information;
DROP INDEX IF EXISTS idx_register_ip ON user_information;
DROP INDEX IF EXISTS idx_country ON user_information;
DROP INDEX IF EXISTS idx_user_creation_time ON user_information;

-- 恢复原来的普通索引
CREATE INDEX idx_invitation_code ON user_information(invitation_code);

-- 恢复原来的字段长度
ALTER TABLE user_information
MODIFY COLUMN android_id VARCHAR(32) NULL
COMMENT 'Android设备ID(可选)';

SELECT '✅ 回滚完成！' AS result;
```

---

## 二、Sequelize 模型更新

### 文件：`backend/src/models/userInformation.js`

```javascript
// user_information 表的 Sequelize 模型
// 用于存储用户的基本信息
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const UserInformation = sequelize.define('user_information', {
  id: { 
    type: DataTypes.INTEGER, 
    primaryKey: true, 
    autoIncrement: true,
    comment: '用户信息主键ID'
  },
  user_id: { 
    type: DataTypes.STRING(30), 
    allowNull: false,
    comment: '用户唯一标识符（格式：U+年月日时分秒+5位随机数）'
  },
  invitation_code: { 
    type: DataTypes.STRING(30), 
    allowNull: false,
    defaultValue: '',
    comment: '用户的邀请码（格式：INV+年月日时分秒+4位随机数）'
  },
  email: { 
    type: DataTypes.STRING(100), 
    allowNull: true,
    comment: '用户邮箱地址'
  },
  google_account: {
    type: DataTypes.STRING(100),
    allowNull: true,
    defaultValue: null,
    comment: '绑定的Google账号邮箱'
  },
  android_id: { 
    type: DataTypes.STRING(255),  // 🔧 扩展长度：32 → 255
    allowNull: true,              // 保持可选（支持多平台）
    defaultValue: null,
    comment: 'Android设备ID（支持长指纹）'
  },
  gaid: { 
    type: DataTypes.STRING(36), 
    allowNull: true,
    defaultValue: null,
    comment: 'Google Advertising ID(可选)'
  },
  register_ip: { 
    type: DataTypes.STRING(45), 
    allowNull: true,
    comment: '注册时的IP地址（支持IPv6）'
  },
  country: { 
    type: DataTypes.STRING(32), 
    allowNull: true,
    comment: '用户所在国家'
  },
  country_multiplier: {
    type: DataTypes.DECIMAL(4, 2),
    allowNull: true,
    defaultValue: 1.00,
    comment: '国家挖矿速度倍率,默认1.00'
  },
  user_level: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: 1,
    comment: '用户等级'
  },
  user_points: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: 0,
    comment: '用户积分'
  },
  mining_speed_multiplier: {
    type: DataTypes.DECIMAL(8, 6),
    allowNull: true,
    defaultValue: 1.000000,
    comment: '挖矿速度倍率'
  },
  user_creation_time: { 
    type: DataTypes.DATE, 
    allowNull: false, 
    defaultValue: DataTypes.NOW,
    comment: '用户创建时间'
  }
}, {
  timestamps: true,
  createdAt: 'user_creation_time',
  updatedAt: false,
  freezeTableName: true,
  indexes: [
    {
      unique: true,
      fields: ['user_id'],
      name: 'idx_user_id'
    },
    {
      unique: true,  // 🔧 添加唯一约束
      fields: ['invitation_code'],
      name: 'idx_invitation_code_unique'
    },
    {
      unique: true,  // 🔧 添加唯一约束
      fields: ['android_id'],
      name: 'idx_android_id_unique',
      // 注意：Sequelize 不直接支持 WHERE 条件的部分唯一索引
      // 需要在数据库迁移脚本中手动创建
    },
    {
      fields: ['email'],
      name: 'idx_email'
    },
    {
      fields: ['gaid'],
      name: 'idx_gaid'
    },
    {
      fields: ['register_ip'],
      name: 'idx_register_ip'
    },
    {
      fields: ['country'],
      name: 'idx_country'
    },
    {
      fields: ['user_creation_time'],
      name: 'idx_user_creation_time'
    }
  ],
  comment: '用户基本信息表'
});

module.exports = UserInformation;
```

---

## 三、控制器优化（使用 findOrCreate）

### 文件：`backend/src/controllers/authController.js`

```javascript
const UserInformation = require('../models/userInformation');
const InvitationRelationship = require('../models/invitationRelationship');
const UserStatus = require('../models/userStatus');
const InvitationRewardService = require('../services/invitationRewardService');
const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');

/**
 * 设备自动登录/注册（优化版 - 使用 findOrCreate）
 * 防止并发创建重复用户
 */
exports.deviceLogin = async (req, res) => {
  try {
    const {
      android_id,
      referrer_invitation_code,
      gaid,
      country,
      email
    } = req.body;

    // 1️⃣ 验证必填字段
    if (!android_id || android_id.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'android_id 是必填字段'
      });
    }

    // 2️⃣ 记录请求日志
    console.log('🔍 [Device Login] 收到请求:');
    console.log('   android_id:', android_id);
    console.log('   android_id长度:', android_id.length);
    console.log('   gaid:', gaid);
    console.log('   country:', country);
    console.log('   email:', email);

    // 3️⃣ 生成 user_id 和 invitation_code 的函数
    const generateUserIds = () => {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const hour = String(now.getHours()).padStart(2, '0');
      const minute = String(now.getMinutes()).padStart(2, '0');
      const second = String(now.getSeconds()).padStart(2, '0');
      const random = String(Math.floor(Math.random() * 100000)).padStart(5, '0');
      
      const timeString = `${year}${month}${day}${hour}${minute}${second}${random}`;
      return {
        user_id: `U${timeString}`,
        invitation_code: `INV${timeString}`
      };
    };

    // 4️⃣ 获取真实IP
    const register_ip = 
      req.headers['x-forwarded-for']?.split(',')[0].trim() ||
      req.headers['x-real-ip'] ||
      req.ip ||
      req.connection.remoteAddress ||
      '未知';

    // 5️⃣ 🔧 使用 findOrCreate 原子操作（防止并发重复创建）
    const { user_id, invitation_code } = generateUserIds();
    
    const [user, created] = await UserInformation.findOrCreate({
      where: { 
        android_id: android_id.trim() 
      },
      defaults: {
        user_id,
        invitation_code,
        email: email || null,
        google_account: null,
        android_id: android_id.trim(),
        gaid: gaid || null,
        register_ip,
        country: country || null
      }
    });

    console.log('   数据库操作结果:', created ? `✨ 创建新用户 ${user.user_id}` : `♻️ 找到现有用户 ${user.user_id}`);

    // 6️⃣ 如果是新用户，执行额外初始化
    if (created) {
      // 6.1 创建用户状态记录
      try {
        await UserStatus.create({
          user_id: user.user_id,
          bitcoin_accumulated_amount: 0,
          current_bitcoin_balance: 0,
          total_invitation_rebate: 0,
          total_withdrawal_amount: 0,
          last_login_time: new Date(),
          user_status: 'normal'
        });
        console.log(`   ✅ 用户状态初始化成功: ${user.user_id}`);
      } catch (statusErr) {
        console.error('   ❌ 创建用户状态失败:', statusErr);
        // 状态创建失败不影响用户注册
      }

      // 6.2 处理推荐人邀请码
      if (referrer_invitation_code && referrer_invitation_code.trim() !== '') {
        try {
          const referrer = await UserInformation.findOne({
            where: { invitation_code: referrer_invitation_code.trim() }
          });

          if (referrer) {
            // 创建邀请关系
            await InvitationRelationship.create({
              user_id: user.user_id,
              invitation_code: user.invitation_code,
              referrer_user_id: referrer.user_id,
              referrer_invitation_code: referrer.invitation_code
            });

            console.log(`   🎁 邀请关系创建成功: ${referrer.user_id} → ${user.user_id}`);

            // 发放邀请奖励
            try {
              const rewardResult = await InvitationRewardService.handleNewReferral(
                referrer.user_id,
                user.user_id,
                referrer_invitation_code.trim()
              );
              console.log('   💰 邀请奖励发放成功:', rewardResult);
            } catch (rewardErr) {
              console.error('   ❌ 发放邀请奖励失败:', rewardErr);
            }

            // 创建/延长推荐人的邀请挖矿合约
            try {
              const InvitationMiningContractService = require('../services/invitationMiningContractService');
              const miningResult = await InvitationMiningContractService.onSuccessfulInvitation(
                referrer.user_id,
                user.user_id
              );
              console.log('   ⛏️ 邀请挖矿合约创建/延长成功:', miningResult);
            } catch (miningErr) {
              console.error('   ❌ 创建/延长邀请挖矿合约失败:', miningErr);
            }

            // 为新用户创建绑定推荐人挖矿合约
            try {
              const RefereeMiningContractService = require('../services/refereeMiningContractService');
              const refereeResult = await RefereeMiningContractService.onBindReferrer(
                user.user_id,
                referrer.user_id
              );
              console.log('   ⛏️ 新用户绑定推荐人挖矿合约创建成功:', refereeResult);
            } catch (bindErr) {
              console.error('   ❌ 创建新用户绑定推荐人挖矿合约失败:', bindErr);
            }
          } else {
            console.warn(`   ⚠️ 推荐人邀请码不存在: ${referrer_invitation_code}`);
          }
        } catch (inviteErr) {
          console.error('   ❌ 创建邀请关系失败:', inviteErr);
        }
      }
    } else {
      // 7️⃣ 如果是已存在的用户，更新最后登录时间
      try {
        await UserStatus.update(
          { last_login_time: new Date() },
          { where: { user_id: user.user_id } }
        );
        console.log(`   ✅ 更新登录时间: ${user.user_id}`);
      } catch (updateErr) {
        console.error('   ❌ 更新登录时间失败:', updateErr);
      }
    }

    // 8️⃣ 生成JWT Token
    const secret = process.env.JWT_SECRET || 'dev_secret_change_me';
    const token = jwt.sign({ user_id: user.user_id }, secret, { expiresIn: '30d' });

    // 9️⃣ 返回结果
    console.log(`   ✅ 登录成功: ${created ? '新用户' : '现有用户'} - ${user.user_id}`);
    
    res.json({
      success: true,
      isNewUser: created,
      message: created ? '账号创建成功' : '登录成功',
      data: user,
      token
    });

  } catch (err) {
    console.error('❌ [Device Login] 失败:', err);
    
    // 🔧 处理唯一约束冲突（并发情况下的兜底）
    if (err.name === 'SequelizeUniqueConstraintError') {
      console.log('   ⚠️ 检测到唯一约束冲突，重新查询用户...');
      
      try {
        const user = await UserInformation.findOne({
          where: { android_id: req.body.android_id.trim() }
        });
        
        if (user) {
          const secret = process.env.JWT_SECRET || 'dev_secret_change_me';
          const token = jwt.sign({ user_id: user.user_id }, secret, { expiresIn: '30d' });
          
          return res.json({
            success: true,
            isNewUser: false,
            message: '登录成功',
            data: user,
            token
          });
        }
      } catch (retryErr) {
        console.error('   ❌ 重新查询失败:', retryErr);
      }
    }
    
    res.status(500).json({
      success: false,
      error: '登录失败',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};
```

---

## 四、执行迁移步骤

### 1️⃣ 备份数据库

```bash
# 备份整个数据库
mysqldump -u root -p bitcoin_mining_db > backup_before_migration_$(date +%Y%m%d_%H%M%S).sql

# 或只备份 user_information 表
mysqldump -u root -p bitcoin_mining_db user_information > backup_user_information_$(date +%Y%m%d_%H%M%S).sql
```

### 2️⃣ 执行迁移

```bash
# 方式1：直接执行 SQL 文件
mysql -u root -p bitcoin_mining_db < backend/migrations/20260124_add_android_id_unique_index.sql

# 方式2：使用 Node.js 脚本
node backend/scripts/run_migration.js
```

### 3️⃣ 验证迁移

```bash
# 检查索引是否创建成功
mysql -u root -p -e "SHOW INDEX FROM bitcoin_mining_db.user_information;"

# 检查是否有重复数据
mysql -u root -p -e "
  SELECT android_id, COUNT(*) as count
  FROM bitcoin_mining_db.user_information
  WHERE android_id IS NOT NULL
  GROUP BY android_id
  HAVING COUNT(*) > 1;
"
```

### 4️⃣ 测试

```bash
# 测试正常创建
curl -X POST http://localhost:8888/api/auth/device-login \
  -H "Content-Type: application/json" \
  -d '{"android_id":"TEST_UNIQUE_001"}'

# 测试重复创建（应该返回现有用户）
curl -X POST http://localhost:8888/api/auth/device-login \
  -H "Content-Type: application/json" \
  -d '{"android_id":"TEST_UNIQUE_001"}'

# 测试并发创建（应该只创建一个用户）
for i in {1..5}; do
  curl -X POST http://localhost:8888/api/auth/device-login \
    -H "Content-Type: application/json" \
    -d '{"android_id":"TEST_CONCURRENT_001"}' &
done
wait
```

---

## 五、监控和日志

### 添加日志服务

**文件：`backend/src/utils/logger.js`**

```javascript
const winston = require('winston');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ 
      filename: 'logs/device-login-error.log', 
      level: 'error' 
    }),
    new winston.transports.File({ 
      filename: 'logs/device-login.log' 
    })
  ]
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}

module.exports = logger;
```

---

## 六、回滚方案

如果迁移出现问题：

```bash
# 1. 停止应用
pm2 stop all

# 2. 恢复数据库
mysql -u root -p bitcoin_mining_db < backup_before_migration_YYYYMMDD_HHMMSS.sql

# 3. 或执行回滚脚本
mysql -u root -p bitcoin_mining_db < backend/migrations/20260124_rollback_android_id_unique_index.sql

# 4. 重启应用
pm2 restart all
```

---

## 七、性能对比

### 优化前
```
查询性能: 全表扫描，随用户增长变慢
并发安全: 可能创建重复用户
数据完整性: 无法保证唯一性
```

### 优化后
```
查询性能: 使用唯一索引，O(log n) 查找
并发安全: findOrCreate 原子操作，防止重复
数据完整性: 数据库层面强制唯一性
```

---

## ✅ 检查清单

迁移前：
- [ ] 备份数据库
- [ ] 检查是否有重复数据
- [ ] 准备回滚方案
- [ ] 通知团队成员

迁移中：
- [ ] 执行迁移脚本
- [ ] 验证索引创建
- [ ] 更新 Sequelize 模型
- [ ] 更新控制器代码

迁移后：
- [ ] 测试创建新用户
- [ ] 测试重复登录
- [ ] 测试并发场景
- [ ] 监控错误日志
- [ ] 验证性能提升
