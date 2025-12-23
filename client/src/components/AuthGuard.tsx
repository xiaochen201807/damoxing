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
        const loginPath = `/login${location.search}`; // 保留完整的查询参数

        return <Navigate to={loginPath} replace />;
    }

    // 已登录，渲染子组件
    return <>{children}</>;
};

export default AuthGuard;
