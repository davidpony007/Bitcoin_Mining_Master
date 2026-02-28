/**
 * 用户状态控制器
 * 
 * 职责：处理用户状态相关的所有业务逻辑
 * 
 * 主要功能：
 * - 用户状态的创建、查询、更新
 * - 比特币余额管理（增加、减少）
 * - 用户活跃度追踪（最后登录时间、活跃状态）
 * - 用户账户管理（启用、禁用、删除）
 * - 用户统计信息查询
 * 
 * 相关模型：
 * - UserStatus: 用户状态表（余额、邀请返利、提现金额等）
 * - UserInformation: 用户信息表（基础信息）
 * 
 * @module controllers/userStatusController
 */

const { UserStatus, UserInformation } = require('../models');
const { Op } = require('sequelize');

/**
 * 获取用户状态信息
 * 
 * 功能说明：
 * - 根据 user_id 查询用户的完整状态信息
 * - 包含关联的用户基础信息（邮箱、国家、注册时间）
 * 
 * 请求参数：
 * @param {string} req.params.user_id - 用户ID（路径参数）
 * 
 * 响应数据：
 * @returns {Object} 用户状态对象，包含：
 *   - bitcoin_accumulated_amount: 累计挖矿金额
 *   - current_bitcoin_balance: 当前比特币余额
 *   - total_invitation_rebate: 总邀请返利
 *   - total_withdrawal_amount: 总提现金额
 *   - last_login_time: 最后登录时间
 *   - user_status: 用户状态（normal/active/disabled等）
 *   - userInfo: 关联的用户基础信息
 * 
 * 错误处理：
 * - 404: 用户状态不存在
 * - 500: 服务器内部错误
 * 
 * 使用场景：
 * - 用户个人中心查看账户状态
 * - 管理后台查看用户详情
 */
exports.getUserStatus = async (req, res, next) => {
  try {
    // 从路径参数中获取用户ID
    const { user_id } = req.params;

    // 查询用户状态，同时关联查询用户基础信息
    const userStatus = await UserStatus.findOne({
      where: { user_id },
      include: [{
        model: UserInformation,
        as: 'userInfo',
        attributes: ['user_id', 'email', 'country', 'user_creation_time']
      }]
    });

    // 如果用户状态不存在，返回404错误
    if (!userStatus) {
      return res.status(404).json({
        success: false,
        message: '用户状态不存在'
      });
    }

    // 返回用户状态信息
    res.json({
      success: true,
      data: userStatus
    });
  } catch (error) {
    // 将错误传递给错误处理中间件
    next(error);
  }
};

/**
 * 创建用户状态记录
 * 
 * 功能说明：
 * - 为新注册用户创建初始状态记录
 * - 通常在用户注册成功后自动调用
 * - 初始化所有金额字段为0
 * 
 * 请求参数：
 * @param {string} req.body.user_id - 用户ID（必填）
 * @param {number} req.body.bitcoin_accumulated_amount - 累计挖矿金额（可选，默认0）
 * @param {number} req.body.current_bitcoin_balance - 当前余额（可选，默认0）
 * @param {number} req.body.total_invitation_rebate - 邀请返利总额（可选，默认0）
 * @param {number} req.body.total_withdrawal_amount - 提现总额（可选，默认0）
 * 
 * 响应数据：
 * @returns {Object} 创建的用户状态对象
 * 
 * 错误处理：
 * - 404: 用户信息不存在（必须先创建用户信息）
 * - 400: 用户状态记录已存在（防止重复创建）
 * - 500: 服务器内部错误
 * 
 * 业务逻辑：
 * 1. 验证用户信息是否存在
 * 2. 检查状态记录是否已存在
 * 3. 创建初始状态记录
 * 4. 设置默认状态为 'normal'
 * 5. 记录创建时间为当前时间
 * 
 * 使用场景：
 * - 用户注册流程的一部分
 * - 管理员手动为用户创建状态记录
 */
