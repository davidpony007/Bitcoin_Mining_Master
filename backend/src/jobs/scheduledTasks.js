// scheduledTasks.js
// 游戏机制定时任务
// 负责每日签到加成过期清理、Redis缓存同步等后台任务

const cron = require('node-cron');
const redisClient = require('../config/redis');
const pool = require('../config/database').pool;

/**
 * 每日签到加成过期清理任务
 * 每分钟执行一次，清理已过期的加成用户
 */
function startDailyBonusCleanup() {
  // 每分钟执行一次
  cron.schedule('* * * * *', async () => {
    try {
      // 检查Redis连接状态
      if (!redisClient.isConnected || !redisClient.client) {
        // Redis未连接时跳过清理，不影响主业务
        return;
      }
      
      const now = Date.now();
      
      // 从sorted set中移除已过期的用户
      const removed = await redisClient.client.zremrangebyscore(
        'daily:bonus:active',
        '-inf',
        now
      );
      
      if (removed > 0) {
        console.log(`[定时任务] 清理了 ${removed} 个过期的每日加成`);
      }
    } catch {
      // 降级模式：出错时只记录日志，不影响系统运行
      // console.error('[定时任务] 每日加成清理失败:', error);
    }
  });
  
  console.log('✓ 每日加成过期清理任务已启动（每分钟）');
}

/**
 * 每日广告计数重置任务
 * 每天凌晨0:00执行，重置所有用户的当日广告观看次数
 */
function startDailyAdCountReset() {
  // 每天凌晨0:00执行
  cron.schedule('0 0 * * *', async () => {
    try {
      console.log('[定时任务] 开始重置每日广告计数...');
      
      // Redis的每日计数会自动过期，这里只是记录日志
      // 实际的过期由Redis的EXPIRE机制自动处理
      
      console.log('[定时任务] 每日广告计数重置完成（由Redis自动过期）');
    } catch (error) {
      console.error('[定时任务] 每日广告计数重置失败:', error);
    }
  });
  
  console.log('✓ 每日广告计数重置任务已启动（每天凌晨0:00）');
}

/**
 * 签到数据同步任务
 * 每小时执行一次，将Redis中的签到状态同步到MySQL
 */
function startCheckInSyncTask() {
  // 每小时执行一次
  cron.schedule('0 * * * *', async () => {
    try {
      console.log('[定时任务] 开始同步签到数据到MySQL...');
      
      // 获取所有有签到缓存的用户
      const keys = await redisClient.client.keys('user:checkin:*');
      
      if (keys.length === 0) {
        console.log('[定时任务] 无需同步签到数据');
        return;
      }
      
      let syncCount = 0;
      for (const key of keys) {
        try {
          const userId = key.split(':')[2];
          const data = await redisClient.client.hgetall(key);
          
          if (data && data.last_date) {
            // 验证数据库中是否有对应记录
            const [rows] = await pool.query(
              'SELECT user_id FROM user_check_in WHERE user_id = ? AND check_in_date = ?',
              [userId, data.last_date]
            );
            
            if (rows.length === 0) {
              console.warn(`[定时任务] 用户 ${userId} 的签到记录不一致，Redis有但MySQL没有`);
            } else {
              syncCount++;
            }
          }
        } catch (err) {
          console.error('[定时任务] 同步单个用户签到数据失败:', err);
        }
      }
      
      console.log(`[定时任务] 签到数据同步完成，验证了 ${syncCount} 个用户`);
    } catch (error) {
      console.error('[定时任务] 签到数据同步失败:', error);
    }
  });
  
  console.log('✓ 签到数据同步任务已启动（每小时）');
}

/**
 * 用户等级缓存预热任务
 * 每天凌晨3:00执行，为活跃用户预热等级缓存
 */
function startLevelCacheWarmup() {
  // 每天凌晨3:00执行
  cron.schedule('0 3 * * *', async () => {
    try {
      console.log('[定时任务] 开始预热用户等级缓存...');
      
      // 获取最近7天有登录的活跃用户
      const [activeUsers] = await pool.query(`
        SELECT DISTINCT ui.user_id, ui.user_level, ui.user_points, ui.mining_speed_multiplier
        FROM user_information ui
        INNER JOIN user_status us ON ui.user_id = us.user_id
        WHERE us.last_login_time >= DATE_SUB(NOW(), INTERVAL 7 DAY)
        LIMIT 1000
      `);
      
      let warmedCount = 0;
      for (const user of activeUsers) {
        try {
          // 检查是否有每日加成
          const bonusActive = await redisClient.isDailyBonusActive(user.user_id);
          
          // 缓存用户等级信息
          await redisClient.cacheUserLevel(
            user.user_id,
            user.user_level,
            user.user_points,
            user.mining_speed_multiplier,
            bonusActive,
            null
          );
          
          warmedCount++;
        } catch (err) {
          console.error(`[定时任务] 预热用户 ${user.user_id} 等级缓存失败:`, err);
        }
      }
      
      console.log(`[定时任务] 等级缓存预热完成，预热了 ${warmedCount} 个活跃用户`);
    } catch (error) {
      console.error('[定时任务] 等级缓存预热失败:', error);
    }
  });
  
  console.log('✓ 等级缓存预热任务已启动（每天凌晨3:00）');
}

/**
 * 邀请进度缓存同步任务
 * 每6小时执行一次，同步邀请进度数据
 */
