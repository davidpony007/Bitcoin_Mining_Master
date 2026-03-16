-- =====================================================================
-- 迁移: 为 withdrawal_records 表添加 binance_uid、reject_reason、updated_at 字段
-- 执行时间: 2025-03
-- 说明: 若列已存在则跳过（使用 IF NOT EXISTS 兼容写法）
-- =====================================================================

-- 添加 binance_uid 列（6-12位数字的 Binance UID）
ALTER TABLE withdrawal_records
  ADD COLUMN IF NOT EXISTS binance_uid VARCHAR(20) DEFAULT NULL COMMENT 'Binance UID，6-12位数字' AFTER apple_id;

-- 添加 reject_reason 列（管理员拒绝时填写的原因）
ALTER TABLE withdrawal_records
  ADD COLUMN IF NOT EXISTS reject_reason VARCHAR(500) DEFAULT NULL COMMENT '拒绝原因（管理员填写）' AFTER binance_uid;

-- 添加 updated_at 列（审批操作时自动更新）
ALTER TABLE withdrawal_records
  ADD COLUMN IF NOT EXISTS updated_at DATETIME DEFAULT NULL COMMENT '更新时间（审批操作时更新）' AFTER created_at;

-- 验证字段添加结果
DESCRIBE withdrawal_records;
