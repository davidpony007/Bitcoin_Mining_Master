// 身份验证控制器
// 处理用户登录、设备绑定、Google账号管理

const UserInformation = require('../models/userInformation');
const InvitationRelationship = require('../models/invitationRelationship');
const UserStatus = require('../models/userStatus');
const FreeContractRecord = require('../models/freeContractRecord');
const InvitationRewardService = require('../services/invitationRewardService');
const jwt = require('jsonwebtoken');

/**
 * 设备自动登录/注册
 * 用户首次打开APP时，通过android_id自动创建账号或登录
 * 
 * 请求体:
 * {
 *   android_id: "设备唯一标识",
 *   referrer_invitation_code: "推荐人邀请码(可选)",
 *   gaid: "Google广告ID(可选)",
 *   country: "国家代码(可选)",
 *   email: "邮箱(可选)"
 * }
 * 
 * 响应:
 * {
 *   success: true,
 *   isNewUser: true/false,
 *   message: "登录成功",
 *   data: {用户信息}
 * }
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

    // 验证必填字段
    if (!android_id || android_id.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'android_id 是必填字段'
      });
    }

    console.log('🔍 [Device Login] 收到请求:');
    console.log('   android_id:', android_id);
    console.log('   android_id长度:', android_id.length);
    console.log('   gaid:', gaid);
    console.log('   country:', country);

    // 生成 user_id 和 invitation_code
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

    // 获取真实IP
    const register_ip = 
      req.headers['x-forwarded-for']?.split(',')[0].trim() ||
      req.headers['x-real-ip'] ||
      req.ip ||
      req.connection.remoteAddress ||
      '未知';

    // 🔧 使用 findOrCreate 原子操作（防止并发重复创建）
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

    let referrerInfo = null;

    // 如果是新用户，执行额外初始化
    if (created) {
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

      // 3. 如果填写了推荐人邀请码，建立邀请关系
      if (referrer_invitation_code && referrer_invitation_code.trim() !== '') {
        try {
          const referrer = await UserInformation.findOne({
            where: { invitation_code: referrer_invitation_code.trim() }
          });

          if (referrer) {
            // 🔒 检查：不能邀请自己
            if (referrer.invitation_code === user.invitation_code) {
              console.warn(`用户尝试使用自己的邀请码: ${user.user_id}`);
              // 不建立邀请关系，但不阻止用户注册
              referrerInfo = {
                error: '不能使用自己的邀请码',
                rejected: true
              };
            } else {
              await InvitationRelationship.create({
              user_id: user.user_id,
              invitation_code: user.invitation_code,
              referrer_user_id: referrer.user_id,
              referrer_invitation_code: referrer.invitation_code
            });

            referrerInfo = {
              referrer_user_id: referrer.user_id,
              referrer_invitation_code: referrer.invitation_code
            };

            // 🎁 处理邀请奖励（基础奖励+里程碑奖励）
            try {
              const rewardResult = await InvitationRewardService.handleNewReferral(
                referrer.user_id,
                user.user_id,
                referrer_invitation_code.trim()
              );
              console.log('邀请奖励发放成功:', rewardResult);
              
              // 将奖励信息附加到推荐人信息中
              if (referrerInfo) {
                referrerInfo.rewards = rewardResult;
              }
            } catch (rewardErr) {
              console.error('发放邀请奖励失败:', rewardErr);
              // 奖励发放失败不影响用户注册和邀请关系建立
            }

            // 🎯 创建或延长推荐人的邀请挖矿合约（增加2小时）
            try {
              const InvitationMiningContractService = require('../services/invitationMiningContractService');
              const miningContractResult = await InvitationMiningContractService.onSuccessfulInvitation(
                referrer.user_id,
                user.user_id
              );
              console.log('邀请挖矿合约创建/延长成功:', miningContractResult);
              
              // 将挖矿合约信息附加到推荐人信息中
              if (referrerInfo) {
                referrerInfo.miningContract = miningContractResult;
              }
            } catch (miningErr) {
              console.error('创建/延长邀请挖矿合约失败:', miningErr);
              // 挖矿合约失败不影响用户注册和邀请关系建立
            }

            // 🎁 为新用户（被邀请人）创建绑定推荐人挖矿合约（仅一次，2小时）
            try {
              const RefereeMiningContractService = require('../services/refereeMiningContractService');
              const refereeContractResult = await RefereeMiningContractService.onBindReferrer(
                user.user_id,
                referrer.user_id
              );
              console.log('新用户绑定推荐人挖矿合约创建成功:', refereeContractResult);
              
              // 将被邀请人挖矿合约信息附加到返回数据中
              if (referrerInfo) {
                referrerInfo.refereeContract = refereeContractResult;
              }
            } catch (bindErr) {
              console.error('创建新用户绑定推荐人挖矿合约失败:', bindErr);
              // 挖矿合约失败不影响用户注册和邀请关系建立
            }
            }
          } else {
            console.warn(`推荐人邀请码不存在: ${referrer_invitation_code}`);
          }
        } catch (inviteErr) {
          console.error('创建邀请关系失败:', inviteErr);
        }
      }
    } else {
      // 如果是已存在的用户(非新用户)，更新最后登录时间
      try {
        await UserStatus.update(
          { last_login_time: new Date() },
          { where: { user_id: user.user_id } }
        );
      } catch (updateErr) {
        console.error('更新登录时间失败:', updateErr);
      }
    }

    // 4. 生成JWT Token（用于访问需要认证的接口）
    const secret = process.env.JWT_SECRET || 'dev_secret_change_me';
    const token = jwt.sign({ user_id: user.user_id }, secret, { expiresIn: '30d' });

    // 5. 返回用户信息
    console.log(`   ✅ 登录成功: ${created ? '新用户' : '现有用户'} - ${user.user_id}`);
    
    res.json({
      success: true,
      isNewUser: created,
      message: created ? '账号创建成功' : '登录成功',
      data: user,
      referrer: referrerInfo,
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
      details: err.message
    });
  }
};

/**
 * 绑定Google账号
 * 
 * 请求体:
 * {
 *   user_id: "用户ID",
 *   google_account: "Google账号邮箱"
 * }
 * 
 * 响应:
 * {
 *   success: true,
 *   message: "Google账号绑定成功",
 *   data: {用户信息}
 * }
 */
