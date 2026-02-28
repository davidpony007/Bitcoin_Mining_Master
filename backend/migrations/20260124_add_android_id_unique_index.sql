-- =============================================================================
-- 迁移：添加 android_id 和 invitation_code 唯一索引
-- 创建时间：2026-01-24
-- 目的：
--   1. 确保 android_id 唯一性（一个设备对应一个账号）
--   2. 确保 invitation_code 唯一性（防止邀请码冲突）
--   3. 提升查询性能
-- =============================================================================

USE bitcoin_mining_db;

-- 1️⃣ 先检查是否有重复数据
SELECT '========================================' AS '';
SELECT '检查重复的 android_id...' AS step;
SELECT '========================================' AS '';
SELECT android_id, COUNT(*) as count
FROM user_information
WHERE android_id IS NOT NULL AND android_id != ''
GROUP BY android_id
HAVING COUNT(*) > 1;

SELECT '========================================' AS '';
SELECT '检查重复的 invitation_code...' AS step;
SELECT '========================================' AS '';
SELECT invitation_code, COUNT(*) as count
FROM user_information
WHERE invitation_code IS NOT NULL AND invitation_code != ''
GROUP BY invitation_code
HAVING COUNT(*) > 1;

-- 2️⃣ 删除旧索引（如果存在）
SELECT '========================================' AS '';
SELECT '删除旧索引...' AS step;
SELECT '========================================' AS '';
DROP INDEX IF EXISTS idx_android_id ON user_information;
DROP INDEX IF EXISTS idx_invitation_code ON user_information;

-- 3️⃣ 增加 android_id 字段长度（支持更长的设备指纹）
SELECT '========================================' AS '';
SELECT '扩展 android_id 字段长度...' AS step;
SELECT '========================================' AS '';
ALTER TABLE user_information
MODIFY COLUMN android_id VARCHAR(255) NULL
COMMENT 'Android设备ID（支持长指纹）';

-- 4️⃣ 添加 android_id 唯一索引
SELECT '========================================' AS '';
SELECT '添加 android_id 唯一索引...' AS step;
SELECT '========================================' AS '';
CREATE UNIQUE INDEX idx_android_id_unique 
ON user_information(android_id);

-- 5️⃣ 添加 invitation_code 唯一约束
SELECT '========================================' AS '';
SELECT '添加 invitation_code 唯一索引...' AS step;
SELECT '========================================' AS '';
DROP INDEX IF EXISTS idx_invitation_code ON user_information;
CREATE UNIQUE INDEX idx_invitation_code_unique 
ON user_information(invitation_code);

-- 6️⃣ 添加普通索引（优化查询性能）
SELECT '========================================' AS '';
SELECT '添加其他索引...' AS step;
SELECT '========================================' AS '';
CREATE INDEX IF NOT EXISTS idx_gaid ON user_information(gaid);
CREATE INDEX IF NOT EXISTS idx_register_ip ON user_information(register_ip);
CREATE INDEX IF NOT EXISTS idx_country ON user_information(country);
CREATE INDEX IF NOT EXISTS idx_user_creation_time ON user_information(user_creation_time);

-- 7️⃣ 验证索引创建成功
SELECT '========================================' AS '';
SELECT '验证索引创建...' AS step;
SELECT '========================================' AS '';
SHOW INDEX FROM user_information;

-- 8️⃣ 显示最终表结构
SELECT '========================================' AS '';
SELECT '显示表结构...' AS step;
SELECT '========================================' AS '';
DESCRIBE user_information;

SELECT '========================================' AS '';
SELECT '✅ 迁移完成！' AS result;
SELECT '========================================' AS '';
