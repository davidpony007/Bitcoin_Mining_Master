/**
 * 提现相关路由
 * 处理用户提现申请和提现历史记录查询
 */

const express = require('express');
const router = express.Router();
const { WithdrawalRecord, UserStatus, UserInformation, BitcoinTransactionRecord } = require('../models');
const { Sequelize } = require('sequelize');
const sequelize = require('../config/database');
const authenticateToken = require('../middleware/auth');
const { requireAdmin } = require('../middleware/role');

/**
 * GET /api/withdrawal/admin/list
 * 管理员获取全部提现记录（支持状态筛选 + 关键词搜索）
 *
 * Query 参数:
 * - status : 'pending' | 'success' | 'rejected' | 'all'（默认 all）
 * - search : 关键词，匹配 email / wallet_address / user_id
 * - limit  : 每页数量（默认 20）
 * - offset : 偏移量（默认 0）
 */
router.get('/admin/list', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { status, search, limit = 20, offset = 0, startDate, endDate } = req.query;

    // 改用原生 SQL 以支持 JOIN user_information 补充 Google/Apple 账号
      const pool = require('../config/database_native');
    const conn = await pool.getConnection();
    try {
      let where = 'WHERE 1=1';
      const params = [];

      if (status && status !== 'all') {
        where += ' AND wr.withdrawal_status = ?';
        params.push(status);
      }
      if (search && search.trim()) {
        const kw = `%${search.trim()}%`;
        where += ' AND (wr.email LIKE ? OR wr.wallet_address LIKE ? OR wr.user_id LIKE ? OR wr.binance_uid LIKE ?)';
        params.push(kw, kw, kw, kw);
      }
      if (startDate) {
        where += ' AND DATE(wr.created_at) >= ?';
        params.push(startDate);
      }
      if (endDate) {
        where += ' AND DATE(wr.created_at) <= ?';
        params.push(endDate);
      }

      const fromClause = `FROM withdrawal_records wr
        LEFT JOIN user_information ui ON ui.user_id = wr.user_id`;

      const [[{ total }]] = await conn.query(
        `SELECT COUNT(*) AS total ${fromClause} ${where}`, params
      );
      const [rows] = await conn.query(
        `SELECT wr.id, wr.user_id, wr.email, wr.wallet_address, wr.binance_uid,
                wr.withdrawal_request_amount, wr.network_fee, wr.received_amount,
                wr.withdrawal_status, wr.reject_reason, wr.created_at, wr.updated_at,
                COALESCE(wr.google_account, ui.google_account) AS google_account,
                COALESCE(wr.apple_account, ui.apple_account, ui.apple_id) AS apple_account
         ${fromClause} ${where}
         ORDER BY wr.id DESC
         LIMIT ? OFFSET ?`,
        [...params, parseInt(limit), parseInt(offset)]
      );

      const withdrawals = rows.map(r => ({
        id:             r.id,
        userId:         r.user_id,
        email:          r.email,
        walletAddress:  r.wallet_address,
        binanceUid:     r.binance_uid  || null,
        amount:         parseFloat(r.withdrawal_request_amount),
        networkFee:     parseFloat(r.network_fee),
        receivedAmount: parseFloat(r.received_amount),
        status:         r.withdrawal_status,
        rejectReason:   r.reject_reason || null,
        googleAccount:  r.google_account  || null,
        appleAccount:   r.apple_account   || null,
        createdAt:      r.created_at,
        updatedAt:      r.updated_at      || null,
      }));

      res.json({
        success: true,
        data: {
          total,
          withdrawals,
          pagination: {
            limit:   parseInt(limit),
            offset:  parseInt(offset),
            hasMore: parseInt(offset) + parseInt(limit) < total,
          },
        },
      });
    } finally {
      conn.release();
    }
  } catch (error) {
    console.error('❌ 管理员查询提现列表失败:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch withdrawal list', error: error.message });
  }
});

/**
 * POST /api/withdrawal/request
 * 用户提交提现申请
 * 
 * 业务流程:
 * 1. 验证用户余额是否足够
 * 2. 扣除用户余额
 * 3. 创建提现记录(状态: pending)
 * 4. 记录比特币交易记录
 * 5. 更新累计提现金额
 */
