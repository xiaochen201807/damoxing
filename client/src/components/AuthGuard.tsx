/**
 * 路由守卫组件
 * 检查用户是否已登录，未登录则重定向到登录页
 */

import React, { type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';

interface AuthGuardProps {
    children: ReactNode;
}

const AuthGuard: React.FC<AuthGuardProps> = ({ children }) => {
    const token = localStorage.getItem('auth_token');

    if (!token) {
        // 未登录，重定向到登录页
        return <Navigate to="/login" replace />;
    }

    // 已登录，渲染子组件
    return <>{children}</>;
};

export default AuthGuard;
