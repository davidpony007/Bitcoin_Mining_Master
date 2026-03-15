-- ============================================================
-- Bitcoin Mining Master 数据库初始化脚本
-- 创建所有必要的表和初始数据
-- ============================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ------------------------------------------------------------
-- 1. user_information 用户基本信息表
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `user_information` (
  `id` INT NOT NULL AUTO_INCREMENT COMMENT '用户信息主键ID',
  `user_id` VARCHAR(30) NOT NULL COMMENT '用户唯一标识符',
  `invitation_code` VARCHAR(30) NOT NULL DEFAULT '' COMMENT '用户的邀请码',
  `email` VARCHAR(100) DEFAULT NULL COMMENT '用户邮箱地址',
  `google_account` VARCHAR(100) DEFAULT NULL COMMENT '绑定的Google账号邮箱',
  `apple_id` VARCHAR(255) DEFAULT NULL COMMENT 'Apple用户唯一ID (sub)',
  `apple_account` VARCHAR(100) DEFAULT NULL COMMENT 'Apple账号邮箱',
  `nickname` VARCHAR(50) DEFAULT NULL COMMENT '用户昵称',
  `device_id` VARCHAR(255) DEFAULT NULL COMMENT 'Android设备ID（支持长指纹）',
  `gaid` VARCHAR(36) DEFAULT NULL COMMENT 'Google Advertising ID',
  `idfa` VARCHAR(36) DEFAULT NULL COMMENT 'iOS广告追踪标识符（IDFA）',
  `att_status` TINYINT(1) DEFAULT NULL COMMENT 'iOS ATT授权状态: 0=未询问 1=受限 2=拒绝 3=已授权',
  `att_consent_updated_at` DATETIME DEFAULT NULL COMMENT 'ATT状态最后更新时间',
  `app_version` VARCHAR(20) DEFAULT NULL COMMENT '用户当前安装的App版本号，如 1.0.1；每次登录时由客户端上报更新',
  `app_build_number` INT DEFAULT NULL COMMENT '用户当前安装的App构建号，如 3；对应 pubspec +N；每次登录时由客户端上报更新',
  `register_ip` VARCHAR(45) DEFAULT NULL COMMENT '注册时的IP地址（支持IPv6）',
  `country_code` VARCHAR(32) DEFAULT NULL COMMENT '用户所在国家代码',
  `country_name_cn` VARCHAR(50) NOT NULL DEFAULT '' COMMENT '国家中文名称',
  `country_multiplier` DECIMAL(4,2) DEFAULT 1.00 COMMENT '国家挖矿速度倍率',
  `miner_level_multiplier` DECIMAL(8,6) DEFAULT 1.000000 COMMENT '矿工等级挖矿倍率',
  `user_level` INT DEFAULT 1 COMMENT '用户等级',
  `user_points` INT DEFAULT 0 COMMENT '用户积分',
  `total_ad_views` INT DEFAULT 0 COMMENT '累计广告观看次数',
  `user_creation_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '用户创建时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_user_id` (`user_id`),
  UNIQUE KEY `idx_invitation_code_unique` (`invitation_code`),
  UNIQUE KEY `idx_apple_id_unique` (`apple_id`),
  KEY `idx_device_id` (`device_id`),
  KEY `idx_email` (`email`),
  KEY `idx_gaid` (`gaid`),
  KEY `idx_register_ip` (`register_ip`),
  KEY `idx_country_code` (`country_code`),
  KEY `idx_user_creation_time` (`user_creation_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户基本信息表';

-- ------------------------------------------------------------
-- 2. user_status 用户账户状态表
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `user_status` (
  `id` INT NOT NULL AUTO_INCREMENT COMMENT '用户状态主键ID',
  `user_id` VARCHAR(30) NOT NULL COMMENT '用户唯一标识符',
  `bitcoin_accumulated_amount` DECIMAL(18,18) DEFAULT 0 COMMENT '累计挖矿获得的比特币总量',
  `current_bitcoin_balance` DECIMAL(18,18) DEFAULT 0 COMMENT '当前比特币余额',
  `total_invitation_rebate` DECIMAL(18,18) DEFAULT 0 COMMENT '累计邀请返利总额',
  `total_withdrawal_amount` DECIMAL(18,18) DEFAULT 0 COMMENT '累计提现总额',
  `last_login_time` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '最后登录时间',
  `user_status` ENUM('active within 3 days','no login within 7 days','disabled','deleted','normal') DEFAULT 'normal' COMMENT '用户活跃状态',
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_user_id` (`user_id`),
  KEY `idx_user_status` (`user_status`),
  KEY `idx_last_login_time` (`last_login_time`),
  CONSTRAINT `fk_user_status_user_id` FOREIGN KEY (`user_id`) REFERENCES `user_information` (`user_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户账户状态表';

-- ------------------------------------------------------------
-- 3. mining_contracts 挖矿合约表
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `mining_contracts` (
  `id` INT NOT NULL AUTO_INCREMENT COMMENT '挖矿合约主键ID',
  `user_id` VARCHAR(30) NOT NULL COMMENT '用户唯一标识符',
  `contract_type` ENUM('Free Ad Reward','Daily Check-in Reward','Invite Friend Reward','paid contract') NOT NULL COMMENT '合约类型',
  `contract_creation_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '合约创建时间',
  `contract_end_time` DATETIME NOT NULL COMMENT '合约结束时间',
  `contract_duration` TIME NOT NULL COMMENT '合约持续时长',
  `hashrate` DECIMAL(18,18) NOT NULL COMMENT '算力',
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_contract_type` (`contract_type`),
  KEY `idx_contract_creation_time` (`contract_creation_time`),
  KEY `idx_contract_end_time` (`contract_end_time`),
  KEY `idx_active_contracts` (`contract_end_time`, `user_id`),
  CONSTRAINT `fk_mining_contracts_user_id` FOREIGN KEY (`user_id`) REFERENCES `user_information` (`user_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='挖矿合约表';

-- ------------------------------------------------------------
-- 4. free_contract_records 免费合约记录表
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `free_contract_records` (
  `id` INT NOT NULL AUTO_INCREMENT COMMENT '免费合约记录主键ID',
  `user_id` VARCHAR(30) NOT NULL COMMENT '用户唯一标识符',
  `free_contract_type` ENUM('Free Ad Reward','Daily Check-in Reward','Invite Friend Reward','Bind Referrer Reward') DEFAULT NULL COMMENT '免费合约类型',
  `free_contract_revenue` DECIMAL(18,18) DEFAULT 0 COMMENT '合约总收益(BTC)',
  `free_contract_creation_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '合约创建时间',
  `free_contract_end_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '合约结束时间',
  `hashrate` DECIMAL(18,18) DEFAULT NULL COMMENT '算力',
  `base_hashrate` DECIMAL(18,18) DEFAULT 0.000000000000139 COMMENT '纯基础算力',
  `has_daily_bonus` TINYINT(1) DEFAULT 0 COMMENT '是否包含签到加成',
  `mining_status` ENUM('completed','mining','error') DEFAULT NULL COMMENT '挖矿状态',
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_free_contract_type` (`free_contract_type`),
  KEY `idx_free_contract_creation_time` (`free_contract_creation_time`),
  KEY `idx_active_contracts` (`free_contract_end_time`, `user_id`),
  CONSTRAINT `fk_free_contract_user_id` FOREIGN KEY (`user_id`) REFERENCES `user_information` (`user_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='免费合约记录表';

-- ------------------------------------------------------------
-- 5. bitcoin_transaction_records 比特币交易记录表
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `bitcoin_transaction_records` (
  `id` INT NOT NULL AUTO_INCREMENT COMMENT '交易记录主键ID',
  `user_id` VARCHAR(15) NOT NULL COMMENT '用户唯一标识符',
  `transaction_type` VARCHAR(100) NOT NULL COMMENT '交易类型',
  `transaction_amount` DECIMAL(20,18) NOT NULL COMMENT '交易金额',
  `balance_after` DECIMAL(20,18) DEFAULT NULL COMMENT '交易后余额 (BTC)',
  `description` VARCHAR(500) DEFAULT NULL COMMENT '交易描述',
  `transaction_creation_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '交易创建时间',
  `transaction_status` VARCHAR(20) NOT NULL DEFAULT 'success' COMMENT '交易状态',
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_transaction_type` (`transaction_type`),
  KEY `idx_transaction_status` (`transaction_status`),
  KEY `idx_transaction_creation_time` (`transaction_creation_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='比特币交易记录表';

-- ------------------------------------------------------------
-- 6. invitation_rebate 邀请返利记录表
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `invitation_rebate` (
  `id` INT NOT NULL AUTO_INCREMENT COMMENT '返利记录主键ID',
  `user_id` VARCHAR(15) NOT NULL COMMENT '获得返利的用户ID',
  `invitation_code` VARCHAR(11) NOT NULL COMMENT '上级用户的邀请码',
  `subordinate_user_id` VARCHAR(15) DEFAULT NULL COMMENT '下级用户ID',
  `subordinate_user_invitation_code` VARCHAR(11) DEFAULT NULL COMMENT '下级用户的邀请码',
  `subordinate_rebate_amount` DECIMAL(18,18) DEFAULT NULL COMMENT '返利金额',
  `rebate_creation_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '返利创建时间',
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_invitation_code` (`invitation_code`),
  KEY `idx_subordinate_user_id` (`subordinate_user_id`),
  KEY `idx_rebate_creation_time` (`rebate_creation_time`),
  KEY `idx_user_time` (`user_id`, `rebate_creation_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='邀请返利记录表';

-- ------------------------------------------------------------
-- 7. invitation_relationship 用户邀请关系表
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `invitation_relationship` (
  `id` INT NOT NULL AUTO_INCREMENT COMMENT '邀请关系主键ID',
  `user_id` VARCHAR(30) NOT NULL COMMENT '被邀请用户ID',
  `invitation_code` VARCHAR(30) NOT NULL COMMENT '被邀请用户自己的邀请码',
  `referrer_user_id` VARCHAR(30) DEFAULT NULL COMMENT '推荐人用户ID',
  `referrer_invitation_code` VARCHAR(30) DEFAULT NULL COMMENT '推荐人的邀请码',
  `invitation_creation_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '邀请关系创建时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_user_id` (`user_id`),
  UNIQUE KEY `idx_invitation_code` (`invitation_code`),
  KEY `idx_referrer_user_id` (`referrer_user_id`),
  KEY `idx_referrer_invitation_code` (`referrer_invitation_code`),
  KEY `idx_invitation_creation_time` (`invitation_creation_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户邀请关系表';

-- ------------------------------------------------------------
-- 8. paid_products_list 付费产品配置表
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `paid_products_list` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `product_id` ENUM('p0499','p0699','p0999','p1999','p4999','p9999') NOT NULL COMMENT '产品档位标识',
  `product_name` ENUM('contract_4.99','contract_6.99','contract_9.99','contract_19.99','contract_49.99','contract_99.99') NOT NULL COMMENT '合约产品名称',
  `product_price` ENUM('4.99','6.99','9.99','19.99','49.99','99.99') NOT NULL COMMENT '产品价格(美元)',
  `hashrate` ENUM('176.3 Gh/s','305.6 Gh/s','611.2 Gh/s','1326.4 Gh/s','2915.6 Gh/s','6122.7 Gh/s') NOT NULL COMMENT '算力值',
  `product_contract_duration` ENUM('720 hours') NOT NULL COMMENT '合约时长',
  PRIMARY KEY (`id`),
  KEY `idx_product_id` (`product_id`),
  KEY `idx_product_price` (`product_price`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='付费产品列表';

-- ------------------------------------------------------------
-- 9. user_orders 用户订单表
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `user_orders` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `user_id` VARCHAR(15) NOT NULL COMMENT '用户唯一标识符',
  `email` VARCHAR(80) NOT NULL COMMENT '用户邮箱地址',
  `google_account` VARCHAR(100) DEFAULT NULL COMMENT '用户Google账号',
  `product_id` ENUM('p0499','p0699','p0999','p1999') NOT NULL COMMENT '产品档位标识',
  `product_name` ENUM('contract_4.99','contract_6.99','contract_9.99','contract_19.99') NOT NULL COMMENT '合约产品名称',
  `product_price` ENUM('4.99','6.99','9.99','19.99') NOT NULL COMMENT '产品价格',
  `hashrate` DECIMAL(18,18) NOT NULL DEFAULT 0 COMMENT '合约算力值',
  `order_creation_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '订单创建时间',
  `payment_time` DATETIME DEFAULT NULL COMMENT '支付完成时间',
  `currency_type` VARCHAR(30) NOT NULL COMMENT '支付货币类型',
  `country_code` VARCHAR(30) DEFAULT NULL COMMENT '国家代码',
  `payment_gateway_id` VARCHAR(80) NOT NULL COMMENT '支付网关标识符',
  `payment_network_id` VARCHAR(80) NOT NULL COMMENT '支付网络标识符',
  `order_status` ENUM('active','renewing','complete','error','refund request in progress','refund successful','refund rejected') DEFAULT 'active' COMMENT '订单状态',
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_email` (`email`),
  KEY `idx_order_status` (`order_status`),
  KEY `idx_order_creation_time` (`order_creation_time`),
  KEY `idx_payment_gateway_id` (`payment_gateway_id`),
  KEY `idx_user_status` (`user_id`, `order_status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户订单表';

-- ------------------------------------------------------------
-- 10. withdrawal_records 用户提现记录表
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `withdrawal_records` (
  `id` INT NOT NULL AUTO_INCREMENT COMMENT '提现记录主键ID',
  `user_id` VARCHAR(30) NOT NULL COMMENT '用户唯一标识符',
  `email` VARCHAR(60) NOT NULL COMMENT '用户邮箱地址',
  `wallet_address` VARCHAR(80) NOT NULL COMMENT '提现钱包地址',
  `withdrawal_request_amount` DECIMAL(20,8) NOT NULL COMMENT '用户申请提现金额',
  `network_fee` DECIMAL(20,8) NOT NULL COMMENT '网络手续费',
  `received_amount` DECIMAL(20,8) NOT NULL COMMENT '实际到账金额',
  `withdrawal_status` ENUM('success','pending','rejected') NOT NULL DEFAULT 'pending' COMMENT '提现状态',
  `google_account` VARCHAR(100) DEFAULT NULL COMMENT 'Google账号邮箱',
  `apple_id` VARCHAR(255) DEFAULT NULL COMMENT 'Apple用户唯一ID',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_email` (`email`),
  KEY `idx_wallet_address` (`wallet_address`),
  KEY `idx_withdrawal_status` (`withdrawal_status`),
  KEY `idx_user_status` (`user_id`, `withdrawal_status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户提现记录表';

-- ------------------------------------------------------------
-- 11. user_log 用户操作日志表
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `user_log` (
  `id` INT NOT NULL AUTO_INCREMENT COMMENT '用户日志主键ID',
  `user_id` VARCHAR(15) NOT NULL COMMENT '用户唯一标识符',
  `action` VARCHAR(100) NOT NULL COMMENT '用户操作行为描述',
  `log_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '日志记录时间',
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_log_time` (`log_time`),
  KEY `idx_user_log_time` (`user_id`, `log_time`),
  KEY `idx_action` (`action`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户操作日志表';

-- ------------------------------------------------------------
-- 12. country_mining_config 国家挖矿配置表
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `country_mining_config` (
  `id` INT NOT NULL AUTO_INCREMENT COMMENT '自增主键',
  `country_code` VARCHAR(2) NOT NULL COMMENT '国家代码 (ISO 3166-1 alpha-2)',
  `country_name` VARCHAR(100) NOT NULL COMMENT '国家英文名称',
  `country_name_cn` VARCHAR(100) NOT NULL COMMENT '国家中文名称',
  `mining_multiplier` DECIMAL(5,2) NOT NULL DEFAULT 1.00 COMMENT '挖矿速率倍率',
  `is_active` TINYINT(1) DEFAULT 1 COMMENT '是否启用',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `country_mining_config_country_code_unique` (`country_code`),
  KEY `idx_is_active` (`is_active`),
  KEY `idx_mining_multiplier` (`mining_multiplier`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='国家挖矿速率配置表';

-- ------------------------------------------------------------
-- 13. level_config 等级配置表
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `level_config` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `level` INT NOT NULL COMMENT '等级',
  `min_points` INT NOT NULL DEFAULT 0 COMMENT '该等级最小积分',
  `max_points` INT NOT NULL COMMENT '升级所需积分',
  `speed_multiplier` DECIMAL(8,4) NOT NULL DEFAULT 1.0000 COMMENT '挖矿速率倍率',
  `level_name` VARCHAR(100) NOT NULL COMMENT '等级名称',
  `description` VARCHAR(255) DEFAULT NULL COMMENT '等级描述',
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_level` (`level`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='等级配置表';

-- ------------------------------------------------------------
-- 14. points_transaction 积分交易记录表
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `points_transaction` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `user_id` VARCHAR(30) NOT NULL COMMENT '用户ID',
  `points_change` INT NOT NULL COMMENT '积分变化量（正为增加，负为减少）',
  `reason` VARCHAR(255) NOT NULL COMMENT '变化原因',
  `reason_type` VARCHAR(50) NOT NULL COMMENT '原因类型',
  `related_user_id` VARCHAR(30) DEFAULT NULL COMMENT '关联用户ID',
  `related_record_id` INT DEFAULT NULL COMMENT '关联记录ID',
  `before_points` INT NOT NULL DEFAULT 0 COMMENT '变化前积分',
  `after_points` INT NOT NULL DEFAULT 0 COMMENT '变化后积分',
  `before_level` INT NOT NULL DEFAULT 1 COMMENT '变化前等级',
  `after_level` INT NOT NULL DEFAULT 1 COMMENT '变化后等级',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_reason_type` (`reason_type`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='积分交易记录表';

-- ============================================================
-- 初始数据插入
-- ============================================================

-- 插入等级配置数据
INSERT IGNORE INTO `level_config` (`level`, `min_points`, `max_points`, `speed_multiplier`, `level_name`, `description`) VALUES
(1, 0, 20,     1.0000, 'LV.1 Novice Miner',        'Beginner miner, starting the journey'),
(2, 0, 30,     1.1000, 'LV.2 Junior Miner',         'Learning the basics of mining'),
(3, 0, 50,     1.2000, 'LV.3 Intermediate Miner',   'Getting better at mining'),
(4, 0, 100,    1.3500, 'LV.4 Senior Miner',         'Experienced miner'),
(5, 0, 200,    1.5000, 'LV.5 Expert Miner',         'Mining expert'),
(6, 0, 400,    1.7000, 'LV.6 Master Miner',         'Mining master'),
(7, 0, 800,    2.0000, 'LV.7 Legendary Miner',      'Legendary mining skills'),
(8, 0, 1600,   2.4000, 'LV.8 Epic Miner',           'Epic level mining power'),
(9, 0, 999999, 3.0000, 'LV.9 Mythic Miner',         'The ultimate mining legend');

-- 插入付费产品数据
INSERT IGNORE INTO `paid_products_list` (`product_id`, `product_name`, `product_price`, `hashrate`, `product_contract_duration`) VALUES
('p0499', 'contract_4.99',  '4.99',  '176.3 Gh/s',  '720 hours'),
('p0699', 'contract_6.99',  '6.99',  '305.6 Gh/s',  '720 hours'),
('p0999', 'contract_9.99',  '9.99',  '611.2 Gh/s',  '720 hours'),
('p1999', 'contract_19.99', '19.99', '1326.4 Gh/s', '720 hours'),
('p4999', 'contract_49.99', '49.99', '2915.6 Gh/s', '720 hours'),
('p9999', 'contract_99.99', '99.99', '6122.7 Gh/s', '720 hours');

-- 插入国家挖矿配置数据
INSERT IGNORE INTO `country_mining_config` (`country_code`, `country_name`, `country_name_cn`, `mining_multiplier`, `is_active`) VALUES
('US', 'United States',      '美国',     1.50, 1),
('CN', 'China',              '中国',     1.30, 1),
('JP', 'Japan',              '日本',     1.40, 1),
('KR', 'South Korea',        '韩国',     1.35, 1),
('GB', 'United Kingdom',     '英国',     1.45, 1),
('DE', 'Germany',            '德国',     1.40, 1),
('FR', 'France',             '法国',     1.38, 1),
('CA', 'Canada',             '加拿大',   1.42, 1),
('AU', 'Australia',          '澳大利亚', 1.38, 1),
('SG', 'Singapore',          '新加坡',   1.45, 1),
('IN', 'India',              '印度',     1.20, 1),
('BR', 'Brazil',             '巴西',     1.15, 1),
('RU', 'Russia',             '俄罗斯',   1.25, 1),
('MX', 'Mexico',             '墨西哥',   1.18, 1),
('ID', 'Indonesia',          '印度尼西亚', 1.15, 1),
('TR', 'Turkey',             '土耳其',   1.20, 1),
('SA', 'Saudi Arabia',       '沙特阿拉伯', 1.30, 1),
('AE', 'United Arab Emirates', '阿联酋', 1.35, 1),
('TH', 'Thailand',           '泰国',     1.22, 1),
('MY', 'Malaysia',           '马来西亚', 1.25, 1),
('PH', 'Philippines',        '菲律宾',   1.18, 1),
('VN', 'Vietnam',            '越南',     1.15, 1),
('PK', 'Pakistan',           '巴基斯坦', 1.10, 1),
('NG', 'Nigeria',            '尼日利亚', 1.10, 1),
('ZA', 'South Africa',       '南非',     1.15, 1),
('EG', 'Egypt',              '埃及',     1.10, 1),
('AR', 'Argentina',          '阿根廷',   1.12, 1),
('CO', 'Colombia',           '哥伦比亚', 1.10, 1),
('IT', 'Italy',              '意大利',   1.38, 1),
('ES', 'Spain',              '西班牙',   1.35, 1),
('NL', 'Netherlands',        '荷兰',     1.42, 1),
('SE', 'Sweden',             '瑞典',     1.40, 1),
('NO', 'Norway',             '挪威',     1.40, 1),
('CH', 'Switzerland',        '瑞士',     1.42, 1),
('PL', 'Poland',             '波兰',     1.30, 1),
('UA', 'Ukraine',            '乌克兰',   1.20, 1),
('HK', 'Hong Kong',          '香港',     1.45, 1),
('TW', 'Taiwan',             '台湾',     1.40, 1),
('NZ', 'New Zealand',        '新西兰',   1.35, 1),
('IL', 'Israel',             '以色列',   1.38, 1),
('DEFAULT', 'Other',         '其他',     1.00, 1);

-- ------------------------------------------------------------
-- 15. app_config App版本配置表
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `app_config` (
  `id`              INT NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `platform`        ENUM('ios','android','all') NOT NULL COMMENT '目标平台: ios=苹果 android=安卓 all=全平台',
  `latest_version`  VARCHAR(20) NOT NULL COMMENT '当前最新版本号，如 1.2.0',
  `min_version`     VARCHAR(20) NOT NULL COMMENT '最低兼容版本号；客户端低于此版本将强制更新，如 1.0.0',
  `build_number`    INT NOT NULL DEFAULT 1 COMMENT '构建号，对应 pubspec.yaml 中的 +N（如 version: 1.0.1+3 则值为 3）',
  `update_message`  VARCHAR(500) DEFAULT NULL COMMENT '版本更新说明文字，将展示给用户（如：修复已知问题，优化挖矿速度）',
  `force_update`    TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否强制更新: 1=强制（用户无法跳过）0=可选（用户可稍后更新）',
  `store_url`       VARCHAR(500) DEFAULT NULL COMMENT '应用商店链接，点击更新时跳转（App Store / Google Play URL）',
  `updated_at`      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '记录最后修改时间，自动更新',
  PRIMARY KEY (`id`),
  KEY `idx_platform` (`platform`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='App版本配置表：控制客户端版本检查、强制更新和商店跳转';

-- 插入初始版本配置
INSERT IGNORE INTO `app_config` (`id`, `platform`, `latest_version`, `min_version`, `build_number`, `update_message`, `force_update`, `store_url`) VALUES
(1, 'android', '1.0.1', '1.0.0', 3, 'Initial release', 0, NULL),
(2, 'ios',     '1.0.1', '1.0.0', 3, 'Initial release', 0, NULL);

SET FOREIGN_KEY_CHECKS = 1;

SELECT '✅ 数据库初始化完成！' AS status;
SHOW TABLES;
