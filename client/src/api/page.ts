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
        return apiClient.get(API_ENDPOINTS.PAGE_BY_KEY(pageKey));
    },

    /**
     * 获取页面列表
     */
    getAll: (): Promise<ApiResponse<PageConfig[]>> => {
        return apiClient.get(API_ENDPOINTS.TEMPLATES);
    },

    /**
     * 获取模板定义列表
     */
    getTemplateDefinitions: (): Promise<ApiResponse<TemplateDefinition[]>> => {
        return apiClient.get(API_ENDPOINTS.TEMPLATE_DEFINITIONS);
    },
};

export const schemaApi = {
    /**
     * 获取配置向导 Schema
     */
    getWizard: (params?: { mode?: string; page_key?: string }): Promise<any> => {
        return apiClient.get(API_ENDPOINTS.SCHEMA_WIZARD, { params });
    },

    /**
     * 预览配置
     */
    preview: (data: { template_id: string; params: any }): Promise<ApiResponse<PageSchema>> => {
        return apiClient.post(API_ENDPOINTS.SCHEMA_PREVIEW, data);
    },

    /**
     * 保存配置
     */
    save: (data: any): Promise<ApiResponse> => {
        return apiClient.post(API_ENDPOINTS.SCHEMA_SAVE, data);
    },
};