exports.bindGoogleAccount = async (req, res) => {
  try {
    const { user_id, google_account } = req.body;

    // 验证必填字段
    if (!user_id || !google_account) {
      return res.status(400).json({
        success: false,
        error: 'user_id 和 google_account 是必填字段'
      });
    }

    // 查找用户
    const user = await UserInformation.findOne({
      where: { user_id: user_id.trim() }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: '用户不存在'
      });
    }

    // 🔒 检查该用户是否已经绑定了Google账号（不可换绑）
    if (user.google_account && user.google_account.trim() !== '') {
      return res.status(400).json({
        success: false,
        error: 'Google账号已绑定，不可更换',
        message: `该账户已绑定Google账号: ${user.google_account}，一旦绑定不可更换。`
      });
    }

    // 检查该Google账号是否已被其他用户绑定
    const existingUser = await UserInformation.findOne({
      where: { google_account: google_account.trim() }
    });

    if (existingUser && existingUser.user_id !== user_id.trim()) {
      return res.status(400).json({
        success: false,
        error: '该Google账号已被其他用户绑定',
        message: `该Google账号已被账户 ${existingUser.user_id} 绑定。`
      });
    }

    // 更新Google账号（仅在未绑定时才能执行）
    await user.update({
      google_account: google_account.trim()
    });

    console.log(`✅ Google账号绑定成功: ${user_id} -> ${google_account}`);

    res.json({
      success: true,
      message: 'Google账号绑定成功',
      data: user
    });

  } catch (err) {
    console.error('绑定Google账号失败:', err);
    res.status(500).json({
      success: false,
      error: '绑定失败',
      details: err.message
    });
  }
};

/**
 * 通过Google账号切换用户
 * 
 * 请求体:
 * {
 *   google_account: "Google账号邮箱",
 *   android_id: "当前设备ID"
 * }
 * 
 * 响应:
 * {
 *   success: true,
 *   message: "切换成功",
 *   data: {用户信息}
 * }
 */
