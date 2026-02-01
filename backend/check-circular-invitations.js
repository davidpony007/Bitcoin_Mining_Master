// 检查循环邀请关系的脚本
const database = require('./src/config/database');
const sequelize = database.sequelize || database;

async function checkCircularInvitations() {
  console.log('========================================');
  console.log('检查循环邀请关系');
  console.log('========================================\n');

  try {
    // 查询所有邀请关系
    const [relationships] = await sequelize.query(`
      SELECT 
        ir.id,
        ir.user_id,
        u1.nickname as user_nickname,
        ir.referrer_user_id,
        u2.nickname as referrer_nickname
      FROM invitation_relationship ir
      LEFT JOIN user_information u1 ON ir.user_id = u1.user_id
      LEFT JOIN user_information u2 ON ir.referrer_user_id = u2.user_id
      ORDER BY ir.id DESC
      LIMIT 10
    `);

    console.log('最近10条邀请关系：\n');
    relationships.forEach((rel, index) => {
      console.log(`${index + 1}. [ID:${rel.id}] ${rel.user_nickname || rel.user_id} <- 被邀请 <- ${rel.referrer_nickname || rel.referrer_user_id}`);
    });

    // 检测循环关系
    console.log('\n========================================');
    console.log('检测循环关系：');
    console.log('========================================\n');

    const userMap = new Map();
    relationships.forEach(rel => {
      if (!userMap.has(rel.user_id)) {
        userMap.set(rel.user_id, []);
      }
      userMap.get(rel.user_id).push(rel.referrer_user_id);
    });

    // 检查是否有用户既是A的推荐人，A又是他的推荐人
    for (const [userId, referrers] of userMap.entries()) {
      for (const referrerId of referrers) {
        // 检查referrer是否也被userId邀请了
        if (userMap.has(referrerId) && userMap.get(referrerId).includes(userId)) {
          console.log(`⚠️  发现循环邀请：`);
          console.log(`   ${userId} 被 ${referrerId} 邀请`);
          console.log(`   同时 ${referrerId} 被 ${userId} 邀请`);
          console.log(`   这是一个循环关系！\n`);
        }
      }
    }

    // 测试验证服务
    console.log('========================================');
    console.log('测试邀请关系验证服务：');
    console.log('========================================\n');

    if (relationships.length >= 2) {
      const userA = relationships[0];
      const userB = relationships[1];

      console.log(`测试场景：`);
      console.log(`用户A: ${userA.user_id}`);
      console.log(`用户B: ${userB.user_id}\n`);

      // 导入验证服务
      const InvitationValidationService = require('./src/services/invitationValidationService');

      // 获取用户A的邀请码
      const [userAInfo] = await sequelize.query(`
        SELECT invitation_code FROM user_information WHERE user_id = ?
      `, {
        replacements: [userA.user_id]
      });

      if (userAInfo.length > 0) {
        const invitationCode = userAInfo[0].invitation_code;
        console.log(`用户A的邀请码: ${invitationCode}`);

        // 测试用户B是否可以使用用户A的邀请码
        console.log(`\n测试：用户B使用用户A的邀请码...`);
        const result = await InvitationValidationService.validateInvitationRelationship(
          userB.user_id,
          invitationCode
        );

        console.log(`验证结果:`);
        console.log(`  有效: ${result.valid}`);
        if (!result.valid) {
          console.log(`  错误: ${result.error}`);
          console.log(`  错误代码: ${result.errorCode}`);
        }

        // 获取邀请链路
        console.log(`\n获取用户B的邀请链路:`);
        const chain = await InvitationValidationService.getInvitationChain(userB.user_id);
        
        if (chain) {
          console.log(`  上级链长度: ${chain.upline.length}`);
          console.log(`  下级链长度: ${chain.downline.length}`);
          
          if (chain.upline.length > 0) {
            console.log(`  上级: ${chain.upline.map(u => u.user_id).join(' <- ')}`);
          }
          if (chain.downline.length > 0) {
            console.log(`  下级: ${chain.downline.map(u => u.user_id).join(' -> ')}`);
          }
        } else {
          console.log('  无法获取邀请链路');
        }
      }
    }

  } catch (error) {
    console.error('错误:', error);
  } finally {
    await sequelize.close();
  }
}

checkCircularInvitations();
