-- 订阅积分奖励记录表
-- 用于追踪每个用户对每个付费档位是否已发放过积分，保证幂等性（续订不重复奖励）
CREATE TABLE IF NOT EXISTS `subscription_point_awards` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `user_id` VARCHAR(30) NOT NULL COMMENT '用户ID',
  `product_id` VARCHAR(20) NOT NULL COMMENT '订阅档位ID（p0499/p0699/p0999/p1999等）',
  `awarded_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '发放时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_user_product` (`user_id`, `product_id`),
  KEY `idx_user_id` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='订阅积分奖励发放记录（每用户每档位最多奖励一次）';