exports.switchByGoogleAccount = async (req, res) => {
  try {
    const { google_account, android_id } = req.body;

    // 验证必填字段
    if (!google_account) {
      return res.status(400).json({
        success: false,
        error: 'google_account 是必填字段'
      });
    }

    // 查找绑定该Google账号的用户
    const user = await UserInformation.findOne({
      where: { google_account: google_account.trim() }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: '未找到绑定该Google账号的用户'
      });
    }

    // 如果提供了android_id，更新用户的设备绑定
    if (android_id && android_id.trim() !== '') {
      await user.update({
        android_id: android_id.trim()
      });
    }

    res.json({
      success: true,
      message: '切换成功',
      data: user
    });

  } catch (err) {
    console.error('切换账号失败:', err);
    res.status(500).json({
      success: false,
      error: '切换失败',
      details: err.message
    });
  }
};

/**
 * 解绑Google账号
 * ⚠️ 已禁用：为保证账号安全性，Google账号一旦绑定不可解绑
 * 
 * 请求体:
 * {
 *   user_id: "用户ID"
 * }
 * 
 * 响应:
 * {
 *   success: false,
 *   message: "Google账号绑定后不可解绑"
 * }
 */
exports.unbindGoogleAccount = async (req, res) => {
  // 🔒 禁用解绑功能，确保账号绑定的永久性和唯一性
  return res.status(403).json({
    success: false,
    error: 'Google账号绑定后不可解绑',
    message: '为保证账号安全性，Google账号一旦绑定，将永久关联该账户，无法解绑或更换。'
  });

  /* 原解绑逻辑已禁用
  try {
    const { user_id } = req.body;

    if (!user_id) {
      return res.status(400).json({
        success: false,
        error: 'user_id 是必填字段'
      });
    }

    const user = await UserInformation.findOne({
      where: { user_id: user_id.trim() }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: '用户不存在'
      });
    }

    await user.update({
      google_account: null
    });

    res.json({
      success: true,
      message: 'Google账号解绑成功',
      data: user
    });

  } catch (err) {
    console.error('解绑Google账号失败:', err);
    res.status(500).json({
      success: false,
      error: '解绑失败',
      details: err.message
    });
  }
  */
};

/**
 * 查询用户的邀请关系
 * 
 * 请求参数:
 * ?user_id=用户ID
 * 
 * 响应:
 * {
 *   success: true,
 *   data: {
 *     myInfo: {...},           // 我的邀请码信息
 *     referrer: {...},         // 推荐人信息(如果有)
 *     invitedUsers: [...]      // 我邀请的用户列表
 *   }
 * }
 */
exports.getInvitationInfo = async (req, res) => {
  try {
    const { user_id } = req.query;

    if (!user_id) {
      return res.status(400).json({
        success: false,
        error: 'user_id 是必填字段'
      });
    }

    // 查找我的邀请关系记录
    const myRelation = await InvitationRelationship.findOne({
      where: { user_id: user_id.trim() }
    });

    let referrerInfo = null;
    if (myRelation && myRelation.referrer_user_id) {
      // 查找推荐人详细信息
      const referrer = await UserInformation.findOne({
        where: { user_id: myRelation.referrer_user_id },
        attributes: ['user_id', 'invitation_code', 'email', 'country']
      });
      referrerInfo = referrer;
    }

    // 查找我邀请的用户列表
    const invitedRelations = await InvitationRelationship.findAll({
      where: { referrer_user_id: user_id.trim() }
    });

    const invitedUsers = [];
    for (const relation of invitedRelations) {
      const invitedUser = await UserInformation.findOne({
        where: { user_id: relation.user_id },
        attributes: ['user_id', 'invitation_code', 'email', 'country', 'user_creation_time']
      });
      if (invitedUser) {
        invitedUsers.push(invitedUser);
      }
    }

    res.json({
      success: true,
      data: {
        myInfo: myRelation,
        referrer: referrerInfo,
        invitedUsers: invitedUsers,
        invitedCount: invitedUsers.length
      }
    });

  } catch (err) {
    console.error('查询邀请信息失败:', err);
    res.status(500).json({
      success: false,
      error: '查询失败',
      details: err.message
    });
  }
};

