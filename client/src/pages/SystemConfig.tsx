import React, { useEffect, useState } from 'react';
import AmisRenderer from '../components/AmisRenderer';
import { fetcher } from '../utils/fetcher';
import { API_ENDPOINTS } from '../config/constants';
import type { AmisSchema } from '../types/amis';
import type { ApiResponse } from '../types/api';

const SystemConfig: React.FC = () => {
    const [schema, setSchema] = useState<AmisSchema | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        // 直接获取config页面的schema
        fetcher<ApiResponse<AmisSchema>>({
            url: API_ENDPOINTS.PAGE_BY_KEY('config'),
            method: 'get'
        })
            .then((res) => {
                // API返回格式: { status: 0, msg: 'success', data: <schema对象> }
                if (res.data && res.data.status === 0 && res.data.data) {
                    setSchema(res.data.data);
                } else {
                    setError('加载配置页面失败');
                }
            })
            .catch((err) => {
                console.error('Failed to load config schema:', err);
                setError('加载配置页面出错');
            })
            .finally(() => {
                setLoading(false);
            });
    }, []);

    if (loading) {
        return (
            <div style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                height: '100vh'
            }}>
                <div>加载中...</div>
            </div>
        );
    }

    if (error || !schema) {
        return (
            <div style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                height: '100vh',
                flexDirection: 'column'
            }}>
                <div style={{ color: 'red', marginBottom: '20px' }}>
                    {error || '配置页面不存在'}
                </div>
                <a href="/" style={{ color: '#1890ff' }}>返回首页</a>
            </div>
        );
    }

    return (
        <div style={{
            width: '100vw',
            height: '100vh',
            overflow: 'auto',
            backgroundColor: '#f0f2f5'
        }}>
            <AmisRenderer schema={schema} />
        </div>
    );
};

export default SystemConfig;
