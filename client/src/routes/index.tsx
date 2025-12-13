import React from 'react';
import { useRoutes, Navigate } from 'react-router-dom';
import MainLayout from '../layout/MainLayout';
import AutoDashboard from '../pages/AutoDashboard';

const AppRoutes: React.FC = () => {
  const routes = useRoutes([
    {
      path: '/',
      element: <MainLayout />,
      children: [
        // 默认重定向到第一个菜单页面 (假设是 dashboard/loan)
        { index: true, element: <Navigate to="/dashboard/loan_risk" replace /> },
        
        // 动态路由：匹配 /dashboard/xxx
        {
          path: 'dashboard/:pageId',
          element: <AutoDashboard />
        },
        
        // 404 页面 (这里简单处理，重定向回首页)
        { path: '*', element: <Navigate to="/" replace /> }
      ]
    }
  ]);

  return routes;
};

export default AppRoutes;