#!/bin/bash
# 部署free_contract_type枚举值修改

echo "=== 开始部署 free_contract_type 枚举值修改 ==="

# 1. 上传修改的文件
echo "1. 上传修改的服务文件..."
scp src/services/adMiningContractService.js root@47.79.232.189:/root/bitcoin-docker/backend/src/services/
scp src/services/checkInMiningContractService.js root@47.79.232.189:/root/bitcoin-docker/backend/src/services/
scp src/services/invitationMiningContractService.js root@47.79.232.189:/root/bitcoin-docker/backend/src/services/
scp src/services/refereeMiningContractService.js root@47.79.232.189:/root/bitcoin-docker/backend/src/services/
scp src/services/contractRewardService.js root@47.79.232.189:/root/bitcoin-docker/backend/src/services/

echo "2. 上传修改的路由文件..."
scp src/routes/contractStatusRoutes.js root@47.79.232.189:/root/bitcoin-docker/backend/src/routes/
scp src/routes/miningPoolRoutes.js root@47.79.232.189:/root/bitcoin-docker/backend/src/routes/

echo "3. 上传其他文件..."
scp cleanup-circular-invitations.js root@47.79.232.189:/root/bitcoin-docker/backend/
scp update-free-contract-type-enum.sql root@47.79.232.189:/tmp/

# 2. 执行数据库更新
echo ""
echo "4. 执行数据库更新..."
ssh root@47.79.232.189 << 'ENDSSH'
echo "  - 更新 ad free contract -> Free Ad Reward"
docker exec bitcoin_mysql_prod mysql -u root -p123456 bitcoin_mining -e "UPDATE free_contract_records SET free_contract_type = 'Free Ad Reward' WHERE free_contract_type = 'ad free contract';"

echo "  - 更新 daily sign-in free contract -> Daily Check-in Reward"
docker exec bitcoin_mysql_prod mysql -u root -p123456 bitcoin_mining -e "UPDATE free_contract_records SET free_contract_type = 'Daily Check-in Reward' WHERE free_contract_type = 'daily sign-in free contract';"

echo "  - 更新 invitation free contract -> Invite Friend Reward"
docker exec bitcoin_mysql_prod mysql -u root -p123456 bitcoin_mining -e "UPDATE free_contract_records SET free_contract_type = 'Invite Friend Reward' WHERE free_contract_type = 'invitation free contract';"

echo "  - 更新 bind referrer free contract -> Bind Referrer Reward"
docker exec bitcoin_mysql_prod mysql -u root -p123456 bitcoin_mining -e "UPDATE free_contract_records SET free_contract_type = 'Bind Referrer Reward' WHERE free_contract_type = 'bind referrer free contract';"

echo "  - 修改表结构ENUM定义"
docker exec bitcoin_mysql_prod mysql -u root -p123456 bitcoin_mining -e "ALTER TABLE free_contract_records MODIFY COLUMN free_contract_type ENUM('Free Ad Reward', 'Daily Check-in Reward', 'Invite Friend Reward', 'Bind Referrer Reward') NOT NULL COMMENT '免费合约类型';"

echo "  - 验证修改结果"
docker exec bitcoin_mysql_prod mysql -u root -p123456 bitcoin_mining -e "SELECT free_contract_type, COUNT(*) as count FROM free_contract_records GROUP BY free_contract_type;"

ENDSSH

# 3. 重启后端服务
echo ""
echo "5. 重启后端服务..."
ssh root@47.79.232.189 "cd /root/bitcoin-docker && docker compose -f docker-compose.prod.yml restart backend"

echo ""
echo "=== 部署完成 ==="
echo "请检查后端日志确认服务正常运行"
