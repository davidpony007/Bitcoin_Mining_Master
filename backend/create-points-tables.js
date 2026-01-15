/**
 * 为云端MySQL数据库创建积分系统相关表
 */

require('dotenv').config();
const { Sequelize } = require('sequelize');

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASS,
  {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 3306,
    dialect: 'mysql',
    logging: console.log
  }
);

async function createPointsTables() {
  try {
    console.log('===== 开始创建积分系统相关表 =====\n');
    
    await sequelize.authenticate();
    console.log('✅ 数据库连接成功\n');

    // 1. 创建 user_points 表
    console.log('📋 创建表: user_points');
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS user_points (
        id INT AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
        user_id VARCHAR(30) NOT NULL UNIQUE COMMENT '用户ID（关联user_information.user_id）',
        total_points INT DEFAULT 0 COMMENT '总积分',
        available_points INT DEFAULT 0 COMMENT '可用积分（扣除已消耗的）',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
        INDEX idx_user_id (user_id),
        INDEX idx_total_points (total_points)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户积分表 - 存储每个用户的当前积分'
    `);
    console.log('✅ user_points 表创建成功\n');

    // 2. 创建 points_transaction 表
    console.log('📋 创建表: points_transaction');
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS points_transaction (
        id INT AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
        user_id VARCHAR(30) NOT NULL COMMENT '用户ID',
        points_change INT NOT NULL COMMENT '积分变动（正数增加，负数减少）',
        points_type ENUM(
          'AD_VIEW',
          'REFERRAL_1',
          'REFERRAL_10',
          'DAILY_CHECKIN',
          'CONSECUTIVE_CHECKIN_3',
          'CONSECUTIVE_CHECKIN_7',
          'CONSECUTIVE_CHECKIN_15',
          'CONSECUTIVE_CHECKIN_30',
          'SUBORDINATE_AD_VIEW',
          'MANUAL_ADD',
          'MANUAL_DEDUCT'
        ) NOT NULL COMMENT '积分类型',
        balance_after INT NOT NULL COMMENT '变动后余额',
        description VARCHAR(255) COMMENT '说明',
        related_user_id VARCHAR(30) COMMENT '关联用户ID（如邀请人/被邀请人）',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
        INDEX idx_user_id (user_id),
        INDEX idx_points_type (points_type),
        INDEX idx_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='积分交易记录表 - 记录所有积分变动'
    `);
    console.log('✅ points_transaction 表创建成功\n');

    // 3. 创建 ad_view_record 表
    console.log('📋 创建表: ad_view_record');
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS ad_view_record (
        id INT AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
        user_id VARCHAR(30) NOT NULL COMMENT '用户ID',
        ad_type VARCHAR(50) DEFAULT 'free_contract' COMMENT '广告类型',
        view_date DATE NOT NULL COMMENT '观看日期（UTC时区）',
        view_count INT DEFAULT 1 COMMENT '当日观看次数',
        points_earned INT DEFAULT 1 COMMENT '获得积分',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
        UNIQUE KEY unique_user_date (user_id, view_date),
        INDEX idx_user_id (user_id),
        INDEX idx_view_date (view_date)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='广告观看记录表 - 记录每日广告观看次数和积分（每日封顶20积分）'
    `);
    console.log('✅ ad_view_record 表创建成功\n');

    // 4. 创建 check_in_record 表
    console.log('📋 创建表: check_in_record');
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS check_in_record (
        id INT AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
        user_id VARCHAR(30) NOT NULL COMMENT '用户ID',
        check_in_date DATE NOT NULL COMMENT '签到日期',
        consecutive_days INT DEFAULT 1 COMMENT '连续签到天数',
        points_earned INT DEFAULT 4 COMMENT '获得积分（基础4积分）',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
        UNIQUE KEY unique_user_date (user_id, check_in_date),
        INDEX idx_user_id (user_id),
        INDEX idx_check_in_date (check_in_date),
        INDEX idx_consecutive_days (consecutive_days)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='每日签到记录表 - 记录用户每日签到和连续天数'
    `);
    console.log('✅ check_in_record 表创建成功\n');

    // 5. 创建 consecutive_check_in_reward 表
    console.log('📋 创建表: consecutive_check_in_reward');
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS consecutive_check_in_reward (
        id INT AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
        user_id VARCHAR(30) NOT NULL COMMENT '用户ID',
        consecutive_days INT NOT NULL COMMENT '连续天数（3/7/15/30）',
        points_earned INT NOT NULL COMMENT '获得积分',
        claimed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '领取时间',
        UNIQUE KEY unique_user_days (user_id, consecutive_days),
        INDEX idx_user_id (user_id),
        INDEX idx_consecutive_days (consecutive_days)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='连续签到奖励记录表 - 防止重复领取连续签到奖励（3/7/15/30天只能领取一次）'
    `);
    console.log('✅ consecutive_check_in_reward 表创建成功\n');

    // 6. 创建 referral_milestone 表
    console.log('📋 创建表: referral_milestone');
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS referral_milestone (
        id INT AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
        user_id VARCHAR(30) NOT NULL COMMENT '推荐人用户ID',
        milestone_type ENUM('1_FRIEND', '10_FRIENDS') NOT NULL COMMENT '里程碑类型（1人/10人）',
        milestone_count INT NOT NULL COMMENT '达成次数（10人里程碑可多次）',
        total_referrals_at_claim INT NOT NULL COMMENT '领取时的总推荐人数',
        points_earned INT NOT NULL COMMENT '获得积分（1人=6积分，10人=30积分）',
        claimed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '领取时间',
        INDEX idx_user_id (user_id),
        INDEX idx_milestone_type (milestone_type),
        INDEX idx_claimed_at (claimed_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='邀请里程碑记录表 - 追踪邀请1人/10人奖励（10人奖励可多次领取）'
    `);
    console.log('✅ referral_milestone 表创建成功\n');

    // 验证表是否创建成功
    console.log('\n===== 验证表创建结果 =====\n');
    const [tables] = await sequelize.query(`
      SELECT TABLE_NAME, TABLE_COMMENT
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = '${process.env.DB_NAME}'
      AND TABLE_NAME IN (
        'user_points',
        'points_transaction',
        'ad_view_record',
        'check_in_record',
        'consecutive_check_in_reward',
        'referral_milestone'
      )
      ORDER BY TABLE_NAME
    `);

    if (tables.length === 6) {
      console.log('✅ 所有表创建成功！\n');
      tables.forEach(table => {
        console.log(`✓ ${table.TABLE_NAME}: ${table.TABLE_COMMENT}`);
      });
    } else {
      console.log(`⚠️  创建了 ${tables.length}/6 个表\n`);
      tables.forEach(table => {
        console.log(`✓ ${table.TABLE_NAME}`);
      });
    }

    console.log('\n===== 完成 =====');
    await sequelize.close();
    process.exit(0);

  } catch (error) {
    console.error('\n❌ 创建表失败:', error.message);
    console.error(error);
    await sequelize.close();
    process.exit(1);
  }
}

createPointsTables();
