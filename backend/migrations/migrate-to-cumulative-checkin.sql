-- ================================================================
-- 迁移签到系统：从连续签到改为累计签到
-- 执行日期：2026-01-18
-- ================================================================

USE bitcoin_mining_master;

-- ================================================================
-- 1. 修改 check_in_record 表
-- 保留 consecutive_days 字段（用于显示连续状态）
-- 注意：不需要删除该字段，后端代码会同时维护连续和累计天数
-- ================================================================

-- 添加注释说明字段用途
ALTER TABLE `check_in_record` 
  MODIFY COLUMN `consecutive_days` INT(11) DEFAULT 1 COMMENT '连续签到天数（用于前端显示，不影响奖励计算）',
  MODIFY COLUMN `points_earned` INT(11) DEFAULT 4 COMMENT '每日签到获得的积分（固定4积分）';

-- 添加索引优化累计天数查询
-- 因为累计天数是通过 COUNT(*) 计算的，需要优化查询性能
ALTER TABLE `check_in_record` 
  ADD INDEX `idx_user_date` (`user_id`, `check_in_date`);

-- ================================================================
-- 2. 创建新表：累计签到奖励记录表
-- 替代原有的 consecutive_check_in_reward 表
-- ================================================================

CREATE TABLE IF NOT EXISTS `cumulative_check_in_reward` (
  `id` INT(11) UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `user_id` VARCHAR(30) NOT NULL COMMENT '用户ID',
  `cumulative_days` INT(11) NOT NULL COMMENT '累计签到天数（3/7/15/30）',
  `points_earned` INT(11) NOT NULL COMMENT '获得的里程碑奖励积分',
  `claimed_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '领取时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_user_cumulative` (`user_id`, `cumulative_days`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_cumulative_days` (`cumulative_days`),
  KEY `idx_claimed_at` (`claimed_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='累计签到里程碑奖励记录表';

-- ================================================================
-- 3. 数据迁移：从连续签到奖励迁移到累计签到奖励
-- 如果用户之前已经领取了连续签到奖励，将其迁移到新表
-- ================================================================

-- 迁移有效的里程碑奖励（3/7/15/30天）
INSERT INTO `cumulative_check_in_reward` 
  (`user_id`, `cumulative_days`, `points_earned`, `claimed_at`)
SELECT 
  `user_id`,
  `consecutive_days` as `cumulative_days`,
  `points_earned`,
  `claimed_at`
FROM `consecutive_check_in_reward`
WHERE `consecutive_days` IN (3, 7, 15, 30)
ON DUPLICATE KEY UPDATE 
  `claimed_at` = VALUES(`claimed_at`);

-- ================================================================
-- 4. 修改 check_in_reward_config 表
-- 更新配置为累计签到里程碑
-- ================================================================

-- 清空旧的连续签到配置
TRUNCATE TABLE `check_in_reward_config`;

-- 插入新的累计签到里程碑配置
-- 根据需求：3天+6积分，7天+15积分，15天+30积分，30天+60积分
INSERT INTO `check_in_reward_config` 
  (`consecutive_days`, `points_reward`, `description`, `is_active`)
VALUES
  (3, 6, '累计签到3天里程碑奖励', 1),
  (7, 15, '累计签到7天里程碑奖励', 1),
  (15, 30, '累计签到15天里程碑奖励', 1),
  (30, 60, '累计签到30天里程碑奖励', 1)
ON DUPLICATE KEY UPDATE
  `points_reward` = VALUES(`points_reward`),
  `description` = VALUES(`description`),
  `is_active` = VALUES(`is_active`);

-- 为配置表字段添加注释说明
ALTER TABLE `check_in_reward_config`
  MODIFY COLUMN `consecutive_days` INT(11) NOT NULL COMMENT '里程碑天数（现用于累计签到，字段名保持兼容性）',
  MODIFY COLUMN `points_reward` INT(11) NOT NULL DEFAULT 0 COMMENT '里程碑奖励积分',
  MODIFY COLUMN `description` VARCHAR(255) NOT NULL COMMENT '里程碑描述';

-- ================================================================
-- 5. 重命名旧表（保留备份）
-- 不删除 consecutive_check_in_reward 表，改为备份表
-- ================================================================

RENAME TABLE 
  `consecutive_check_in_reward` TO `consecutive_check_in_reward_backup_20260118`;

-- ================================================================
-- 6. 验证数据
-- ================================================================

-- 查看累计签到奖励表数据
SELECT '=== 累计签到奖励表数据 ===' as '';
SELECT * FROM `cumulative_check_in_reward` LIMIT 10;

-- 查看签到配置
SELECT '=== 签到里程碑配置 ===' as '';
SELECT `consecutive_days` as '里程碑天数', `points_reward` as '奖励积分', `description` as '描述' 
FROM `check_in_reward_config` 
WHERE `is_active` = 1
ORDER BY `consecutive_days`;

-- 查看最近签到记录
SELECT '=== 最近10条签到记录 ===' as '';
SELECT `user_id`, `check_in_date`, `consecutive_days`, `points_earned` 
FROM `check_in_record` 
ORDER BY `created_at` DESC 
LIMIT 10;

-- ================================================================
-- 迁移完成提示
-- ================================================================

SELECT '✅ 数据库迁移完成！' as '状态',
       '签到系统已从连续签到改为累计签到' as '说明',
       '里程碑配置：3/7/15/30天 → 6/15/30/60积分' as '里程碑';