/**
 * 查询用户状态(余额、挖矿统计等)
 * 
 * 请求参数:
 * ?user_id=用户ID
 * 
 * 响应:
 * {
 *   success: true,
 *   data: {
 *     user_id: "U2025120721463704333",
 *     bitcoin_accumulated_amount: "0.000000000000000000",
 *     current_bitcoin_balance: "0.000000000000000000",
 *     total_invitation_rebate: "0.000000000000000000",
 *     total_withdrawal_amount: "0.000000000000000000",
 *     last_login_time: "2025-12-07T13:46:37.000Z",
 *     user_status: "normal"
 *   }
 * }
 */
exports.getUserStatus = async (req, res) => {
  try {
    const { user_id } = req.query;

    if (!user_id) {
      return res.status(400).json({
        success: false,
        error: 'user_id 是必填字段'
      });
    }

    // 查找用户状态
    const userStatus = await UserStatus.findOne({
      where: { user_id: user_id.trim() }
    });

    if (!userStatus) {
      return res.status(404).json({
        success: false,
        error: '用户状态不存在'
      });
    }

    // 同时查询用户信息以获取invitation_code
    const userInfo = await UserInformation.findOne({
      where: { user_id: user_id.trim() },
      attributes: ['invitation_code']
    });

    // 合并返回数据
    const responseData = {
      ...userStatus.toJSON(),
      invitation_code: userInfo ? userInfo.invitation_code : null
    };

    res.json({
      success: true,
      data: responseData
    });

  } catch (err) {
    console.error('查询用户状态失败:', err);
    res.status(500).json({
      success: false,
      error: '查询失败',
      details: err.message
    });
  }
};

/**
 * 后期添加推荐人邀请码
 * 用户首次未填写邀请码，后期可通过此接口绑定推荐人
 * 
 * 请求体:
 * {
 *   user_id: "用户ID",
 *   referrer_invitation_code: "推荐人邀请码"
 * }
 */
exports.addReferrer = async (req, res) => {
  try {
    const { user_id, referrer_invitation_code } = req.body;

    // 1. 验证参数
    if (!user_id || !referrer_invitation_code) {
      return res.status(400).json({
        success: false,
        message: '用户ID和推荐人邀请码不能为空'
      });
    }

    // 2. 检查用户是否存在
    const user = await UserInformation.findOne({
      where: { user_id: user_id.trim() }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: '用户不存在'
      });
    }

    // 3. 检查是否已经有推荐人
    const existingRelation = await InvitationRelationship.findOne({
      where: { user_id: user_id.trim() }
    });

    if (existingRelation) {
      return res.status(400).json({
        success: false,
        message: '您已经绑定过推荐人，无法重复绑定'
      });
    }

    // 4. 查找推荐人
    const referrer = await UserInformation.findOne({
      where: { invitation_code: referrer_invitation_code.trim() }
    });

    if (!referrer) {
      return res.status(404).json({
        success: false,
        message: '推荐人邀请码不存在'
      });
    }

    // 5. 不能邀请自己
    if (referrer.user_id === user_id.trim()) {
      return res.status(400).json({
        success: false,
        message: '不能使用自己的邀请码'
      });
    }

    // 6. 创建邀请关系
    await InvitationRelationship.create({
      user_id: user.user_id,
      invitation_code: user.invitation_code,
      referrer_user_id: referrer.user_id,
      referrer_invitation_code: referrer.invitation_code
    });

    // 7. 🎁 处理邀请奖励（推荐人获得奖励）
    let rewardResult = null;
    try {
      rewardResult = await InvitationRewardService.handleNewReferral(
        referrer.user_id,
        user.user_id,
        referrer_invitation_code.trim()
      );
      console.log('邀请奖励发放成功:', rewardResult);
    } catch (rewardErr) {
      console.error('发放邀请奖励失败:', rewardErr);
    }

    // 8. 🎯 创建或延长推荐人的邀请挖矿合约（增加2小时）
    let referrerContractResult = null;
    try {
      const InvitationMiningContractService = require('../services/invitationMiningContractService');
      referrerContractResult = await InvitationMiningContractService.onSuccessfulInvitation(
        referrer.user_id,
        user.user_id
      );
      console.log('推荐人邀请挖矿合约创建/延长成功:', referrerContractResult);
    } catch (miningErr) {
      console.error('创建/延长推荐人邀请挖矿合约失败:', miningErr);
    }

    // 9. 🎁 为被邀请人创建绑定推荐人挖矿合约（仅一次，2小时）
    let refereeContractResult = null;
    try {
      const RefereeMiningContractService = require('../services/refereeMiningContractService');
      refereeContractResult = await RefereeMiningContractService.onBindReferrer(
        user.user_id,
        referrer.user_id
      );
      console.log('被邀请人绑定推荐人挖矿合约创建成功:', refereeContractResult);
    } catch (bindErr) {
      console.error('创建被邀请人绑定推荐人挖矿合约失败:', bindErr);
    }

    res.json({
      success: true,
      message: '推荐人绑定成功，您获得了2小时免费挖矿合约',
      data: {
        referrer_user_id: referrer.user_id,
        referrer_invitation_code: referrer.invitation_code,
        rewards: rewardResult,
        referrerContract: referrerContractResult,
        refereeContract: refereeContractResult
      }
    });

  } catch (err) {
    console.error('添加推荐人失败:', err);
    res.status(500).json({
      success: false,
      error: '绑定失败',
      details: err.message
    });
  }
};

