/**
 * 数据模型类型定义
 */

// 用户信息（预留）
export interface User {
    id: number;
    username: string;
    email?: string;
    role?: string;
}

// 路由参数
export interface RouteParams {
    pageId?: string;
}

import type { AxiosRequestConfig } from 'axios';

// Fetcher 配置
export interface FetcherConfig {
    url: string;
    method?: 'get' | 'post' | 'put' | 'delete' | 'patch';
    data?: unknown;
    responseType?: AxiosRequestConfig['responseType'];
    config?: AxiosRequestConfig & { cancelExecutor?: (cancel: (message?: string) => void) => void };
    headers?: Record<string, string>;
}

// Fetcher 响应
export interface FetcherResponse<T = unknown> {
    data: T;
    status?: number;
    msg?: string;
}

// 环境变量
export interface ImportMetaEnv {
    readonly VITE_API_BASE_URL: string;
    readonly VITE_APP_NAME: string;
    readonly VITE_APP_VERSION: string;
}
