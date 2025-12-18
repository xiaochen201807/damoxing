import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import AmisRenderer from '../components/AmisRenderer'; // 引入上一环节封装的渲染器
import { fetcher } from '../utils/fetcher';
import { Spinner } from 'amis-ui';
import type { AmisSchema } from '../types/amis';
import type { ApiResponse } from '../types/api';

interface MenuItem {
  id: number;
  label: string;
  path: string;
  page_key: string;
  icon?: string;
}

const AutoDashboard: React.FC = () => {
  const { pageId } = useParams<{ pageId: string }>();
  const [schema, setSchema] = useState<AmisSchema | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);

  useEffect(() => {
    if (!pageId) return;

    setLoading(true);
    setError('');
    setSchema(null);
    setHasPermission(null);

    // 第一步：先检查菜单权限
    fetcher<ApiResponse<MenuItem[]>>({
      url: '/api/system/menu',
      method: 'get'
    })
      .then((menuRes) => {
        if (menuRes.data && menuRes.data.status === 0) {
          const menuItems = menuRes.data.data || [];
          const allowedPageKeys = menuItems.map(item => item.page_key);

          // 检查当前 pageId 是否在菜单的 page_key 列表中
          if (!allowedPageKeys.includes(pageId)) {
            setHasPermission(false);
            setError(`无权限访问此页面: ${pageId}`);
            setLoading(false);
            return;
          }

          setHasPermission(true);

          // 第二步：有权限，加载页面配置
          return fetcher<ApiResponse<AmisSchema>>({
            url: `/api/page/${pageId}`,
            method: 'get'
          });
        } else {
          throw new Error('获取菜单列表失败');
        }
      })
      .then((pageRes) => {
        if (!pageRes) return; // 无权限时已返回

        if (pageRes.data && pageRes.data.status === 0) {
          setSchema(pageRes.data.data as AmisSchema);
        } else {
          setError(pageRes.data?.msg || '获取页面配置失败');
        }
      })
      .catch((err: Error) => {
        console.error(err);
        setError('网络请求错误: ' + err.message);
      })
      .finally(() => {
        setLoading(false);
      });

  }, [pageId]);

  if (loading) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Spinner overlay show size="lg" />
      </div>
    );
  }

  // 无权限访问
  if (hasPermission === false) {
    return (
      <div style={{
        padding: '40px',
        textAlign: 'center',
        maxWidth: '600px',
        margin: '100px auto'
      }}>
        <h2 style={{ color: '#ff4d4f', marginBottom: '20px' }}>🚫 无权限访问</h2>
        <p style={{ fontSize: '16px', color: '#666', marginBottom: '10px' }}>
          页面 <code style={{
            background: '#f0f0f0',
            padding: '2px 8px',
            borderRadius: '4px',
            color: '#d9534f'
          }}>{pageId}</code> 不在菜单列表中
        </p>
        <p style={{ fontSize: '14px', color: '#999', marginBottom: '30px' }}>
          动态路由仅允许访问菜单表中配置的页面
        </p>
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
          <a
            href="/"
            style={{
              display: 'inline-block',
              padding: '10px 20px',
              background: '#1890ff',
              color: 'white',
              borderRadius: '4px',
              textDecoration: 'none'
            }}
          >
            返回首页
          </a>
          {pageId === 'config' && (
            <a
              href="/system/config"
              style={{
                display: 'inline-block',
                padding: '10px 20px',
                background: '#52c41a',
                color: 'white',
                borderRadius: '4px',
                textDecoration: 'none'
              }}
            >
              访问系统配置
            </a>
          )}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '20px', color: 'red' }}>
        <h3>Error</h3>
        <p>{error}</p>
      </div>
    );
  }

  if (!schema) {
    return <div style={{ padding: '20px' }}>暂无配置数据</div>;
  }

  return (
    <div style={{ padding: '20px' }}>
      {/* 将获取到的 JSON 配置传递给 AMIS 渲染器 */}
      <AmisRenderer schema={schema} />
    </div>
  );
};

export default AutoDashboard;