exports.createUserStatus = async (req, res, next) => {
  try {
    // 从请求体中解构参数，设置默认值为0
    const {
      user_id,
      bitcoin_accumulated_amount = 0,
      current_bitcoin_balance = 0,
      total_invitation_rebate = 0,
      total_withdrawal_amount = 0
    } = req.body;

    // 第一步：检查用户信息表中是否存在该用户
    // 必须先有用户信息记录才能创建状态记录（外键约束）
    const userInfo = await UserInformation.findOne({ where: { user_id } });
    if (!userInfo) {
      return res.status(404).json({
        success: false,
        message: '用户不存在'
      });
    }

    // 第二步：检查状态记录是否已存在
    // 防止重复创建，确保一个用户只有一条状态记录
    const existingStatus = await UserStatus.findOne({ where: { user_id } });
    if (existingStatus) {
      return res.status(400).json({
        success: false,
        message: '用户状态记录已存在'
      });
    }

    // 第三步：创建用户状态记录
    const userStatus = await UserStatus.create({
      user_id,                          // 用户ID（唯一）
      bitcoin_accumulated_amount,       // 累计挖矿金额
      current_bitcoin_balance,          // 当前比特币余额
      total_invitation_rebate,          // 邀请返利总额
      total_withdrawal_amount,          // 提现总额
      last_login_time: new Date(),      // 最后登录时间（当前时间）
      user_status: 'normal'             // 默认状态为正常
    });

    // 返回创建成功的响应（HTTP 201）
    res.status(201).json({
      success: true,
      message: '用户状态创建成功',
      data: userStatus
    });
  } catch (error) {
    // 将错误传递给错误处理中间件
    next(error);
  }
};

/**
 * 更新用户比特币余额
 * 
 * 功能说明：
 * - 增加或减少用户的比特币余额
 * - 增加余额时同步更新累计挖矿金额
 * - 减少余额时检查余额是否足够
 * 
 * 请求参数：
 * @param {string} req.params.user_id - 用户ID（路径参数）
 * @param {number} req.body.amount - 金额（必须为正数）
 * @param {string} req.body.type - 操作类型：'add'（增加）或 'subtract'（减少）
 * 
 * 响应数据：
 * @returns {Object} 包含：
 *   - user_id: 用户ID
 *   - previous_balance: 操作前余额
 *   - amount: 变动金额
 *   - new_balance: 操作后余额
 * 
 * 错误处理：
 * - 404: 用户状态不存在
 * - 400: 余额不足（减少操作时）
 * - 400: 无效的操作类型
 * - 500: 服务器内部错误
 * 
 * 业务规则：
 * 1. 增加余额（type='add'）：
 *    - 余额 = 余额 + 金额
 *    - 累计金额 = 累计金额 + 金额
 * 2. 减少余额（type='subtract'）：
 *    - 检查余额是否充足
 *    - 余额 = 余额 - 金额
 *    - 不影响累计金额
 * 
 * 使用场景：
 * - 挖矿收益到账（add）
 * - 邀请返利到账（add）
 * - 用户提现（subtract）
 * - 购买矿机合约（subtract）
 */
exports.updateBitcoinBalance = async (req, res, next) => {
  try {
    // 获取用户ID和操作参数
    const { user_id } = req.params;
    const { amount, type } = req.body; // type: 'add'（增加）或 'subtract'（减少）

    // 查询用户状态记录
    const userStatus = await UserStatus.findOne({ where: { user_id } });
    if (!userStatus) {
      return res.status(404).json({
        success: false,
        message: '用户状态不存在'
      });
    }

    // 将余额和金额转换为浮点数，确保精确计算
    const currentBalance = parseFloat(userStatus.current_bitcoin_balance);
    const amountValue = parseFloat(amount);

    let newBalance;
    
    // 根据操作类型执行不同逻辑
    if (type === 'add') {
      // 增加余额
      newBalance = currentBalance + amountValue;
      
      // 重要：增加余额时，同时更新累计挖矿金额
      // 累计金额只增不减，记录用户总共挖到的比特币数量
      userStatus.bitcoin_accumulated_amount = 
        parseFloat(userStatus.bitcoin_accumulated_amount) + amountValue;
        
    } else if (type === 'subtract') {
      // 减少余额（提现、购买等）
      
      // 检查余额是否充足
      if (currentBalance < amountValue) {
        return res.status(400).json({
          success: false,
          message: '余额不足'
        });
      }
      
      // 扣除余额（不影响累计金额）
      newBalance = currentBalance - amountValue;
      
    } else {
      // 无效的操作类型
      return res.status(400).json({
        success: false,
        message: '无效的操作类型'
      });
    }

    // 更新余额并保存到数据库
    userStatus.current_bitcoin_balance = newBalance;
    await userStatus.save();

    // 返回操作结果
    res.json({
      success: true,
      message: '余额更新成功',
      data: {
        user_id,
        previous_balance: currentBalance,  // 操作前余额
        amount: amountValue,               // 变动金额
        new_balance: newBalance            // 操作后余额
      }
    });
  } catch (error) {
    // 将错误传递给错误处理中间件
    next(error);
  }
};

