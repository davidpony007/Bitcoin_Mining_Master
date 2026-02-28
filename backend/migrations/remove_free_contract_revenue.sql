-- 删除 free_contract_revenue 字段
-- 该字段在当前系统中固定为 0，不参与任何计算，可以安全删除

-- 执行前备份（可选）
-- CREATE TABLE free_contract_records_backup AS SELECT * FROM free_contract_records;

-- 删除字段
ALTER TABLE free_contract_records 
DROP COLUMN free_contract_revenue;

-- 验证字段已删除
DESCRIBE free_contract_records;
