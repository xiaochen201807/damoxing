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
import { getGatewayParamsWithFallback, saveUrlParamsToSession, getGatewayParams, clearGatewayParamsSession } from '../utils/urlParams';
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
    // 只要有 ticket 或 cheque 就认为是 SSO 登录尝试
    // 不需要强制检查 tyLoginToken，防止因缺失该参数导致重定向循环
    const hasValidTicket = (params.ticket && params.ticket !== 'nothing') || params.cheque;
    console.log('[AuthGuard] Checking gateway params:', { params, hasValidTicket });
    return !!hasValidTicket;
};

const AuthGuard: React.FC<AuthGuardProps> = ({ children }) => {
    const location = useLocation();

    // 使用状态管理 token，而不是直接读取 localStorage
    const [authToken, setAuthToken] = useState(() => localStorage.getItem('auth_token'));

    // SSO 登录状态
    const [ssoLoading, setSsoLoading] = useState(() => !authToken && hasValidGatewayParams());
    const [ssoError, setSsoError] = useState<string | null>(null);
    const [authChecked, setAuthChecked] = useState(!!authToken);

    // SSO 自动登录
    useEffect(() => {
        if (authToken) {
            setAuthChecked(true);
            return;
        }

        saveUrlParamsToSession();

        // 这里同样使用放宽后的检查逻辑
        const gatewayParams = getGatewayParamsWithFallback();
        const hasValidTicket = (gatewayParams.ticket && gatewayParams.ticket !== 'nothing') || gatewayParams.cheque;

        if (hasValidTicket) {
            console.log('[AuthGuard SSO] 检测到网关参数，进行 SSO 登录', gatewayParams);
            performSsoLogin(gatewayParams);
        } else {
            console.log('[AuthGuard SSO] 未检测到有效网关参数，跳过 SSO');
            setAuthChecked(true);
        }
    }, [authToken]);

    // SSO 登录函数
    const performSsoLogin = async (gatewayParams: any) => {
        setSsoLoading(true);
        setSsoError(null);

        try {
            console.log('[AuthGuard SSO] 发起登录请求...');
            const response = await axios.post(`${API_PREFIX}/auth/login`, {
                ticket: gatewayParams.ticket === 'nothing' ? gatewayParams.cheque : gatewayParams.ticket,
                tyLoginToken: gatewayParams.tyLoginToken, // 可选
                qycode: gatewayParams.qycode
            });

            if (response.data.status === 0) {
                // 保存到 localStorage
                localStorage.setItem('auth_token', response.data.data.token);
                localStorage.setItem('user_info', JSON.stringify(response.data.data.user));

                if (response.data.data.gateway_info) {
                    localStorage.setItem('gateway_info', JSON.stringify(response.data.data.gateway_info));
                }

                console.log('[AuthGuard SSO] 登录成功，更新组件状态');

                // 清除 sessionStorage 中的网关参数缓存
                clearGatewayParamsSession();

                // 通过状态更新触发重新渲染，而不是刷新页面
                setAuthToken(response.data.data.token);
                setSsoLoading(false);
                setAuthChecked(true);
            } else {
                console.warn('[AuthGuard SSO] 登录返回非 0 状态:', response.data);
                setSsoError(response.data.msg || 'SSO 登录失败');
                // 登录失败不应该 setAuthChecked(true) 导致重定向，而是显示错误
                setSsoLoading(false);
            }
        } catch (err: any) {
            console.error('[AuthGuard SSO] 登录失败:', err);
            const errMsg = err.response?.data?.msg || err.message || '网关验证失败';
            setSsoError(errMsg);
            setSsoLoading(false);
        }
    };

    // 无 token 且无网关参数，重定向到登录页
    // 注意：如果有 ssoError，说明是网关登录失败，应该显示错误遮罩而不是重定向
    if (authChecked && !authToken && !ssoLoading && !ssoError) {
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
    // 1. SSO 验证中：显示骨架屏布局（无提示框）
    if (ssoLoading) {
        return <SkeletonLayout />;
    }

    // 2. SSO 失败：显示骨架屏 + 错误提示
    if (ssoError) {
        return <SkeletonLayout error={ssoError} />;
    }

    // 3. 已登录：渲染子组件
    return <>{children}</>;
};

export default AuthGuard;