router.post('/request', authenticateToken, async (req, res) => {
  const transaction = await sequelize.transaction();
  
  try {
    const { 
      userId, 
      email,
      walletAddress, 
      amount, // 用户申请提现的金额
      networkFee,
      network, // 网络类型(Bitcoin, TRC20等)
      googleAccount, // Google登录账号，用于用户去重
      appleAccount   // Apple登录账号（邮箱），用于用户去重
    } = req.body;

    // 1. 参数验证
    if (!userId || !email || !walletAddress || !amount) {
      return res.status(400).json({
        success: false,
        message: 'Missing required parameters'
      });
    }

    // JWT 用户身份校验：防止用户 A 用自己的 Token 替 B 提现
    const jwtUserId = req.user?.userId || req.user?.user_id;
    if (jwtUserId && String(jwtUserId) !== String(userId)) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: cannot withdraw on behalf of another user'
      });
    }

    const withdrawAmount = parseFloat(parseFloat(amount).toFixed(8));
    const withdrawAmountStr = parseFloat(amount).toFixed(18);           // exact string for DB (avoids IEEE 754 float noise)
    const fee = parseFloat(parseFloat(networkFee || 0).toFixed(8));
    const feeStr = parseFloat(networkFee || 0).toFixed(18);              // exact string for DB
    const receivedAmount = parseFloat((withdrawAmount - fee).toFixed(8));
    const receivedAmountStr = (withdrawAmount - fee).toFixed(18);        // exact string for DB

    // 2. 验证金额
    const MINIMUM_WITHDRAWAL = 0.00002200; // 与客户端 _minimumAmount 保持一致
    if (withdrawAmount <= 0 || receivedAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid withdrawal amount'
      });
    }
    if (withdrawAmount < MINIMUM_WITHDRAWAL) {
      return res.status(400).json({
        success: false,
        message: `Minimum withdrawal amount is ${MINIMUM_WITHDRAWAL.toFixed(8)} BTC`
      });
    }

    // 3. 验证钱包地址/UID格式
    const isBinanceUID = (network === 'BINANCE_UID');
    if (isBinanceUID) {
      // Binance UID: 纯数字，6-12位
      if (!/^\d{6,12}$/.test(walletAddress)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid Binance UID format. Must be 6-12 digits.'
        });
      }
    } else {
      // 普通钱包地址长度校验
      if (walletAddress.length < 26 || walletAddress.length > 80) {
        return res.status(400).json({
          success: false,
          message: 'Invalid wallet address'
        });
      }
    }

    // 4. 验证用户账号绑定状态（必须绑定 Google 或 Apple 账号才能提现）
    const [userInfoRows] = await sequelize.query(
      'SELECT google_account, apple_account, apple_id FROM user_information WHERE user_id = ? LIMIT 1',
      { replacements: [userId], transaction }
    );
    if (!userInfoRows.length || (
      !userInfoRows[0].google_account &&
      !userInfoRows[0].apple_account &&
      !userInfoRows[0].apple_id
    )) {
      await transaction.rollback();
      return res.status(403).json({
        success: false,
        message: 'You have not bound an account yet. Please bind your account before attempting to withdraw.'
      });
    }

    // 5. 检查每日提现次数限制（每位用户每天最多3次）
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const [dailyCountResult] = await sequelize.query(
      'SELECT COUNT(*) AS cnt FROM withdrawal_records WHERE user_id = ? AND created_at >= ?',
      { replacements: [userId, todayStart], transaction }
    );
    const dailyCount = parseInt(dailyCountResult[0].cnt || 0);
    if (dailyCount >= 3) {
      await transaction.rollback();
      return res.status(429).json({
        success: false,
        message: 'Daily withdrawal limit reached (max 3 per day). Please try again tomorrow.'
      });
    }

    // 5. 查询用户余额（使用 FOR UPDATE 行级锁，防止并发提现竞态导致余额变负）
    const userStatus = await UserStatus.findOne({
      where: { user_id: userId },
      lock: transaction.LOCK.UPDATE,
      transaction
    });

    if (!userStatus) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // 5. 从 userStatus 中提取当前余额
    const currentBalance = parseFloat(userStatus.current_bitcoin_balance || 0);

    // 6. 验证余额是否足够
    if (currentBalance < withdrawAmount) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: `Insufficient balance. Current: ${currentBalance.toFixed(8)} BTC, Required: ${withdrawAmount.toFixed(8)} BTC`
      });
    }

    // 7. 扣除用户余额（双重保险：WHERE 条件确保即使并发也不会扣出负数）
    const [, deductMeta] = await sequelize.query(
      'UPDATE user_status SET current_bitcoin_balance = current_bitcoin_balance - ? WHERE user_id = ? AND current_bitcoin_balance >= ?',
      { replacements: [withdrawAmountStr, userId, withdrawAmountStr], transaction }
    );
    const affectedRows = deductMeta?.affectedRows ?? deductMeta ?? 0;
    if (parseInt(affectedRows) === 0) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Insufficient balance. Please try again.'
      });
    }

    // 8. 创建提现记录（使用原生SQL避免Sequelize验证问题）
    // binance_uid 单独存储：isBinanceUID 时 walletAddress 即为 UID，同时写入专用列方便管理员识别
    const [insertResult] = await sequelize.query(
      `INSERT INTO withdrawal_records 
       (user_id, email, wallet_address, binance_uid, withdrawal_request_amount, network_fee, received_amount, withdrawal_status, google_account, apple_account, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, NOW())`,
      { replacements: [userId, email, walletAddress, isBinanceUID ? walletAddress : null, withdrawAmountStr, feeStr, receivedAmountStr, googleAccount || null, appleAccount || null], transaction }
    );
    
    const withdrawalId = insertResult;

    // 9. 记录比特币交易（提现）
    const newBalanceAfterWithdraw = parseFloat((currentBalance - withdrawAmount).toFixed(8));
    const newBalanceAfterWithdrawStr = (currentBalance - parseFloat(withdrawAmountStr)).toFixed(18); // exact string for DB
    const txDescription = isBinanceUID
      ? `Withdrawal to Binance UID: ${walletAddress}`
      : `Withdrawal to ${walletAddress.substring(0, 10)}...${walletAddress.substring(walletAddress.length - 6)} (${network || 'BEP20'})`;
    await sequelize.query(
      `INSERT INTO bitcoin_transaction_records
         (user_id, transaction_type, transaction_amount, balance_after, description,
          transaction_status, transaction_creation_time)
       VALUES (?, 'withdrawal', ?, ?, ?, 'pending', NOW())`,
      {
        replacements: [
          userId,
          withdrawAmountStr,
          newBalanceAfterWithdrawStr,
          txDescription
        ],
        transaction
      }
    );

    await transaction.commit();

    res.json({
      success: true,
      message: 'Withdrawal request submitted successfully',
      data: {
        withdrawalId: withdrawalId,
        amount: withdrawAmount,
        fee: fee,
        receivedAmount: receivedAmount,
        status: 'pending',
        walletAddress: walletAddress,
        network: network || 'Bitcoin',
        newBalance: (currentBalance - withdrawAmount).toFixed(8)
      }
    });

  } catch (error) {
    await transaction.rollback();
    console.error('❌ 提现请求失败:', error);
    
    res.status(500).json({
      success: false,
      message: 'Withdrawal request failed',
      error: error.message
    });
  }
});

