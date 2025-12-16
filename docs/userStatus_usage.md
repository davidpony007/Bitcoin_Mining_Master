# UserStatus 模块使用示例

## 1. 用户注册时创建状态记录

```javascript
// 在 authController.js 或 userController.js 的注册逻辑中
const { UserInformation } = require('../models');
const { UserStatus } = require('../models');

async function registerUser(req, res) {
  try {
    const { user_id, email, invitation_code } = req.body;
    
    // 1. 创建用户信息
    const userInfo = await UserInformation.create({
      user_id,
      email,
      invitation_code,
      register_ip: req.ip,
      country: req.body.country || 'Unknown'
    });
    
    // 2. 创建用户状态记录
    await UserStatus.create({
      user_id,
      bitcoin_accumulated_amount: 0,
      current_bitcoin_balance: 0,
      total_invitation_rebate: 0,
      total_withdrawal_amount: 0,
      last_login_time: new Date(),
      user_status: 'active within 3 days'
    });
    
    res.json({
      success: true,
      message: '注册成功',
      data: { user_id }
    });
  } catch (error) {
    console.error('注册失败:', error);
    res.status(500).json({ success: false, message: '注册失败' });
  }
}
```

---

## 2. 用户登录时更新状态

```javascript
// 在 authController.js 的登录逻辑中
const { UserStatus } = require('../models');

async function loginUser(req, res) {
  try {
    const { user_id } = req.body;
    
    // 验证登录...
    
    // 更新最后登录时间
    await UserStatus.update(
      {
        last_login_time: new Date(),
        user_status: 'active within 3 days'
      },
      { where: { user_id } }
    );
    
    res.json({
      success: true,
      message: '登录成功',
      token: 'JWT_TOKEN_HERE'
    });
  } catch (error) {
    console.error('登录失败:', error);
    res.status(500).json({ success: false, message: '登录失败' });
  }
}
```

---

## 3. 挖矿奖励时更新余额

```javascript
// 在 miningController.js 中
const { UserStatus } = require('../models');

async function distributeMiningReward(user_id, amount) {
  try {
    const userStatus = await UserStatus.findOne({ where: { user_id } });
    
    if (!userStatus) {
      throw new Error('用户状态不存在');
    }
    
    // 增加累计挖矿金额和当前余额
    userStatus.bitcoin_accumulated_amount = 
      parseFloat(userStatus.bitcoin_accumulated_amount) + amount;
    userStatus.current_bitcoin_balance = 
      parseFloat(userStatus.current_bitcoin_balance) + amount;
    
    await userStatus.save();
    
    console.log(`用户 ${user_id} 获得挖矿奖励: ${amount} BTC`);
  } catch (error) {
    console.error('发放挖矿奖励失败:', error);
  }
}
```

---

## 4. 提现时扣除余额

```javascript
// 在 withdrawalController.js 中
const { UserStatus } = require('../models');

async function processWithdrawal(req, res) {
  try {
    const { user_id, amount } = req.body;
    
    const userStatus = await UserStatus.findOne({ where: { user_id } });
    
    if (!userStatus) {
      return res.status(404).json({
        success: false,
        message: '用户状态不存在'
      });
    }
    
    const currentBalance = parseFloat(userStatus.current_bitcoin_balance);
    
    // 检查余额
    if (currentBalance < amount) {
      return res.status(400).json({
        success: false,
        message: '余额不足'
      });
    }
    
    // 扣除余额并增加提现总额
    userStatus.current_bitcoin_balance = currentBalance - amount;
    userStatus.total_withdrawal_amount = 
      parseFloat(userStatus.total_withdrawal_amount) + amount;
    
    await userStatus.save();
    
    // 创建提现记录...
    
    res.json({
      success: true,
      message: '提现申请成功',
      data: {
        remaining_balance: userStatus.current_bitcoin_balance
      }
    });
  } catch (error) {
    console.error('提现失败:', error);
    res.status(500).json({ success: false, message: '提现失败' });
  }
}
```

---

## 5. 邀请返利时更新

```javascript
// 在 invitationController.js 中
const { UserStatus } = require('../models');

async function giveInvitationRebate(inviter_user_id, rebate_amount) {
  try {
    const userStatus = await UserStatus.findOne({ 
      where: { user_id: inviter_user_id } 
    });
    
    if (!userStatus) {
      console.error('邀请人状态不存在');
      return;
    }
    
    // 增加邀请返利总额和当前余额
    userStatus.total_invitation_rebate = 
      parseFloat(userStatus.total_invitation_rebate) + rebate_amount;
    userStatus.current_bitcoin_balance = 
      parseFloat(userStatus.current_bitcoin_balance) + rebate_amount;
    
    await userStatus.save();
    
    console.log(`用户 ${inviter_user_id} 获得邀请返利: ${rebate_amount} BTC`);
  } catch (error) {
    console.error('发放邀请返利失败:', error);
  }
}
```

---

## 6. 查询用户完整信息（包含状态）

```javascript
// 使用关联查询
const { UserInformation } = require('../models');

async function getUserCompleteInfo(user_id) {
  try {
    const userInfo = await UserInformation.findOne({
      where: { user_id },
      include: [{
        association: 'status',
        required: false
      }]
    });
    
    return userInfo;
  } catch (error) {
    console.error('查询用户信息失败:', error);
  }
}

// 使用示例
const completeInfo = await getUserCompleteInfo('USER123456');
console.log('用户信息:', completeInfo.toJSON());
console.log('用户余额:', completeInfo.status.current_bitcoin_balance);
console.log('活跃状态:', completeInfo.status.user_status);
```

---

## 7. 在定时任务中使用

```javascript
// 在 scheduler 或 worker 中
const { updateAllUserStatus } = require('../utils/userStatusScheduler');

// 手动触发更新（测试用）
updateAllUserStatus();

// 或通过 API 调用
const response = await fetch('http://localhost:8888/api/userStatus/update-active-status', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_TOKEN',
    'Content-Type': 'application/json'
  }
});
```

---

## 8. 在 PM2 Ecosystem 中配置定时任务

```javascript
// ecosystem.config.js
module.exports = {
  apps: [
    {
      name: 'bmm-scheduler',
      script: './src/utils/userStatusScheduler.js',
      instances: 1,
      cron_restart: '0 2 * * *', // 每天凌晨2点重启并执行
      autorestart: false
    }
  ]
};
```

---

## 完整集成示例

```javascript
// 完整的用户流程示例
async function completeUserFlow() {
  const user_id = 'USER' + Date.now();
  
  // 1. 注册
  await UserInformation.create({ user_id, email: 'test@example.com' });
  await UserStatus.create({ user_id });
  
  // 2. 登录
  await UserStatus.update(
    { last_login_time: new Date() },
    { where: { user_id } }
  );
  
  // 3. 挖矿获得奖励
  const userStatus = await UserStatus.findOne({ where: { user_id } });
  userStatus.bitcoin_accumulated_amount = 
    parseFloat(userStatus.bitcoin_accumulated_amount) + 0.00001;
  userStatus.current_bitcoin_balance = 
    parseFloat(userStatus.current_bitcoin_balance) + 0.00001;
  await userStatus.save();
  
  // 4. 提现
  userStatus.current_bitcoin_balance = 
    parseFloat(userStatus.current_bitcoin_balance) - 0.000005;
  userStatus.total_withdrawal_amount = 
    parseFloat(userStatus.total_withdrawal_amount) + 0.000005;
  await userStatus.save();
  
  // 5. 查询统计
  const stats = await UserStatus.findOne({ where: { user_id } });
  console.log('用户统计:', stats.toJSON());
}
```
