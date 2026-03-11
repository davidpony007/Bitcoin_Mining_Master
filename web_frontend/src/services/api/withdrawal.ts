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
    request.get('/api/withdrawal/admin/list', { params }),

  /** 管理员同意提现 */
  approve: (id: number) =>
    request.put(`/api/withdrawal/approve/${id}`, {}),

  /** 管理员拒绝提现 */
  reject: (id: number, body?: { reason?: string }) =>
    request.put(`/api/withdrawal/reject/${id}`, body ?? {}),

  /** 查看单条提现详情 */
  detail: (id: number) =>
    request.get(`/api/withdrawal/${id}`),
};