/**
 * 更新最后登录时间
 * 
 * 功能说明：
 * - 记录用户的最后登录时间
 * - 自动更新用户活跃状态
 * 
 * 请求参数：
 * @param {string} req.params.user_id - 用户ID（路径参数）
 * 
 * 响应数据：
 * @returns {Object} 包含：
 *   - user_id: 用户ID
 *   - last_login_time: 最后登录时间
 * 
 * 错误处理：
 * - 404: 用户状态不存在
 * - 500: 服务器内部错误
 * 
 * 业务规则：
 * - 更新登录时间为当前时间
 * - 如果用户状态为正常（非禁用/删除），则设置为 'active within 3 days'
 * - 禁用和已删除的用户不更新状态
 * 
 * 使用场景：
 * - 用户登录APP时调用
 * - 用户访问主要功能时调用
 * - 用于统计用户活跃度
 */
exports.updateLastLoginTime = async (req, res, next) => {
  try {
    // 获取用户ID
    const { user_id } = req.params;

    // 查询用户状态
    const userStatus = await UserStatus.findOne({ where: { user_id } });
    if (!userStatus) {
      return res.status(404).json({
        success: false,
        message: '用户状态不存在'
      });
    }

    // 更新最后登录时间为当前时间
    userStatus.last_login_time = new Date();
    
    // 只有非禁用/删除状态才更新为活跃
    // 保护已禁用和已删除用户的状态不被改变
    if (userStatus.user_status !== 'disabled' && userStatus.user_status !== 'deleted') {
      userStatus.user_status = 'active within 3 days';
    }
    
    // 保存到数据库
    await userStatus.save();

    // 返回更新结果
    res.json({
      success: true,
      message: '登录时间更新成功',
      data: {
        user_id,
        last_login_time: userStatus.last_login_time
      }
    });
  } catch (error) {
    // 将错误传递给错误处理中间件
    next(error);
  }
};

/**
 * 更新用户活跃状态（批量）
 * 
 * 功能说明：
 * - 定时任务调用，批量更新所有用户的活跃状态
 * - 根据最后登录时间自动分类用户活跃度
 * 
 * 请求参数：无
 * 
 * 响应数据：
 * @returns {Object} 包含：
 *   - active_users: 更新为活跃的用户数量
 *   - inactive_users: 更新为不活跃的用户数量
 * 
 * 业务规则：
 * 1. 3天内登录的用户 → 状态更新为 'active within 3 days'
 * 2. 7天内未登录的用户 → 状态更新为 'no login within 7 days'
 * 3. 已禁用和已删除的用户不参与更新
 * 
 * 时间计算：
 * - 当前时间 - 3天 = 3天前的时间点
 * - 当前时间 - 7天 = 7天前的时间点
 * 
 * 使用场景：
 * - 定时任务（如每天凌晨执行）
 * - 管理员手动触发批量更新
 * - 用于生成用户活跃度报表
 * 
 * 注意事项：
 * - 此操作会影响大量记录，建议在低峰期执行
 * - 不会发送通知给用户
 */
exports.updateUserActiveStatus = async (req, res, next) => {
  try {
    // 获取当前时间
    const now = new Date();
    
    // 计算3天前的时间点（3 * 24小时 * 60分钟 * 60秒 * 1000毫秒）
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
    
    // 计算7天前的时间点
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // 批量更新1：将3天内登录的用户标记为活跃
    // 条件：last_login_time >= 3天前 且 状态不是已禁用/已删除
    const activeCount = await UserStatus.update(
      { user_status: 'active within 3 days' },  // 要设置的新状态
      {
        where: {
          last_login_time: {
            [Op.gte]: threeDaysAgo  // 大于等于3天前（即3天内登录过）
          },
          user_status: { 
            [Op.notIn]: ['disabled', 'deleted'] // 排除已禁用/删除的用户
          }
        }
      }
    );

    // 批量更新2：将7天内未登录的用户标记为不活跃
    // 条件：last_login_time < 7天前 且 状态不是已禁用/已删除
    const sevenDaysCount = await UserStatus.update(
      { user_status: 'no login within 7 days' },  // 要设置的新状态
      {
        where: {
          last_login_time: {
            [Op.lt]: sevenDaysAgo  // 小于7天前（即7天内未登录）
          },
          user_status: { 
            [Op.notIn]: ['disabled', 'deleted'] // 排除已禁用/删除的用户
          }
        }
      }
    );

    // 返回更新结果
    // activeCount[0] 和 sevenDaysCount[0] 分别表示受影响的行数
    res.json({
      success: true,
      message: '用户活跃状态更新完成',
      data: {
        active_users: activeCount[0],      // 更新为活跃的用户数量
        inactive_users: sevenDaysCount[0]  // 更新为不活跃的用户数量
      }
    });
  } catch (error) {
    // 将错误传递给错误处理中间件
    next(error);
  }
};

