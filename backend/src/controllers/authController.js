// 身份验证控制器
// 处理用户登录、设备绑定、Google账号管理

const UserInformation = require('../models/userInformation');
const InvitationRelationship = require('../models/invitationRelationship');
const UserStatus = require('../models/userStatus');
const FreeContractRecord = require('../models/freeContractRecord');
const InvitationRewardService = require('../services/invitationRewardService');

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

    // 1. 查找是否已存在该设备的用户
    let user = await UserInformation.findOne({
      where: { android_id: android_id.trim() }
    });

    let isNewUser = false;
    let referrerInfo = null;

    // 2. 如果用户不存在，自动创建新用户
    if (!user) {
      isNewUser = true;

      // 生成唯一的 user_id 和 invitation_code
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const hour = String(now.getHours()).padStart(2, '0');
      const minute = String(now.getMinutes()).padStart(2, '0');
      const second = String(now.getSeconds()).padStart(2, '0');
      const random = String(Math.floor(Math.random() * 100000)).padStart(5, '0');
      
      const timeString = `${year}${month}${day}${hour}${minute}${second}${random}`;
      const user_id = `U${timeString}`;
      const invitation_code = `INV${timeString}`;

      // 获取真实IP
      const register_ip = 
        req.headers['x-forwarded-for']?.split(',')[0].trim() ||
        req.headers['x-real-ip'] ||
        req.ip ||
        req.connection.remoteAddress ||
        '未知';

      // 创建新用户
      user = await UserInformation.create({
        user_id,
        invitation_code,
        email: email || null,
        google_account: null,
        android_id: android_id.trim(),
        gaid: gaid || null,
        register_ip,
        country: country || null
      });

      // 2.1 自动创建用户状态记录
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
        console.log(`用户状态初始化成功: ${user.user_id}`);
      } catch (statusErr) {
        console.error('创建用户状态失败:', statusErr);
        // 状态创建失败不影响用户注册
      }

      // 3. 如果填写了推荐人邀请码，建立邀请关系
      if (referrer_invitation_code && referrer_invitation_code.trim() !== '') {
        try {
          const referrer = await UserInformation.findOne({
            where: { invitation_code: referrer_invitation_code.trim() }
          });

          if (referrer) {
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

    // 4. 返回用户信息
    res.json({
      success: true,
      isNewUser,
      message: isNewUser ? '账号创建成功' : '登录成功',
      data: user,
      referrer: referrerInfo
    });

  } catch (err) {
    console.error('设备登录失败:', err);
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

    // 检查该Google账号是否已被其他用户绑定
    const existingUser = await UserInformation.findOne({
      where: { google_account: google_account.trim() }
    });

    if (existingUser && existingUser.user_id !== user_id.trim()) {
      return res.status(400).json({
        success: false,
        error: '该Google账号已被其他用户绑定'
      });
    }

    // 更新Google账号
    await user.update({
      google_account: google_account.trim()
    });

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
 * 
 * 请求体:
 * {
 *   user_id: "用户ID"
 * }
 * 
 * 响应:
 * {
 *   success: true,
 *   message: "Google账号解绑成功"
 * }
 */
exports.unbindGoogleAccount = async (req, res) => {
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

    res.json({
      success: true,
      data: userStatus
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

    // 7. 🎁 处理邀请奖励
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

    res.json({
      success: true,
      message: '推荐人绑定成功',
      data: {
        referrer_user_id: referrer.user_id,
        referrer_invitation_code: referrer.invitation_code,
        rewards: rewardResult
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

    // 3. 创建免费广告合约（未激活状态）
    const now = new Date();
    const contract = await FreeContractRecord.create({
      user_id: user_id.trim(),
      free_contract_type: 'ad free contract',
      free_contract_revenue: 0,
      free_contract_creation_time: now,
      free_contract_end_time: new Date(now.getTime() + 2 * 60 * 60 * 1000), // 2小时后
      hashrate: 0.00000001, // 示例算力
      mining_status: 'completed' // 待激活状态
    });

    res.json({
      success: true,
      message: '免费广告合约创建成功，请观看广告激活',
      data: contract
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

    // 2. 激活合约
    const now = new Date();
    await contract.update({
      mining_status: 'mining',
      free_contract_creation_time: now,
      free_contract_end_time: new Date(now.getTime() + 2 * 60 * 60 * 1000) // 挖矿2小时
    });

    res.json({
      success: true,
      message: '广告合约已激活，开始挖矿2小时',
      data: contract
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

module.exports = exports;
