import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import AmisRenderer from '../components/AmisRenderer'; // 引入上一环节封装的渲染器
import { fetcher } from '../utils/fetcher';
import { Spinner } from 'amis-ui';
import type { RouteParams } from '../types/models';
import type { AmisSchema } from '../types/amis';
import type { ApiResponse, PageTemplate } from '../types/api';

const AutoDashboard: React.FC = () => {
  const { pageId } = useParams<RouteParams>();
  const [schema, setSchema] = useState<AmisSchema | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!pageId) return;

    setLoading(true);
    setError('');
    setSchema(null);

    // 请求后端页面配置接口
    fetcher<ApiResponse<AmisSchema>>({
      url: `/api/page/${pageId}`,
      method: 'get'
    })
      .then((res) => {
        if (res.data && res.data.status === 0) {
          setSchema(res.data.data as AmisSchema);
        } else {
          setError(res.data?.msg || '获取页面配置失败');
        }
      })
      .catch((err: Error) => {
        console.error(err);
        setError('网络请求错误');
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