/**
 * 创建免费广告挖矿合约
 * 用户绑定推荐人后，获得一个需要通过观看广告激活的免费挖矿合约
 * 
 * 请求体:
 * {
 *   user_id: "用户ID"
 * }
 */
exports.createAdFreeContract = async (req, res) => {
  try {
    const { user_id } = req.body;

    if (!user_id) {
      return res.status(400).json({
        success: false,
        message: '用户ID不能为空'
      });
    }

    // 1. 验证用户存在
    const user = await UserInformation.findOne({
      where: { user_id: user_id.trim() }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: '用户不存在'
      });
    }

    // 2. 检查是否已经有待激活的广告合约
    const existingContract = await FreeContractRecord.findOne({
      where: {
        user_id: user_id.trim(),
        free_contract_type: 'ad free contract',
        mining_status: 'completed' // 查找未激活的合约
      }
    });

    if (existingContract) {
      return res.status(400).json({
        success: false,
        message: '您已有待激活的广告合约'
      });
    }

    // 3. 计算挖矿速度（应用公式：基础奖励 × 国家系数 × 矿工等级速率系数 × 特殊加成系数）
    const LevelService = require('../services/levelService');
    const speedInfo = await LevelService.calculateMiningSpeed(user_id.trim());
    
    // 计算2小时的预期收益
    const durationSeconds = 2 * 60 * 60; // 2小时
    const expectedRevenue = speedInfo.finalSpeedWithCountry * durationSeconds;

    console.log(`✅ 免费广告合约速度计算:`, {
      user_id: user_id.trim(),
      baseSpeed: speedInfo.baseSpeed,
      levelMultiplier: speedInfo.levelMultiplier,
      dailyBonusMultiplier: speedInfo.dailyBonusMultiplier,
      countryMultiplier: speedInfo.countryMultiplier,
      finalSpeed: speedInfo.finalSpeedWithCountry,
      expectedRevenue2Hours: expectedRevenue
    });

    // 4. 创建免费广告合约（未激活状态）
    const now = new Date();
    const contract = await FreeContractRecord.create({
      user_id: user_id.trim(),
      free_contract_type: 'ad free contract',
      free_contract_revenue: 0,
      free_contract_creation_time: now,
      free_contract_end_time: new Date(now.getTime() + 2 * 60 * 60 * 1000), // 2小时后
      hashrate: speedInfo.finalSpeedWithCountry, // ✅ 使用公式计算的速度
      mining_status: 'completed' // 待激活状态
    });

    res.json({
      success: true,
      message: '免费广告合约创建成功，请观看广告激活',
      data: {
        contract,
        speedInfo: {
          baseSpeed: speedInfo.baseSpeed,
          baseHashrate: speedInfo.baseHashrateGhs + ' Gh/s',
          levelMultiplier: speedInfo.levelMultiplier,
          dailyBonusMultiplier: speedInfo.dailyBonusMultiplier,
          countryMultiplier: speedInfo.countryMultiplier,
          finalSpeed: speedInfo.finalSpeedWithCountry,
          expectedRevenue2Hours: expectedRevenue,
          formula: '每秒奖励 = 基础奖励 × 国家系数 × 矿工等级速率系数 × 特殊加成系数'
        }
      }
    });

  } catch (err) {
    console.error('创建免费广告合约失败:', err);
    res.status(500).json({
      success: false,
      error: '创建失败',
      details: err.message
    });
  }
};

