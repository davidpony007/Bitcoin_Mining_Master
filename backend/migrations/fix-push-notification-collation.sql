-- 修复 push_tokens 和 notification_log 表的字符集排序规则
-- 将 utf8mb4_unicode_ci 统一改为与其他表一致的 utf8mb4_0900_ai_ci
-- 执行时间: 2026-03-30
-- 原因: JOIN mining_contracts 时产生 "Illegal mix of collations" 错误

ALTER TABLE push_tokens     CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
ALTER TABLE notification_log CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
