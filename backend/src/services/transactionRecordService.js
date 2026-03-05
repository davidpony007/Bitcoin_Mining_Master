/**
 * TransactionRecordService
 * 统一的比特币交易记录写入服务。
 * 所有余额变更（增加/减少）必须通过此服务写入 bitcoin_transaction_records，
 * 确保列名和格式一致，避免各处代码直接拼接 SQL 导致的列名不一致问题。
 */

const pool = require('../config/database_native');

/**
 * 支持的交易类型常量
 */
const TX_TYPE = {
  AD_REWARD:              'Free Ad Reward',
  CHECKIN_REWARD:         'Daily Check-in Reward',
  INVITE_REWARD:          'Invite Friend Reward',
  BIND_REFERRER:          'Bind Referrer Reward',
  CONTRACT_499:           'contract_4.99',
  CONTRACT_699:           'contract_6.99',
  CONTRACT_999:           'contract_9.99',
  CONTRACT_1999:          'contract_19.99',
  WITHDRAWAL:             'withdrawal',
  REBATE:                 'subordinate rebate',
  REFUND:                 'refund for withdrawal failure',
  MINING_REWARD:          'mining_reward',   // 周期性挖矿收益结算
};

/**
 * 插入一条交易记录。
 *
 * @param {object} params
 * @param {string|number} params.userId          - 用户ID
 * @param {string}        params.transactionType - 交易类型（使用 TX_TYPE 常量）
 * @param {number}        params.amount          - 交易金额（BTC，正数）
 * @param {number|null}   [params.balanceAfter]  - 交易后余额（可选）
 * @param {string|null}   [params.description]   - 描述（可选，最长500字符）
 * @param {'success'|'error'} [params.status]    - 交易状态，默认 'success'
 * @param {object|null}   [params.connection]    - 已有的数据库连接（用于事务中），
 *                                                 若为 null 则自动获取新连接
 * @returns {Promise<number>} 插入的记录 ID
 */
async function recordTransaction({
  userId,
  transactionType,
  amount,
  balanceAfter = null,
  description = null,
  status = 'success',
  connection = null,
}) {
  if (!userId || !transactionType || amount == null) {
    throw new Error('recordTransaction: userId, transactionType, amount 为必填项');
  }

  const sql = `
    INSERT INTO bitcoin_transaction_records
      (user_id, transaction_type, transaction_amount, balance_after, description,
       transaction_status, transaction_creation_time)
    VALUES (?, ?, ?, ?, ?, ?, NOW())
  `;
  const values = [userId, transactionType, amount, balanceAfter, description, status];

  let shouldRelease = false;
  let conn = connection;

  try {
    if (!conn) {
      conn = await pool.getConnection();
      shouldRelease = true;
    }
    const [result] = await conn.query(sql, values);
    return result.insertId;
  } finally {
    if (shouldRelease && conn) conn.release();
  }
}

/**
 * 批量插入交易记录（同一连接/事务）。
 *
 * @param {Array<object>} records - recordTransaction params 数组
 * @param {object|null}   connection - 已有连接
 */
async function recordTransactions(records, connection = null) {
  for (const rec of records) {
    await recordTransaction({ ...rec, connection });
  }
}

module.exports = { recordTransaction, recordTransactions, TX_TYPE };
