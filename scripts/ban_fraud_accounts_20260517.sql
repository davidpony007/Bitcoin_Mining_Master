-- ============================================================
-- 封禁 2026-05-17 欺诈账号 & 注销其付费合约
-- 依据：同一 device_id 在同一天创建多个账号，各自购买全部套餐
-- 欺诈账号：45个  虚假合约：181个  账面虚假收入：$5,620
-- 执行前请备份: mysqldump bitcoin_mining_master user_information mining_contracts > backup_$(date +%s).sql
-- ============================================================

START TRANSACTION;

-- Step 1: 找出所有欺诈用户并打封禁标记（使用 JOIN 语法绕过 MySQL 自引用限制）
UPDATE user_information ui_target
JOIN (
  SELECT DISTINCT ui2.user_id
  FROM user_information ui1
  JOIN user_information ui2
    ON  ui2.device_id  = ui1.device_id
    AND ui2.user_id   != ui1.user_id
  WHERE DATE(ui1.user_creation_time) = '2026-05-17'
    AND DATE(ui2.user_creation_time) = '2026-05-17'
    AND ui1.device_id IS NOT NULL
) fraud ON fraud.user_id = ui_target.user_id
SET ui_target.banned_at = NOW()
WHERE ui_target.banned_at IS NULL;

-- Step 2: 取消这些用户的所有付费合约
UPDATE mining_contracts mc
JOIN (
  SELECT DISTINCT ui2.user_id
  FROM user_information ui1
  JOIN user_information ui2
    ON  ui2.device_id  = ui1.device_id
    AND ui2.user_id   != ui1.user_id
  WHERE DATE(ui1.user_creation_time) = '2026-05-17'
    AND DATE(ui2.user_creation_time) = '2026-05-17'
    AND ui1.device_id IS NOT NULL
) fraud ON fraud.user_id = mc.user_id
SET mc.is_cancelled = 1,
    mc.cancelled_at = NOW()
WHERE mc.contract_type = 'paid contract'
  AND mc.is_cancelled = 0;

-- Step 3: 确认结果
SELECT 
  (SELECT COUNT(*) FROM user_information WHERE banned_at >= CURDATE()) AS banned_today,
  (SELECT COUNT(*) FROM mining_contracts WHERE cancelled_at >= CURDATE() AND contract_type = 'paid contract') AS contracts_cancelled;

COMMIT;
