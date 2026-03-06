#!/usr/bin/env node
/**
 * 系统服务状态检查脚本
 * 检查Redis、MySQL、PM2服务状态
 */

require('dotenv').config();
const Redis = require('ioredis');
const mysql = require('mysql2/promise');
const { execSync } = require('child_process');

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m',
};

async function checkRedis() {
  console.log(`\n${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  console.log(`${colors.blue}📦 Redis 连接检查${colors.reset}`);
  console.log(`${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  
  try {
    const redis = new Redis({
      host: process.env.REDIS_HOST || '127.0.0.1',
      port: process.env.REDIS_PORT || 16379,
      password: process.env.REDIS_PASSWORD,
      lazyConnect: true,
      retryStrategy: () => null,
    });

    await redis.connect();
    const pong = await redis.ping();
    
    const info = await redis.info('stats');
    const totalConnections = info.match(/total_connections_received:(\d+)/)?.[1] || 'N/A';
    const totalCommands = info.match(/total_commands_processed:(\d+)/)?.[1] || 'N/A';
    
    console.log(`${colors.green}✅ Redis 连接成功${colors.reset}`);
    console.log(`   主机: ${process.env.REDIS_HOST || '127.0.0.1'}:${process.env.REDIS_PORT || 16379}`);
    console.log(`   响应: ${pong}`);
    console.log(`   总连接数: ${totalConnections}`);
    console.log(`   总命令数: ${totalCommands}`);
    
    await redis.quit();
    return true;
  } catch (error) {
    console.log(`${colors.red}❌ Redis 连接失败${colors.reset}`);
    console.log(`   错误: ${error.message}`);
    return false;
  }
}

async function checkMySQL() {
  console.log(`\n${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  console.log(`${colors.blue}🗄️  MySQL 连接检查${colors.reset}`);
  console.log(`${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      connectTimeout: 10000,
    });

    console.log(`${colors.green}✅ MySQL 连接成功${colors.reset}`);
    console.log(`   主机: ${process.env.DB_HOST}:${process.env.DB_PORT || 3306}`);
    console.log(`   数据库: ${process.env.DB_NAME}`);
    console.log(`   用户: ${process.env.DB_USER}`);

    // 检查关键表
    const tables = [
      'user_information',
      'user_status',
      'free_contract_records',
      'mining_contracts',
    ];

    console.log(`\n   表统计:`);
    for (const table of tables) {
      try {
        const [rows] = await connection.execute(`SELECT COUNT(*) as count FROM ${table}`);
        console.log(`   - ${table}: ${rows[0].count} 条记录`);
      } catch (err) {
        console.log(`   - ${table}: ${colors.yellow}查询失败${colors.reset}`);
      }
    }

    await connection.end();
    return true;
  } catch (error) {
    console.log(`${colors.red}❌ MySQL 连接失败${colors.reset}`);
    console.log(`   错误: ${error.message}`);
    return false;
  }
}

function checkPM2() {
  console.log(`\n${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  console.log(`${colors.blue}⚙️  PM2 进程状态${colors.reset}`);
  console.log(`${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  
  try {
    const output = execSync('pm2 jlist', { encoding: 'utf8' });
    const processes = JSON.parse(output);
    
    if (processes.length === 0) {
      console.log(`${colors.yellow}⚠️  没有运行的PM2进程${colors.reset}`);
      return false;
    }

    processes.forEach((proc) => {
      const status = proc.pm2_env.status === 'online' 
        ? `${colors.green}online${colors.reset}` 
        : `${colors.red}${proc.pm2_env.status}${colors.reset}`;
      
      console.log(`\n   ${proc.name} (${proc.pm_id})`);
      console.log(`   状态: ${status}`);
      console.log(`   重启次数: ${proc.pm2_env.restart_time}`);
      console.log(`   内存: ${(proc.monit.memory / 1024 / 1024).toFixed(2)} MB`);
      console.log(`   CPU: ${proc.monit.cpu}%`);
      console.log(`   运行模式: ${proc.pm2_env.exec_mode}`);
    });

    return true;
  } catch (error) {
    console.log(`${colors.red}❌ PM2 检查失败${colors.reset}`);
    console.log(`   错误: ${error.message}`);
    return false;
  }
}

async function main() {
  console.log(`${colors.blue}╔════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.blue}║   Bitcoin Mining Master 服务状态检查   ║${colors.reset}`);
  console.log(`${colors.blue}╚════════════════════════════════════════╝${colors.reset}`);
  console.log(`时间: ${new Date().toLocaleString('zh-CN')}`);

  const redisOk = await checkRedis();
  const mysqlOk = await checkMySQL();
  const pm2Ok = checkPM2();

  console.log(`\n${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  console.log(`${colors.blue}📊 总结${colors.reset}`);
  console.log(`${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  console.log(`Redis:  ${redisOk ? `${colors.green}✅ 正常${colors.reset}` : `${colors.red}❌ 异常${colors.reset}`}`);
  console.log(`MySQL:  ${mysqlOk ? `${colors.green}✅ 正常${colors.reset}` : `${colors.red}❌ 异常${colors.reset}`}`);
  console.log(`PM2:    ${pm2Ok ? `${colors.green}✅ 正常${colors.reset}` : `${colors.red}❌ 异常${colors.reset}`}`);
  
  const allOk = redisOk && mysqlOk && pm2Ok;
  console.log(`\n${allOk ? `${colors.green}🎉 所有服务运行正常！${colors.reset}` : `${colors.yellow}⚠️  部分服务异常，请检查${colors.reset}`}\n`);
  
  process.exit(allOk ? 0 : 1);
}

main().catch(console.error);
