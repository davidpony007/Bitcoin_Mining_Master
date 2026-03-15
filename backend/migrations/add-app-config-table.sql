-- ============================================================
-- Migration: 添加 app_config App版本配置表
-- 日期: 2026-03-15
-- 用途: 支持移动端版本检查、强制更新功能
-- ============================================================

USE bitcoin_mining_master;

CREATE TABLE IF NOT EXISTS `app_config` (
  `id`              INT NOT NULL AUTO_INCREMENT,
  `platform`        ENUM('ios','android','all') NOT NULL COMMENT '平台',
  `latest_version`  VARCHAR(20) NOT NULL COMMENT '最新版本号，如 1.2.0',
  `min_version`     VARCHAR(20) NOT NULL COMMENT '最低兼容版本（低于此版本强制更新）',
  `build_number`    INT NOT NULL DEFAULT 1 COMMENT '构建号，对应 pubspec 的 +N',
  `update_message`  VARCHAR(500) DEFAULT NULL COMMENT '更新说明（展示给用户）',
  `force_update`    TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否强制更新: 1=强制 0=可跳过',
  `store_url`       VARCHAR(500) DEFAULT NULL COMMENT '商店链接',
  `updated_at`      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_platform` (`platform`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='App版本配置表';

-- 插入初始版本配置数据（若已存在则跳过）
INSERT IGNORE INTO `app_config` (`id`, `platform`, `latest_version`, `min_version`, `build_number`, `update_message`, `force_update`, `store_url`) VALUES
(1, 'android', '1.0.1', '1.0.0', 3, 'Initial release', 0, NULL),
(2, 'ios',     '1.0.1', '1.0.0', 3, 'Initial release', 0, NULL);

SELECT '✅ app_config 表创建完成' AS status;
SHOW COLUMNS FROM app_config;
