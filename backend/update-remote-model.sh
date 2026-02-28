#!/bin/bash
# 更新远程服务器的 Sequelize 模型并重启服务

echo "🚀 开始更新远程服务器..."

# 1. 创建更新后的模型文件
cat > /tmp/freeContractRecord.js << 'EOF'
// free_contract_records 表的 Sequelize 模型
// 用于存储用户的免费合约记录(广告、签到等)
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const FreeContractRecord = sequelize.define('free_contract_records', {
  id: { 
    type: DataTypes.INTEGER, 
    primaryKey: true, 
    autoIncrement: true,
    comment: '免费合约记录主键ID'
  },
  user_id: { 
    type: DataTypes.STRING(30), 
    allowNull: false,
    references: {
      model: 'user_information',
      key: 'user_id'
    },
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE',
    comment: '用户唯一标识符'
  },
  free_contract_type: { 
    type: DataTypes.ENUM(
      'Free Ad Reward',
      'Daily Check-in Reward',
      'Invite Friend Reward',
      'Bind Referrer Reward'
    ),
    allowNull: true,
    comment: '免费合约类型: 广告免费合约/每日签到/邀请奖励/绑定推荐人'
  },
  free_contract_revenue: { 
    type: DataTypes.DECIMAL(18, 18), 
    allowNull: true,
    defaultValue: 0,
    comment: '合约总收益(BTC)'
  },
  free_contract_creation_time: { 
    type: DataTypes.DATE, 
    allowNull: false,
    defaultValue: DataTypes.NOW,
    comment: '合约创建时间'
  },
  free_contract_end_time: { 
    type: DataTypes.DATE, 
    allowNull: false,
    defaultValue: DataTypes.NOW,
    comment: '合约结束时间'
  },
  hashrate: { 
    type: DataTypes.DECIMAL(18, 18), 
    allowNull: true,
    comment: '算力(hashrate)'
  },
  base_hashrate: { 
    type: DataTypes.DECIMAL(18, 18), 
    allowNull: true,
    defaultValue: 0.000000000000139,
    comment: '纯基础算力(不含任何倍数)'
  },
  has_daily_bonus: { 
    type: DataTypes.BOOLEAN, 
    allowNull: true,
    defaultValue: false,
    comment: '是否包含签到加成(1.36倍)'
  },
  mining_status: { 
    type: DataTypes.ENUM('completed', 'mining', 'error'),
    allowNull: true,
    comment: '挖矿状态'
  }
}, {
  timestamps: false,
  freezeTableName: true,
  indexes: [
    {
      fields: ['user_id'],
      name: 'idx_user_id'
    },
    {
      fields: ['free_contract_type'],
      name: 'idx_free_contract_type'
    },
    {
      fields: ['free_contract_creation_time'],
      name: 'idx_free_contract_creation_time'
    },
    {
      fields: ['free_contract_end_time', 'user_id'],
      name: 'idx_active_contracts'
    }
  ],
  comment: '免费合约记录表'
});

module.exports = FreeContractRecord;
EOF

echo "✅ 模型文件已创建"

# 2. 备份远程文件
echo "📦 备份远程文件..."
ssh root@47.79.232.189 "cp /root/bitcoin-backend/src/models/freeContractRecord.js /root/bitcoin-backend/src/models/freeContractRecord.js.backup.$(date +%Y%m%d_%H%M%S)"

# 3. 上传新文件
echo "⬆️  上传新模型文件..."
scp /tmp/freeContractRecord.js root@47.79.232.189:/root/bitcoin-backend/src/models/freeContractRecord.js

# 4. 重启远程服务
echo "🔄 重启远程服务..."
ssh root@47.79.232.189 "cd /root/bitcoin-backend && pm2 restart bitcoin-backend"

sleep 5

# 5. 验证服务
echo "🔍 验证服务状态..."
ssh root@47.79.232.189 "pm2 status bitcoin-backend"

echo ""
echo "✅ 远程服务器更新完成！"
echo ""

# 6. 测试API
echo "🧪 测试 API..."
sleep 3

echo "测试广告挖矿 API:"
curl -s -X POST "http://47.79.232.189/api/mining-pool/extend-contract" \
  -H "Content-Type: application/json" \
  -d '{"user_id":"TEST_REMOTE_001","hours":2}' | jq '.' 2>/dev/null || curl -s -X POST "http://47.79.232.189/api/mining-pool/extend-contract" -H "Content-Type: application/json" -d '{"user_id":"TEST_REMOTE_001","hours":2}'

echo ""
echo ""
echo "测试签到 API:"
curl -s -X POST "http://47.79.232.189/api/mining-contracts/checkin" \
  -H "Content-Type: application/json" \
  -d '{"user_id":"TEST_REMOTE_001"}' | jq '.' 2>/dev/null || curl -s -X POST "http://47.79.232.189/api/mining-contracts/checkin" -H "Content-Type: application/json" -d '{"user_id":"TEST_REMOTE_001"}'

echo ""
echo "🎉 完成！"
