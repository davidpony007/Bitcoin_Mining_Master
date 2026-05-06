import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { message } from 'antd';
import { API_CONFIG } from '@config/index';

/**
 * 创建Axios实例
 */
const instance: AxiosInstance = axios.create({
  baseURL: API_CONFIG.baseURL,
  timeout: API_CONFIG.timeout,
  headers: API_CONFIG.headers,
});

/**
 * 请求拦截器
 */
instance.interceptors.request.use(
  (config) => {
    // 添加 JWT token
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    // 管理员 API 加自定义密钥头（nginx 第一道防线，与 JWT 不冲突）
    if (config.url && config.url.includes('/admin/')) {
      config.headers['X-Admin-Key'] = 'BtcAdmin!Ng1nx@2026';
    }
    return config;
  },
  (error) => {
    console.error('Request error:', error);
    return Promise.reject(error);
  }
);

/**
 * 响应拦截器
 */
instance.interceptors.response.use(
  (response: AxiosResponse) => {
    const { data } = response;
    
    // 成功返回
    if (data.success) {
      return data;
    }
    
    // 业务错误
    message.error(data.message || '请求失败');
    return Promise.reject(new Error(data.message || '请求失败'));
  },
  (error) => {
    // HTTP错误处理
    if (error.response) {
      const { status, data } = error.response;
      
      switch (status) {
        case 401:
          message.error('未授权，请重新登录');
          localStorage.removeItem('token');
          window.location.href = '/data-system/login';
          break;
        case 403:
          message.error('登录已过期，请重新登录');
          localStorage.removeItem('token');
          window.location.href = '/data-system/login';
          break;
        case 404:
          message.error('请求的资源不存在');
          break;
        case 500:
          message.error('服务器错误');
          break;
        default:
          message.error(data?.message || '请求失败');
      }
    } else if (error.request) {
      message.error('网络错误，请检查网络连接');
    } else {
      message.error(error.message || '请求失败');
    }
    
    return Promise.reject(error);
  }
);

/**
 * 通用请求方法
 */
export const request = {
  get: <T = any>(url: string, config?: AxiosRequestConfig) => 
    instance.get<T, T>(url, config),
    
  post: <T = any>(url: string, data?: any, config?: AxiosRequestConfig) => 
    instance.post<T, T>(url, data, config),
    
  put: <T = any>(url: string, data?: any, config?: AxiosRequestConfig) => 
    instance.put<T, T>(url, data, config),
    
  delete: <T = any>(url: string, config?: AxiosRequestConfig) => 
    instance.delete<T, T>(url, config),
};

export default instance;
