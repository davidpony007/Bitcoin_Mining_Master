/**
 * API配置
 */
export const API_CONFIG = {
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
};

/**
 * WebSocket配置
 */
export const WS_CONFIG = {
  url: import.meta.env.VITE_WS_URL || 'ws://localhost:8888',
  reconnectInterval: 3000,
  heartbeatInterval: 30000,
};

/**
 * 分页配置
 */
export const PAGINATION_CONFIG = {
  defaultPageSize: 20,
  pageSizeOptions: [10, 20, 50, 100],
  showSizeChanger: true,
  showQuickJumper: true,
};

/**
 * 日期格式
 */
export const DATE_FORMAT = {
  date: 'YYYY-MM-DD',
  datetime: 'YYYY-MM-DD HH:mm:ss',
  time: 'HH:mm:ss',
  month: 'YYYY-MM',
  year: 'YYYY',
};
