/**
 * 页面相关类型定义
 */

// 页面配置
export interface PageConfig {
    id: number;
    page_key: string;
    title: string;
    schema_json: string;
    version: number;
    is_active: boolean;
    source_template_id?: string;
    source_params?: string;
    created_at: string;
    updated_at: string;
}

// 页面 Schema（解析后的 JSON）
export interface PageSchema {
    type: string;
    title?: string;
    body?: any[];
    [key: string]: any;
}

// 模板定义
export interface TemplateDefinition {
    template_id: string;
    template_name: string;
    template_file: string;
    description?: string;
    preview_image?: string;
    is_active: boolean;
}
