/**
 * 路由守卫组件
 * 检查用户是否已登录
 * - 已登录：渲染子组件
 * - 未登录 + 有网关参数：显示真实页面 + 半透明遮罩进行 SSO 登录
 * - 未登录 + 无网关参数：重定向到登录页
 */

import React, { type ReactNode, useState, useEffect, useCallback } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { getGatewayParamsWithFallback, clearGatewayParamsSession } from '../utils/urlParams';
import SkeletonLayout from './SkeletonLayout';
import '../styles/AuthGuard.css';

// API 路由前缀
const API_PREFIX = import.meta.env.VITE_API_ROUTE_PREFIX || '/api';

interface AuthGuardProps {
    children: ReactNode;
}

type GatewayParams = ReturnType<typeof getGatewayParamsWithFallback>;

const AuthGuard: React.FC<AuthGuardProps> = ({ children }) => {
    const location = useLocation();


    // 使用状态管理 token，而不是直接读取 localStorage
    const [authToken, setAuthToken] = useState(() => localStorage.getItem('auth_token'));

    // 检查是否是新的 SSO 访问（有 Ticket）
    const checkForSsoParams = () => {
        const params = getGatewayParamsWithFallback();
        // 只要有 ticket 或 cheque 就认为是 SSO 登录尝试
        const hasValidTicket = (params.ticket && params.ticket !== 'nothing') || params.cheque;
        return { hasSso: !!hasValidTicket, params };
    };

    const ssoCheck = checkForSsoParams();
    const { ticket, cheque, tyLoginToken, qycode } = ssoCheck.params;

    // 如果 URL 中有 SSO 参数，即使本地有 Token 也应该优先尝试 SSO（覆盖旧 Token）
    // 或者可以先验证 Token 是否有效，但保险起见，SSO 链接通常意味着强行登录指定用户
    const [ssoLoading, setSsoLoading] = useState(ssoCheck.hasSso);
    const [ssoError, setSsoError] = useState<string | null>(null);
    const [authChecked, setAuthChecked] = useState(false);

    // SSO 登录函数
    const performSsoLogin = useCallback(async (gatewayParams: GatewayParams) => {
        setSsoLoading(true);
        setSsoError(null);

        try {
            console.log('[AuthGuard SSO] 发起登录请求...');
            const response = await axios.post(`${API_PREFIX}/auth/login`, {
                ticket: gatewayParams.ticket === 'nothing' ? gatewayParams.cheque : gatewayParams.ticket,
                tyLoginToken: gatewayParams.tyLoginToken,
                qycode: gatewayParams.qycode
            });

            if (response.data.status === 0) {
                localStorage.setItem('auth_token', response.data.data.token);
                localStorage.setItem('user_info', JSON.stringify(response.data.data.user));

                if (response.data.data.gateway_info) {
                    console.log('[AuthGuard SSO] 登录成功，保存网关参数到 Storage:', response.data.data.gateway_info);
                    localStorage.setItem('gateway_info', JSON.stringify(response.data.data.gateway_info));
                } else {
                    console.warn('[AuthGuard SSO] 登录成功，但后端未返回 gateway_info');
                }

                console.log('[AuthGuard SSO] 登录成功，清除 URL 参数并更新状态');

                clearGatewayParamsSession();

                const url = new URL(window.location.href);
                url.searchParams.delete('ticket');
                url.searchParams.delete('tyLoginToken');
                url.searchParams.delete('qycode');
                url.searchParams.delete('cheque');
                url.searchParams.delete('zzjgdmz');
                url.searchParams.delete('access_token');
                window.history.replaceState({}, '', url.toString());

                setAuthToken(response.data.data.token);
                setSsoLoading(false);
                setAuthChecked(true);
            } else {
                console.warn('[AuthGuard SSO] 登录返回非 0 状态:', response.data);
                setSsoError(response.data.msg || 'SSO 登录失败');
                setSsoLoading(false);
            }
        } catch (err: unknown) {
            console.error('[AuthGuard SSO] 登录失败:', err);
            const errMsg = axios.isAxiosError(err)
                ? (err.response?.data as { msg?: string } | undefined)?.msg || err.message || '网关验证失败'
                : err instanceof Error
                    ? err.message
                    : '网关验证失败';
            setSsoError(errMsg);
            setSsoLoading(false);
        }
    }, []);

    // SSO 自动登录
    useEffect(() => {
        // 1. 如果有 SSO 参数，优先进行 SSO 登录
        if (ssoCheck.hasSso && !authToken) {
            console.log('[AuthGuard SSO] 检测到网关参数，优先进行 SSO 登录', { ticket, cheque, tyLoginToken, qycode });
            performSsoLogin({ ticket, cheque, tyLoginToken, qycode });
        }
        // 2. 如果没有 SSO 参数，但有 Token，认为已登录
        else if (authToken) {
            setAuthChecked(true);
        }
        // 3. 既无 SSO 参数也无 Token，需要重定向
        else {
            setAuthChecked(true);
        }
    }, [
        authToken,
        cheque,
        performSsoLogin,
        ssoCheck.hasSso,
        ticket,
        tyLoginToken,
        qycode,
    ]);

    // 渲染逻辑判定

    // 1. SSO 进行中
    if (ssoLoading) {
        return <SkeletonLayout />;
    }

    // 2. SSO 失败
    if (ssoError) {
        return <SkeletonLayout error={ssoError} />;
    }

    // 3. 检查结束，未登录（且不在 SSO 流程中）-> 重定向
    // 注意：ssoCheck.hasSso 为 true 时不应该走到这里，因为会在 useEffect 中处理
    if (authChecked && !authToken && !ssoCheck.hasSso) {
        const searchParams = new URLSearchParams(location.search);
        if (location.pathname !== '/' && location.pathname !== '/login') {
            searchParams.set('returnUrl', location.pathname);
        }
        const loginPath = `/login?${searchParams.toString()}`;
        console.log('[AuthGuard] 无效会话，重定向到登录页');
        return <Navigate to={loginPath} replace />;
    }

    // 4. 已登录 (authToken 存在)
    if (authToken) {
        return <>{children}</>;
    }

    // 默认返回（防抖动，理论上不会长时间停留）
    return <SkeletonLayout />;
};

export default AuthGuard;
