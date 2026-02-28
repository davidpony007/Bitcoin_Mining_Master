-- ================================================================
-- 完全移除连续签到天数统计，只保留累计签到天数
-- 执行日期：2026-01-18
-- ================================================================

USE bitcoin_mining_master;

-- ================================================================
-- 1. 修改 check_in_record 表 - 删除 consecutive_days 字段
-- ================================================================

-- 删除 consecutive_days 字段（如果存在）
ALTER TABLE `check_in_record` 
  DROP COLUMN `consecutive_days`;

-- 优化表结构，只保留必要字段
ALTER TABLE `check_in_record`
  MODIFY COLUMN `id` INT(11) NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  MODIFY COLUMN `user_id` VARCHAR(30) NOT NULL COMMENT '用户ID',
  MODIFY COLUMN `check_in_date` DATE NOT NULL COMMENT '签到日期',
  MODIFY COLUMN `points_earned` INT(11) DEFAULT 4 COMMENT '每日签到获得的积分（固定4积分）',
  MODIFY COLUMN `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间';

-- 添加索引（如果不存在会忽略错误）
ALTER TABLE `check_in_record`
  ADD INDEX `idx_user_date` (`user_id`, `check_in_date`);
  
ALTER TABLE `check_in_record`
  ADD INDEX `idx_user_id` (`user_id`);

-- ================================================================
-- 2. 修改 check_in_reward_config 表 - 重命名字段
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
-- 3. 删除旧的连续签到奖励备份表
-- ================================================================

-- 删除备份表（如果确认不需要恢复数据）
DROP TABLE IF EXISTS `consecutive_check_in_reward_backup_20260118`;

-- ================================================================
-- 4. 验证修改结果
-- ================================================================

-- 查看 check_in_record 表结构（应该没有 consecutive_days 字段）
SELECT '=== check_in_record 表结构 ===' as '';
DESCRIBE `check_in_record`;

-- 查看 check_in_reward_config 表结构（应该有 cumulative_days 字段）
SELECT '=== check_in_reward_config 表结构 ===' as '';
DESCRIBE `check_in_reward_config`;

-- 查看 cumulative_check_in_reward 表结构
SELECT '=== cumulative_check_in_reward 表结构 ===' as '';
DESCRIBE `cumulative_check_in_reward`;

-- 查看里程碑配置
SELECT '=== 累计签到里程碑配置 ===' as '';
SELECT `cumulative_days` as '累计天数', `points_reward` as '奖励积分', `description` as '描述' 
FROM `check_in_reward_config` 
WHERE `is_active` = 1
ORDER BY `cumulative_days`;

-- 查看现有表列表
SELECT '=== 签到相关表列表 ===' as '';
SHOW TABLES LIKE '%check%';

-- ================================================================
-- 完成提示
-- ================================================================

SELECT '✅ 连续签到统计已完全移除！' as '状态',
       '系统现在只使用累计签到天数' as '说明',
       'check_in_record 已删除 consecutive_days 字段' as '变更1',
       'check_in_reward_config 已改为 cumulative_days 字段' as '变更2';