/**
 * 激活免费广告挖矿合约
 * 用户观看广告完成回调后，激活合约开始挖矿
 * 
 * 请求体:
 * {
 *   user_id: "用户ID",
 *   contract_id: "合约ID"
 * }
 */
exports.activateAdFreeContract = async (req, res) => {
  try {
    const { user_id, contract_id } = req.body;

    if (!user_id || !contract_id) {
      return res.status(400).json({
        success: false,
        message: '用户ID和合约ID不能为空'
      });
    }

    // 1. 查找合约
    const contract = await FreeContractRecord.findOne({
      where: {
        id: contract_id,
        user_id: user_id.trim(),
        free_contract_type: 'ad free contract',
        mining_status: 'completed'
      }
    });

    if (!contract) {
      return res.status(404).json({
        success: false,
        message: '合约不存在或已激活'
      });
    }

    // 2. 重新计算挖矿速度（激活时应用最新的等级/签到/国家系数）
    const LevelService = require('../services/levelService');
    const speedInfo = await LevelService.calculateMiningSpeed(user_id.trim());
    
    const durationSeconds = 2 * 60 * 60;
    const expectedRevenue = speedInfo.finalSpeedWithCountry * durationSeconds;

    console.log(`✅ 激活广告合约，重新计算速度:`, {
      user_id: user_id.trim(),
      finalSpeed: speedInfo.finalSpeedWithCountry,
      expectedRevenue2Hours: expectedRevenue
    });

    // 3. 激活合约
    const now = new Date();
    await contract.update({
      mining_status: 'mining',
      free_contract_creation_time: now,
      free_contract_end_time: new Date(now.getTime() + 2 * 60 * 60 * 1000), // 挖矿2小时
      hashrate: speedInfo.finalSpeedWithCountry // ✅ 更新为当前实际速度
    });

    res.json({
      success: true,
      message: '广告合约已激活，开始挖矿2小时',
      data: {
        contract,
        speedInfo: {
          baseSpeed: speedInfo.baseSpeed,
          levelMultiplier: speedInfo.levelMultiplier,
          dailyBonusMultiplier: speedInfo.dailyBonusMultiplier,
          countryMultiplier: speedInfo.countryMultiplier,
          finalSpeed: speedInfo.finalSpeedWithCountry,
          expectedRevenue2Hours: expectedRevenue
        }
      }
    });

  } catch (err) {
    console.error('激活广告合约失败:', err);
    res.status(500).json({
      success: false,
      error: '激活失败',
      details: err.message
    });
  }
};

/**
 * 邮箱注册
 * 使用邮箱和密码创建新账号
 * 
 * 请求体:
 * {
 *   email: "用户邮箱",
 *   password: "密码",
 *   referrer_invitation_code: "推荐人邀请码(可选)"
 * }
 */
