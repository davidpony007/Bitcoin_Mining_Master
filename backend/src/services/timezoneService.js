/**
 * 时区管理服务
 * 负责管理用户本地时区,用于:
 * - 签到判断 (是否进入新的一天)
 * - 广告次数重置
 * - 活动时间判断
 */

const UserInformation = require('../models/userInformation');

class TimezoneService {
  /**
   * 设置用户时区
   * 
   * @param {string} userId - 用户ID
   * @param {string} timezone - 时区字符串 (如: Asia/Shanghai, America/New_York)
   * @returns {boolean} 是否成功
   */
  static async setTimezone(userId, timezone) {
    try {
      // 验证时区格式
      if (!this.isValidTimezone(timezone)) {
        throw new Error('无效的时区格式');
      }

      // 更新到数据库
      const [updated] = await UserInformation.update(
        { localTimezone: timezone },
        { where: { id: userId } }
      );

      if (updated === 0) {
        throw new Error('用户不存在');
      }

      console.log(`✅ 用户 ${userId} 时区已设置为 ${timezone}`);
      return true;
    } catch (error) {
      console.error('设置时区失败:', error);
      throw error;
    }
  }

  /**
   * 获取用户时区
   * 
   * @param {string} userId - 用户ID
   * @returns {string} 时区字符串
   */
  static async getTimezone(userId) {
    try {
      const user = await UserInformation.findByPk(userId);
      if (!user) {
        throw new Error('用户不存在');
      }

      return user.localTimezone || 'UTC';
    } catch (error) {
      console.error('获取时区失败:', error);
      throw error;
    }
  }

  /**
   * 获取用户本地时间
   * 
   * @param {string} userId - 用户ID
   * @returns {Object} 本地时间信息
   */
  static async getLocalTime(userId) {
    try {
      const timezone = await this.getTimezone(userId);
      const now = new Date();

      // 使用 Intl.DateTimeFormat 获取本地时间
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      });

      const parts = formatter.formatToParts(now);
      const dateObj = {};
      parts.forEach(part => {
        dateObj[part.type] = part.value;
      });

      // 构造本地时间字符串
      const localDateStr = `${dateObj.year}-${dateObj.month}-${dateObj.day}`;
      const localTimeStr = `${dateObj.hour}:${dateObj.minute}:${dateObj.second}`;
      const localDateTimeStr = `${localDateStr} ${localTimeStr}`;

      return {
        timezone: timezone,
        utcTime: now.toISOString(),
        localDate: localDateStr,
        localTime: localTimeStr,
        localDateTime: localDateTimeStr,
        timestamp: now.getTime()
      };
    } catch (error) {
      console.error('获取本地时间失败:', error);
      throw error;
    }
  }

  /**
   * 判断用户是否进入新的一天
   * 
   * @param {string} userId - 用户ID
   * @param {string} lastDate - 上次活动日期 (YYYY-MM-DD 格式)
   * @returns {boolean} 是否是新的一天
   */
  static async isNewDay(userId, lastDate) {
    try {
      const localTimeInfo = await this.getLocalTime(userId);
      const currentDate = localTimeInfo.localDate;

      // 如果没有上次日期,认为是新的一天
      if (!lastDate) {
        return true;
      }

      // 比较日期
      return currentDate !== lastDate;
    } catch (error) {
      console.error('判断新日期失败:', error);
      return false;
    }
  }

  /**
   * 验证时区格式是否有效
   * 
   * @param {string} timezone - 时区字符串
   * @returns {boolean} 是否有效
   */
  static isValidTimezone(timezone) {
    try {
      // 尝试使用时区创建日期格式化器
      new Intl.DateTimeFormat('en-US', { timeZone: timezone });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 获取常用时区列表
   * 
   * @returns {Array} 时区列表
   */
  static getCommonTimezones() {
    return [
      { value: 'Asia/Shanghai', label: '中国标准时间 (UTC+8)', offset: '+08:00' },
      { value: 'Asia/Hong_Kong', label: '香港时间 (UTC+8)', offset: '+08:00' },
      { value: 'Asia/Taipei', label: '台北时间 (UTC+8)', offset: '+08:00' },
      { value: 'Asia/Tokyo', label: '日本时间 (UTC+9)', offset: '+09:00' },
      { value: 'Asia/Seoul', label: '韩国时间 (UTC+9)', offset: '+09:00' },
      { value: 'Asia/Singapore', label: '新加坡时间 (UTC+8)', offset: '+08:00' },
      { value: 'Asia/Bangkok', label: '曼谷时间 (UTC+7)', offset: '+07:00' },
      { value: 'Asia/Dubai', label: '迪拜时间 (UTC+4)', offset: '+04:00' },
      { value: 'Europe/London', label: '伦敦时间 (UTC+0)', offset: '+00:00' },
      { value: 'Europe/Paris', label: '巴黎时间 (UTC+1)', offset: '+01:00' },
      { value: 'America/New_York', label: '纽约时间 (UTC-5)', offset: '-05:00' },
      { value: 'America/Los_Angeles', label: '洛杉矶时间 (UTC-8)', offset: '-08:00' },
      { value: 'America/Chicago', label: '芝加哥时间 (UTC-6)', offset: '-06:00' },
      { value: 'Australia/Sydney', label: '悉尼时间 (UTC+11)', offset: '+11:00' },
      { value: 'UTC', label: '协调世界时 (UTC)', offset: '+00:00' }
    ];
  }

  /**
   * 根据国家代码推荐时区
   * 
   * @param {string} countryCode - 国家代码 (如: CN, US, JP)
   * @returns {string} 推荐的时区
   */
  static getTimezoneByCountry(countryCode) {
    const timezoneMap = {
      'CN': 'Asia/Shanghai',
      'HK': 'Asia/Hong_Kong',
      'TW': 'Asia/Taipei',
      'JP': 'Asia/Tokyo',
      'KR': 'Asia/Seoul',
      'SG': 'Asia/Singapore',
      'TH': 'Asia/Bangkok',
      'AE': 'Asia/Dubai',
      'GB': 'Europe/London',
      'FR': 'Europe/Paris',
      'DE': 'Europe/Berlin',
      'US': 'America/New_York',
      'AU': 'Australia/Sydney'
    };

    return timezoneMap[countryCode] || 'UTC';
  }
}

module.exports = TimezoneService;
