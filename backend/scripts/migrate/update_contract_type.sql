ALTER TABLE free_contract_records 
MODIFY COLUMN free_contract_type ENUM(
  'ad free contract',
  'daily sign-in free contract', 
  'invitation free contract',
  'bind referrer free contract'
) DEFAULT NULL;
