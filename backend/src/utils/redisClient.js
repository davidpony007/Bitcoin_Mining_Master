// redisClient.js
// 模块职责：
// - 以 ioredis 初始化并导出 Redis 客户端单例，供项目内所有模块复用
// - 优先支持 REDIS_URL（如 redis://user:pass@host:port/db），否则走分散参数（HOST/PORT/DB/PASSWORD/TLS）
// - 通过 keyPrefix 统一 Redis 命名空间，避免不同环境/项目间键冲突
//
// 重要说明：
// - ioredis 自带自动重连；commonOptions 的 retryStrategy 控制退避曲线
// - maxRetriesPerRequest 限制单条命令的重试次数，避免连接抖动导致请求长时间挂起
// - enableReadyCheck 会等待 Redis “ready” 后再放行命令，主从切换/集群模式更安全
// - keyPrefix 仅对“以键为参数”的命令生效；Lua 脚本里的 KEYS 不会自动加前缀，需要手动拼接
//
// 环境变量建议（.env 示例）：
//   # 方式一（推荐）
//   REDIS_URL=redis://user:pass@host:6379/0
//   # 方式二（分散参数）
//   REDIS_HOST=127.0.0.1
//   REDIS_PORT=6379
//   REDIS_DB=0
//   REDIS_PASSWORD=
//   REDIS_TLS=false           # 云厂商托管 Redis 常需 true
//   REDIS_KEY_PREFIX=bmm:     # 项目统一前缀，便于区分环境与清理

const Redis = require('ioredis');

const {
	REDIS_URL,
	REDIS_HOST = '127.0.0.1',
	REDIS_PORT = '6379',
	REDIS_DB = '0',
	REDIS_PASSWORD,
	REDIS_TLS, // 'true' 开启基本 TLS（多数云厂商需要）
	REDIS_KEY_PREFIX = 'bmm:' // Bitcoin Mining Master 统一前缀
} = process.env;

// 通用连接选项（URL/分散参数共用）
// 优化后的配置：增强连接稳定性和容错能力
const commonOptions = {
	keyPrefix: REDIS_KEY_PREFIX,
	lazyConnect: false, // 立即连接；若需按需再连可设 true
	maxRetriesPerRequest: 3, // 限制请求级重试，防止阻塞
	connectTimeout: 15000, // 连接超时15秒（云服务器网络延迟较高）
	commandTimeout: 10000, // 单个命令超时10秒
	enableReadyCheck: true,
	enableOfflineQueue: true, // 断线时缓存命令，重连后执行
	keepAlive: 30000, // TCP Keep-Alive 30秒，防止长时间空闲断开
	family: 4, // 强制使用 IPv4，避免 IPv6 解析问题
	reconnectOnError(err) {
		// 遇到特定错误时主动重连
		const targetErrors = ['READONLY', 'ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND'];
		if (targetErrors.some(e => err.message.includes(e))) {
			return true; // 触发重连
		}
		return false;
	},
	retryStrategy(times) {
		// 指数退避，最多重试20次，最大延迟5秒
		if (times > 20) {
			console.error('[Redis] 重试次数超过20次，停止重连');
			return null; // 停止重试
		}
		const delay = Math.min(times * 100, 5000);
		console.log(`[Redis] 第${times}次重试，延迟${delay}ms`);
		return delay;
	}
};

// 构造客户端：优先 URL；否则使用分散参数
let redis;
if (REDIS_URL) {
	redis = new Redis(REDIS_URL, commonOptions);
} else {
	const numericPort = Number(REDIS_PORT) || 6379;
	const numericDb = Number(REDIS_DB) || 0;
	const base = {
		host: REDIS_HOST,
		port: numericPort,
		db: numericDb,
		password: REDIS_PASSWORD || undefined
	};
	// 可选 TLS（值为 'true' 时启用最小 TLS 配置）
	if ((REDIS_TLS || '').toLowerCase() === 'true') {
		base.tls = {};
	}
	redis = new Redis({ ...base, ...commonOptions });
}

// 事件：便于运维观测/接入告警
// connected：TCP/握手阶段建立
redis.on('connect', () => {
	const timestamp = new Date().toISOString();
	console.log(`${timestamp}: [Redis] ✅ connected to ${REDIS_HOST || 'server'}:${REDIS_PORT}`);
});

// ready：鉴权/角色确认完成，可正常处理命令
redis.on('ready', () => {
	const timestamp = new Date().toISOString();
	console.log(`${timestamp}: [Redis] ✅ ready - 可以正常处理命令`);
});

// error：连接错误/鉴权失败/命令错误等
redis.on('error', (err) => {
	const timestamp = new Date().toISOString();
	// 只记录错误消息，不打印整个堆栈（减少日志噪音）
	console.error(`${timestamp}: [Redis] ❌ error: ${err?.message || err}`);
	// 如果是认证错误，额外提示
	if (err?.message?.includes('NOAUTH') || err?.message?.includes('invalid password')) {
		console.error(`${timestamp}: [Redis] ⚠️  请检查 REDIS_PASSWORD 是否正确`);
	}
});

// reconnecting：断线后的重连尝试中
redis.on('reconnecting', (delay) => {
	const timestamp = new Date().toISOString();
	console.warn(`${timestamp}: [Redis] 🔄 reconnecting... (延迟: ${delay}ms)`);
});

// close：连接正常关闭
redis.on('close', () => {
	const timestamp = new Date().toISOString();
	console.log(`${timestamp}: [Redis] 🔌 connection closed`);
});

// end：连接强制结束（quit/disconnect）
redis.on('end', () => {
	const timestamp = new Date().toISOString();
	console.log(`${timestamp}: [Redis] 🛑 connection ended`);
});

// 添加健康检查函数
redis.healthCheck = async () => {
	try {
		const result = await redis.ping();
		return result === 'PONG';
	} catch (err) {
		console.error('[Redis] Health check failed:', err.message);
		return false;
	}
};

// 优雅关闭处理
process.on('SIGTERM', async () => {
	console.log('[Redis] 收到 SIGTERM，正在关闭连接...');
	await redis.quit();
});

process.on('SIGINT', async () => {
	console.log('[Redis] 收到 SIGINT，正在关闭连接...');
	await redis.quit();
});

module.exports = redis;
