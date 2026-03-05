import { request } from './request';

/**
 * 广告数据API
 */
export const adsAPI = {
  /**
   * 获取广告列表
   */
  getAdsList: (params: any) => 
    request.get('/ads/list', { params }),
  
  /**
   * 获取广告统计
   */
  getAdsStats: (startDate: string, endDate: string) => 
    request.get('/ads/stats', { params: { startDate, endDate } }),
  
  /**
   * 获取广告收入
   */
  getAdsRevenue: (startDate: string, endDate: string) => 
    request.get('/ads/revenue', { params: { startDate, endDate } }),
  
  /**
   * 获取广告表现
   */
  getAdsPerformance: (adId: string) => 
    request.get(`/ads/${adId}/performance`),
};
