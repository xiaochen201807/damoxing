/**
 * useMenu Hook
 * 获取菜单数据
 */

import { useState, useEffect } from 'react';
import { menuService } from '@/services';
import type { MenuItem } from '@/types';

export interface UseMenuResult {
    menus: MenuItem[];
    loading: boolean;
    error: Error | null;
    refresh: () => Promise<void>;
}

export function useMenu(routeKey: string): UseMenuResult {
    const [menus, setMenus] = useState<MenuItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    const fetchMenus = async (forceRefresh = false) => {
        if (!routeKey) {
            setMenus([]);
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const data = await menuService.fetchMenus(routeKey, forceRefresh);
            setMenus(data);
        } catch (err) {
            setError(err as Error);
            console.error('useMenu error:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchMenus();
    }, [routeKey]);

    const refresh = async () => {
        await fetchMenus(true);
    };

    return { menus, loading, error, refresh };
}
