/**
 * 提现相关路由
 * 处理用户提现申请和提现历史记录查询
 */

const express = require('express');
const router = express.Router();
const { WithdrawalRecord, UserStatus, UserInformation, BitcoinTransactionRecord } = require('../models');
const { Sequelize } = require('sequelize');
const sequelize = require('../config/database');

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
router.post('/request', async (req, res) => {
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
      appleId        // Apple登录ID，用于用户去重
    } = req.body;

    // 1. 参数验证
    if (!userId || !email || !walletAddress || !amount) {
      return res.status(400).json({
        success: false,
        message: 'Missing required parameters'
      });
    }

    const withdrawAmount = parseFloat(amount);
    const fee = parseFloat(networkFee || 0);
    const receivedAmount = withdrawAmount - fee;

    // 2. 验证金额
    if (withdrawAmount <= 0 || receivedAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid withdrawal amount'
      });
    }

    // 3. 验证钱包地址格式(基础验证)
    if (walletAddress.length < 26 || walletAddress.length > 80) {
      return res.status(400).json({
        success: false,
        message: 'Invalid wallet address'
      });
    }

    // 4. 查询用户余额
    const userStatus = await UserStatus.findOne({
      where: { user_id: userId },
      transaction
    });

    if (!userStatus) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const currentBalance = parseFloat(userStatus.current_bitcoin_balance || 0);

    // 5. 验证余额是否足够
    if (currentBalance < withdrawAmount) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: `Insufficient balance. Current: ${currentBalance.toFixed(8)} BTC, Required: ${withdrawAmount.toFixed(8)} BTC`
      });
    }

    // 6. 扣除用户余额
    await sequelize.query(
      'UPDATE user_status SET current_bitcoin_balance = current_bitcoin_balance - ? WHERE user_id = ?',
      { replacements: [withdrawAmount, userId], transaction }
    );

    // 7. 创建提现记录（使用原生SQL避免Sequelize验证问题）
    const [insertResult] = await sequelize.query(
      `INSERT INTO withdrawal_records 
       (user_id, email, wallet_address, withdrawal_request_amount, network_fee, received_amount, withdrawal_status, google_account, apple_id)
       VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
      { replacements: [userId, email, walletAddress, withdrawAmount, fee, receivedAmount, googleAccount || null, appleId || null], transaction }
    );
    
    const withdrawalId = insertResult;

    // 8. 记录比特币交易(提现) - 暂时注释，避免user_id字段长度问题
    // await BitcoinTransactionRecord.create({
    //   user_id: userId,
    //   transaction_type: 'withdrawal',
    //   transaction_amount: withdrawAmount,
    //   transaction_status: 'pending',
    //   description: `Withdrawal to ${walletAddress.substring(0, 10)}...${walletAddress.substring(walletAddress.length - 6)}`
    // }, { transaction });

    // 9. 更新累计提现金额(等待审核通过后再更新)
    // await userStatus.increment('total_withdrawal_amount', {
    //   by: withdrawAmount,
    //   transaction
    // });

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
 * 查询用户提现历史记录
 * 
 * Query参数:
 * - userId: 用户ID(必需)
 * - status: 筛选状态(可选): all, pending, success, rejected
 * - limit: 每页记录数(默认20)
 * - offset: 偏移量(默认0)
 */
router.get('/history', async (req, res) => {
  try {
    const { userId, status, limit = 20, offset = 0 } = req.query;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'userId is required'
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
 * 查询单个提现记录详情
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.query; // 验证用户身份

    const withdrawal = await WithdrawalRecord.findOne({
      where: { 
        id: id,
        ...(userId && { user_id: userId }) // 可选的用户验证
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
        id: withdrawal.id,
        userId: withdrawal.user_id,
        email: withdrawal.email,
        walletAddress: withdrawal.wallet_address,
        amount: parseFloat(withdrawal.withdrawal_request_amount),
        networkFee: parseFloat(withdrawal.network_fee),
        receivedAmount: parseFloat(withdrawal.received_amount),
        status: withdrawal.withdrawal_status,
        createdAt: withdrawal.createdAt || null,
        updatedAt: withdrawal.updatedAt || null
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
router.put('/approve/:id', async (req, res) => {
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

    // 更新提现状态为成功
    await withdrawal.update({
      withdrawal_status: 'success'
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
router.put('/reject/:id', async (req, res) => {
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

    // 更新提现状态为已拒绝
    await withdrawal.update({
      withdrawal_status: 'rejected'
    }, { transaction });

    // 退还余额给用户
    const userStatus = await UserStatus.findOne({
      where: { user_id: withdrawal.user_id },
      transaction
    });

    if (userStatus) {
      await userStatus.update({
        current_bitcoin_balance: Sequelize.literal(
          `current_bitcoin_balance + ${withdrawal.withdrawal_request_amount}`
        )
      }, { transaction });
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

module.exports = router;
