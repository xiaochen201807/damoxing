/**
 * React Error Boundary 组件
 * 捕获子组件树中的 JavaScript 错误，记录错误并显示降级 UI
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
    readonly state: State;

    constructor(props: Props) {
        super(props);
        this.state = {
            hasError: false,
            error: null,
            errorInfo: null,
        };
    }

    static getDerivedStateFromError(error: Error): Partial<State> {
        // 更新 state 使下一次渲染能够显示降级后的 UI
        return { hasError: true };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        // 记录错误信息
        console.error('ErrorBoundary caught an error:', error, errorInfo);

        // 更新状态
        this.setState({
            error,
            errorInfo,
        });

        // 可以将错误日志上报给服务器
        // this.logErrorToService(error, errorInfo);
    }

    // logErrorToService = (error: Error, errorInfo: ErrorInfo) => {
    //   // 发送错误信息到监控服务（如 Sentry）
    //   fetch('/api/log-error', {
    //     method: 'POST',
    //     headers: { 'Content-Type': 'application/json' },
    //     body: JSON.stringify({
    //       error: error.toString(),
    //       errorInfo: errorInfo.componentStack,
    //       userAgent: navigator.userAgent,
    //       timestamp: new Date().toISOString(),
    //     }),
    //   });
    // };

    handleReset = () => {
        this.setState({
            hasError: false,
            error: null,
            errorInfo: null,
        });
    };

    render() {
        if (this.state.hasError) {
            // 自定义降级 UI
            if (this.props.fallback) {
                return this.props.fallback;
            }

            return (
                <div style={{
                    padding: '40px',
                    textAlign: 'center',
                    backgroundColor: '#f5f5f5',
                    minHeight: '100vh',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}>
                    <div style={{
                        backgroundColor: 'white',
                        padding: '30px',
                        borderRadius: '8px',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                        maxWidth: '600px',
                    }}>
                        <h1 style={{ color: '#ff4d4f', marginBottom: '20px' }}>
                            😕 出错了
                        </h1>
                        <p style={{ color: '#666', marginBottom: '20px' }}>
                            抱歉，页面遇到了一些问题。请尝试刷新页面或联系管理员。
                        </p>

                        {process.env.NODE_ENV === 'development' && this.state.error && (
                            <details style={{
                                marginTop: '20px',
                                padding: '15px',
                                backgroundColor: '#f5f5f5',
                                borderRadius: '4px',
                                textAlign: 'left',
                            }}>
                                <summary style={{ cursor: 'pointer', fontWeight: 'bold', marginBottom: '10px' }}>
                                    错误详情（开发模式）
                                </summary>
                                <pre style={{
                                    fontSize: '12px',
                                    overflow: 'auto',
                                    color: '#d32f2f',
                                    whiteSpace: 'pre-wrap',
                                    wordBreak: 'break-word',
                                }}>
                                    {this.state.error.toString()}
                                    {this.state.errorInfo?.componentStack}
                                </pre>
                            </details>
                        )}

                        <div style={{ marginTop: '30px' }}>
                            <button
                                onClick={() => window.location.reload()}
                                style={{
                                    padding: '10px 24px',
                                    backgroundColor: '#1890ff',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    marginRight: '10px',
                                    fontSize: '14px',
                                }}
                            >
                                刷新页面
                            </button>
                            <button
                                onClick={this.handleReset}
                                style={{
                                    padding: '10px 24px',
                                    backgroundColor: '#fff',
                                    color: '#666',
                                    border: '1px solid #d9d9d9',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontSize: '14px',
                                }}
                            >
                                重试
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
