/**
 * 为云端MySQL数据库的所有表字段添加中文注释
 */

require('dotenv').config();
const { Sequelize } = require('sequelize');

// 创建数据库连接
const sequelize = new Sequelize(
  process.env.DB_NAME || 'bitcoin_mining',
  process.env.DB_USER || 'root',
  process.env.DB_PASS || process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 3306,
    dialect: 'mysql',
    logging: console.log,
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    }
  }
);

// 所有表的字段注释定义
const tableComments = {
  user_information: {
    table: '用户基本信息表',
    columns: {
      id: '用户信息主键ID',
      user_id: '用户唯一标识符（格式：U+年月日时分秒+5位随机数）',
      invitation_code: '用户的邀请码（格式：INV+年月日时分秒+4位随机数）',
      email: '用户邮箱地址',
      google_account: '绑定的Google账号邮箱',
      android_id: 'Android设备ID(可选)',
      gaid: 'Google Advertising ID(可选)',
      register_ip: '注册时的IP地址（支持IPv6）',
      country: '用户所在国家',
      country_multiplier: '国家挖矿速度倍率，默认1.00',
      created_at: '用户创建时间',
      updated_at: '用户信息更新时间'
    }
  },
  
  user_status: {
    table: '用户状态表（挖矿和余额数据）',
    columns: {
      id: '用户状态主键ID',
      user_id: '用户唯一标识符',
      bitcoin_balance: '比特币余额',
      mining_status: '挖矿状态: idle(空闲) / mining(挖矿中)',
      mining_start_time: '本次挖矿开始时间',
      mining_end_time: '本次挖矿结束时间',
      total_mined: '累计挖矿产出总量',
      referrer_count: '下级推荐人数',
      created_at: '记录创建时间',
      updated_at: '记录更新时间'
    }
  },

  mining_contract: {
    table: '挖矿合约表',
    columns: {
      id: '合约记录主键ID',
      user_id: '用户唯一标识符',
      contract_name: '合约名称',
      contract_type: '合约类型: free(免费合约) / paid(付费合约)',
      mining_duration: '挖矿时长（小时）',
      mining_speed: '挖矿速度（BTC/小时）',
      mining_start_time: '挖矿开始时间',
      mining_end_time: '挖矿结束时间',
      total_output: '预期总产出（BTC）',
      mining_status: '挖矿状态: active(进行中) / completed(已完成) / expired(已过期)',
      created_at: '合约创建时间',
      updated_at: '合约更新时间'
    }
  },

  free_contract_record: {
    table: '免费合约领取记录表',
    columns: {
      id: '记录主键ID',
      user_id: '用户唯一标识符',
      contract_type: '免费合约类型: ad_reward(广告奖励) / daily_checkin(每日签到)',
      claimed_at: '领取时间',
      created_at: '记录创建时间',
      updated_at: '记录更新时间'
    }
  },

  bitcoin_transaction_record: {
    table: '比特币交易记录表',
    columns: {
      id: '交易记录主键ID',
      user_id: '用户唯一标识符',
      transaction_type: '交易类型: 广告免费合约 / 每日签到 / 邀请奖励 / 付费合约 / 提现 / 下级返利 / 提现失败退款',
      amount: '交易金额（比特币数量）',
      created_at: '交易创建时间',
      status: '交易状态: 成功 / 失败',
      transaction_hash: '交易哈希值（提现时的区块链交易标识）',
      btc_address: '比特币地址（提现目标地址）',
      related_user_id: '关联用户ID（返利时记录下级用户ID）',
      updated_at: '记录更新时间'
    }
  },

  invitation_relationship: {
    table: '邀请关系表',
    columns: {
      id: '关系记录主键ID',
      user_id: '被邀请用户ID',
      inviter_user_id: '邀请人用户ID',
      invitation_code_used: '使用的邀请码',
      relationship_established_at: '建立关系时间',
      created_at: '记录创建时间',
      updated_at: '记录更新时间'
    }
  },

  invitation_rebate: {
    table: '邀请返利记录表',
    columns: {
      id: '返利记录主键ID',
      inviter_user_id: '邀请人用户ID',
      invitee_user_id: '被邀请人用户ID',
      rebate_amount: '返利金额（BTC）',
      rebate_rate: '返利比例（例如：0.05 表示5%）',
      source_contract_id: '来源合约ID（触发返利的付费合约）',
      rebate_time: '返利发放时间',
      created_at: '记录创建时间',
      updated_at: '记录更新时间'
    }
  },

  user_order: {
    table: '用户订单表（付费合约购买记录）',
    columns: {
      id: '订单主键ID',
      user_id: '用户唯一标识符',
      order_number: '订单编号',
      product_id: '产品ID（关联paid_product_list）',
      product_name: '产品名称',
      product_price: '产品价格（美元）',
      payment_method: '支付方式',
      payment_status: '支付状态: pending(待支付) / completed(已完成) / failed(失败) / cancelled(已取消)',
      payment_time: '支付完成时间',
      created_at: '订单创建时间',
      updated_at: '订单更新时间'
    }
  },

  paid_product_list: {
    table: '付费产品列表表',
    columns: {
      id: '产品主键ID',
      product_name: '产品名称',
      product_description: '产品描述',
      price_usd: '价格（美元）',
      mining_duration: '挖矿时长（小时）',
      mining_speed: '挖矿速度（BTC/小时）',
      total_output: '总产出（BTC）',
      is_available: '是否可用',
      display_order: '显示顺序',
      created_at: '产品创建时间',
      updated_at: '产品更新时间'
    }
  },

  withdrawal_record: {
    table: '提现记录表',
    columns: {
      id: '提现记录主键ID',
      user_id: '用户唯一标识符',
      withdrawal_amount: '提现金额（BTC）',
      btc_address: '提现比特币地址',
      withdrawal_status: '提现状态: pending(处理中) / completed(已完成) / failed(失败)',
      transaction_hash: '区块链交易哈希',
      request_time: '提现申请时间',
      completed_time: '提现完成时间',
      failure_reason: '失败原因',
      created_at: '记录创建时间',
      updated_at: '记录更新时间'
    }
  },

  user_log: {
    table: '用户日志表',
    columns: {
      id: '日志主键ID',
      user_id: '用户唯一标识符',
      action_type: '操作类型',
      action_detail: '操作详情（JSON格式）',
      ip_address: '操作IP地址',
      created_at: '日志创建时间',
      updated_at: '日志更新时间'
    }
  },

  country_config: {
    table: '国家配置表 - 不同国家的挖矿速率配置',
    columns: {
      id: '主键ID',
      country_code: '国家代码（ISO 3166-1 alpha-2）',
      country_name: '国家名称',
      multiplier: '挖矿速度倍数',
      is_enabled: '是否启用',
      created_at: '创建时间',
      updated_at: '更新时间'
    }
  },

  country_mining_config: {
    table: '国家挖矿配置表（补充表）',
    columns: {
      id: '自增主键',
      country_code: '国家代码（ISO 3166-1 alpha-2）',
      country_name_en: '国家英文名称',
      country_name_cn: '国家中文名称',
      mining_multiplier: '挖矿速率倍率',
      is_active: '是否启用',
      created_at: '创建时间',
      updated_at: '更新时间'
    }
  }
};

