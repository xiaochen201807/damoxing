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
        return apiClient.get(API_ENDPOINTS.ROUTES);
    },

    /**
     * 获取单个路由配置
     */
    getOne: (routeKey: string): Promise<ApiResponse<RouteConfig>> => {
        return apiClient.get(API_ENDPOINTS.ROUTES_BY_KEY(routeKey));
    },

    /**
     * 创建路由
     */
    create: (data: CreateRouteParams): Promise<ApiResponse<RouteConfig>> => {
        return apiClient.post(API_ENDPOINTS.ROUTES, data);
    },

    /**
     * 更新路由
     */
    update: (routeKey: string, data: UpdateRouteParams): Promise<ApiResponse> => {
        return apiClient.put(API_ENDPOINTS.ROUTES_BY_KEY(routeKey), data);
    },

    /**
     * 删除路由（软删除）
     */
    delete: (routeKey: string): Promise<ApiResponse> => {
        return apiClient.delete(API_ENDPOINTS.ROUTES_BY_KEY(routeKey));
    },
};
