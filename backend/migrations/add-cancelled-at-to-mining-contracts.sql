-- 为 mining_contracts 表添加 cancelled_at 字段
-- 用于记录合约实际取消时间，解决数据分析模块【取消订阅数】始终为 0 的问题
-- 原因：旧统计 SQL 按 order_creation_time 分组（购买时间），取消发生时订单早已存在，
--       导致当天取消数查询不到任何记录。
-- 修复：改为按 cancelled_at（实际取消时间）统计。

ALTER TABLE mining_contracts
  ADD COLUMN `cancelled_at` DATETIME DEFAULT NULL
    COMMENT '合约取消时间，is_cancelled 设为 1 时写入，用于按日统计取消订阅数'
  AFTER `is_cancelled`;

-- 回填历史数据：对已取消的合约，用 contract_end_time 作为近似取消时间
UPDATE mining_contracts
SET cancelled_at = contract_end_time
WHERE is_cancelled = 1 AND cancelled_at IS NULL;
