/**
 * 登录页面
 * 用户身份验证入口
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { getGatewayParamsWithFallback, saveUrlParamsToSession } from '../utils/urlParams';
import '../styles/Login.css';

// API 路由前缀（从环境变量读取，默认 /api）
const API_PREFIX = import.meta.env.VITE_API_ROUTE_PREFIX || '/api';

const Login: React.FC = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const navigate = useNavigate();

    // 组件加载时保存 URL 参数到 sessionStorage
    useEffect(() => {
        saveUrlParamsToSession();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            // 获取网关参数（从 URL 或 sessionStorage）
            const gatewayParams = getGatewayParamsWithFallback();

            const response = await axios.post(`${API_PREFIX}/auth/login`, {
                username,
                password,
                // 将网关参数一并发送给后端
                ticket: gatewayParams.ticket,
                tyLoginToken: gatewayParams.tyLoginToken,
                qycode: gatewayParams.qycode
            });

            if (response.data.status === 0) {
                // 存储 token 和用户信息
                localStorage.setItem('auth_token', response.data.data.token);
                localStorage.setItem('user_info', JSON.stringify(response.data.data.user));

                // 存储网关信息（包含 qycode）
                if (response.data.data.gateway_info) {
                    localStorage.setItem('gateway_info', JSON.stringify(response.data.data.gateway_info));
                }

                // 跳转到首页
                navigate('/');
            } else {
                setError(response.data.msg || '登录失败');
            }
        } catch (err: any) {
            if (err.response) {
                setError(err.response.data?.msg || '登录失败，请检查用户名和密码');
            } else {
                setError('网络错误，请稍后重试');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-container">
            <div className="login-box">
                <div className="login-header">
                    <h1>大模型智能系统</h1>
                    <p>登录以继续</p>
                </div>

                <form onSubmit={handleSubmit} className="login-form">
                    {error && (
                        <div className="login-error">
                            {error}
                        </div>
                    )}

                    <div className="form-group">
                        <label htmlFor="username">用户名</label>
                        <input
                            id="username"
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="请输入用户名"
                            required
                            autoFocus
                            disabled={loading}
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="password">密码</label>
                        <input
                            id="password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="请输入密码"
                            required
                            disabled={loading}
                        />
                    </div>

                    <button
                        type="submit"
                        className="login-button"
                        disabled={loading}
                    >
                        {loading ? '登录中...' : '登录'}
                    </button>
                </form>

                <div className="login-footer">
                    <p className="hint">默认账号：admin / admin123</p>
                </div>
            </div>
        </div>
    );
};

export default Login;
