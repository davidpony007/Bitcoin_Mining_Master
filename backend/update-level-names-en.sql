-- 更新等级名称为英文
UPDATE level_config SET level_name = 'LV.1 Novice Miner' WHERE level = 1;
UPDATE level_config SET level_name = 'LV.2 Junior Miner' WHERE level = 2;
UPDATE level_config SET level_name = 'LV.3 Intermediate Miner' WHERE level = 3;
UPDATE level_config SET level_name = 'LV.4 Senior Miner' WHERE level = 4;
UPDATE level_config SET level_name = 'LV.5 Expert Miner' WHERE level = 5;
UPDATE level_config SET level_name = 'LV.6 Master Miner' WHERE level = 6;
UPDATE level_config SET level_name = 'LV.7 Legendary Miner' WHERE level = 7;
UPDATE level_config SET level_name = 'LV.8 Epic Miner' WHERE level = 8;
UPDATE level_config SET level_name = 'LV.9 Mythic Miner' WHERE level = 9;

-- 验证更新结果
SELECT level, level_name, speed_multiplier FROM level_config ORDER BY level;