async function addColumnComments() {
  try {
    console.log('===== 开始为云端数据库表字段添加中文注释 =====\n');
    
    // 测试数据库连接
    await sequelize.authenticate();
    console.log('✅ 数据库连接成功\n');

    let successCount = 0;
    let errorCount = 0;

    // 遍历所有表
    for (const [tableName, config] of Object.entries(tableComments)) {
      console.log(`\n📋 处理表: ${tableName}`);
      console.log(`   表注释: ${config.table}`);

      try {
        // 修改表注释
        await sequelize.query(`ALTER TABLE ${tableName} COMMENT '${config.table}'`);
        console.log(`   ✅ 表注释已添加`);

        // 遍历所有字段
        for (const [columnName, comment] of Object.entries(config.columns)) {
          try {
            // 首先获取字段的当前定义
            const [results] = await sequelize.query(`
              SELECT COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, EXTRA
              FROM INFORMATION_SCHEMA.COLUMNS
              WHERE TABLE_SCHEMA = '${process.env.DB_NAME}'
              AND TABLE_NAME = '${tableName}'
              AND COLUMN_NAME = '${columnName}'
            `);

            if (results.length === 0) {
              console.log(`   ⚠️  字段 ${columnName} 不存在，跳过`);
              continue;
            }

            const colInfo = results[0];
            const columnType = colInfo.COLUMN_TYPE;
            const nullable = colInfo.IS_NULLABLE === 'YES' ? 'NULL' : 'NOT NULL';
            const defaultValue = colInfo.COLUMN_DEFAULT !== null 
              ? `DEFAULT '${colInfo.COLUMN_DEFAULT}'` 
              : '';
            const extra = colInfo.EXTRA || '';

            // 构建ALTER语句（保持原有属性，只添加注释）
            const alterSql = `
              ALTER TABLE ${tableName} 
              MODIFY COLUMN ${columnName} ${columnType} ${nullable} ${defaultValue} ${extra}
              COMMENT '${comment}'
            `.replace(/\s+/g, ' ').trim();

            await sequelize.query(alterSql);
            console.log(`   ✅ ${columnName}: ${comment}`);
            successCount++;

          } catch (colError) {
            console.error(`   ❌ 字段 ${columnName} 失败:`, colError.message);
            errorCount++;
          }
        }

      } catch (tableError) {
        console.error(`❌ 表 ${tableName} 处理失败:`, tableError.message);
        errorCount++;
      }
    }

    console.log('\n\n===== 完成 =====');
    console.log(`✅ 成功: ${successCount} 个字段`);
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

// 执行脚本
addColumnComments();
