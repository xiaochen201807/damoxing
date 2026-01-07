/**
 * 登录页面
 * 用户身份验证入口
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { getGatewayParamsWithFallback, saveUrlParamsToSession, getUrlParam } from '../utils/urlParams';
import '../styles/Login.css';

// 默认跳转路径
const DEFAULT_REDIRECT_PATH = '/system/config';

// API 路由前缀（从环境变量读取，默认 /api）
const API_PREFIX = import.meta.env.VITE_API_ROUTE_PREFIX || '/api';

const Login: React.FC = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [ssoMode, setSsoMode] = useState(false); // 是否为 SSO 模式
    const navigate = useNavigate();

    // 组件加载时保存 URL 参数到 sessionStorage，并尝试 SSO 自动登录
    useEffect(() => {
        saveUrlParamsToSession();

        // 检查是否有网关参数，如果有则尝试 SSO 登录
        const gatewayParams = getGatewayParamsWithFallback();

        if (gatewayParams.ticket && gatewayParams.tyLoginToken) {
            console.log('[SSO] 检测到网关参数，尝试自动登录');
            setSsoMode(true);
            performSsoLogin(gatewayParams);
        }
    }, []);

    /**
     * 获取登录后的跳转路径
     * - 有网关参数（cheque + tyLoginToken）时：返回原始路径或默认路径
     * - 无网关参数时：返回默认路径
     */
    const getRedirectPath = (hasGatewayParams: boolean): string => {
        if (hasGatewayParams) {
            // 网关登录：优先返回原始路径
            const returnUrl = getUrlParam('returnUrl');
            if (returnUrl && returnUrl !== '/' && returnUrl !== '/login') {
                return returnUrl;
            }
        }
        // 默认跳转到系统配置页面
        return DEFAULT_REDIRECT_PATH;
    };

    // SSO 自动登录
    const performSsoLogin = async (gatewayParams: any) => {
        setLoading(true);
        setError('正在通过网关验证登录...');

        try {
            const response = await axios.post(`${API_PREFIX}/auth/login`, {
                // SSO 模式下不需要 username/password
                // 如果 ticket 是 "nothing" 则使用 cheque 参数
                ticket: gatewayParams.ticket === 'nothing' ? gatewayParams.cheque : gatewayParams.ticket,
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

                // 网关登录成功，跳转到原始路径或默认路径
                const redirectPath = getRedirectPath(true);
                console.log('[SSO] 登录成功，跳转到:', redirectPath);
                navigate(redirectPath);
            } else {
                setError(response.data.msg || 'SSO 登录失败');
                setSsoMode(false); // 失败后显示表单
            }
        } catch (err: any) {
            console.error('[SSO] 自动登录失败:', err);
            if (err.response) {
                setError(err.response.data?.msg || 'SSO 登录失败，请联系管理员');
            } else {
                setError('网络错误，请稍后重试');
            }
            setSsoMode(false); // 失败后显示表单
        } finally {
            setLoading(false);
        }
    };

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
                // 如果 ticket 是 "nothing" 则使用 cheque 参数
                ticket: gatewayParams.cheque,
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

                // 判断是否有网关参数
                const hasGatewayParams = !!(gatewayParams.cheque && gatewayParams.tyLoginToken);
                const redirectPath = getRedirectPath(hasGatewayParams);
                console.log('[Login] 登录成功，跳转到:', redirectPath);
                navigate(redirectPath);
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
                    <p>{ssoMode && loading ? '正在验证网关登录...' : '登录以继续'}</p>
                </div>

                {ssoMode && loading ? (
                    // SSO 登录中，显示加载状态
                    <div className="login-form">
                        <div className="login-loading">
                            <div className="spinner"></div>
                            <p>正在通过网关验证登录...</p>
                            {error && <div className="login-error">{error}</div>}
                        </div>
                    </div>
                ) : (
                    // 正常登录表单
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
                )}

                <div className="login-footer">
                    <p className="hint">默认账号：admin / admin123</p>
                </div>
            </div>
        </div>
    );
};

export default Login;
