import React, { useEffect, useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { fetcher } from '../utils/fetcher';

interface MenuItem {
  id: number;
  label: string;
  path: string;
  icon: string;
}

const MainLayout: React.FC = () => {
  const [menus, setMenus] = useState<MenuItem[]>([]);
  const location = useLocation();

  useEffect(() => {
    // 请求后端菜单接口
    fetcher({
      url: '/api/system/menu',
      method: 'get'
    }).then((res: any) => {
      // fetcher 封装层返回了 { data: 后端原始响应 }
      // 后端原始响应结构: { status: 0, msg: 'success', data: [...] }
      if (res.data && res.data.status === 0) {
        setMenus(res.data.data);
      } else {
        console.error('Failed to load menus', res);
      }
    });
  }, []);

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden' }}>
      {/* Sidebar Area */}
      <aside style={{
        width: '240px',
        backgroundColor: '#1a3c6e', // 政务蓝
        color: '#fff',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '2px 0 6px rgba(0,0,0,0.1)'
      }}>
        <div style={{
          height: '60px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '18px',
          fontWeight: 'bold',
          borderBottom: '1px solid rgba(255,255,255,0.1)'
        }}>
          <span>系统控制台</span>
        </div>

        <nav style={{ flex: 1, overflowY: 'auto', paddingTop: '10px' }}>
          {menus.map((menu) => {
            const isActive = location.pathname.startsWith(menu.path);
            return (
              <Link
                key={menu.id}
                to={menu.path}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '12px 20px',
                  color: '#fff',
                  textDecoration: 'none',
                  backgroundColor: isActive ? '#254e8a' : 'transparent', // 高亮色
                  borderLeft: isActive ? '4px solid #61dafb' : '4px solid transparent',
                  transition: 'all 0.3s'
                }}
              >
                <i className={menu.icon} style={{ width: '24px', marginRight: '8px' }}></i>
                <span>{menu.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main Content Area */}
      <main style={{ flex: 1, overflow: 'auto', backgroundColor: '#f0f2f5', position: 'relative' }}>
        <Outlet />
      </main>
    </div>
  );
};

export default MainLayout;