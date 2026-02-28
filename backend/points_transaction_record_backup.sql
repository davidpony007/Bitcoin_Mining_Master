-- points_transaction_record 表结构备份
-- 备份时间: 2026/1/23 00:15:56
-- 备份原因: 该表为空表且未被代码使用，与 points_transaction 功能重复
-- 
-- 注意: 此表已被删除，如需恢复可使用以下SQL

CREATE TABLE `points_transaction_record` (
  `id` int(11) NOT NULL AUTO_INCREMENT COMMENT '交易记录唯一ID',
  `user_id` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '用户ID',
  `transaction_type` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '交易类型',
  `points_change` int(11) NOT NULL COMMENT '积分变化（正数=增加，负数=扣除）',
  `balance_after` int(11) NOT NULL DEFAULT '0' COMMENT '交易后的积分余额',
  `transaction_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '交易发生时间',
  `description` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '交易描述',
  `related_id` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '关联记录ID',
  `source` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT 'SYSTEM' COMMENT '积分来源',
  `ip_address` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '操作IP地址',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '记录创建时间',
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '记录更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_transaction_time` (`transaction_time`),
  KEY `idx_transaction_type` (`transaction_type`),
  KEY `idx_user_time` (`user_id`,`transaction_time`),
  KEY `idx_related_id` (`related_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='积分交易记录表';

-- 备份说明:
-- 该表在创建后未被任何代码使用，且与已有的 points_transaction 表功能重复
-- 为避免维护两个相似的表，决定删除此表
-- 保留此备份以便将来需要时参考其设计
