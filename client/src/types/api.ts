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
    meta?: {
        templateVersion?: TemplateVersionStatus;
        [key: string]: unknown;
    };
}

export type TemplateVersionState =
    | 'current'
    | 'unmanaged'
    | 'unversioned_template'
    | 'legacy_unversioned'
    | 'page_outdated'
    | 'program_version_older'
    | 'missing_program_template'
    | 'check_failed';

export interface TemplateVersionStatus {
    status: TemplateVersionState;
    templateId?: string;
    programVersion?: number | null;
    pageVersion?: number | null;
    message?: string;
}

// 菜单项
export interface MenuItem {
    id: number;
    label: string;
    page_key: string;      // 页面标识
    route_key: string;     // 路由组标识
    path: string;          // 路由路径
    icon?: string;         // 图标（可选）
    subtitle?: string;     // 副标题（可选）
    order: number;         // 排序
    parent_id: number | null;  // 父菜单ID（null表示根级菜单）
    created_at?: string;   // 创建时间
    children?: MenuItem[]; // 子菜单（前端构建树形结构时使用）
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
