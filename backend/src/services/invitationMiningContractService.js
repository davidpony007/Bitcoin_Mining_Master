/**
 * 邀请好友挖矿合约服务
 * 负责邀请好友挖矿合约的创建和时间延长
 * 特点：每成功邀请一个好友，增加2小时挖矿时间
 */

const FreeContractRecord = require('../models/freeContractRecord');
const UserInformation = require('../models/userInformation');
const LevelService = require('./levelService');
const pool = require('../config/database_native');

class InvitationMiningContractService {
  /**
   * 每次邀请增加的挖矿时长（2小时）
   */
  static INVITATION_MINING_DURATION = 2 * 60 * 60 * 1000; // 2小时（毫秒）

  /**
   * 成功邀请好友后创建或延长挖矿合约
   * 业务逻辑：
   * 1. 如果推荐人没有活跃的邀请挖矿合约，创建新合约（2小时）
   * 2. 如果推荐人已有活跃合约，延长2小时
   * 3. 每成功邀请一人，增加2小时挖矿时间
   * 
   * @param {string} referrerId - 推荐人ID
   * @param {string} refereeId - 被邀请人ID
   */
  static async onSuccessfulInvitation(referrerId, refereeId) {
    try {
      // 1. 验证推荐人存在
      const referrer = await UserInformation.findOne({
        where: { user_id: referrerId }
      });

      if (!referrer) {
        return {
          success: false,
          message: '推荐人不存在'
        };
      }

      // 2. 查找推荐人当前的邀请挖矿合约
      const existingContract = await FreeContractRecord.findOne({
        where: {
          user_id: referrerId,
          free_contract_type: 'Invite Friend Reward',
          mining_status: 'mining' // 正在挖矿中
        },
        order: [['free_contract_creation_time', 'DESC']]
      });

      // 3. 计算挖矿速度（基础奖励 × 国家系数 × 矿工等级速率系数，不含签到加成）
      const speedInfo = await LevelService.calculateMiningSpeed(referrerId);
      
      // 计算实际BTC/s算力：基础0.000000000000139 BTC/s × 等级系数 × 国家系数
      const actualHashrate = speedInfo.finalSpeedWithoutBonus;
      
      // 计算Gh/s显示值（仅用于日志显示）
      const displayHashrateGhs = speedInfo.baseHashrateGhs * speedInfo.levelMultiplier * speedInfo.countryMultiplier;

      const now = new Date();
      let contract;
      let isNewContract = false;

      if (existingContract) {
        // 延长现有合约
        const currentEndTime = new Date(existingContract.free_contract_end_time);
        const newEndTime = new Date(currentEndTime.getTime() + this.INVITATION_MINING_DURATION);

        await existingContract.update({
          free_contract_end_time: newEndTime,
          hashrate: actualHashrate // 使用实际BTC/s算力
        });

        contract = existingContract;

        console.log(`✅ 延长邀请挖矿合约: 推荐人 ${referrerId}, 从 ${currentEndTime} 延长到 ${newEndTime}`);
      } else {
        // 创建新合约
        const endTime = new Date(now.getTime() + this.INVITATION_MINING_DURATION);

        contract = await FreeContractRecord.create({
          user_id: referrerId,
          free_contract_type: 'Invite Friend Reward',
          free_contract_revenue: 0,
          free_contract_creation_time: now,
          free_contract_end_time: endTime,
          hashrate: actualHashrate, // 使用实际BTC/s算力
          mining_status: 'mining'
        });

        isNewContract = true;

        console.log(`✅ 创建邀请挖矿合约: 推荐人 ${referrerId}, 结束时间 ${endTime}`);
      }

      // 4. 获取推荐人的总邀请人数
      const connection = await pool.getConnection();
      try {
        const [invitationStats] = await connection.query(
          'SELECT COUNT(*) as total FROM invitation_relationship WHERE referrer_user_id = ?',
          [referrerId]
        );
        
        const totalInvitations = invitationStats[0]?.total || 0;
        
        return {
          success: true,
          message: isNewContract ? '邀请成功，开始挖矿2小时' : '邀请成功，挖矿时间延长2小时',
          contract: {
            id: contract.id,
            type: 'Invite Friend Reward',
            startTime: contract.free_contract_creation_time,
            endTime: contract.free_contract_end_time,
            hashrate: contract.hashrate,
            miningStatus: contract.mining_status
          },
          speedInfo: {
            baseSpeed: speedInfo.baseSpeed,
            baseHashrateDisplay: speedInfo.baseHashrateGhs + ' Gh/s',
            actualHashrate: actualHashrate, // 实际BTC/s算力
            displayHashrate: displayHashrateGhs + ' Gh/s', // 前端显示值
            levelMultiplier: speedInfo.levelMultiplier,
            dailyBonusMultiplier: speedInfo.dailyBonusMultiplier,
            countryMultiplier: speedInfo.countryMultiplier
          },
          invitationStats: {
            totalInvitations,
            newInvitee: refereeId
          },
          isNewContract
        };
      } finally {
        connection.release();
      }

    } catch (err) {
      console.error('❌ 处理邀请挖矿合约失败:', err);
      throw err;
    }
  }

  /**
   * 获取用户当前的邀请挖矿合约状态
   */
  static async getContractStatus(userId) {
    try {
      const contract = await FreeContractRecord.findOne({
        where: {
          user_id: userId,
          free_contract_type: 'Invite Friend Reward',
          mining_status: 'mining'
        },
        order: [['free_contract_creation_time', 'DESC']]
      });

      if (!contract) {
        return {
          hasActiveContract: false,
          message: '暂无活跃的邀请挖矿合约'
        };
      }

      const now = new Date();
      const endTime = new Date(contract.free_contract_end_time);
      const remainingSeconds = Math.max(0, Math.floor((endTime - now) / 1000));

      // 获取总邀请人数
      const [invitationStats] = await db.query(
        'SELECT COUNT(*) as total FROM invitation_relationship WHERE referrer_user_id = ?',
        [userId]
      );

      const totalInvitations = invitationStats[0]?.total || 0;

      return {
        hasActiveContract: true,
        contract: {
          id: contract.id,
          type: 'Invite Friend Reward',
          startTime: contract.free_contract_creation_time,
          endTime: contract.free_contract_end_time,
          hashrate: contract.hashrate,
          remainingSeconds,
          remainingFormatted: this.formatDuration(remainingSeconds)
        },
        invitationStats: {
          totalInvitations
        }
      };

    } catch (err) {
      console.error('❌ 获取邀请挖矿合约状态失败:', err);
      throw err;
    }
  }

  /**
   * 格式化时长显示
   */
  static formatDuration(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours}小时${minutes}分${secs}秒`;
  }
}

module.exports = InvitationMiningContractService;
