/**
 * API 响应类型定义
 */

// 通用 API 响应格式
export interface ApiResponse<T = any> {
    status: number;
    msg: string;
    data?: T;
    error?: string;
    errors?: Array<{
        field: string;
        message: string;
    }>;
}

// 菜单项
export interface MenuItem {
    id: number;
    label: string;
    page_key: string;      // 新增
    route_key: string;     // 新增
    path: string;
    icon: string;
    subtitle?: string;
    created_at?: string;
}

// 页面模板
export interface PageTemplate {
    id: number;
    page_key: string;
    title: string;
    schema_json: string;
    created_at?: string;
    updated_at?: string;
}

// Dify 配置
export interface DifyConfig {
    id: number;
    page_key: string;
    workflow_name: string;
    api_url: string;
    api_key: string;
    enabled: number;
    description?: string;
    created_at?: string;
    updated_at?: string;
}

// AI 生成请求
export interface AiGenerateRequest {
    query: string;
    pageId?: string;
}

// AI 生成响应
export interface AiGenerateResponse {
    status: number;
    msg: string;
    data: any; // AMIS Schema，类型复杂，暂时使用 any
}
