/**
 * 路由守卫组件
 * 检查用户是否已登录
 * - 已登录：渲染子组件
 * - 未登录 + 有网关参数：显示真实页面 + 半透明遮罩进行 SSO 登录
 * - 未登录 + 无网关参数：重定向到登录页
 */

import React, { type ReactNode, useState, useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { getGatewayParamsWithFallback, saveUrlParamsToSession, getGatewayParams } from '../utils/urlParams';
import SkeletonLayout from './SkeletonLayout';
import '../styles/AuthGuard.css';

// API 路由前缀
const API_PREFIX = import.meta.env.VITE_API_ROUTE_PREFIX || '/api';

interface AuthGuardProps {
    children: ReactNode;
}

// 检测是否有有效的网关参数
const hasValidGatewayParams = (): boolean => {
    const params = getGatewayParams();
    const hasValidTicket = (params.ticket && params.ticket !== 'nothing') || params.cheque;
    return !!(hasValidTicket && params.tyLoginToken);
};

const AuthGuard: React.FC<AuthGuardProps> = ({ children }) => {
    const token = localStorage.getItem('auth_token');
    const location = useLocation();

    // SSO 登录状态
    const [ssoLoading, setSsoLoading] = useState(() => !token && hasValidGatewayParams());
    const [ssoError, setSsoError] = useState<string | null>(null);
    const [authChecked, setAuthChecked] = useState(!!token);

    // SSO 自动登录
    useEffect(() => {
        if (token) {
            setAuthChecked(true);
            return;
        }

        saveUrlParamsToSession();

        const gatewayParams = getGatewayParamsWithFallback();
        const hasValidTicket = (gatewayParams.ticket && gatewayParams.ticket !== 'nothing') || gatewayParams.cheque;

        if (hasValidTicket && gatewayParams.tyLoginToken) {
            console.log('[AuthGuard SSO] 检测到网关参数，进行 SSO 登录');
            performSsoLogin(gatewayParams);
        } else {
            setAuthChecked(true);
        }
    }, [token]);

    // SSO 登录函数
    const performSsoLogin = async (gatewayParams: any) => {
        setSsoLoading(true);
        setSsoError(null);

        try {
            const response = await axios.post(`${API_PREFIX}/auth/login`, {
                ticket: gatewayParams.ticket === 'nothing' ? gatewayParams.cheque : gatewayParams.ticket,
                tyLoginToken: gatewayParams.tyLoginToken,
                qycode: gatewayParams.qycode
            });

            if (response.data.status === 0) {
                localStorage.setItem('auth_token', response.data.data.token);
                localStorage.setItem('user_info', JSON.stringify(response.data.data.user));

                if (response.data.data.gateway_info) {
                    localStorage.setItem('gateway_info', JSON.stringify(response.data.data.gateway_info));
                }

                console.log('[AuthGuard SSO] 登录成功');
                // 移除遮罩，刷新以显示内容
                window.location.reload();
            } else {
                setSsoError(response.data.msg || 'SSO 登录失败');
                setAuthChecked(true);
            }
        } catch (err: any) {
            console.error('[AuthGuard SSO] 登录失败:', err);
            setSsoError(err.response?.data?.msg || '网关验证失败');
            setAuthChecked(true);
        } finally {
            setSsoLoading(false);
        }
    };

    // 无 token 且无网关参数，重定向到登录页
    // 注意：如果有 ssoError，说明是网关登录失败，应该显示错误遮罩而不是重定向
    if (authChecked && !localStorage.getItem('auth_token') && !ssoLoading && !ssoError) {
        // 检查是否有网关参数，有的话不重定向（保持显示错误或重试）
        if (!hasValidGatewayParams()) {
            const searchParams = new URLSearchParams(location.search);
            if (location.pathname !== '/' && location.pathname !== '/login') {
                searchParams.set('returnUrl', location.pathname);
            }
            const loginPath = `/login?${searchParams.toString()}`;
            return <Navigate to={loginPath} replace />;
        }
    }

    // 渲染逻辑
    // 1. SSO 验证中：显示骨架屏布局
    if (ssoLoading) {
        return <SkeletonLayout message="正在验证登录..." />;
    }

    // 2. SSO 失败：显示骨架屏 + 错误提示
    if (ssoError) {
        return <SkeletonLayout message={`验证失败: ${ssoError}`} />;
    }

    // 3. 已登录：渲染子组件
    return <>{children}</>;
};

export default AuthGuard;
