// 用户状态定时任务
// 定期更新用户的活跃状态

const cron = require('node-cron');
const { UserStatus } = require('../models');
const { Op } = require('sequelize');

/**
 * 更新所有用户的活跃状态
 * 根据最后登录时间自动更新用户状态
 */
async function updateAllUserStatus() {
  try {
    console.log('[定时任务] 开始更新用户活跃状态...');
    
    const now = new Date();
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // 更新为 "active within 3 days" - 3天内登录的用户
    const activeCount = await UserStatus.update(
      { user_status: 'active within 3 days' },
      {
        where: {
          last_login_time: {
            [Op.gte]: threeDaysAgo
          },
          user_status: { 
            [Op.notIn]: ['disabled', 'deleted'] // 排除已禁用/删除的用户
          }
        }
      }
    );

    // 更新为 "no login within 7 days" - 7天内未登录的用户
    const sevenDaysCount = await UserStatus.update(
      { user_status: 'no login within 7 days' },
      {
        where: {
          last_login_time: {
            [Op.lt]: sevenDaysAgo
          },
          user_status: { 
            [Op.notIn]: ['disabled', 'deleted'] // 排除已禁用/删除的用户
          }
        }
      }
    );

    console.log('[定时任务] 用户状态更新完成');
    console.log(`  - 活跃用户(3天内): ${activeCount[0]} 人`);
    console.log(`  - 不活跃用户(7天+): ${sevenDaysCount[0]} 人`);
  } catch (error) {
    console.error('[定时任务] 更新用户状态失败:', error);
  }
}

/**
 * 启动定时任务调度器
 */
function startUserStatusScheduler() {
  // 每天凌晨 2 点执行一次
  cron.schedule('0 2 * * *', () => {
    console.log('[定时任务] 触发用户状态更新任务');
    updateAllUserStatus();
  });

  console.log('[定时任务] 用户状态调度器已启动 - 每天凌晨 2:00 执行');
  
  // 立即执行一次（可选）
  // updateAllUserStatus();
}

module.exports = {
  startUserStatusScheduler,
  updateAllUserStatus
};
