-- 修复等级系统配置，按照规范表要求
-- 每个等级的积分都是独立的，从0开始，升级后清零

UPDATE level_config SET min_points = 0, max_points = 20, speed_multiplier = 1.0000,
description = '需要积满20积分才能升级LV.2，升级后积分从0开始积攒'
WHERE level = 1;

UPDATE level_config SET min_points = 0, max_points = 30, speed_multiplier = 1.1000,
description = '需要积满30积分才能升级LV.3，升级后积分从0开始积攒'
WHERE level = 2;

UPDATE level_config SET min_points = 0, max_points = 50, speed_multiplier = 1.2000,
description = '需要积满50积分才能升级LV.4，升级后积分从0开始积攒'
WHERE level = 3;

UPDATE level_config SET min_points = 0, max_points = 100, speed_multiplier = 1.3500,
description = '需要积满100积分才能升级LV.5，升级后积分从0开始积攒'
WHERE level = 4;

UPDATE level_config SET min_points = 0, max_points = 200, speed_multiplier = 1.5000,
description = '需要积满200积分才能升级LV.6，升级后积分从0开始积攒'
WHERE level = 5;

UPDATE level_config SET min_points = 0, max_points = 400, speed_multiplier = 1.7000,
description = '需要积满400积分才能升级LV.7，升级后积分从0开始积攒'
WHERE level = 6;

UPDATE level_config SET min_points = 0, max_points = 800, speed_multiplier = 2.0000,
description = '需要积满800积分才能升级LV.8，升级后积分从0开始积攒'
WHERE level = 7;

UPDATE level_config SET min_points = 0, max_points = 1600, speed_multiplier = 2.4000,
description = '需要积满1600积分才能升级为LV.9'
WHERE level = 8;

UPDATE level_config SET min_points = 0, max_points = 999999, speed_multiplier = 3.0000,
description = '积分显示为Max，没有具体数值'
WHERE level = 9;

SELECT * FROM level_config ORDER BY level;
