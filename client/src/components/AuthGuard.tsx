/**
 * 路由守卫组件
 * 检查用户是否已登录，未登录则重定向到登录页
 */

import React, { type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';

interface AuthGuardProps {
    children: ReactNode;
}

const AuthGuard: React.FC<AuthGuardProps> = ({ children }) => {
    const token = localStorage.getItem('auth_token');
    const location = useLocation();

    if (!token) {
        // 未登录，重定向到登录页
        // ⭐ 关键：保留原始 URL 的所有查询参数（ticket、tyLoginToken、qycode 等）
        // 同时保存原始路径到 returnUrl 参数，以便登录后返回
        const searchParams = new URLSearchParams(location.search);

        // 将原始路径编码后添加到参数中
        if (location.pathname !== '/' && location.pathname !== '/login') {
            searchParams.set('returnUrl', location.pathname);
        }

        const loginPath = `/login?${searchParams.toString()}`;

        return <Navigate to={loginPath} replace />;
    }

    // 已登录，渲染子组件
    return <>{children}</>;
};

export default AuthGuard;
