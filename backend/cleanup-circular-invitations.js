// 清理循环邀请关系的脚本
const database = require('./src/config/database');
const sequelize = database.sequelize || database;

async function cleanupCircularInvitations() {
  console.log('========================================');
  console.log('清理循环邀请关系');
  console.log('========================================\n');

  try {
    // 查询所有邀请关系
    const [relationships] = await sequelize.query(`
      SELECT 
        ir.id,
        ir.user_id,
        ir.referrer_user_id
      FROM invitation_relationship ir
      ORDER BY ir.id ASC
    `);

    console.log(`总共有 ${relationships.length} 条邀请关系\n`);

    // 检测循环关系
    const circularRelations = [];
    const userMap = new Map();
    
    relationships.forEach(rel => {
      if (!userMap.has(rel.user_id)) {
        userMap.set(rel.user_id, []);
      }
      userMap.get(rel.user_id).push({
        id: rel.id,
        referrer_user_id: rel.referrer_user_id
      });
    });

    // 找出循环关系
    for (const [userId, referrers] of userMap.entries()) {
      for (const referrerInfo of referrers) {
        // 检查referrer是否也被userId邀请了
        if (userMap.has(referrerInfo.referrer_user_id)) {
          const referrerReferrers = userMap.get(referrerInfo.referrer_user_id);
          for (const rr of referrerReferrers) {
            if (rr.referrer_user_id === userId) {
              circularRelations.push({
                relationId1: referrerInfo.id,
                userId1: userId,
                referrerId1: referrerInfo.referrer_user_id,
                relationId2: rr.id,
                userId2: referrerInfo.referrer_user_id,
                referrerId2: userId
              });
            }
          }
        }
      }
    }

    // 去重（每个循环会被检测两次）
    const uniqueCircularRelations = [];
    const seenPairs = new Set();
    
    for (const cr of circularRelations) {
      const key = [cr.userId1, cr.userId2].sort().join('-');
      if (!seenPairs.has(key)) {
        seenPairs.add(key);
        uniqueCircularRelations.push(cr);
      }
    }

    console.log(`发现 ${uniqueCircularRelations.length} 对循环邀请关系\n`);

    if (uniqueCircularRelations.length > 0) {
      console.log('循环关系详情：');
      uniqueCircularRelations.forEach((cr, index) => {
        console.log(`\n${index + 1}. 循环对:`);
        console.log(`   关系1 [ID:${cr.relationId1}]: ${cr.userId1} <- ${cr.referrerId1}`);
        console.log(`   关系2 [ID:${cr.relationId2}]: ${cr.userId2} <- ${cr.referrerId2}`);
      });

      console.log('\n========================================');
      console.log('清理策略：');
      console.log('========================================\n');
      console.log('对于每对循环关系，我们将：');
      console.log('1. 保留ID较小的关系（创建时间较早）');
      console.log('2. 删除ID较大的关系（创建时间较晚）');
      console.log('3. 删除相关的奖励合约\n');

      // 执行清理
      for (const cr of uniqueCircularRelations) {
        // 保留ID较小的关系，删除ID较大的
        const relationToDelete = cr.relationId1 > cr.relationId2 ? cr.relationId1 : cr.relationId2;
        const userToClean = cr.relationId1 > cr.relationId2 ? cr.userId1 : cr.userId2;

        console.log(`删除关系 [ID:${relationToDelete}] ${userToClean} 的推荐人绑定...`);

        // 删除邀请关系
        const [deleteResult] = await sequelize.query(
          `DELETE FROM invitation_relationship WHERE id = ?`,
          { replacements: [relationToDelete] }
        );

        console.log(`  ✓ 已删除邀请关系`);

        // 删除相关的Bind Referrer Reward合约
        const [deleteContractResult] = await sequelize.query(
          `DELETE FROM free_contract_records WHERE user_id = ? AND free_contract_type = 'Bind Referrer Reward'`,
          { replacements: [userToClean] }
        );

        console.log(`  ✓ 已删除 ${deleteContractResult.affectedRows || 0} 个Bind Referrer Reward合约\n`);
      }

      console.log('========================================');
      console.log('清理完成！');
      console.log('========================================\n');

      // 验证清理结果
      const [remainingRelations] = await sequelize.query(`
        SELECT COUNT(*) as count FROM invitation_relationship
      `);

      console.log(`剩余邀请关系: ${remainingRelations[0].count} 条`);

    } else {
      console.log('✅ 没有发现循环邀请关系！');
    }

  } catch (error) {
    console.error('错误:', error);
  } finally {
    await sequelize.close();
  }
}

// 执行清理
cleanupCircularInvitations();
