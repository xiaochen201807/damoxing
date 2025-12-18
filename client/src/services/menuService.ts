/**
 * 菜单服务
 * 管理菜单数据的获取和缓存
 */

import { menuApi } from '@/api';
import { STORAGE_KEYS, CACHE_TIME } from '@/config';
import type { MenuItem } from '@/types';

interface CacheData {
    data: MenuItem[];
    routeKey: string;
    timestamp: number;
}

class MenuService {
    private menuCache = new Map<string, MenuItem[]>();

    /**
     * 根据路由key获取菜单
     */
    async fetchMenus(routeKey: string, forceRefresh = false): Promise<MenuItem[]> {
        // 检查内存缓存
        if (!forceRefresh && this.menuCache.has(routeKey)) {
            const cached = this.getCache(routeKey);
            if (cached) {
                return cached.data;
            }
        }

        try {
            const response = await menuApi.getAll({ route_key: routeKey });

            if (response.status === 0 && response.data) {
                const menus = response.data.sort((a, b) => a.order - b.order);

                // 保存到缓存
                this.menuCache.set(routeKey, menus);
                this.saveCache(routeKey, menus);

                return menus;
            }

            return [];
        } catch (error) {
            console.error('Failed to fetch menus:', error);

            // 尝试从缓存加载
            const cached = this.getCache(routeKey);
            return cached ? cached.data : [];
        }
    }

    /**
     * 清除指定路由的缓存
     */
    clearCache(routeKey?: string) {
        if (routeKey) {
            this.menuCache.delete(routeKey);
            sessionStorage.removeItem(`${STORAGE_KEYS.MENU_CACHE}_${routeKey}`);
        } else {
            this.menuCache.clear();
            // 清除所有菜单缓存
            Object.keys(sessionStorage).forEach(key => {
                if (key.startsWith(STORAGE_KEYS.MENU_CACHE)) {
                    sessionStorage.removeItem(key);
                }
            });
        }
    }

    /**
     * 获取缓存
     */
    private getCache(routeKey: string): CacheData | null {
        try {
            const cached = sessionStorage.getItem(`${STORAGE_KEYS.MENU_CACHE}_${routeKey}`);
            if (cached) {
                const data: CacheData = JSON.parse(cached);

                // 检查缓存是否过期
                if (Date.now() - data.timestamp < CACHE_TIME.MENU) {
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
    private saveCache(routeKey: string, menus: MenuItem[]) {
        try {
            const cacheData: CacheData = {
                data: menus,
                routeKey,
                timestamp: Date.now(),
            };
            sessionStorage.setItem(
                `${STORAGE_KEYS.MENU_CACHE}_${routeKey}`,
                JSON.stringify(cacheData)
            );
        } catch (error) {
            console.error('Failed to save cache:', error);
        }
    }
}

// 导出单例
export const menuService = new MenuService();
