/**
 * 为云端MySQL数据库表字段添加完整中文注释（基于实际数据库结构）
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
    logging: false
  }
);

// 完整的表和字段注释定义（基于实际数据库结构）
const allTableComments = {
  // 比特币交易记录表
  bitcoin_transaction_records: {
    table: '比特币交易记录表 - 记录所有比特币相关交易',
    columns: {
      id: '交易记录主键ID',
      user_id: '用户唯一标识符',
      transaction_type: '交易类型：广告免费合约/每日签到免费合约/邀请免费合约/付费合约/提现/下级返利/提现失败退款',
      transaction_amount: '交易金额（比特币数量，精确到18位小数）',
      transaction_creation_time: '交易创建时间',
      transaction_status: '交易状态：成功/失败'
    }
  },

  // 签到奖励配置表
  check_in_reward_config: {
    table: '签到奖励配置表 - 连续签到奖励规则',
    columns: {
      id: '自增主键ID',
      consecutive_days: '连续签到天数',
      points_reward: '奖励积分数量',
      bonus_multiplier: '挖矿速度加成倍数（可选）',
      bonus_duration_hours: '加成持续时间（小时）',
      description: '奖励描述说明',
      is_active: '是否启用该奖励规则',
      created_at: '配置创建时间',
      updated_at: '配置更新时间'
    }
  },

  // 国家配置表（已有注释，只补充缺失的）
  country_config: {
    table: '国家配置表 - 不同国家的挖矿速率配置',
    columns: {
      id: '主键ID',
      country_code: '国家代码（ISO 3166-1 alpha-2标准）',
      country_name: '国家名称',
      mining_speed_multiplier: '挖矿速度倍数',
      is_active: '是否启用该国家配置',
      created_at: '创建时间',
      updated_at: '更新时间'
    }
  },

  // 国家挖矿配置表（补充表）
  country_mining_config: {
    table: '国家挖矿配置表（补充表） - 详细的国家挖矿参数',
    columns: {
      id: '自增主键ID',
      country_code: '国家代码（ISO 3166-1 alpha-2标准）',
      country_name: '国家英文名称',
      country_name_cn: '国家中文名称',
      mining_multiplier: '挖矿速率倍率',
      is_active: '是否启用',
      created_at: '创建时间',
      updated_at: '更新时间'
    }
  },

  // 免费合约记录表
  free_contract_records: {
    table: '免费合约记录表 - 用户免费挖矿合约记录',
    columns: {
      id: '免费合约记录主键ID',
      user_id: '用户唯一标识符',
      free_contract_type: '免费合约类型：广告免费合约/每日签到免费合约/邀请免费合约',
      free_contract_revenue: '免费合约预期收益（BTC）',
      free_contract_creation_time: '免费合约创建时间',
      free_contract_end_time: '免费合约结束时间',
      hashrate: '算力（挖矿速度）',
      mining_status: '挖矿状态：已完成/挖矿中/错误'
    }
  },

  // 邀请返利表
  invitation_rebate: {
    table: '邀请返利记录表 - 推荐人获得的返利记录',
    columns: {
      id: '返利记录主键ID',
      user_id: '推荐人用户ID（获得返利的用户）',
      invitation_code: '推荐人的邀请码',
      subordinate_user_id: '被推荐人用户ID（下级用户）',
      subordinate_user_invitation_code: '被推荐人的邀请码',
      subordinate_rebate_amount: '返利金额（BTC）',
      rebate_creation_time: '返利发放时间'
    }
  },

  // 邀请关系表
  invitation_relationship: {
    table: '邀请关系表 - 用户推荐关系链',
    columns: {
      id: '关系记录主键ID',
      user_id: '被邀请用户ID',
      invitation_code: '被邀请用户自己的邀请码',
      referrer_user_id: '推荐人用户ID（邀请者ID，可为空表示无推荐人）',
      referrer_invitation_code: '推荐人的邀请码（使用的邀请码，可为空）',
      invitation_creation_time: '邀请关系建立时间'
    }
  },

  // 等级配置表
  level_config: {
    table: '等级配置表 - 用户等级体系配置',
    columns: {
      level: '等级数值',
      min_points: '该等级所需最小积分',
      max_points: '该等级所需最大积分',
      speed_multiplier: '挖矿速度倍数加成',
      level_name: '等级名称',
      description: '等级描述说明',
      created_at: '配置创建时间',
      updated_at: '配置更新时间'
    }
  },

  // 挖矿合约表
  mining_contracts: {
    table: '挖矿合约表 - 所有用户的挖矿合约记录',
    columns: {
      id: '合约记录主键ID',
      user_id: '用户唯一标识符',
      contract_type: '合约类型：广告免费合约/每日签到免费合约/邀请免费合约/付费合约',
      contract_creation_time: '合约创建时间',
      contract_end_time: '合约结束时间',
      contract_duration: '合约持续时长',
      hashrate: '算力（挖矿速度，BTC/小时）',
      mining_status: '挖矿状态：已完成/挖矿中/错误'
    }
  },

  // 付费产品列表表
  paid_products_list: {
    table: '付费产品列表表 - 可购买的付费挖矿合约产品',
    columns: {
      id: '产品主键ID',
      product_id: '产品唯一标识（p0499/p0699/p0999/p1999/p4999/p9999）',
      product_name: '产品名称（contract_4.99等）',
      product_price: '产品价格（美元）',
      hashrate: '算力（挖矿速度）',
      product_contract_duration: '合约持续时长（720小时）'
    }
  },

  // 用户信息表
  user_information: {
    table: '用户基本信息表 - 用户注册和身份信息',
    columns: {
      id: '用户信息主键ID',
      user_id: '用户唯一标识符（格式：U+年月日时分秒+5位随机数）',
      invitation_code: '用户的邀请码（格式：INV+年月日时分秒+4位随机数）',
      email: '用户邮箱地址',
      google_account: '绑定的Google账号邮箱',
      android_id: 'Android设备ID（可选）',
      gaid: 'Google Advertising ID（可选）',
      register_ip: '注册时的IP地址（支持IPv4和IPv6）',
      country: '用户所在国家',
      user_creation_time: '用户账户创建时间',
      country_multiplier: '国家挖矿速度倍率，默认1.00'
    }
  },

  // 用户日志表
  user_log: {
    table: '用户日志表 - 记录用户操作日志',
    columns: {
      id: '日志主键ID',
      user_id: '用户唯一标识符',
      action: '用户操作类型',
      log_time: '日志记录时间'
    }
  },

  // 用户订单表
  user_orders: {
    table: '用户订单表 - 付费合约购买订单记录',
    columns: {
      id: '订单主键ID',
      user_id: '用户唯一标识符',
      email: '用户邮箱',
      product_id: '产品ID（p0499/p0699/p0999/p1999/p4999/p9999）',
      product_name: '产品名称（contract_4.99等）',
      product_price: '产品价格（美元）',
      hashrate: '算力（挖矿速度）',
      order_creation_time: '订单创建时间',
      payment_time: '支付完成时间',
      currency_type: '支付货币类型',
      country: '用户所在国家',
      payment_gateway_id: '支付网关订单ID',
      payment_network_id: '支付网络交易ID',
      order_status: '订单状态：激活中/续费中/完成/错误/退款申请中/退款成功/退款被拒'
    }
  },

  // 用户状态表
  user_status: {
    table: '用户状态表 - 用户挖矿状态和比特币余额',
    columns: {
      id: '用户状态主键ID',
      user_id: '用户唯一标识符',
      bitcoin_accumulated_amount: '累计挖矿产出总量（BTC）',
      current_bitcoin_balance: '当前比特币余额（BTC）',
      total_invitation_rebate: '累计邀请返利总额（BTC）',
      total_withdrawal_amount: '累计提现金额（BTC）',
      last_login_time: '最后登录时间',
      user_status: '用户状态：3天内活跃/7天未登录/已禁用/已删除/正常'
    }
  },

  // 提现记录表
  withdrawal_records: {
    table: '提现记录表 - 用户比特币提现申请记录',
    columns: {
      id: '提现记录主键ID',
      user_id: '用户唯一标识符',
      email: '用户邮箱',
      wallet_address: '比特币钱包地址',
      withdrawal_request_amount: '申请提现金额（BTC）',
      network_fee: '网络手续费（BTC）',
      received_amount: '实际到账金额（BTC）',
      withdrawal_status: '提现状态：成功/处理中/已拒绝'
    }
  }
};

async function addAllComments() {
  try {
    console.log('===== 开始为云端数据库所有表字段添加中文注释 =====\n');
    
    await sequelize.authenticate();
    console.log('✅ 数据库连接成功\n');

    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;

    for (const [tableName, config] of Object.entries(allTableComments)) {
      console.log(`\n📋 处理表: ${tableName}`);
      
      try {
        // 更新表注释
        await sequelize.query(`ALTER TABLE \`${tableName}\` COMMENT '${config.table}'`);
        console.log(`   ✅ 表注释: ${config.table}`);

        // 更新字段注释
        for (const [columnName, comment] of Object.entries(config.columns)) {
          try {
            // 获取字段当前定义
            const [results] = await sequelize.query(`
              SELECT COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, EXTRA
              FROM INFORMATION_SCHEMA.COLUMNS
              WHERE TABLE_SCHEMA = '${process.env.DB_NAME}'
              AND TABLE_NAME = '${tableName}'
              AND COLUMN_NAME = '${columnName}'
            `);

            if (results.length === 0) {
              console.log(`   ⚠️  字段 ${columnName} 不存在，跳过`);
              skipCount++;
              continue;
            }

            const colInfo = results[0];
            const columnType = colInfo.COLUMN_TYPE;
            const nullable = colInfo.IS_NULLABLE === 'YES' ? 'NULL' : 'NOT NULL';
            
            // 处理默认值
            let defaultValue = '';
            if (colInfo.COLUMN_DEFAULT !== null) {
              // timestamp类型的CURRENT_TIMESTAMP需要特殊处理
              if (colInfo.COLUMN_DEFAULT === 'CURRENT_TIMESTAMP' || 
                  colInfo.COLUMN_DEFAULT === 'current_timestamp()') {
                defaultValue = 'DEFAULT CURRENT_TIMESTAMP';
              } else {
                defaultValue = `DEFAULT '${colInfo.COLUMN_DEFAULT}'`;
              }
            }
            
            const extra = colInfo.EXTRA || '';

            // 构建ALTER语句
            const alterSql = `
              ALTER TABLE \`${tableName}\` 
              MODIFY COLUMN \`${columnName}\` ${columnType} ${nullable} ${defaultValue} ${extra}
              COMMENT '${comment}'
            `.replace(/\s+/g, ' ').trim();

            await sequelize.query(alterSql);
            console.log(`   ✅ ${columnName}: ${comment}`);
            successCount++;

          } catch (colError) {
            console.error(`   ❌ 字段 ${columnName} 失败: ${colError.message}`);
            errorCount++;
          }
        }

      } catch (tableError) {
        console.error(`❌ 表 ${tableName} 处理失败: ${tableError.message}`);
        errorCount++;
      }
    }

    console.log('\n\n===== 完成 =====');
    console.log(`✅ 成功添加注释: ${successCount} 个字段`);
    console.log(`⚠️  跳过不存在: ${skipCount} 个字段`);
    console.log(`❌ 失败: ${errorCount} 个字段`);

    await sequelize.close();
    process.exit(0);

  } catch (error) {
    console.error('\n❌ 执行失败:', error.message);
    console.error(error);
    await sequelize.close();
    process.exit(1);
  }
}

addAllComments();
