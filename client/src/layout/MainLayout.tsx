import React, { useState, useEffect } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { fetcher } from '../utils/fetcher';
import type { MenuItem, ApiResponse } from '../types/api';
import './MainLayout.css';

const MainLayout: React.FC = () => {
  const [menus, setMenus] = useState<MenuItem[]>([]);
  const [routeTitle, setRouteTitle] = useState('管理系统'); // 默认标题
  const [loading, setLoading] = useState(true);
  const location = useLocation();

  // 从路径中提取 route_key
  const routeKey = location.pathname.split('/')[1] || 'dashboard';

  useEffect(() => {
    setLoading(true);

    // 同时获取路由信息和菜单数据
    Promise.all([
      // 获取路由信息（包含标题）
      fetcher<ApiResponse<any>>({
        url: `/api/routes/${routeKey}`,
        method: 'get'
      }),
      // 获取菜单数据
      fetcher<ApiResponse<MenuItem[]>>({
        url: `/api/system/menu?route_key=${routeKey}`,
        method: 'get'
      })
    ]).then(([routeRes, menuRes]) => {
      // 设置路由标题
      if (routeRes.data && routeRes.data.status === 0 && routeRes.data.data) {
        setRouteTitle(routeRes.data.data.route_name || '管理系统');
      }

      // 设置菜单
      if (menuRes.data && menuRes.data.status === 0) {
        setMenus(menuRes.data.data || []);
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
      <aside className="sidebar">
        <div className="sidebar-header">
          <h2>{routeTitle}</h2>
        </div>

        <nav className="sidebar-nav">
          {loading ? (
            <div className="menu-loading">加载菜单中...</div>
          ) : menus.length === 0 ? (
            <div className="menu-empty">暂无菜单</div>
          ) : (
            <ul className="menu-list">
              {menus.map((menu) => (
                <li key={menu.id} className="menu-item">
                  <Link
                    to={`/${routeKey}/${menu.page_key}`}
                    className={
                      location.pathname === `/${routeKey}/${menu.page_key}`
                        ? 'menu-link active'
                        : 'menu-link'
                    }
                  >
                    {menu.icon && <i className={menu.icon}></i>}
                    <div className="menu-text">
                      <span className="menu-label">{menu.label}</span>
                      {menu.subtitle && <span className="menu-subtitle">{menu.subtitle}</span>}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </nav>
      </aside>

      {/* 主内容区域 */}
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
};

export default MainLayout;