/**
 * GET /api/withdrawal/history
 * 查询用户提现历史记录（需登录，只能查看自己的记录）
 * 
 * Query参数:
 * - userId: 用户ID(必需)
 * - status: 筛选状态(可选): all, pending, success, rejected
 * - limit: 每页记录数(默认20)
 * - offset: 偏移量(默认0)
 */
router.get('/history', authenticateToken, async (req, res) => {
  try {
    const { userId, status, limit = 20, offset = 0 } = req.query;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'userId is required'
      });
    }

    // 确保只能查看自己的记录（管理员可查任意用户）
    if (req.user.role !== 'admin' && String(req.user.user_id) !== String(userId)) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: cannot access other users\' withdrawal history'
      });
    }

    // 构建查询条件
    const whereClause = { user_id: userId };
    
    if (status && status !== 'all') {
      whereClause.withdrawal_status = status;
    }

    // 查询提现记录
    const { count, rows } = await WithdrawalRecord.findAndCountAll({
      where: whereClause,
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['id', 'DESC']]
    });

    // 格式化返回数据
    const withdrawals = rows.map(record => ({
      id: record.id,
      userId: record.user_id,
      email: record.email,
      walletAddress: record.wallet_address,
      amount: parseFloat(record.withdrawal_request_amount),
      networkFee: parseFloat(record.network_fee),
      receivedAmount: parseFloat(record.received_amount),
      status: record.withdrawal_status,
      createdAt: record.createdAt || null,
      updatedAt: record.updatedAt || null
    }));

    res.json({
      success: true,
      data: {
        total: count,
        withdrawals: withdrawals,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          hasMore: (parseInt(offset) + parseInt(limit)) < count
        }
      }
    });

  } catch (error) {
    console.error('❌ 查询提现历史失败:', error);
    
    res.status(500).json({
      success: false,
      message: 'Failed to fetch withdrawal history',
      error: error.message
    });
  }
});

