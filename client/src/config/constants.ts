/**
 * 应用常量配置
 */

// 应用基础路径（从环境变量读取，去掉末尾的 /，用于前端路由）
const BASE_PATH = (import.meta.env.VITE_BASE_PATH || '/').replace(/\/$/, '') || '';

// API 路由前缀（从环境变量读取，默认 /api）
const API_PREFIX = import.meta.env.VITE_API_ROUTE_PREFIX || '/api';

// 路由路径常量（包含基础路径）
export const ROUTES = {
    HOME: `${BASE_PATH}/`,
    DASHBOARD: `${BASE_PATH}/dashboard`,
    SYSTEM: `${BASE_PATH}/system`,
    CONFIG: `${BASE_PATH}/system/config`,
} as const;

// API 端点常量
export const API_ENDPOINTS = {
    // 路由相关
    ROUTES: `${API_PREFIX}/routes`,
    ROUTES_BY_KEY: (key: string) => `${API_PREFIX}/routes/${key}`,

    // 菜单相关
    MENU: `${API_PREFIX}/system/menu`,

    // 页面相关
    PAGE: `${API_PREFIX}/page`,
    PAGE_BY_KEY: (key: string) => `${API_PREFIX}/page/${key}`,

    // Schema 相关
    SCHEMA_WIZARD: `${API_PREFIX}/schema/wizard`,
    SCHEMA_PREVIEW: `${API_PREFIX}/schema/preview`,
    SCHEMA_SAVE: `${API_PREFIX}/schema/save`,

    // 模板相关
    TEMPLATES: `${API_PREFIX}/system/template`,
    TEMPLATE_DEFINITIONS: `${API_PREFIX}/system/template-definitions`,
} as const;

// 本地存储 key
export const STORAGE_KEYS = {
    TOKEN: 'auth_token',
    USER_INFO: 'user_info',
    THEME: 'app_theme',
    LANGUAGE: 'app_language',
    ROUTES_CACHE: 'routes_cache',
    MENU_CACHE: 'menu_cache',
} as const;

// 缓存时间（毫秒）
export const CACHE_TIME = {
    ROUTES: 5 * 60 * 1000,  // 5分钟
    MENU: 5 * 60 * 1000,    // 5分钟
    PAGE: 2 * 60 * 1000,    // 2分钟
} as const;

// HTTP 状态码
export const HTTP_STATUS = {
    OK: 0,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    INTERNAL_ERROR: 500,
} as const;

// 主题配置
export const THEMES = {
    DEFAULT: 'default',
    DARK: 'dark',
    BRAND: 'brand',
} as const;

export type Theme = typeof THEMES[keyof typeof THEMES];
