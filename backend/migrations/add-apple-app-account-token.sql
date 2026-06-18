-- 添加 apple_app_account_token 字段到 user_information 表
-- 用于关联 Apple 服务端通知（SUBSCRIBED/INITIAL_BUY）到具体用户
-- 值由后端 deriveAppleAccountToken(user_id) 计算，与 Flutter 端 _deriveAccountToken() 一致

ALTER TABLE user_information
  ADD COLUMN apple_app_account_token VARCHAR(36) NULL DEFAULT NULL
    COMMENT 'Apple AppAccount Token（UUID v4，由 user_id FNV1a 衍生）用于 SUBSCRIBED/INITIAL_BUY 通知反查用户'
  AFTER apple_account;

CREATE INDEX idx_ui_apple_app_account_token
  ON user_information(apple_app_account_token);
