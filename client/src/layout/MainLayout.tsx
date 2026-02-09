import React, { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { fetcher } from '../utils/fetcher';
import { API_ENDPOINTS } from '../config/constants';
import { buildMenuTree } from '../utils/menuTree';
import type { MenuItem, ApiResponse } from '../types/api';
import MenuList from '../components/Menu/MenuList';
import './MainLayout.css';

interface RouteInfo {
  route_name?: string;
  layout_type?: string;
}

const MainLayout: React.FC = () => {
  const [menus, setMenus] = useState<MenuItem[]>([]);
  const [routeTitle, setRouteTitle] = useState('管理系统'); // 默认标题
  const [layoutType, setLayoutType] = useState('default'); // 布局类型
  const [loading, setLoading] = useState(true);
  const location = useLocation();

  // 从路径中提取 route_key
  const routeKey = location.pathname.split('/')[1] || 'dashboard';

  useEffect(() => {
    setLoading(true);

    // 同时获取路由信息和菜单数据
    Promise.all([
      // 获取路由信息（包含标题）
      fetcher<ApiResponse<RouteInfo>>({
        url: API_ENDPOINTS.ROUTES_BY_KEY(routeKey),
        method: 'get'
      }),
      // 获取菜单数据
      fetcher<ApiResponse<MenuItem[]>>({
        url: `${API_ENDPOINTS.MENU}?route_key=${routeKey}`,
        method: 'get'
      })
    ]).then(([routeRes, menuRes]) => {
      // 设置路由标题
      if (routeRes.data && routeRes.data.status === 0 && routeRes.data.data) {
        setRouteTitle(routeRes.data.data.route_name || '管理系统');
        setLayoutType(routeRes.data.data.layout_type || 'default');
      }

      // 设置菜单 - 构建树形结构
      if (menuRes.data && menuRes.data.status === 0) {
        const flatMenus = menuRes.data.data || [];
        const treeMenus = buildMenuTree(flatMenus);
        setMenus(treeMenus);
      }

      setLoading(false);
    }).catch(err => {
      console.error('Failed to load:', err);
      setLoading(false);
    });
  }, [routeKey]);

  return (
    <div className="main-layout">
      {/* 侧边栏 */}
      {layoutType !== 'no_sidebar' && (
        <aside className="sidebar">
          <div className="sidebar-header">
            <h2>{routeTitle}</h2>
          </div>

          <nav className="sidebar-nav">
            {loading ? (
              <div className="menu-loading">加载菜单中...</div>
            ) : (
              <MenuList items={menus} routeKey={routeKey} />
            )}
          </nav>
        </aside>
      )}


      {/* 主内容区域 */}
      <main className="main-content">
        <Outlet />
      </main>
    </div >
  );
};

export default MainLayout;
