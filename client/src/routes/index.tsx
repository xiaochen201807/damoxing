/**
 * 应用路由配置
 * 暂时使用静态路由，动态路由待优化后启用
 */

import React from 'react';
import { useRoutes, Navigate } from 'react-router-dom';
import MainLayout from '../layout/MainLayout';
import AutoDashboard from '../pages/AutoDashboard';
import SystemConfig from '../pages/SystemConfig';
import Login from '../pages/Login';
import AuthGuard from '../components/AuthGuard';

const AppRoutes: React.FC = () => {
  const routes = useRoutes([
    // 登录路由（独立路由，不在 MainLayout 中）
    {
      path: '/login',
      element: <Login />
    },

    // 主路由（需要登录）
    {
      path: '/',
      element: <AuthGuard><MainLayout /></AuthGuard>,
      children: [
        // 默认重定向到第一个菜单页面
        { index: true, element: <Navigate to="/dashboard/loan_risk" replace /> },

        // 通用动态路由：匹配 /:routeKey/:pageId
        // 例如 /dashboard/loan_risk, /zcfx/gdlfx
        {
          path: ':routeKey/:pageId',
          element: <AutoDashboard />
        },

        // 404 页面 (重定向回首页)
        { path: '*', element: <Navigate to="/" replace /> }
      ]
    },

    // 系统配置路由 (独立路由，需要登录)
    {
      path: '/system/config',
      element: <AuthGuard><SystemConfig /></AuthGuard>
    }
  ]);

  return routes;
};

export default AppRoutes;