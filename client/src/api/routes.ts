/**
 * 路由配置 API
 */

import apiClient from './client';
import { API_ENDPOINTS } from '@/config';
import type { RouteConfig, CreateRouteParams, UpdateRouteParams, ApiResponse } from '@/types';

export const routesApi = {
    /**
     * 获取所有路由配置
     */
    getAll: (): Promise<ApiResponse<RouteConfig[]>> => {
        return apiClient
            .get<ApiResponse<RouteConfig[]>>(API_ENDPOINTS.ROUTES)
            .then(res => res.data);
    },

    /**
     * 获取单个路由配置
     */
    getOne: (routeKey: string): Promise<ApiResponse<RouteConfig>> => {
        return apiClient
            .get<ApiResponse<RouteConfig>>(API_ENDPOINTS.ROUTES_BY_KEY(routeKey))
            .then(res => res.data);
    },

    /**
     * 创建路由
     */
    create: (data: CreateRouteParams): Promise<ApiResponse<RouteConfig>> => {
        return apiClient
            .post<ApiResponse<RouteConfig>>(API_ENDPOINTS.ROUTES, data)
            .then(res => res.data);
    },

    /**
     * 更新路由
     */
    update: (routeKey: string, data: UpdateRouteParams): Promise<ApiResponse> => {
        return apiClient
            .put<ApiResponse>(API_ENDPOINTS.ROUTES_BY_KEY(routeKey), data)
            .then(res => res.data);
    },

    /**
     * 删除路由（软删除）
     */
    delete: (routeKey: string): Promise<ApiResponse> => {
        return apiClient
            .delete<ApiResponse>(API_ENDPOINTS.ROUTES_BY_KEY(routeKey))
            .then(res => res.data);
    },
};
