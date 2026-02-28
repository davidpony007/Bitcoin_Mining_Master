-- 创建用户积分增加的存储过程
-- 支持自动升级逻辑：每个等级的积分独立，升级后积分清零

DELIMITER $$

DROP PROCEDURE IF EXISTS sp_add_user_points$$

CREATE PROCEDURE sp_add_user_points(
    IN p_user_id VARCHAR(30),
    IN p_points INT,
    IN p_reason VARCHAR(100),
    IN p_reason_type VARCHAR(20),
    IN p_related_user_id VARCHAR(30),
    IN p_related_record_id INT
)
BEGIN
    DECLARE v_before_level INT;
    DECLARE v_before_points INT;
    DECLARE v_after_level INT;
    DECLARE v_after_points INT;
    DECLARE v_level_up TINYINT DEFAULT 0;
    DECLARE v_new_multiplier DECIMAL(8,6);
    DECLARE v_max_points INT;
    
    -- 开启事务
    START TRANSACTION;
    
    -- 获取当前等级和积分
    SELECT user_level, user_points, mining_speed_multiplier
    INTO v_before_level, v_before_points, v_new_multiplier
    FROM user_information
    WHERE user_id = p_user_id
    FOR UPDATE;
    
    -- 计算新积分
    SET v_after_points = v_before_points + p_points;
    SET v_after_level = v_before_level;
    
    -- 如果积分为负，重置为0
    IF v_after_points < 0 THEN
        SET v_after_points = 0;
    END IF;
    
    -- 检查是否需要升级（循环处理多级升级）
    upgrade_loop: WHILE v_after_level < 9 DO
        -- 获取当前等级的max_points
        SELECT max_points INTO v_max_points
        FROM level_config
        WHERE level = v_after_level;
        
        -- 如果积分超过当前等级上限，升级
        IF v_after_points > v_max_points THEN
            SET v_after_points = v_after_points - v_max_points - 1;  -- 减去升级所需积分，多余的进入下一等级
            SET v_after_level = v_after_level + 1;
            SET v_level_up = 1;
            
            -- 获取新等级的speed_multiplier
            SELECT speed_multiplier INTO v_new_multiplier
            FROM level_config
            WHERE level = v_after_level;
        ELSE
            -- 积分未达到升级要求，退出循环
            LEAVE upgrade_loop;
        END IF;
    END WHILE upgrade_loop;
    
    -- LV.9特殊处理：积分无上限
    IF v_after_level = 9 THEN
        -- LV.9 积分不清零，可以无限增长（虽然没有实际意义）
        SET v_after_points = v_before_points + p_points;
    END IF;
    
    -- 更新用户信息
    UPDATE user_information
    SET user_level = v_after_level,
        user_points = v_after_points,
        mining_speed_multiplier = v_new_multiplier
    WHERE user_id = p_user_id;
    
    -- 记录积分变动历史
    INSERT INTO user_points_history (
        user_id, points_change, points_before, points_after,
        level_before, level_after, reason, reason_type,
        related_user_id, related_record_id
    ) VALUES (
        p_user_id, p_points, v_before_points, v_after_points,
        v_before_level, v_after_level, p_reason, p_reason_type,
        p_related_user_id, p_related_record_id
    );
    
    -- 提交事务
    COMMIT;
    
    -- 返回结果
    SELECT 
        v_before_points AS before_points,
        v_after_points AS after_points,
        v_before_level AS before_level,
        v_after_level AS after_level,
        v_level_up AS level_up,
        v_new_multiplier AS new_multiplier;
END$$

DELIMITER ;

-- 测试存储过程
SELECT '存储过程创建完成' AS status;