/**
 * GET /api/withdrawal/:id
 * 查询单个提现记录详情（需登录，只能查看自己的记录）
 */
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'userId is required'
      });
    }

    // 确保只能查看自己的记录（管理员可查任意记录）
    if (req.user.role !== 'admin' && String(req.user.user_id) !== String(userId)) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: cannot access other users\' withdrawal records'
      });
    }

    const withdrawal = await WithdrawalRecord.findOne({
      where: { 
        id: id,
        user_id: userId // 强制验证记录归属
      }
    });

    if (!withdrawal) {
      return res.status(404).json({
        success: false,
        message: 'Withdrawal record not found'
      });
    }

    res.json({
      success: true,
      data: {
        id:             withdrawal.id,
        userId:         withdrawal.user_id,
        email:          withdrawal.email,
        walletAddress:  withdrawal.wallet_address,
        binanceUid:     withdrawal.binance_uid    || null,
        amount:         parseFloat(withdrawal.withdrawal_request_amount),
        networkFee:     parseFloat(withdrawal.network_fee),
        receivedAmount: parseFloat(withdrawal.received_amount),
        status:         withdrawal.withdrawal_status,
        rejectReason:   withdrawal.reject_reason  || null,
        googleAccount:  withdrawal.google_account || null,
        appleAccount:  withdrawal.apple_account  || null,
        createdAt:      withdrawal.created_at     || null,
        updatedAt:      withdrawal.updated_at     || null,
      }
    });

  } catch (error) {
    console.error('❌ 查询提现详情失败:', error);
    
    res.status(500).json({
      success: false,
      message: 'Failed to fetch withdrawal detail',
      error: error.message
    });
  }
});

/**
 * 管理员专用接口
 * PUT /api/withdrawal/approve/:id
 * 批准提现申请
 */
router.put('/approve/:id', authenticateToken, requireAdmin, async (req, res) => {
  const transaction = await sequelize.transaction();
  
  try {
    const { id } = req.params;
    const { adminId } = req.body; // 后续可添加管理员验证

    const withdrawal = await WithdrawalRecord.findByPk(id, { transaction });

    if (!withdrawal) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: 'Withdrawal record not found'
      });
    }

    if (withdrawal.withdrawal_status !== 'pending') {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: `Cannot approve withdrawal with status: ${withdrawal.withdrawal_status}`
      });
    }

    // 更新提现状态为成功（含更新时间）
    await withdrawal.update({
      withdrawal_status: 'success',
      updated_at:        new Date(),
    }, { transaction });

    // 更新用户的累计提现金额
    const userStatus = await UserStatus.findOne({
      where: { user_id: withdrawal.user_id },
      transaction
    });

    if (userStatus) {
      await userStatus.increment('total_withdrawal_amount', {
        by: parseFloat(withdrawal.withdrawal_request_amount),
        transaction
      });
    }

    // 更新交易记录状态
    await BitcoinTransactionRecord.update({
      transaction_status: 'success'
    }, {
      where: {
        user_id: withdrawal.user_id,
        transaction_type: 'withdrawal',
        transaction_amount: withdrawal.withdrawal_request_amount,
        transaction_status: 'pending'
      },
      transaction,
      limit: 1
    });

    await transaction.commit();

    res.json({
      success: true,
      message: 'Withdrawal approved successfully',
      data: {
        withdrawalId: withdrawal.id,
        status: 'success'
      }
    });

  } catch (error) {
    await transaction.rollback();
    console.error('❌ 批准提现失败:', error);
    
    res.status(500).json({
      success: false,
      message: 'Failed to approve withdrawal',
      error: error.message
    });
  }
});

/**
 * 管理员专用接口
 * PUT /api/withdrawal/reject/:id
 * 拒绝提现申请并退还余额
 */
