import { PaginationParams, PaginationResponse } from './api';

/**
 * 用户信息
 */
export interface User {
  id: string;
  username: string;
  email?: string;
  phone?: string;
  country?: string;
  registeredAt: string;
  lastLoginAt?: string;
  status: 'active' | 'inactive' | 'banned';
  totalPoints: number;
  totalOrders: number;
  totalRevenue: number;
}

/**
 * 用户列表请求参数
 */
export interface UserListParams extends PaginationParams {
  keyword?: string;
  country?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
}

/**
 * 用户列表响应
 */
export type UserListResponse = PaginationResponse<User>;

/**
 * 用户详情响应
 */
export interface UserDetailResponse {
  user: User;
  stats: {
    totalCheckIns: number;
    totalMining: number;
    totalAdsWatched: number;
  };
}

/**
 * 用户统计响应
 */
export interface UserStatsResponse {
  totalUsers: number;
  activeUsers: number;
  newUsers: number;
  dailyActiveUsers: number;
}
