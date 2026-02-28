-- 创建累计签到奖励表（用于记录用户已领取的累计签到里程碑奖励）
-- 与连续签到奖励不同，累计签到可以不连续

CREATE TABLE IF NOT EXISTS `cumulative_check_in_reward` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `user_id` INT UNSIGNED NOT NULL COMMENT '用户ID',
  `cumulative_days` INT UNSIGNED NOT NULL COMMENT '累计签到天数（3/7/15/30）',
  `points_earned` INT UNSIGNED NOT NULL COMMENT '获得的积分',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_user_cumulative` (`user_id`, `cumulative_days`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='累计签到里程碑奖励记录表';

-- 如果旧的连续签到奖励表存在，可以保留（用于数据迁移或兼容性）
-- 新的累计签到系统将使用 cumulative_check_in_reward 表