/**
 * 获取用户统计信息
 * 
 * 功能说明：
 * - 查询单个用户的详细统计数据
 * - 计算提现率等衍生指标
 * 
 * 请求参数：
 * @param {string} req.params.user_id - 用户ID（路径参数）
 * 
 * 响应数据：
 * @returns {Object} 包含：
 *   - user_id: 用户ID
 *   - bitcoin_accumulated_amount: 累计挖矿金额（总共挖到的比特币）
 *   - current_bitcoin_balance: 当前可用余额
 *   - total_invitation_rebate: 邀请返利总额
 *   - total_withdrawal_amount: 提现总额
 *   - withdrawn_percentage: 提现率（提现金额 / 累计金额 * 100%）
 *   - user_status: 用户状态
 *   - last_login_time: 最后登录时间
 * 
 * 错误处理：
 * - 404: 用户状态不存在
 * - 500: 服务器内部错误
 * 
 * 计算逻辑：
 * - 提现率 = (总提现金额 / 累计挖矿金额) × 100%
 * - 如果累计金额为0，则提现率为0
 * - 结果保留两位小数
 * 
 * 使用场景：
 * - 用户个人中心展示统计数据
 * - 管理后台查看用户收益情况
 * - 生成用户财务报表
 */
exports.getUserStatistics = async (req, res, next) => {
  try {
    // 获取用户ID
    const { user_id } = req.params;

    // 查询用户状态
    const userStatus = await UserStatus.findOne({
      where: { user_id }
    });

    // 如果用户状态不存在，返回404
    if (!userStatus) {
      return res.status(404).json({
        success: false,
        message: '用户状态不存在'
      });
    }

    // 构建统计信息对象
    const statistics = {
      user_id,
      // 将数据库中的字符串转换为浮点数
      bitcoin_accumulated_amount: parseFloat(userStatus.bitcoin_accumulated_amount),
      current_bitcoin_balance: parseFloat(userStatus.current_bitcoin_balance),
      total_invitation_rebate: parseFloat(userStatus.total_invitation_rebate),
      total_withdrawal_amount: parseFloat(userStatus.total_withdrawal_amount),
      
      // 计算提现率（提现金额 / 累计金额 * 100%）
      withdrawn_percentage: userStatus.bitcoin_accumulated_amount > 0
        ? (parseFloat(userStatus.total_withdrawal_amount) / parseFloat(userStatus.bitcoin_accumulated_amount) * 100).toFixed(2)
        : 0,  // 如果累计金额为0，则提现率为0
      
      user_status: userStatus.user_status,
      last_login_time: userStatus.last_login_time
    };

    // 返回统计信息
    res.json({
      success: true,
      data: statistics
    });
  } catch (error) {
    // 将错误传递给错误处理中间件
    next(error);
  }
};

/**
 * 禁用用户
 * 
 * 功能说明：
 * - 将用户状态设置为禁用
 * - 禁用后用户将无法登录和使用功能
 * 
 * 请求参数：
 * @param {string} req.params.user_id - 用户ID（路径参数）
 * 
 * 响应数据：
 * @returns {Object} 包含：
 *   - user_id: 用户ID
 *   - user_status: 新状态（'disabled'）
 * 
 * 错误处理：
 * - 404: 用户状态不存在
 * - 500: 服务器内部错误
 * 
 * 业务规则：
 * - 状态更新为 'disabled'
 * - 不影响用户的余额和数据
 * - 可以通过 enableUser 恢复
 * 
 * 使用场景：
 * - 管理员封禁违规用户
 * - 暂时冻结用户账户
 * - 风控系统自动禁用可疑账户
 * 
 * 注意事项：
 * - 禁用状态的用户不会被定时任务更新为活跃状态
 * - 建议记录禁用原因到日志表
 */