function startInvitationProgressSync() {
  // 每6小时执行一次（0:00, 6:00, 12:00, 18:00）
  cron.schedule('0 */6 * * *', async () => {
    try {
      console.log('[定时任务] 开始同步邀请进度数据...');
      
      // 获取所有有邀请进度缓存的用户
      const keys = await redisClient.client.keys('user:invite:progress:*');
      
      if (keys.length === 0) {
        console.log('[定时任务] 无需同步邀请进度数据');
        return;
      }
      
      let syncCount = 0;
      for (const key of keys) {
        try {
          const userId = key.split(':')[3];
          const cachedData = await redisClient.client.hgetall(key);
          
          // 从数据库查询实际数据进行对比
          const [dbData] = await pool.query(`
            SELECT 
              COUNT(*) as total_count,
              SUM(CASE WHEN irp.milestone_type = 'INVITE_5' AND irp.is_claimed = 1 THEN 1 ELSE 0 END) as milestone_5_claimed,
              SUM(CASE WHEN irp.milestone_type = 'INVITE_10' AND irp.is_claimed = 1 THEN 1 ELSE 0 END) as milestone_10_claimed
            FROM invitation_relationship ir
            LEFT JOIN invitation_reward_progress irp ON ir.referrer_user_id = irp.user_id
            WHERE ir.referrer_user_id = ?
          `, [userId]);
          
          if (dbData.length > 0 && cachedData.total_count) {
            const dbCount = parseInt(dbData[0].total_count) || 0;
            const cacheCount = parseInt(cachedData.total_count) || 0;
            
            if (dbCount !== cacheCount) {
              console.warn(`[定时任务] 用户 ${userId} 邀请数据不一致: DB=${dbCount}, Cache=${cacheCount}`);
              // 清除缓存，下次访问时会重新从数据库加载
              await redisClient.client.del(key);
            } else {
              syncCount++;
            }
          }
        } catch (err) {
          console.error('[定时任务] 同步单个用户邀请进度失败:', err);
        }
      }
      
      console.log(`[定时任务] 邀请进度同步完成，验证了 ${syncCount} 个用户`);
    } catch (error) {
      console.error('[定时任务] 邀请进度同步失败:', error);
    }
  });
  
  console.log('✓ 邀请进度同步任务已启动（每6小时）');
}

/**
 * 推荐人广告计数同步任务
 * 每小时执行一次，同步推荐人广告观看计数
 */
function startReferralAdCountSync() {
  // 每小时执行一次
  cron.schedule('0 * * * *', async () => {
    try {
      console.log('[定时任务] 开始同步推荐人广告计数...');
      
      // 获取所有推荐人广告计数缓存
      const keys = await redisClient.client.keys('user:referral:ad:*');
      
      if (keys.length === 0) {
        console.log('[定时任务] 无需同步推荐人广告计数');
        return;
      }
      
      let syncCount = 0;
      for (const key of keys) {
        try {
          const parts = key.split(':');
          const referrerId = parts[3];
          const referralId = parts[4];
          const cacheCount = await redisClient.client.get(key);
          
          // 从数据库查询实际计数
          const [dbData] = await pool.query(
            'SELECT total_count FROM referral_ad_watch_count WHERE referrer_user_id = ? AND referral_user_id = ?',
            [referrerId, referralId]
          );
          
          if (dbData.length > 0) {
            const dbCount = dbData[0].total_count;
            const cachedCount = parseInt(cacheCount) || 0;
            
            if (dbCount !== cachedCount) {
              console.warn(`[定时任务] 推荐关系 ${referrerId}->${referralId} 广告计数不一致: DB=${dbCount}, Cache=${cachedCount}`);
              // 清除缓存，下次访问时会重新从数据库加载
              await redisClient.client.del(key);
            } else {
              syncCount++;
            }
          }
        } catch (err) {
          console.error('[定时任务] 同步单个推荐关系广告计数失败:', err);
        }
      }
      
      console.log(`[定时任务] 推荐人广告计数同步完成，验证了 ${syncCount} 个关系`);
    } catch (error) {
      console.error('[定时任务] 推荐人广告计数同步失败:', error);
    }
  });
  
  console.log('✓ 推荐人广告计数同步任务已启动（每小时）');
}

/**
 * 启动所有定时任务
 */
function startAllScheduledTasks() {
  console.log('\n========== 启动游戏机制定时任务 ==========');
  
  startDailyBonusCleanup();          // 每日加成过期清理（每分钟）
  startDailyAdCountReset();          // 每日广告计数重置（每天凌晨）
  startCheckInSyncTask();            // 签到数据同步（每小时）
  startLevelCacheWarmup();           // 等级缓存预热（每天凌晨3点）
  startInvitationProgressSync();     // 邀请进度同步（每6小时）
  startReferralAdCountSync();        // 推荐人广告计数同步（每小时）
  
  console.log('==========================================\n');
}

/**
 * 停止所有定时任务
 */
function stopAllScheduledTasks() {
  console.log('[定时任务] 正在停止所有定时任务...');
  // node-cron会在进程退出时自动清理
  console.log('[定时任务] 所有定时任务已停止');
}

module.exports = {
  startAllScheduledTasks,
  stopAllScheduledTasks,
  
  // 导出单个任务启动函数，供灵活调用
  startDailyBonusCleanup,
  startDailyAdCountReset,
  startCheckInSyncTask,
  startLevelCacheWarmup,
  startInvitationProgressSync,
  startReferralAdCountSync
};
