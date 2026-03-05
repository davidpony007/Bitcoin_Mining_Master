import { request } from './request';

/**
 * 数据分析API
 */
export const analyticsAPI = {
  /**
   * 获取DAU数据
   */
  getDAU: (startDate: string, endDate: string) => 
    request.get('/analytics/dau', { params: { startDate, endDate } }),
  
  /**
   * 获取MAU数据
   */
  getMAU: (startDate: string, endDate: string) => 
    request.get('/analytics/mau', { params: { startDate, endDate } }),
  
  /**
   * 获取留存数据
   */
  getRetention: (date: string) => 
    request.get('/analytics/retention', { params: { date } }),
  
  /**
   * 获取用户行为数据
   */
  getUserBehavior: (startDate: string, endDate: string) => 
    request.get('/analytics/behavior', { params: { startDate, endDate } }),
};
