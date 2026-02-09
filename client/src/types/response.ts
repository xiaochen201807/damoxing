/**
 * API 响应类型定义
 */

// 标准 API 响应
export interface ApiResponse<T = unknown> {
    status: number;
    msg: string;
    data?: T;
    error?: string;
}

// 分页响应
export interface PaginatedResponse<T = unknown> extends ApiResponse<T[]> {
    total?: number;
    page?: number;
    perPage?: number;
}

// 请求配置
export interface RequestConfig {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
    headers?: Record<string, string>;
    params?: Record<string, unknown>;
    data?: unknown;
}
