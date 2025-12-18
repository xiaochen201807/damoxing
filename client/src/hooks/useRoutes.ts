/**
 * useRoutes Hook
 * 获取路由配置
 */

import { useState, useEffect } from 'react';
import { routeService } from '@/services';
import type { RouteConfig } from '@/types';

export interface UseRoutesResult {
    routes: RouteConfig[];
    loading: boolean;
    error: Error | null;
    refresh: () => Promise<void>;
}

export function useRoutes(): UseRoutesResult {
    const [routes, setRoutes] = useState<RouteConfig[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    const fetchRoutes = async (forceRefresh = false) => {
        setLoading(true);
        setError(null);

        try {
            const data = await routeService.fetchRoutes(forceRefresh);
            setRoutes(data);
        } catch (err) {
            setError(err as Error);
            console.error('useRoutes error:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRoutes();
    }, []);

    const refresh = async () => {
        await fetchRoutes(true);
    };

    return { routes, loading, error, refresh };
}
