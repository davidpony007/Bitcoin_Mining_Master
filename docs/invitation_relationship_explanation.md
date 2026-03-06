# invitation_relationship 表结构说明

## 📋 表字段详解

| 字段名 | 类型 | 说明 | 示例 |
|--------|------|------|------|
| **id** | int(11) | 主键,自增ID | 1, 2, 3... |
| **user_id** | varchar(15) | **被邀请人**的用户ID | "USER123" |
| **invitation_code** | varchar(11) | **被邀请人自己**的邀请码 | "ABC12345" |
| **referrer_user_id** | varchar(15) NULL | **推荐人**(邀请者)的用户ID | "USER001" 或 NULL |
| **referrer_invitation_code** | varchar(11) NULL | **推荐人**的邀请码 | "XYZ98765" 或 NULL |
| **invitation_creation_time** | timestamp | 邀请关系建立时间 | 2025-11-23 10:30:00 |

---

## 🔄 邀请关系逻辑

### 场景1: 用户A邀请用户B注册

```javascript
// 用户A的信息(已存在)
user_id: "USER001"
invitation_code: "XYZ98765"

// 用户B通过A的邀请码注册
用户B填写邀请码: "XYZ98765"

// 数据库记录(用户B的邀请关系)
{
  id: 1,
  user_id: "USER002",              // B的用户ID
  invitation_code: "ABC12345",     // B自己的邀请码(系统生成)
  referrer_user_id: "USER001",     // A的用户ID(推荐人)
  referrer_invitation_code: "XYZ98765",  // A的邀请码
  invitation_creation_time: "2025-11-23 10:30:00"
}
```

### 场景2: 用户C没有推荐人(直接注册)

```javascript
// 用户C直接注册,没有填写邀请码
{
  id: 2,
  user_id: "USER003",              // C的用户ID
  invitation_code: "DEF54321",     // C自己的邀请码
  referrer_user_id: NULL,          // 没有推荐人
  referrer_invitation_code: NULL,  // 没有推荐人邀请码
  invitation_creation_time: "2025-11-23 11:00:00"
}
```

### 场景3: 多级邀请链

```javascript
用户A -> 邀请 -> 用户B -> 邀请 -> 用户C

// 用户A的记录
{
  user_id: "USER001",
  invitation_code: "CODE_A",
  referrer_user_id: NULL,          // A是最顶层
  referrer_invitation_code: NULL
}

// 用户B的记录
{
  user_id: "USER002",
  invitation_code: "CODE_B",
  referrer_user_id: "USER001",     // B的上级是A
  referrer_invitation_code: "CODE_A"
}

// 用户C的记录
{
  user_id: "USER003",
  invitation_code: "CODE_C",
  referrer_user_id: "USER002",     // C的上级是B
  referrer_invitation_code: "CODE_B"
}
```

---

## 🔍 常用查询示例

### 1. 查询用户的推荐人信息
```javascript
// 查询用户B的推荐人
const relationship = await InvitationRelationship.findOne({
  where: { user_id: 'USER002' }
});

console.log(relationship.referrer_user_id);  // "USER001"
```

### 2. 查询用户邀请了多少人
```javascript
// 查询用户A邀请的所有人
const invitees = await InvitationRelationship.findAll({
  where: { referrer_user_id: 'USER001' }
});

console.log(`用户A邀请了 ${invitees.length} 人`);
```

### 3. 查询某邀请码对应的用户
```javascript
// 通过邀请码查找用户
const user = await InvitationRelationship.findOne({
  where: { invitation_code: 'XYZ98765' }
});

console.log(user.user_id);  // "USER001"
```

### 4. 查询没有推荐人的用户(直接注册)
```javascript
// 查询所有没有推荐人的用户
const directUsers = await InvitationRelationship.findAll({
  where: { referrer_user_id: null }
});
```

### 5. 统计用户的下级数量
```javascript
// 统计用户A的直属下级
const count = await InvitationRelationship.count({
  where: { referrer_user_id: 'USER001' }
});

console.log(`用户A有 ${count} 个直属下级`);
```

---

## 📊 业务场景

### 用户注册流程

```javascript
// 1. 用户填写注册信息 + 可选邀请码
const registerData = {
  user_id: 'NEW_USER_123',
  email: 'user@example.com',
  referral_code: 'XYZ98765'  // 可选
};

// 2. 生成新用户的邀请码
const newInvitationCode = generateInvitationCode(); // "ABC99999"

// 3. 如果填写了邀请码,查找推荐人
let referrerUserId = null;
let referrerInvitationCode = null;

if (registerData.referral_code) {
  const referrer = await InvitationRelationship.findOne({
    where: { invitation_code: registerData.referral_code }
  });
  
  if (referrer) {
    referrerUserId = referrer.user_id;
    referrerInvitationCode = referrer.invitation_code;
  }
}

// 4. 创建邀请关系记录
await InvitationRelationship.create({
  user_id: registerData.user_id,
  invitation_code: newInvitationCode,
  referrer_user_id: referrerUserId,
  referrer_invitation_code: referrerInvitationCode
});

// 5. 如果有推荐人,发放邀请奖励
if (referrerUserId) {
  await giveInvitationReward(referrerUserId, registerData.user_id);
}
```

### 邀请奖励发放

