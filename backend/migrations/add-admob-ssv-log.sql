-- AdMob SSV (Server-Side Verification) 验证日志表
-- AdMob 在用户看完激励广告后，调用后端 SSV 回调，携带 RSA 签名
-- 本表记录已由 Google 服务器验证通过的广告观看凭证，用于防止客户端伪造奖励请求

CREATE TABLE IF NOT EXISTS admob_ssv_log (
  id             BIGINT        NOT NULL AUTO_INCREMENT,
  transaction_id VARCHAR(128)  NOT NULL COMMENT 'AdMob 全局唯一交易ID，用于幂等去重',
  user_id        VARCHAR(64)   NOT NULL COMMENT '服务端通过 ServerSideVerificationOptions.userId 传入的用户ID',
  reward_amount  INT           NOT NULL DEFAULT 1 COMMENT '奖励数量（AdMob 广告单元配置的 reward amount）',
  reward_item    VARCHAR(64)   NOT NULL DEFAULT '' COMMENT '奖励类型（AdMob 广告单元配置的 reward item）',
  ad_unit        VARCHAR(128)  NOT NULL DEFAULT '' COMMENT '广告单元ID（ca-app-pub-xxx/xxx）',
  ad_network     VARCHAR(64)   NOT NULL DEFAULT '' COMMENT '出价方网络ID（如 5450213213286189855=AdMob）',
  created_at     TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uk_transaction_id (transaction_id),  -- 防止同一交易ID被重复处理
  KEY idx_user_id (user_id),
  KEY idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='AdMob SSV 已验证广告观看凭证表';
