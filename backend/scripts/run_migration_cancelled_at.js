const mysql = require('mysql2/promise');

(async () => {
  const conn = await mysql.createConnection({
    host: '47.79.232.189',
    user: 'root',
    password: 'Bitcoin_MySQL_Root_2026!Secure',
    database: 'bitcoin_mining_master'
  });

  // 检查字段是否已存在
  const [cols] = await conn.query("SHOW COLUMNS FROM mining_contracts LIKE 'cancelled_at'");
  if (cols.length > 0) {
    console.log('字段 cancelled_at 已存在，跳过 ALTER TABLE');
  } else {
    await conn.query(`ALTER TABLE mining_contracts
      ADD COLUMN \`cancelled_at\` DATETIME DEFAULT NULL
        COMMENT '合约取消时间，is_cancelled 设为 1 时写入，用于按日统计取消订阅数'
      AFTER \`is_cancelled\``);
    console.log('✅ cancelled_at 字段添加成功');
  }

  // 回填历史数据
  const [upd] = await conn.query(
    'UPDATE mining_contracts SET cancelled_at = contract_end_time WHERE is_cancelled = 1 AND cancelled_at IS NULL'
  );
  console.log('✅ 历史数据回填完成，影响行数:', upd.affectedRows);

  // 验证
  const [[row]] = await conn.query('SELECT COUNT(*) AS cnt FROM mining_contracts WHERE is_cancelled = 1 AND cancelled_at IS NOT NULL');
  console.log('✅ 已取消且有 cancelled_at 的记录数:', row.cnt);

  await conn.end();
  process.exit(0);
})().catch(e => {
  console.error('❌ 错误:', e.message);
  process.exit(1);
});