exports.emailRegister = async (req, res) => {
  try {
    const { email, password, referrer_invitation_code } = req.body;

    // 验证必填字段
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: '邮箱和密码是必填字段'
      });
    }

    // 验证邮箱格式
    const emailRegex = /^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        error: '邮箱格式不正确'
      });
    }

    // 验证密码长度
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        error: '密码长度至少为6个字符'
      });
    }

    console.log('📧 [Email Register] 收到注册请求:', email);

    // 检查邮箱是否已存在
    const existingUser = await UserInformation.findOne({
      where: { email: email.toLowerCase() }
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: '该邮箱已被注册'
      });
    }

    // 生成 user_id 和 invitation_code
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

    // 获取真实IP
    const register_ip = 
      req.headers['x-forwarded-for']?.split(',')[0].trim() ||
      req.headers['x-real-ip'] ||
      req.ip ||
      req.connection.remoteAddress ||
      '未知';

    const bcrypt = require('bcrypt');
    const hashedPassword = await bcrypt.hash(password, 10);

    const { user_id, invitation_code } = generateUserIds();

    // 创建新用户
    const newUser = await UserInformation.create({
      user_id,
      invitation_code,
      email: email.toLowerCase(),
      password: hashedPassword,
      register_ip
    });

    console.log('✅ [Email Register] 用户创建成功:', user_id);

    // 处理推荐人邀请码（如果提供）
    let referrerInfo = null;
    if (referrer_invitation_code) {
      try {
        const referrer = await UserInformation.findOne({
          where: { invitation_code: referrer_invitation_code }
        });

        if (referrer) {
          // 创建邀请关系
          await InvitationRelationship.create({
            inviter_user_id: referrer.user_id,
            invitee_user_id: user_id
          });

          console.log(`✅ 邀请关系创建成功: ${referrer.user_id} -> ${user_id}`);

          // 发放推荐人奖励
          try {
            const InvitationRewardService = require('../services/invitationRewardService');
            const rewardResult = await InvitationRewardService.onSuccessfulInvitation(
              referrer.user_id,
              user_id
            );
            console.log('邀请奖励发放成功:', rewardResult);
          } catch (rewardErr) {
            console.error('发放邀请奖励失败:', rewardErr);
          }

          // 创建邀请挖矿合约
          try {
            const InvitationMiningContractService = require('../services/invitationMiningContractService');
            await InvitationMiningContractService.onSuccessfulInvitation(
              referrer.user_id,
              user_id
            );
          } catch (miningErr) {
            console.error('创建邀请挖矿合约失败:', miningErr);
          }

          // 创建被邀请人挖矿合约
          try {
            const RefereeMiningContractService = require('../services/refereeMiningContractService');
            await RefereeMiningContractService.onBindReferrer(
              user_id,
              referrer.user_id
            );
          } catch (bindErr) {
            console.error('创建被邀请人挖矿合约失败:', bindErr);
          }

          referrerInfo = {
            referrer_user_id: referrer.user_id,
            referrer_invitation_code: referrer.invitation_code
          };
        }
      } catch (inviteErr) {
        console.error('处理邀请关系失败:', inviteErr);
      }
    }

    // 创建初始余额记录
    await UserStatus.create({
      user_id,
      bitcoin_balance: '0.000000000000000',
      total_invitation_rebate: '0.000000000000000'
    });

    res.json({
      success: true,
      message: '注册成功',
      data: {
        user_id: newUser.user_id,
        email: newUser.email,
        invitation_code: newUser.invitation_code,
        referrer: referrerInfo
      }
    });

  } catch (err) {
    console.error('邮箱注册失败:', err);
    res.status(500).json({
      success: false,
      error: '注册失败',
      details: err.message
    });
  }
};

/**
 * 邮箱登录
 * 使用邮箱和密码登录
 * 
 * 请求体:
 * {
 *   email: "用户邮箱",
 *   password: "密码"
 * }
 */
exports.emailLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    // 验证必填字段
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: '邮箱和密码是必填字段'
      });
    }

    console.log('📧 [Email Login] 收到登录请求:', email);

    // 查找用户
    const user = await UserInformation.findOne({
      where: { email: email.toLowerCase() }
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        error: '邮箱或密码错误'
      });
    }

    // 检查是否设置了密码
    if (!user.password) {
      return res.status(401).json({
        success: false,
        error: '该账号未设置密码，请使用其他方式登录'
      });
    }

    // 验证密码
    const bcrypt = require('bcrypt');
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        error: '邮箱或密码错误'
      });
    }

    console.log('✅ [Email Login] 登录成功:', user.user_id);

    // 更新最后登录时间
    await UserStatus.update(
      { last_login_time: new Date() },
      { where: { user_id: user.user_id } }
    );

    res.json({
      success: true,
      message: '登录成功',
      data: {
        user_id: user.user_id,
        email: user.email,
        invitation_code: user.invitation_code,
        google_account: user.google_account
      }
    });

  } catch (err) {
    console.error('邮箱登录失败:', err);
    res.status(500).json({
      success: false,
      error: '登录失败',
      details: err.message
    });
  }
};

module.exports = exports;
