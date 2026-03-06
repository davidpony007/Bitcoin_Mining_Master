/**
 * 数据库迁移脚本 - 支持订阅模式
 * 执行方式: node migrate-to-subscription.js
 */

const { sequelize } = require('../src/config/database');

async function migrateToSubscription() {
  try {
    console.log('🔄 开始迁移数据库到订阅模式...\n');

    // 1. 修改 paid_contracts 表
    console.log('📊 步骤1: 修改 paid_contracts 表结构...');
    
    await sequelize.query(`
      ALTER TABLE paid_contracts 
      ADD COLUMN IF NOT EXISTS subscription_id VARCHAR(255) COMMENT 'Google Play订阅ID',
      ADD COLUMN IF NOT EXISTS subscription_status ENUM(
        'active',           -- 正常活跃
        'grace_period',     -- 宽限期（继续挖矿）
        'account_hold',     -- 账号冻结（停止挖矿）
        'paused',           -- 用户暂停
        'expired',          -- 已过期
        'canceled'          -- 已取消
      ) DEFAULT 'active' COMMENT '订阅状态',
      ADD COLUMN IF NOT EXISTS is_subscription BOOLEAN DEFAULT FALSE COMMENT '是否为订阅模式',
      ADD COLUMN IF NOT EXISTS next_billing_date TIMESTAMP NULL COMMENT '下次扣费日期',
      ADD COLUMN IF NOT EXISTS grace_period_start TIMESTAMP NULL COMMENT '宽限期开始时间',
      ADD COLUMN IF NOT EXISTS account_hold_start TIMESTAMP NULL COMMENT '冻结期开始时间',
      ADD COLUMN IF NOT EXISTS auto_renewing BOOLEAN DEFAULT TRUE COMMENT '是否自动续订'
    `);

    // 添加索引
    await sequelize.query(`
      ALTER TABLE paid_contracts
      ADD INDEX IF NOT EXISTS idx_subscription_id (subscription_id),
      ADD INDEX IF NOT EXISTS idx_subscription_status (subscription_status)
    `);

    console.log('✅ paid_contracts 表更新完成\n');

    // 2. 修改 payment_transactions 表
    console.log('📊 步骤2: 修改 payment_transactions 表结构...');
    
    await sequelize.query(`
      ALTER TABLE payment_transactions
      ADD COLUMN IF NOT EXISTS transaction_type ENUM('purchase', 'renewal', 'refund', 'cancellation') DEFAULT 'purchase' COMMENT '交易类型',
      ADD COLUMN IF NOT EXISTS subscription_id VARCHAR(255) COMMENT '关联的订阅ID',
      ADD COLUMN IF NOT EXISTS is_subscription BOOLEAN DEFAULT FALSE COMMENT '是否为订阅交易'
    `);

    await sequelize.query(`
      ALTER TABLE payment_transactions
      ADD INDEX IF NOT EXISTS idx_subscription_id (subscription_id),
      ADD INDEX IF NOT EXISTS idx_transaction_type (transaction_type)
    `);

    console.log('✅ payment_transactions 表更新完成\n');

    // 3. 创建订阅状态历史表
    console.log('📊 步骤3: 创建 subscription_status_history 表...');
    
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS subscription_status_history (
        id INT AUTO_INCREMENT PRIMARY KEY,
        subscription_id VARCHAR(255) NOT NULL,
        user_id VARCHAR(255) NOT NULL,
        old_status VARCHAR(50),
        new_status VARCHAR(50) NOT NULL,
        reason VARCHAR(255) COMMENT '状态变更原因',
        metadata JSON COMMENT '额外元数据',
        changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_subscription_id (subscription_id),
        INDEX idx_user_id (user_id),
        INDEX idx_changed_at (changed_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='订阅状态变更历史'
    `);

    console.log('✅ subscription_status_history 表创建完成\n');

    // 4. 创建订阅通知记录表
    console.log('📊 步骤4: 创建 subscription_notifications 表...');
    
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS subscription_notifications (
        id INT AUTO_INCREMENT PRIMARY KEY,
        notification_type INT NOT NULL COMMENT 'Google通知类型代码',
        notification_type_name VARCHAR(100) COMMENT '通知类型名称',
        subscription_id VARCHAR(255),
        purchase_token TEXT,
        user_id VARCHAR(255),
        raw_data JSON COMMENT '原始通知数据',
        processed BOOLEAN DEFAULT FALSE COMMENT '是否已处理',
        processed_at TIMESTAMP NULL,
        received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_subscription_id (subscription_id),
        INDEX idx_user_id (user_id),
        INDEX idx_processed (processed),
        INDEX idx_received_at (received_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='订阅通知记录'
    `);

    console.log('✅ subscription_notifications 表创建完成\n');

    // 5. 验证表结构
    console.log('🔍 步骤5: 验证表结构...');
    
    const [paidContractsColumns] = await sequelize.query(`
      SHOW COLUMNS FROM paid_contracts
    `);
    
    const hasSubscriptionId = paidContractsColumns.some(col => col.Field === 'subscription_id');
    const hasSubscriptionStatus = paidContractsColumns.some(col => col.Field === 'subscription_status');
    
    if (hasSubscriptionId && hasSubscriptionStatus) {
      console.log('✅ paid_contracts 表验证通过');
    } else {
      console.log('⚠️ paid_contracts 表可能缺少某些字段');
    }

    const [paymentColumns] = await sequelize.query(`
      SHOW COLUMNS FROM payment_transactions
    `);
    
    const hasTransactionType = paymentColumns.some(col => col.Field === 'transaction_type');
    
    if (hasTransactionType) {
      console.log('✅ payment_transactions 表验证通过');
    } else {
      console.log('⚠️ payment_transactions 表可能缺少某些字段');
    }

    // 6. 统计信息
    console.log('\n📈 迁移统计:');
    
    const [[contractCount]] = await sequelize.query(`
      SELECT COUNT(*) as count FROM paid_contracts
    `);
    console.log(`   现有付费合约数: ${contractCount.count}`);
    
    const [[transactionCount]] = await sequelize.query(`
      SELECT COUNT(*) as count FROM payment_transactions
    `);
    console.log(`   现有交易记录数: ${transactionCount.count}`);

    console.log('\n✅ 数据库迁移完成！');
    console.log('\n📝 后续步骤:');
    console.log('   1. 在Google Play Console创建订阅商品');
    console.log('   2. 配置Real-time Developer Notifications');
    console.log('   3. 更新后端验证逻辑');
    console.log('   4. 更新Flutter客户端代码');
    console.log('   5. 测试订阅购买流程');

  } catch (error) {
    console.error('❌ 迁移失败:', error);
    throw error;
  } finally {
    await sequelize.close();
  }
}

// 执行迁移
migrateToSubscription();
