-- ============================================================
-- user_information 表结构更新SQL脚本
-- 执行方法：复制到MySQL客户端执行，或使用 source 命令
-- ============================================================

USE bitcoin_mining_master;

-- 步骤1: 删除password字段
ALTER TABLE user_information DROP COLUMN IF EXISTS `password`;

-- 步骤2: 将country重命名为country_code
ALTER TABLE user_information 
CHANGE COLUMN `country` `country_code` VARCHAR(32) 
COMMENT '用户所在国家代码（如：CN, US等）';

-- 步骤3: 添加country_name_cn字段
ALTER TABLE user_information 
ADD COLUMN `country_name_cn` VARCHAR(50) DEFAULT NULL 
COMMENT '国家中文名称（对应 country_mining_config.country_name_cn）'
AFTER `country_code`;

-- 步骤4: 添加miner_level_multiplier字段
ALTER TABLE user_information 
ADD COLUMN `miner_level_multiplier` DECIMAL(4, 2) DEFAULT 1.00 
COMMENT '矿工等级挖矿倍率'
AFTER `country_multiplier`;

-- 步骤5: 删除旧的country索引
ALTER TABLE user_information DROP INDEX IF EXISTS `idx_country`;

-- 步骤6: 添加新的country_code索引
ALTER TABLE user_information ADD INDEX `idx_country_code` (`country_code`);

-- 步骤7: 从country_mining_config同步数据到现有用户
UPDATE user_information ui
LEFT JOIN country_mining_config cmc ON ui.country_code = cmc.country_code
SET 
  ui.country_name_cn = cmc.country_name_cn,
  ui.country_multiplier = COALESCE(cmc.mining_multiplier, 1.00)
WHERE ui.country_code IS NOT NULL AND ui.country_code != '';

-- 显示更新统计
SELECT '=== 更新统计 ===' as '';
SELECT 
  COUNT(*) as '总用户数',
  COUNT(country_code) as '有国家代码的用户',
  COUNT(country_name_cn) as '有国家名称的用户',
  ROUND(AVG(country_multiplier), 2) as '平均国家倍率',
  ROUND(AVG(miner_level_multiplier), 2) as '平均矿工倍率'
FROM user_information;

-- 显示各国家用户分布
SELECT '=== 国家用户分布 ===' as '';
SELECT 
  country_code as '国家代码',
  country_name_cn as '国家名称',
  country_multiplier as '国家倍率',
  COUNT(*) as '用户数'
FROM user_information
WHERE country_code IS NOT NULL
GROUP BY country_code, country_name_cn, country_multiplier
ORDER BY COUNT(*) DESC
LIMIT 20;

-- 显示最新的几个用户
SELECT '=== 最新用户示例 ===' as '';
SELECT 
  user_id as '用户ID',
  country_code as '国家代码',
  country_name_cn as '国家名称',
  country_multiplier as '国家倍率',
  miner_level_multiplier as '矿工倍率',
  user_creation_time as '创建时间'
FROM user_information
ORDER BY user_creation_time DESC
LIMIT 5;

SELECT '=== 更新完成 ===' as '';
