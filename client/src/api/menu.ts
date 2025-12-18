/**
 * 菜单 API
 */

import apiClient from './client';
import { API_ENDPOINTS } from '@/config';
import type { MenuItem, MenuQueryParams, CreateMenuParams, ApiResponse } from '@/types';

export const menuApi = {
    /**
     * 获取菜单列表
     */
    getAll: (params?: MenuQueryParams): Promise<ApiResponse<MenuItem[]>> => {
        return apiClient.get(API_ENDPOINTS.MENU, { params });
    },

    /**
     * 创建菜单
     */
    create: (data: CreateMenuParams): Promise<ApiResponse<MenuItem>> => {
        return apiClient.post(API_ENDPOINTS.MENU, data);
    },

    /**
     * 更新菜单
     */
    update: (id: number, data: Partial<CreateMenuParams>): Promise<ApiResponse> => {
        return apiClient.put(`${API_ENDPOINTS.MENU}/${id}`, data);
    },

    /**
     * 删除菜单
     */
    delete: (id: number): Promise<ApiResponse> => {
        return apiClient.delete(`${API_ENDPOINTS.MENU}/${id}`);
    },
};
