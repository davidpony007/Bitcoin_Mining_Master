// 用户相关业务逻辑控制器
// 包含获取用户列表和创建用户的接口

// 引入用户信息的 Sequelize 模型，用于操作 user_information 表
const UserInformation = require('../models/userInformation');
const InvitationRelationship = require('../models/invitationRelationship');
const InvitationValidationService = require('../services/invitationValidationService');


// 获取所有用户信息的接口
// 处理 GET 请求，返回所有用户数据
exports.getAllUsers = async (req, res) => {
  try {
    // 查询 user_information 表，获取所有用户记录（包含所有字段）
    const users = await UserInformation.findAll();
    // 将查询结果以 JSON 格式返回给前端
    res.json(users);
  } catch (err) {
    // 查询失败时返回 500 错误及详细信息
    res.status(500).json({ error: '获取用户列表失败', details: err.message });
  }
};


// 创建新用户的接口
// 处理 POST 请求，向数据库插入新用户数据，只使用表中实际存在的字段
exports.createUser = async (req, res) => {
  try {
    // 从请求体中解构出 user_information 表实际存在的字段
    let {
      user_id,
      invitation_code,
      email,
      google_account,
      android_id,
      gaid,
      country,
      referrer_invitation_code  // 推荐人的邀请码(可选)
    } = req.body;

    // user_id 和 invitation_code 自动生成（保持一致）
    // 如果客户端没有提供 user_id，则自动生成
    // 格式: U + 年月日时分秒(14位) + 5位随机数 = 总共20位
    // 示例: U20251204233218123456
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hour = String(now.getHours()).padStart(2, '0');
    const minute = String(now.getMinutes()).padStart(2, '0');
    const second = String(now.getSeconds()).padStart(2, '0');
    const random = String(Math.floor(Math.random() * 100000)).padStart(5, '0'); // 5位随机数(00000-99999)
    
    const timeString = `${year}${month}${day}${hour}${minute}${second}${random}`;
    
    // 如果客户端没有提供 user_id，自动生成
    if (!user_id || user_id.trim() === '') {
      user_id = `U${timeString}`;
    }

    // 自动获取真实IP地址（支持代理和负载均衡）
    // 优先级：X-Forwarded-For > X-Real-IP > req.ip
    const register_ip = 
      req.headers['x-forwarded-for']?.split(',')[0].trim() ||  // Nginx代理
      req.headers['x-real-ip'] ||                               // 其他代理
      req.ip ||                                                  // Express直接获取
      req.connection.remoteAddress ||                           // 备用方案
      '未知';

    // 自动生成邀请码（如果客户端没有提供）
    // 格式与 user_id 保持一致: INV + 年月日时分秒(14位) + 5位随机数 = 总共22位
    // 示例: INV2025120423321812345
    // 注意：使用与 user_id 相同的时间戳和随机数
    let finalInvitationCode = invitation_code;
    if (!finalInvitationCode || finalInvitationCode.trim() === '') {
      finalInvitationCode = `INV${timeString}`;
    }

    // 只插入 user_information 表中实际定义的字段
    // user_creation_time 会自动设置为当前时间（模型中已配置 defaultValue）
    // register_ip 由后端自动获取，客户端不应该传递
    // invitation_code 由后端自动生成唯一邀请码
    const newUser = await UserInformation.create({
      user_id,
      invitation_code: finalInvitationCode,      // 使用自动生成的邀请码
      email,
      google_account,                             // Google账号(可选)
      android_id: android_id || '',              // Android设备ID为空时使用空字符串
      gaid,
      register_ip,                                // 自动获取的真实IP
      country
    });

    // 如果填写了推荐人邀请码,建立邀请关系
    let referrerInfo = null;
    if (referrer_invitation_code && referrer_invitation_code.trim() !== '') {
      try {
        // ✅ 验证邀请关系合法性
        const validation = await InvitationValidationService.validateInvitationRelationship(
          newUser.user_id,
          referrer_invitation_code.trim()
        );

        if (!validation.valid) {
          console.warn(`❌ 邀请关系验证失败: ${validation.error}`, {
            userId: newUser.user_id,
            referrerCode: referrer_invitation_code.trim(),
            errorCode: validation.errorCode
          });
          
          referrerInfo = {
            error: validation.error,
            errorCode: validation.errorCode,
            rejected: true
          };
        } else {
          // 验证通过，创建邀请关系
          const referrer = validation.referrer;
          
          await InvitationRelationship.create({
            user_id: newUser.user_id,
            invitation_code: newUser.invitation_code,
            referrer_user_id: referrer.user_id,
            referrer_invitation_code: referrer.invitation_code
          });
          
          referrerInfo = {
            referrer_user_id: referrer.user_id,
            referrer_invitation_code: referrer.invitation_code
          };
        }
      } catch (inviteErr) {
        console.error('❌ 创建邀请关系失败:', inviteErr);
        // 邀请关系创建失败不影响用户注册
      }
    }

    // 插入成功后返回新用户数据，状态码 201
    res.status(201).json({
      success: true,
      message: '用户创建成功',
      data: newUser,
      referrer: referrerInfo  // 返回推荐人信息(如果有)
    });
  } catch (err) {
    // 插入失败时返回 500 错误及详细信息
    console.error('创建用户失败:', err);
    res.status(500).json({ 
      error: '创建用户失败', 
      details: err.message 
    });
  }
};

// 更新用户昵称的接口
// 处理 PUT 请求，更新用户昵称到 user_information 表
exports.updateNickname = async (req, res) => {
  try {
    const { user_id } = req.params;
    const { nickname } = req.body;

    // 验证参数
    if (!nickname || nickname.trim() === '') {
      return res.status(400).json({
        success: false,
        message: '昵称不能为空'
      });
    }

    // 验证昵称长度
    const trimmedNickname = nickname.trim();
    if (trimmedNickname.length > 50) {
      return res.status(400).json({
        success: false,
        message: '昵称长度不能超过50个字符'
      });
    }

    // 查找用户
    const user = await UserInformation.findOne({
      where: { user_id }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: '用户不存在'
      });
    }

    // 更新昵称
    await UserInformation.update(
      { nickname: trimmedNickname },
      { where: { user_id } }
    );

    res.json({
      success: true,
      message: '昵称更新成功',
      data: {
        user_id,
        nickname: trimmedNickname
      }
    });

  } catch (err) {
    console.error('更新昵称失败:', err);
    res.status(500).json({
      success: false,
      message: '更新昵称失败',
      error: err.message
    });
  }
};
