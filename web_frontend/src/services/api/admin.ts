/**
 * 管理后台统一 API 服务
 * 所有模块均通过 /admin/* 端点获取真实数据库数据
 */
import request from './request';

// ─── Dashboard ───────────────────────────────────────────────────────────────

export const dashboardApi = {
  /** 仪表盘概要统计 */
  stats: () => request.get('/admin/dashboard/stats'),
  /** 趋势数据（最近 N 天） */
  trend: (days = 7) => request.get('/admin/dashboard/trend', { params: { days } }),
};

// ─── Users ────────────────────────────────────────────────────────────────────

export const usersApi = {
  /** 分页用户列表 */
  list: (params: { page?: number; limit?: number; search?: string; status?: string; system?: string; acquisition?: string }) =>
    request.get('/admin/users/list', { params }),
  /** 用户统计概要 */
  stats: () => request.get('/admin/users/stats'),
  /** 用户完整画像详情 */
  detail: (userId: string) => request.get(`/admin/users/${userId}/detail`),
  /** 禁用用户 */
  ban: (userId: string, reason?: string) => request.put(`/admin/users/${userId}/ban`, { reason }),
  /** 解除禁用 */
  unban: (userId: string) => request.put(`/admin/users/${userId}/unban`, {}),
  /** 手动调整BTC余额 (amount正=增加,负=减少) */
  adjustBtc: (userId: string, amount: number, reason: string) =>
    request.post(`/admin/users/${userId}/adjust-btc`, { amount, reason }),
};

// ─── Orders ───────────────────────────────────────────────────────────────────

export const ordersApi = {
  /** 分页订单列表 */
  list: (params: { page?: number; limit?: number; uid?: string; search?: string; status?: string; platform?: string; startDate?: string; endDate?: string }) =>
    request.get('/admin/orders/list', { params }),
  /** 订单统计概要 */
  stats: () => request.get('/admin/orders/stats'),
  /** 删除单条订单 */
  deleteOne: (id: number) => request.delete(`/admin/orders/${id}`),
  /** 批量删除订单 */
  bulkDelete: (ids: number[]) => request.post('/admin/orders/bulk-delete', { ids }),
  /** 手动新增订单 */
  add: (data: any) => request.post('/admin/orders/add', data),
};

// ─── Mining ───────────────────────────────────────────────────────────────────

export const miningApi = {
  /** 分页挖矿合约列表 */
  list: (params: { page?: number; limit?: number; search?: string; type?: string }) =>
    request.get('/admin/mining/list', { params }),
  /** 挖矿统计概要 */
  stats: () => request.get('/admin/mining/stats'),
};

// ─── Points ───────────────────────────────────────────────────────────────────

export const pointsApi = {
  /** 积分排行榜 */
  leaderboard: (params: { page?: number; limit?: number; search?: string }) =>
    request.get('/admin/points/leaderboard', { params }),
  /** 积分交易记录 */
  transactions: (params: { page?: number; limit?: number; userId?: string; type?: string }) =>
    request.get('/admin/points/transactions', { params }),
  /** 积分整体统计 */
  stats: () => request.get('/admin/points/stats'),
};

// ─── CheckIn ──────────────────────────────────────────────────────────────────

export const checkinApi = {
  /** 用户签到汇总列表 */
  list: (params: { page?: number; limit?: number; search?: string }) =>
    request.get('/admin/checkin/list', { params }),
  /** 签到整体统计 */
  stats: () => request.get('/admin/checkin/stats'),
};

// ─── Geography ────────────────────────────────────────────────────────────────

export const geographyApi = {
  /** 按国家分布数据 */
  data: () => request.get('/admin/geography/data'),
};

// ─── Analytics ────────────────────────────────────────────────────────────────

export const analyticsApi = {
  /** 多维趋势数据 */
  trend: (days = 30) => request.get('/admin/analytics/trend', { params: { days } }),
  /** 国家排名 */
  countryRank: () => request.get('/admin/analytics/country-rank'),
};

// ─── Ads ──────────────────────────────────────────────────────────────────────

export const adsApi = {
  /** 广告整体统计 */
  stats: () => request.get('/admin/ads/stats'),
  /** 广告趋势数据 */
  trend: (days = 30) => request.get('/admin/ads/trend', { params: { days } }),
  /** 广告观看 Top 用户 */
  topUsers: (limit = 20) => request.get('/admin/ads/top-users', { params: { limit } }),
};

// ─── DataCenter ───────────────────────────────────────────────────────────────

export const dataCenterApi = {
  /** 每日综合业务数据（旧版） */
  daily: (days = 30) => request.get('/admin/datacenter/daily', { params: { days } }),
  /** 完整每日业务报表 */
  dailyReport: (startDate: string, endDate: string, platform = 'Android') =>
    request.get('/admin/datacenter/daily-report', { params: { startDate, endDate, platform } }),
  /** 添加广告消耗 */
  addAdSpend: (data: any) => request.post('/admin/datacenter/ad-spend', data),
  /** 添加广告数据（M1/M2/M3 等） */
  addAdData: (data: any) => request.post('/admin/datacenter/ad-data', data),
};

// ─── Reports ──────────────────────────────────────────────────────────────────

export const reportsApi = {
  /** 报表概要统计 */
  summary: () => request.get('/admin/reports/summary'),
};

// ─── Bitcoin Transactions (Admin) ─────────────────────────────────────────────

export const bitcoinTxApi = {
  /** 比特币交易记录（无3天限制，支持日期范围） */
  list: (params: { page?: number; limit?: number; userId?: string; type?: string; startDate?: string; endDate?: string }) =>
    request.get('/admin/bitcoin-transactions', { params }),
  /** 邀请返利记录（无3天限制，支持日期范围） */
  rebateList: (params: { page?: number; limit?: number; userId?: string; startDate?: string; endDate?: string }) =>
    request.get('/admin/invitation-rebate', { params }),
};

// ─── Paid Products ────────────────────────────────────────────────────────────

export const paidProductsApi = {
  /** 获取产品列表（公开接口） */
  list: () => request.get('/paid-contracts/products'),
  /** 更新产品字段（管理员接口） */
  update: (id: number, data: Partial<{
    display_name: string;
    description: string;
    ios_product_id: string;
    android_product_id: string;
    hashrate_raw: number;
    duration_days: number;
    sort_order: number;
    is_active: number;
  }>) => request.put(`/admin/paid-products/${id}`, data),
};

