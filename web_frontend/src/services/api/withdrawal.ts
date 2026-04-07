import { request } from './request';

export interface AdminListParams {
  status?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export const withdrawalAPI = {
  /** 管理员获取全部提现记录（含筛选） */
  adminList: (params?: AdminListParams) =>
    request.get('/withdrawal/admin/list', { params }),

  /** 管理员同意提现 */
  approve: (id: number) =>
    request.put(`/withdrawal/approve/${id}`, {}),

  /** 管理员拒绝提现 */
  reject: (id: number, body?: { reason?: string }) =>
    request.put(`/withdrawal/reject/${id}`, body ?? {}),

  /** 查看单条提现详情 */
  detail: (id: number) =>
    request.get(`/withdrawal/${id}`),

  /** 获取提现统计汇总 */
  stats: () =>
    request.get('/withdrawal/admin/stats'),

  /** 批量同意提现 */
  bulkApprove: (ids: number[]) =>
    request.post('/withdrawal/admin/bulk-approve', { ids }),

  /** 批量拒绝提现 */
  bulkReject: (ids: number[], reason?: string) =>
    request.post('/withdrawal/admin/bulk-reject', { ids, reason }),

  /** 通过币安 API 批量打款（dryRun=true 仅预览，不实际转账） */
  batchPayout: (params: { ids?: number[]; payAll?: boolean; dryRun?: boolean }) =>
    request.post('/withdrawal/admin/batch-payout', params),

  /** 验证币安 API Key 是否配置正确且有提现权限 */
  verifyBinanceKey: () =>
    request.get('/withdrawal/admin/verify-binance-key'),
};
