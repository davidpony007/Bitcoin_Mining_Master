-- Migration: 在 user_information 表中添加客户端 App 版本字段
-- 用途：每次用户登录时，由客户端上报当前安装的版本号，存储在用户记录中
-- 执行时机：已有生产数据库执行一次即可
-- 创建时间：2025-03-15

USE bitcoin_mining_master;

ALTER TABLE user_information
  ADD COLUMN IF NOT EXISTS `app_version` VARCHAR(20) DEFAULT NULL
    COMMENT '用户当前安装的App版本号，如1.0.1；每次登录时由客户端上报更新'
  AFTER `idfa`;

ALTER TABLE user_information
  ADD COLUMN IF NOT EXISTS `app_build_number` INT DEFAULT NULL
    COMMENT '用户当前安装的App构建号，如3；对应pubspec +N；每次登录时由客户端上报更新'
  AFTER `app_version`;