exports.disableUser = async (req, res, next) => {
  try {
    // 获取用户ID
    const { user_id } = req.params;

    // 查询用户状态
    const userStatus = await UserStatus.findOne({ where: { user_id } });
    if (!userStatus) {
      return res.status(404).json({
        success: false,
        message: '用户状态不存在'
      });
    }

    // 设置状态为禁用
    userStatus.user_status = 'disabled';
    await userStatus.save();

    // 返回操作结果
    res.json({
      success: true,
      message: '用户已禁用',
      data: { user_id, user_status: 'disabled' }
    });
  } catch (error) {
    // 将错误传递给错误处理中间件
    next(error);
  }
};

/**
 * 启用用户
 * 
 * 功能说明：
 * - 恢复被禁用的用户，允许其正常使用
 * - 将用户状态重置为正常状态
 * 
 * 请求参数：
 * @param {string} req.params.user_id - 用户ID（路径参数）
 * 
 * 响应数据：
 * @returns {Object} 包含：
 *   - user_id: 用户ID
 *   - user_status: 新状态（'normal'）
 * 
 * 错误处理：
 * - 404: 用户状态不存在
 * - 400: 用户已被删除，无法启用
 * - 500: 服务器内部错误
 * 
 * 业务规则：
 * - 状态更新为 'normal'
 * - 已删除的用户无法启用（软删除是最终状态）
 * - 恢复后用户可以正常登录和使用
 * 
 * 使用场景：
 * - 管理员解除用户封禁
 * - 用户申诉成功后恢复账户
 * - 误操作后的账户恢复
 * 
 * 注意事项：
 * - 不能启用已删除（deleted）状态的用户
 * - 建议记录启用原因到日志表
 */
exports.enableUser = async (req, res, next) => {
  try {
    // 获取用户ID
    const { user_id } = req.params;

    // 查询用户状态
    const userStatus = await UserStatus.findOne({ where: { user_id } });
    if (!userStatus) {
      return res.status(404).json({
        success: false,
        message: '用户状态不存在'
      });
    }

    // 检查用户是否已被删除
    // 已删除的用户无法启用（软删除是最终状态）
    if (userStatus.user_status === 'deleted') {
      return res.status(400).json({
        success: false,
        message: '已删除的用户无法启用'
      });
    }

    // 恢复用户，设置状态为正常
    userStatus.user_status = 'normal';
    await userStatus.save();

    // 返回操作结果
    res.json({
      success: true,
      message: '用户已启用',
      data: { user_id, user_status: 'normal' }
    });
  } catch (error) {
    // 将错误传递给错误处理中间件
    next(error);
  }
};

/**
 * 删除用户（软删除）
 * 
 * 功能说明：
 * - 将用户标记为已删除（不真正从数据库删除数据）
 * - 保留用户的所有数据用于审计和分析
 * 
 * 请求参数：
 * @param {string} req.params.user_id - 用户ID（路径参数）
 * 
 * 响应数据：
 * @returns {Object} 包含：
 *   - user_id: 用户ID
 *   - user_status: 新状态（'deleted'）
 * 
 * 错误处理：
 * - 404: 用户状态不存在
 * - 500: 服务器内部错误
 * 
 * 业务规则：
 * - 状态更新为 'deleted'
 * - 不删除数据库记录（软删除）
 * - 保留余额、交易记录等所有数据
 * - 删除后无法通过 enableUser 恢复
 * 
 * 使用场景：
 * - 用户申请注销账户
 * - 管理员永久封禁用户
 * - 清理僵尸账户
 * 
 * 注意事项：
 * - 软删除不会删除数据库记录，只是标记状态
 * - 已删除的用户不会被定时任务更新状态
 * - 如需恢复，需要手动修改状态（不能用 enableUser）
 * - 建议记录删除原因和删除时间到日志表
 * - 删除后用户余额仍然保留在记录中
 */
exports.deleteUser = async (req, res, next) => {
  try {
    // 获取用户ID
    const { user_id } = req.params;

    // 查询用户状态
    const userStatus = await UserStatus.findOne({ where: { user_id } });
    if (!userStatus) {
      return res.status(404).json({
        success: false,
        message: '用户状态不存在'
      });
    }

    // 软删除：只修改状态，不删除数据库记录
    // 这样可以保留用户的所有历史数据用于审计
    userStatus.user_status = 'deleted';
    await userStatus.save();

    // 返回操作结果
    res.json({
      success: true,
      message: '用户已删除',
      data: { user_id, user_status: 'deleted' }
    });
  } catch (error) {
    // 将错误传递给错误处理中间件
    next(error);
  }
};
