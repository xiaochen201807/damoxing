/**
 * AMIS Schema 类型定义
 * 基于 AMIS 官方文档的常用组件类型
 */

// AMIS 基础类型
export type AmisSchema =
    | PageSchema
    | GridSchema
    | CardSchema
    | ChartSchema
    | TplSchema
    | FormSchema
    | TableSchema
    | any; // 兜底类型，AMIS 组件类型众多

// 页面 Schema
export interface PageSchema {
    type: 'page';
    title?: string;
    subTitle?: string;
    body?: AmisSchema | AmisSchema[];
    aside?: AmisSchema | AmisSchema[];
    toolbar?: AmisSchema | AmisSchema[];
    initApi?: string | ApiConfig;
    [key: string]: any;
}

// 网格布局 Schema
export interface GridSchema {
    type: 'grid';
    columns: Array<{
        body?: AmisSchema | AmisSchema[];
        md?: number;
        sm?: number;
        [key: string]: any;
    }>;
    gap?: string | number;
    [key: string]: any;
}

// 卡片 Schema
export interface CardSchema {
    type: 'card';
    header?: {
        title?: string;
        subTitle?: string;
        [key: string]: any;
    };
    body?: AmisSchema | AmisSchema[];
    actions?: AmisSchema[];
    [key: string]: any;
}

// 图表 Schema
export interface ChartSchema {
    type: 'chart';
    config?: any; // ECharts 配置
    api?: string | ApiConfig;
    height?: number | string;
    [key: string]: any;
}

// 模板 Schema
export interface TplSchema {
    type: 'tpl';
    tpl: string;
    [key: string]: any;
}

// 表单 Schema
export interface FormSchema {
    type: 'form';
    title?: string;
    body?: AmisSchema[];
    api?: string | ApiConfig;
    submitText?: string;
    [key: string]: any;
}

// 表格 Schema
export interface TableSchema {
    type: 'table' | 'crud';
    columns?: Array<{
        name: string;
        label: string;
        type?: string;
        [key: string]: any;
    }>;
    api?: string | ApiConfig;
    [key: string]: any;
}

// API 配置
export interface ApiConfig {
    url: string;
    method?: 'get' | 'post' | 'put' | 'delete';
    data?: any;
    headers?: Record<string, string>;
    [key: string]: any;
}

// AMIS 渲染器 Props
export interface AmisRendererProps {
    schema: AmisSchema;
    data?: any;
    locale?: string;
    [key: string]: any;
}
