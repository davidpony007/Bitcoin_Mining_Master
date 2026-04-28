-- ============================================================
-- Migration: add-user-daily-active-table.sql
-- Description: 新增用户日活跃记录表，用于计算次日留存（D+1 Retention）
-- Date: 2026-04-23
-- ============================================================

CREATE TABLE IF NOT EXISTS `user_daily_active` (
  `user_id`     VARCHAR(30) NOT NULL COMMENT '用户唯一标识符',
  `active_date` DATE        NOT NULL COMMENT '活跃日期',
  PRIMARY KEY (`user_id`, `active_date`),
  KEY `idx_active_date` (`active_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户每日活跃记录表（用于次留计算）';

-- 历史数据回填：基于 user_status.last_login_time 回填存量数据
-- 注意：last_login_time 只保存最后一次登录，历史回填数据不完整，仅供参考
INSERT IGNORE INTO `user_daily_active` (`user_id`, `active_date`)
SELECT `user_id`, DATE(`last_login_time`)
FROM `user_status`
WHERE `last_login_time` IS NOT NULL;
