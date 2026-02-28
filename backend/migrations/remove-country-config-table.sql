-- ============================================
-- 删除冗余的 country_config 表
-- ============================================
-- 创建时间: 2026-01-18
-- 原因: country_config 表功能与 country_mining_config 完全重复
--       且 country_config 为空表，无实际数据
--       country_mining_config 功能更完善（支持中英文双语）
-- ============================================

-- 1. 检查表是否存在
SELECT 'Checking if country_config table exists...' as status;

-- 2. 检查表中数据量（应该为0）
SELECT COUNT(*) as record_count FROM country_config;

-- 3. 删除 country_config 表
DROP TABLE IF EXISTS country_config;

-- 4. 验证删除成功
SELECT 'country_config table dropped successfully!' as status;

-- 5. 确认 country_mining_config 表仍然存在且有数据
SELECT 'Verifying country_mining_config table...' as status;
SELECT COUNT(*) as record_count FROM country_mining_config;

-- ============================================
-- 迁移完成说明
-- ============================================
-- 1. country_config 表已删除
-- 2. 所有国家挖矿配置功能由 country_mining_config 表提供
-- 3. 后端代码将使用 CountryMiningService 替代 CountryConfigService
-- ============================================
