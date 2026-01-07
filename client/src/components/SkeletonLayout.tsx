/**
 * 骨架屏组件
 * 在 SSO 验证期间显示页面布局占位符
 */

import React from 'react';
import './SkeletonLayout.css';

interface SkeletonLayoutProps {
    message?: string;
}

const SkeletonLayout: React.FC<SkeletonLayoutProps> = ({ message = '正在验证登录...' }) => {
    return (
        <div className="skeleton-layout">
            {/* 侧边栏骨架 */}
            <aside className="skeleton-sidebar">
                <div className="skeleton-sidebar-header">
                    <div className="skeleton-title"></div>
                </div>
                <nav className="skeleton-nav">
                    {/* 菜单项骨架 */}
                    {[1, 2, 3, 4, 5].map((i) => (
                        <div key={i} className="skeleton-menu-item">
                            <div className="skeleton-icon"></div>
                            <div className="skeleton-text"></div>
                        </div>
                    ))}
                </nav>
            </aside>

            {/* 主内容区骨架 */}
            <main className="skeleton-main">
                {/* 顶部卡片骨架 */}
                <div className="skeleton-cards">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="skeleton-card">
                            <div className="skeleton-card-title"></div>
                            <div className="skeleton-card-content"></div>
                        </div>
                    ))}
                </div>

                {/* 大内容区骨架 */}
                <div className="skeleton-content-area">
                    <div className="skeleton-content-header"></div>
                    <div className="skeleton-content-body">
                        {[1, 2, 3, 4].map((i) => (
                            <div key={i} className="skeleton-row"></div>
                        ))}
                    </div>
                </div>

                {/* 加载提示遮罩 */}
                <div className="skeleton-overlay">
                    <div className="skeleton-loading-box">
                        <div className="skeleton-spinner"></div>
                        <span>{message}</span>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default SkeletonLayout;