```javascript
// 当用户B通过A的邀请码注册后,给A发奖励
async function giveInvitationReward(referrerId, newUserId) {
  // 1. 记录到 invitation_rebate 表
  await InvitationRebate.create({
    user_id: referrerId,
    invited_user_id: newUserId,
    rebate_amount: 0.00001,  // 邀请奖励金额
    status: 'pending'
  });
  
  // 2. 更新推荐人的总邀请返利
  await UserStatus.increment('total_invitation_rebate', {
    by: 0.00001,
    where: { user_id: referrerId }
  });
}
```

---

## 🔗 关联关系

### 与 user_information 表的关联

```javascript
// 在 models/index.js 中添加关联
InvitationRelationship.belongsTo(UserInformation, {
  foreignKey: 'user_id',
  targetKey: 'user_id',
  as: 'user'
});

InvitationRelationship.belongsTo(UserInformation, {
  foreignKey: 'referrer_user_id',
  targetKey: 'user_id',
  as: 'referrer'
});

// 使用示例: 查询邀请关系并包含用户信息
const relationship = await InvitationRelationship.findOne({
  where: { user_id: 'USER002' },
  include: [
    { model: UserInformation, as: 'user' },      // 被邀请人信息
    { model: UserInformation, as: 'referrer' }   // 推荐人信息
  ]
});

console.log(relationship.user.email);      // 被邀请人邮箱
console.log(relationship.referrer.email);  // 推荐人邮箱
```

---

## ⚠️ 重要注意事项

### 1. 邀请码唯一性
```javascript
// invitation_code 必须唯一
// 建议使用 unique 索引防止重复
CREATE UNIQUE INDEX idx_invitation_code ON invitation_relationship(invitation_code);
```

### 2. user_id 唯一性
```javascript
// 每个用户只能有一条邀请关系记录
// 不能修改推荐人(防止刷邀请奖励)
CREATE UNIQUE INDEX idx_user_id ON invitation_relationship(user_id);
```

### 3. 防止循环邀请
```javascript
// 检查邀请码是否是自己的
if (inputInvitationCode === myInvitationCode) {
  throw new Error('不能使用自己的邀请码注册');
}

// 检查是否形成循环(A邀请B,B不能邀请A)
async function checkCircularInvitation(newUserId, referrerUserId) {
  let currentUser = referrerUserId;
  let depth = 0;
  const maxDepth = 10; // 防止无限循环
  
  while (currentUser && depth < maxDepth) {
    if (currentUser === newUserId) {
      throw new Error('检测到循环邀请关系');
    }
    
    const relation = await InvitationRelationship.findOne({
      where: { user_id: currentUser }
    });
    
    currentUser = relation?.referrer_user_id;
    depth++;
  }
}
```

### 4. referrer 字段可为 NULL
```javascript
// 处理没有推荐人的情况
const relationship = await InvitationRelationship.findOne({
  where: { user_id: 'USER001' }
});

if (relationship.referrer_user_id === null) {
  console.log('该用户没有推荐人(直接注册)');
}
```

---

## 📈 统计分析

### 邀请层级分析
```javascript
// 递归查询邀请层级树
async function getInvitationTree(userId, maxLevel = 3) {
  const tree = { user_id: userId, children: [] };
  
  if (maxLevel > 0) {
    const directInvitees = await InvitationRelationship.findAll({
      where: { referrer_user_id: userId }
    });
    
    for (const invitee of directInvitees) {
      const subTree = await getInvitationTree(invitee.user_id, maxLevel - 1);
      tree.children.push(subTree);
    }
  }
  
  return tree;
}

// 使用示例
const tree = await getInvitationTree('USER001', 3);
console.log(JSON.stringify(tree, null, 2));
```

### 邀请效果统计
```javascript
// 统计各用户的邀请效果
SELECT 
  referrer_user_id,
  COUNT(*) as total_invites,
  COUNT(CASE WHEN invitation_creation_time >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 1 END) as recent_invites
FROM invitation_relationship
WHERE referrer_user_id IS NOT NULL
GROUP BY referrer_user_id
ORDER BY total_invites DESC
LIMIT 10;
```

---

## 💡 数据库优化建议

### 当前索引配置 ✅
```sql
-- 已添加的索引
CREATE UNIQUE INDEX idx_user_id ON invitation_relationship(user_id);
CREATE UNIQUE INDEX idx_invitation_code ON invitation_relationship(invitation_code);
CREATE INDEX idx_referrer_user_id ON invitation_relationship(referrer_user_id);
CREATE INDEX idx_referrer_invitation_code ON invitation_relationship(referrer_invitation_code);
CREATE INDEX idx_invitation_creation_time ON invitation_relationship(invitation_creation_time);
```

### 可选外键约束
```sql
-- 确保 user_id 引用真实用户
ALTER TABLE invitation_relationship
ADD CONSTRAINT fk_invitee_user
FOREIGN KEY (user_id) REFERENCES user_information(user_id)
ON DELETE CASCADE;

-- 确保 referrer_user_id 引用真实用户
ALTER TABLE invitation_relationship
ADD CONSTRAINT fk_referrer_user
FOREIGN KEY (referrer_user_id) REFERENCES user_information(user_id)
ON DELETE SET NULL;  -- 如果推荐人被删除,设为NULL而不是删除记录
```

---

## 🎯 总结

**核心概念:**
- 每个用户有自己的 `invitation_code` (用于邀请别人)
- 每个用户有一个 `referrer_user_id` (自己的推荐人)
- `referrer` 字段可以为 NULL (直接注册的用户)
- 一个用户只能有一个推荐人(不能修改)
- 一个用户可以邀请无数人

**业务价值:**
- 追踪用户来源
- 计算邀请奖励
- 分析推广效果
- 构建用户关系网络
