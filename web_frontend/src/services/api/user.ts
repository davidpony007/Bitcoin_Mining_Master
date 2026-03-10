import { request } from './request';
import type { 
  UserListParams, 
  UserListResponse,
  UserDetailResponse,
  UserStatsResponse 
} from '@/types/user';

/**
 * 用户相关API
 */
export const userAPI = {
  /**
   * 获取用户列表
   */
  getUserList: (params: UserListParams) => 
    request.get<UserListResponse>('/users/list', { params }),
  
  /**
   * 获取用户详情
   */
  getUserDetail: (userId: string) => 
    request.get<UserDetailResponse>(`/users/${userId}`),
  
  /**
   * 获取用户统计
   */
  getUserStats: () => 
    request.get<UserStatsResponse>('/users/stats'),
  
  /**
   * 导出用户数据
   */
  exportUsers: (params: UserListParams) => 
    request.get('/users/export', { params, responseType: 'blob' }),
};
