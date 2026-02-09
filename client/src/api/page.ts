/**
 * 页面 API
 */

import apiClient from './client';
import { API_ENDPOINTS } from '@/config';
import type { PageConfig, PageSchema, TemplateDefinition, ApiResponse } from '@/types';

export const pageApi = {
    /**
     * 根据 page_key 获取页面配置
     */
    getByKey: (pageKey: string): Promise<ApiResponse<PageSchema>> => {
        return apiClient
            .get<ApiResponse<PageSchema>>(API_ENDPOINTS.PAGE_BY_KEY(pageKey))
            .then(res => res.data);
    },

    /**
     * 获取页面列表
     */
    getAll: (): Promise<ApiResponse<PageConfig[]>> => {
        return apiClient
            .get<ApiResponse<PageConfig[]>>(API_ENDPOINTS.TEMPLATES)
            .then(res => res.data);
    },

    /**
     * 获取模板定义列表
     */
    getTemplateDefinitions: (): Promise<ApiResponse<TemplateDefinition[]>> => {
        return apiClient
            .get<ApiResponse<TemplateDefinition[]>>(API_ENDPOINTS.TEMPLATE_DEFINITIONS)
            .then(res => res.data);
    },
};

export const schemaApi = {
    /**
     * 获取配置向导 Schema
     */
    getWizard: (params?: { mode?: string; page_key?: string }): Promise<ApiResponse<unknown>> => {
        return apiClient
            .get<ApiResponse<unknown>>(API_ENDPOINTS.SCHEMA_WIZARD, { params })
            .then(res => res.data);
    },

    /**
     * 预览配置
     */
    preview: (data: { template_id: string; params: unknown }): Promise<ApiResponse<PageSchema>> => {
        return apiClient
            .post<ApiResponse<PageSchema>>(API_ENDPOINTS.SCHEMA_PREVIEW, data)
            .then(res => res.data);
    },

    /**
     * 保存配置
     */
    save: (data: unknown): Promise<ApiResponse<unknown>> => {
        return apiClient
            .post<ApiResponse<unknown>>(API_ENDPOINTS.SCHEMA_SAVE, data)
            .then(res => res.data);
    },
};