router.put('/reject/:id', authenticateToken, requireAdmin, async (req, res) => {
  const transaction = await sequelize.transaction();
  
  try {
    const { id } = req.params;
    const { adminId, reason } = req.body;

    const withdrawal = await WithdrawalRecord.findByPk(id, { transaction });

    if (!withdrawal) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: 'Withdrawal record not found'
      });
    }

    if (withdrawal.withdrawal_status !== 'pending') {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: `Cannot reject withdrawal with status: ${withdrawal.withdrawal_status}`
      });
    }

    // 更新提现状态为已拒绝（含拒绝原因和更新时间）
    await withdrawal.update({
      withdrawal_status: 'rejected',
      reject_reason:     reason || '管理员拒绝',
      updated_at:        new Date(),
    }, { transaction });

    // 退还余额给用户
    const userStatus = await UserStatus.findOne({
      where: { user_id: withdrawal.user_id },
      transaction
    });

    if (userStatus) {
      await userStatus.increment('current_bitcoin_balance', {
        by: parseFloat(withdrawal.withdrawal_request_amount),
        transaction,
      });
    }

    // 记录退款交易
    await BitcoinTransactionRecord.create({
      user_id: withdrawal.user_id,
      transaction_type: 'refund for withdrawal failure',
      transaction_amount: parseFloat(withdrawal.withdrawal_request_amount),
      transaction_status: 'success',
      description: `Withdrawal rejected: ${reason || 'No reason provided'}`
    }, { transaction });

    // 更新原提现交易记录状态
    await BitcoinTransactionRecord.update({
      transaction_status: 'failed'
    }, {
      where: {
        user_id: withdrawal.user_id,
        transaction_type: 'withdrawal',
        transaction_amount: withdrawal.withdrawal_request_amount,
        transaction_status: 'pending'
      },
      transaction,
      limit: 1
    });

    await transaction.commit();

    res.json({
      success: true,
      message: 'Withdrawal rejected and balance refunded',
      data: {
        withdrawalId: withdrawal.id,
        status: 'rejected',
        refundedAmount: parseFloat(withdrawal.withdrawal_request_amount)
      }
    });

  } catch (error) {
    await transaction.rollback();
    console.error('❌ 拒绝提现失败:', error);
    
    res.status(500).json({
      success: false,
      message: 'Failed to reject withdrawal',
      error: error.message
    });
  }
});

/**
 * POST /api/withdrawal/admin/bulk-approve
 * 管理员批量同意提现
 * Body: { ids: number[] }
 */
router.post('/admin/bulk-approve', authenticateToken, requireAdmin, async (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ success: false, message: '请提供要操作的提现记录ID' });
  }

  const results = { success: [], failed: [] };

  for (const id of ids) {
    const transaction = await sequelize.transaction();
    try {
      const withdrawal = await WithdrawalRecord.findByPk(id, { transaction });
      if (!withdrawal) { results.failed.push({ id, reason: '记录不存在' }); await transaction.rollback(); continue; }
      if (withdrawal.withdrawal_status !== 'pending') { results.failed.push({ id, reason: '状态不是pending' }); await transaction.rollback(); continue; }

      await withdrawal.update({ withdrawal_status: 'success', updated_at: new Date() }, { transaction });

      // 更新用户累计提现金额（原 bulk-approve 遗漏此步骤）
      const userStatus = await UserStatus.findOne({ where: { user_id: withdrawal.user_id }, transaction });
      if (userStatus) {
        await userStatus.increment('total_withdrawal_amount', {
          by: parseFloat(withdrawal.withdrawal_request_amount),
          transaction,
        });
      }

      // 更新对应的比特币交易记录状态
      await BitcoinTransactionRecord.update(
        { transaction_status: 'success' },
        { where: { user_id: withdrawal.user_id, transaction_type: 'withdrawal', transaction_status: 'pending' }, transaction, limit: 1 }
      );

      await transaction.commit();
      results.success.push(id);
    } catch (err) {
      await transaction.rollback();
      results.failed.push({ id, reason: err.message });
    }
  }

  res.json({ success: true, data: results, message: `成功同意 ${results.success.length} 条，失败 ${results.failed.length} 条` });
});

/**
 * POST /api/withdrawal/admin/bulk-reject
 * 管理员批量拒绝提现
 * Body: { ids: number[], reason?: string }
 */
