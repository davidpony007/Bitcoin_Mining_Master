-- 创建支付交易记录表
-- 用于记录所有应用内购买交易

CREATE TABLE IF NOT EXISTS payment_transactions (
  id INT AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
  user_id VARCHAR(255) NOT NULL COMMENT '用户ID',
  platform ENUM('android', 'ios') NOT NULL COMMENT '平台：android/ios',
  product_id VARCHAR(50) NOT NULL COMMENT '商品ID（如p0499）',
  order_id VARCHAR(255) NOT NULL COMMENT 'Google/Apple订单ID',
  purchase_token TEXT COMMENT '购买token（用于验证）',
  amount DECIMAL(10,2) DEFAULT 0 COMMENT '金额（仅记录用，实际以商店为准）',
  status ENUM('pending', 'completed', 'failed', 'refunded') DEFAULT 'pending' COMMENT '状态：待处理/已完成/失败/已退款',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  
  -- 索引
  INDEX idx_user_id (user_id),
  INDEX idx_order_id (order_id),
  INDEX idx_status (status),
  INDEX idx_created_at (created_at),
  
  -- 唯一约束（防止重复订单）
  UNIQUE KEY uk_order_user (order_id, user_id)
  
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='支付交易记录表';

-- 插入测试数据示例（可选）
-- INSERT INTO payment_transactions (user_id, platform, product_id, order_id, purchase_token, status)
-- VALUES ('test_user_123', 'android', 'p0499', 'GPA.1234.5678.9012', 'test_token_abc123', 'completed');

-- 查询统计
SELECT 
  platform,
  product_id,
  COUNT(*) as total_orders,
  SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_orders
FROM payment_transactions
GROUP BY platform, product_id;
