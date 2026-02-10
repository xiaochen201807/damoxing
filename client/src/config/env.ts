/**
 * 环境变量配置
 */

export const env = {
    // API 基础地址
    API_BASE_URL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001',

    // API 路由前缀（优先读取运行时配置）
    API_ROUTE_PREFIX: window.__APP_CONFIG__?.API_ROUTE_PREFIX || import.meta.env.VITE_API_ROUTE_PREFIX || '/api',

    // 运行模式
    MODE: import.meta.env.MODE,
    DEV: import.meta.env.DEV,
    PROD: import.meta.env.PROD,

    // 其他配置
    APP_NAME: import.meta.env.VITE_APP_NAME || 'Damoxing',
    APP_VERSION: import.meta.env.VITE_APP_VERSION || '1.0.0',
} as const;

// 开发环境日志
if (env.DEV) {
    console.log('🔧 Environment:', env);
}