router.post('/admin/bulk-reject', authenticateToken, requireAdmin, async (req, res) => {
  const { ids, reason } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ success: false, message: '请提供要操作的提现记录ID' });
  }

  const rejectReason = reason || '管理员批量拒绝';
  const results = { success: [], failed: [] };

  for (const id of ids) {
    const transaction = await sequelize.transaction();
    try {
      const withdrawal = await WithdrawalRecord.findByPk(id, { transaction });
      if (!withdrawal) { results.failed.push({ id, reason: '记录不存在' }); await transaction.rollback(); continue; }
      if (withdrawal.withdrawal_status !== 'pending') { results.failed.push({ id, reason: '状态不是pending' }); await transaction.rollback(); continue; }

      // 退还余额
      const userStatus = await UserStatus.findOne({ where: { user_id: withdrawal.user_id }, transaction });
      if (userStatus) {
        await userStatus.increment('current_bitcoin_balance', {
          by: parseFloat(withdrawal.withdrawal_request_amount),
          transaction,
        });
      }

      await withdrawal.update({
        withdrawal_status: 'rejected',
        reject_reason: rejectReason,
      }, { transaction });

      // 将原 pending 提现的 BTX 记录标为 failed
      await BitcoinTransactionRecord.update(
        { transaction_status: 'failed' },
        {
          where: {
            user_id: withdrawal.user_id,
            transaction_type: 'withdrawal',
            transaction_status: 'pending',
          },
          limit: 1,
          transaction,
        }
      );

      // 创建退款 BTX 记录（与单条 reject 保持一致）
      await BitcoinTransactionRecord.create({
        user_id: withdrawal.user_id,
        transaction_type: 'refund for withdrawal failure',
        transaction_amount: parseFloat(withdrawal.withdrawal_request_amount),
        transaction_status: 'success',
        description: `Withdrawal rejected: ${rejectReason}`,
      }, { transaction });

      await transaction.commit();
      results.success.push(id);
    } catch (err) {
      await transaction.rollback();
      results.failed.push({ id, reason: err.message });
    }
  }

  res.json({ success: true, data: results, message: `成功拒绝 ${results.success.length} 条，失败 ${results.failed.length} 条` });
});

/**
 * GET /api/withdrawal/admin/stats
 * 管理员获取提现统计数据
 */
router.get('/admin/stats', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const [rows] = await sequelize.query(
      `SELECT
         COUNT(*)                                            AS total,
         SUM(withdrawal_status = 'pending')                 AS pending,
         SUM(withdrawal_status = 'success')                 AS success,
         SUM(withdrawal_status = 'rejected')                AS rejected,
         COALESCE(SUM(withdrawal_request_amount), 0)        AS totalAmount,
         COALESCE(SUM(CASE WHEN withdrawal_status='success' THEN withdrawal_request_amount ELSE 0 END), 0) AS paidAmount
       FROM withdrawal_records`
    );
    const s = rows[0];
    res.json({
      success: true,
      data: {
        total:       Number(s.total),
        pending:     Number(s.pending),
        success:     Number(s.success),
        rejected:    Number(s.rejected),
        totalAmount: parseFloat(s.totalAmount),
        paidAmount:  parseFloat(s.paidAmount),
      },
    });
  } catch (error) {
    console.error('❌ 提现统计查询失败:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch stats', error: error.message });
  }
});

/**
 * POST /api/withdrawal/admin/batch-payout
 * 通过币安 API 批量向用户发放 BTC
 *
 * Body:
 *   ids?:    number[]   — 指定提现记录 ID（与 payAll 二选一）
 *   payAll?: boolean    — true 则处理所有 pending 记录
 *   dryRun?: boolean    — true 则只预览不实际打款（用于确认单子列表）
 *
 * 返回：
 *   success[]:  { id, binanceId, amount }   — 已通过币安API成功发起
 *   failed[]:   { id, reason }              — API 调用失败
 *   manual[]:   { id, uid, amount }         — 币安UID类型，需在币安App手动转账
 */
