-- ================================================================
-- 完全移除连续签到天数统计 - 第二阶段
-- 只修改剩余的表结构
-- ================================================================

USE bitcoin_mining_master;

-- ================================================================
-- 1. 修改 check_in_reward_config 表 - 重命名字段
-- ================================================================

-- 将 consecutive_days 重命名为 cumulative_days
ALTER TABLE `check_in_reward_config`
  CHANGE COLUMN `consecutive_days` `cumulative_days` INT(11) NOT NULL COMMENT '累计签到天数里程碑（3/7/15/30）';

-- 更新表注释
ALTER TABLE `check_in_reward_config` 
  COMMENT = '累计签到里程碑奖励配置表';

-- 更新字段注释
ALTER TABLE `check_in_reward_config`
  MODIFY COLUMN `points_reward` INT(11) NOT NULL DEFAULT 0 COMMENT '里程碑奖励积分',
  MODIFY COLUMN `description` VARCHAR(255) NOT NULL COMMENT '里程碑描述（累计签到）';

-- ================================================================
-- 2. 删除旧的连续签到奖励备份表
-- ================================================================

DROP TABLE IF EXISTS `consecutive_check_in_reward_backup_20260118`;

-- ================================================================
-- 3. 验证修改结果
-- ================================================================

SELECT '=== check_in_record 表结构（无consecutive_days） ===' as '';
DESCRIBE `check_in_record`;

SELECT '=== check_in_reward_config 表结构（有cumulative_days） ===' as '';
DESCRIBE `check_in_reward_config`;

SELECT '=== cumulative_check_in_reward 表结构 ===' as '';
DESCRIBE `cumulative_check_in_reward`;

SELECT '=== 累计签到里程碑配置 ===' as '';
SELECT `cumulative_days` as '累计天数', `points_reward` as '奖励积分', `description` as '描述' 
FROM `check_in_reward_config` 
WHERE `is_active` = 1
ORDER BY `cumulative_days`;

SELECT '=== 签到相关表列表 ===' as '';
SHOW TABLES LIKE '%check%';

SELECT '✅ 连续签到统计已完全移除！' as '状态',
       '系统现在只使用累计签到天数' as '说明';
