/**
 * AMIS Schema 类型定义
 * 基于 AMIS 官方文档的常用组件类型
 */

import type { Schema } from 'amis-core';

// AMIS 基础类型
export type AmisSchema = Schema;

// 页面 Schema
export interface PageSchema {
    type: 'page';
    title?: string;
    subTitle?: string;
    body?: AmisSchema | AmisSchema[];
    aside?: AmisSchema | AmisSchema[];
    toolbar?: AmisSchema | AmisSchema[];
    initApi?: string | ApiConfig;
    [key: string]: unknown;
}

// 网格布局 Schema
export interface GridSchema {
    type: 'grid';
    columns: Array<{
        body?: AmisSchema | AmisSchema[];
        md?: number;
        sm?: number;
        [key: string]: unknown;
    }>;
    gap?: string | number;
    [key: string]: unknown;
}

// 卡片 Schema
export interface CardSchema {
    type: 'card';
    header?: {
        title?: string;
        subTitle?: string;
        [key: string]: unknown;
    };
    body?: AmisSchema | AmisSchema[];
    actions?: AmisSchema[];
    [key: string]: unknown;
}

// 图表 Schema
export interface ChartSchema {
    type: 'chart';
    config?: unknown;
    api?: string | ApiConfig;
    height?: number | string;
    [key: string]: unknown;
}

// 模板 Schema
export interface TplSchema {
    type: 'tpl';
    tpl: string;
    [key: string]: unknown;
}

// 表单 Schema
export interface FormSchema {
    type: 'form';
    title?: string;
    body?: AmisSchema[];
    api?: string | ApiConfig;
    submitText?: string;
    [key: string]: unknown;
}

// 表格 Schema
export interface TableSchema {
    type: 'table' | 'crud';
    columns?: Array<{
        name: string;
        label: string;
        type?: string;
        [key: string]: unknown;
    }>;
    api?: string | ApiConfig;
    [key: string]: unknown;
}

// API 配置
export interface ApiConfig {
    url: string;
    method?: 'get' | 'post' | 'put' | 'delete';
    data?: unknown;
    headers?: Record<string, string>;
    [key: string]: unknown;
}

// AMIS 渲染器 Props
export interface AmisRendererProps {
    schema: AmisSchema;
    data?: unknown;
    locale?: string;
    [key: string]: unknown;
}
