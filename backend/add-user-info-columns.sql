-- 在user_information表中添加缺失的字段
ALTER TABLE user_information
ADD COLUMN user_level INT DEFAULT 1 COMMENT '用户等级',
ADD COLUMN user_points INT DEFAULT 0 COMMENT '用户积分',
ADD COLUMN mining_speed_multiplier DECIMAL(8, 6) DEFAULT 1.000000 COMMENT '挖矿速度倍率';

-- 查看更新后的表结构
SHOW COLUMNS FROM user_information;
