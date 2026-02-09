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
        return apiClient
            .get<ApiResponse<MenuItem[]>>(API_ENDPOINTS.MENU, { params })
            .then(res => res.data);
    },

    /**
     * 创建菜单
     */
    create: (data: CreateMenuParams): Promise<ApiResponse<MenuItem>> => {
        return apiClient
            .post<ApiResponse<MenuItem>>(API_ENDPOINTS.MENU, data)
            .then(res => res.data);
    },

    /**
     * 更新菜单
     */
    update: (id: number, data: Partial<CreateMenuParams>): Promise<ApiResponse> => {
        return apiClient
            .put<ApiResponse>(`${API_ENDPOINTS.MENU}/${id}`, data)
            .then(res => res.data);
    },

    /**
     * 删除菜单
     */
    delete: (id: number): Promise<ApiResponse> => {
        return apiClient
            .delete<ApiResponse>(`${API_ENDPOINTS.MENU}/${id}`)
            .then(res => res.data);
    },
};
