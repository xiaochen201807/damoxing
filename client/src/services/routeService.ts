/**
 * 路由服务
 * 管理路由配置的获取和缓存
 */

import { routesApi } from '@/api';
import { STORAGE_KEYS, CACHE_TIME } from '@/config';
import type { RouteConfig } from '@/types';

interface CacheData {
    data: RouteConfig[];
    timestamp: number;
}

class RouteService {
    private routes: RouteConfig[] = [];
    private loaded = false;
    private loading = false;

    /**
     * 获取所有路由配置
     */
    async fetchRoutes(forceRefresh = false): Promise<RouteConfig[]> {
        // 如果正在加载，等待加载完成
        if (this.loading) {
            await this.waitForLoading();
            return this.routes;
        }

        // 检查缓存
        if (!forceRefresh && this.loaded && this.routes.length > 0) {
            const cache = this.getCache();
            if (cache) {
                return cache.data;
            }
        }

        this.loading = true;

        try {
            const response = await routesApi.getAll();

            if (response.status === 0 && response.data) {
                this.routes = response.data.filter(r => r.is_active);
                this.loaded = true;

                // 保存到缓存
                this.saveCache(this.routes);
            }

            return this.routes;
        } catch (error) {
            console.error('Failed to fetch routes:', error);

            // 尝试从缓存加载
            const cache = this.getCache();
            if (cache) {
                this.routes = cache.data;
                return this.routes;
            }

            return [];
        } finally {
            this.loading = false;
        }
    }

    /**
     * 根据 route_key 获取路由
     */
    getRouteByKey(routeKey: string): RouteConfig | undefined {
        return this.routes.find(r => r.route_key === routeKey);
    }

    /**
     * 清除缓存
     */
    clearCache() {
        this.routes = [];
        this.loaded = false;
        sessionStorage.removeItem(STORAGE_KEYS.ROUTES_CACHE);
    }

    /**
     * 等待加载完成
     */
    private async waitForLoading(): Promise<void> {
        return new Promise(resolve => {
            const check = () => {
                if (!this.loading) {
                    resolve();
                } else {
                    setTimeout(check, 100);
                }
            };
            check();
        });
    }

    /**
     * 获取缓存
     */
    private getCache(): CacheData | null {
        try {
            const cached = sessionStorage.getItem(STORAGE_KEYS.ROUTES_CACHE);
            if (cached) {
                const data: CacheData = JSON.parse(cached);

                // 检查缓存是否过期
                if (Date.now() - data.timestamp < CACHE_TIME.ROUTES) {
                    return data;
                }
            }
        } catch (error) {
            console.error('Failed to get cache:', error);
        }
        return null;
    }

    /**
     * 保存缓存
     */
    private saveCache(routes: RouteConfig[]) {
        try {
            const cacheData: CacheData = {
                data: routes,
                timestamp: Date.now(),
            };
            sessionStorage.setItem(STORAGE_KEYS.ROUTES_CACHE, JSON.stringify(cacheData));
        } catch (error) {
            console.error('Failed to save cache:', error);
        }
    }
}

// 导出单例
export const routeService = new RouteService();