router.post('/admin/batch-payout', authenticateToken, requireAdmin, async (req, res) => {
  const { ids, payAll, dryRun } = req.body;
  const { withdrawToAddress, isBinanceUID } = require('../services/binancePayoutService');

  // 1. 获取待处理记录
  let pendingWithdrawals;
  try {
    if (payAll) {
      pendingWithdrawals = await WithdrawalRecord.findAll({
        where: { withdrawal_status: 'pending' },
        order: [['id', 'ASC']],
      });
    } else if (Array.isArray(ids) && ids.length > 0) {
      pendingWithdrawals = await WithdrawalRecord.findAll({
        where: { id: ids, withdrawal_status: 'pending' },
        order: [['id', 'ASC']],
      });
    } else {
      return res.status(400).json({ success: false, message: '请提供 ids 数组或设置 payAll=true' });
    }
  } catch (err) {
    return res.status(500).json({ success: false, message: '查询提现记录失败', error: err.message });
  }

  if (pendingWithdrawals.length === 0) {
    return res.json({ success: true, message: '没有待处理的提现记录', data: { success: [], failed: [], manual: [], total: 0 } });
  }

  // 2. 预览模式：仅返回将要处理的单子，不实际打款
  if (dryRun) {
    const preview = pendingWithdrawals.map(w => ({
      id:           w.id,
      userId:       w.user_id,
      email:        w.email,
      walletAddress: w.wallet_address,
      isUID:        isBinanceUID(w.wallet_address),
      amount:       parseFloat(w.withdrawal_request_amount),
      receivedAmount: parseFloat(w.received_amount),
      networkFee:   parseFloat(w.network_fee),
    }));
    return res.json({
      success: true,
      message: `预览：共 ${preview.length} 条待处理，其中 ${preview.filter(p => p.isUID).length} 条需手动（币安UID）`,
      data: { preview, total: preview.length },
    });
  }

  // 3. 实际打款
  const results = { success: [], failed: [], manual: [] };

  for (const withdrawal of pendingWithdrawals) {
    const address  = withdrawal.wallet_address;
    const received = parseFloat(withdrawal.received_amount);

    // 币安UID：无法通过链上提现API处理，标记为手动
    if (isBinanceUID(address)) {
      results.manual.push({
        id:     withdrawal.id,
        uid:    address,
        userId: withdrawal.user_id,
        email:  withdrawal.email,
        amount: received,
      });
      continue;
    }

    // 链上 BTC 提现
    try {
      const { binanceId } = await withdrawToAddress({
        address,
        amount:        received,
        coin:          'BTC',
        network:       'BTC',
        clientOrderId: `wd_${withdrawal.id}`,
      });

      // 币安API成功 → 更新DB
      const transaction = await sequelize.transaction();
      try {
        await withdrawal.update({ withdrawal_status: 'success', updated_at: new Date() }, { transaction });

        const userStatus = await UserStatus.findOne({ where: { user_id: withdrawal.user_id }, transaction });
        if (userStatus) {
          await userStatus.increment('total_withdrawal_amount', {
            by: parseFloat(withdrawal.withdrawal_request_amount),
            transaction,
          });
        }

        await BitcoinTransactionRecord.update(
          { transaction_status: 'success' },
          { where: { user_id: withdrawal.user_id, transaction_type: 'withdrawal', transaction_status: 'pending' }, transaction, limit: 1 }
        );

        await transaction.commit();
        results.success.push({ id: withdrawal.id, binanceId, amount: received });
      } catch (dbErr) {
        await transaction.rollback();
        // 币安已打款但DB更新失败，需人工处理；不应再次打款
        results.failed.push({ id: withdrawal.id, reason: `⚠️ 币安已打款(${binanceId})但DB更新失败: ${dbErr.message}` });
      }
    } catch (apiErr) {
      const errMsg = apiErr.response?.data?.msg || apiErr.message;
      results.failed.push({ id: withdrawal.id, reason: errMsg });
    }

    // 避免触发币安 API 速率限制，每笔间隔 300ms
    await new Promise(r => setTimeout(r, 300));
  }

  const total = results.success.length + results.failed.length + results.manual.length;
  res.json({
    success: true,
    message: `批量打款完成（共${total}条）：成功${results.success.length}条，失败${results.failed.length}条，需手动处理${results.manual.length}条(UID)`,
    data: results,
  });
});

/**
 * GET /api/withdrawal/admin/verify-binance-key
 * 验证币安 API Key 是否配置正确且有提现权限
 */
router.get('/admin/verify-binance-key', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { verifyApiKey } = require('../services/binancePayoutService');
    const info = await verifyApiKey();
    res.json({
      success: true,
      message: info.enableWithdrawals
        ? '✅ API Key 有效，提现权限已开启'
        : '⚠️ API Key 有效但未开启提现权限，请在币安后台开启',
      data: info,
    });
  } catch (err) {
    const msg = err.response?.data?.msg || err.message;
    res.json({
      success: false,
      message: `❌ API Key 验证失败: ${msg}`,
      error: msg,
    });
  }
});

module.exports = router;
