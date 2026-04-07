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
  list: (params: { page?: number; limit?: number; search?: string; status?: string; system?: string; acquisition?: string; country?: string; level?: string; sortBy?: string; sortOrder?: string }) =>
    request.get('/admin/users/list', { params }),
  /** 用户统计概要 */
  stats: () => request.get('/admin/users/stats'),
  /** 国家列表（用于筛选） */
  countries: () => request.get('/admin/users/countries'),
  /** 用户完整画像详情 */
  detail: (userId: string) => request.get(`/admin/users/${userId}/detail`),
  /** 禁用用户 */
  ban: (userId: string, reason?: string) => request.put(`/admin/users/${userId}/ban`, { reason }),
  /** 解除禁用 */
  unban: (userId: string) => request.put(`/admin/users/${userId}/unban`, {}),
  /** 手动调整BTC余额 (amount正=增加,负=减少，以字符串传输避免浮点精度丢失) */
  adjustBtc: (userId: string, amount: string, reason: string) =>
    request.post(`/admin/users/${userId}/adjust-btc`, { amount, reason }),
  /** 获取比特币实时美元价格 */
  getBtcPrice: () => request.get('/admin/btc-price'),
  /** 删除单个用户（级联删除所有数据） */
  deleteUser: (userId: string) => request.delete(`/admin/users/${userId}`),
  /** 批量删除用户 */
  bulkDeleteUsers: (userIds: string[]) => request.post('/admin/users/bulk-delete', { userIds }),
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
  daily: (params: { startDate?: string; endDate?: string; platform?: string; days?: number } | number = 30) =>
    request.get('/admin/datacenter/daily', { params: typeof params === 'number' ? { days: params } : params }),
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
  /** 获取产品列表（管理端接口，含完整字段） */
  list: () => request.get('/admin/products'),
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

// ─── Rate Config ─────────────────────────────────────────────────────────────

export const rateConfigApi = {
  /** 获取基础速率 + 所有国家倍率 */
  getConfig: () => request.get('/admin/rate-config'),
  /** 更新基础挖矿速率 */
  updateBaseRate: (value: number) => request.put('/admin/rate-config/base-rate', { value }),
  /** 更新单个国家倍率 */
  updateCountry: (code: string, multiplier: number) =>
    request.put(`/admin/rate-config/country/${code}`, { multiplier }),
  /** 批量更新多个国家倍率 */
  batchUpdateCountries: (updates: { code: string; multiplier: number }[]) =>
    request.post('/admin/rate-config/country/batch', { updates }),
};

