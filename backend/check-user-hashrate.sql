-- 检查两个用户的真实挖矿速率
SELECT 
  user_id as '用户ID',
  free_contract_type as '合约类型',
  hashrate as 'Hashrate(BTC/s)',
  CASE 
    WHEN hashrate < 0.000000001 THEN CONCAT(FORMAT(hashrate * 1000000000000000, 2), ' Gh/s')
    ELSE CONCAT(FORMAT(hashrate, 18), ' BTC/s')
  END as '显示值',
  mining_status as '挖矿状态',
  free_contract_creation_time as '创建时间',
  free_contract_end_time as '结束时间',
  TIMESTAMPDIFF(SECOND, NOW(), free_contract_end_time) as '剩余秒数'
FROM free_contract_records 
WHERE user_id IN ('U2026020112215706221', 'U2026020112193721811')
  AND mining_status = 'mining'
ORDER BY user_id, free_contract_creation_time DESC;
