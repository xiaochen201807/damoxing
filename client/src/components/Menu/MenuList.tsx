import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { Link, useLocation } from 'react-router-dom';
import type { MenuItem } from '../../types/api';
import './Menu.css';

interface TooltipProps {
    title: string;
    subtitle?: string;
    targetRef: React.RefObject<HTMLElement>;
    visible: boolean;
}

const Tooltip: React.FC<TooltipProps> = ({ title, subtitle, targetRef, visible }) => {
    const [position, setPosition] = useState({ top: 0, left: 0 });

    useEffect(() => {
        if (visible && targetRef.current) {
            const rect = targetRef.current.getBoundingClientRect();
            setPosition({
                top: rect.top,
                left: rect.right + 10 // 显示在右侧 10px 处
            });
        }
    }, [visible, targetRef]);

    if (!visible) return null;

    return ReactDOM.createPortal(
        <div
            className="custom-menu-tooltip"
            style={{
                top: position.top,
                left: position.left,
            }}
        >
            <div className="tooltip-title">{title}</div>
            {subtitle && <div className="tooltip-subtitle">{subtitle}</div>}
        </div>,
        document.body
    );
};

interface SubMenuProps {
    item: MenuItem;
    routeKey: string;
    level?: number;
}

const SubMenu: React.FC<SubMenuProps> = ({ item, routeKey, level = 1 }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [isHovered, setIsHovered] = useState(false);
    const itemRef = useRef<HTMLLIElement>(null);
    const location = useLocation();
    const hasChildren = item.children && item.children.length > 0;

    // 检查是否有子菜单处于激活状态
    const hasActiveChild = (menuItem: MenuItem): boolean => {
        if (!menuItem.children) return false;
        return menuItem.children.some(child => {
            if (location.pathname === `/${routeKey}/${child.page_key}`) return true;
            return hasActiveChild(child);
        });
    };

    const isActive = hasActiveChild(item);

    // 如果有激活的子菜单，自动展开
    React.useEffect(() => {
        if (isActive) {
            setIsOpen(true);
        }
    }, [isActive]);

    // 显示 Tooltip 的条件：有文本且鼠标悬停
    const showTooltip = isHovered && !!item.label;

    if (!hasChildren) {
        // 没有子菜单，渲染普通菜单项
        return (
            <li
                className={`menu-item level-${level}`}
                ref={itemRef}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
            >
                <Link
                    to={`/${routeKey}/${item.page_key}`}
                    className={
                        location.pathname === `/${routeKey}/${item.page_key}`
                            ? 'menu-link active'
                            : 'menu-link'
                    }
                    title={item.label} // 原生 title 作为兜底
                >
                    {item.icon && <i className={item.icon}></i>}
                    <div className="menu-text">
                        <span className="menu-label">{item.label}</span>
                        {item.subtitle && <span className="menu-subtitle">{item.subtitle}</span>}
                    </div>
                </Link>
                <Tooltip
                    title={item.label}
                    subtitle={item.subtitle}
                    targetRef={itemRef}
                    visible={showTooltip}
                />
            </li>
        );
    }

    // 有子菜单，渲染可折叠的子菜单
    return (
        <li
            className={`submenu level-${level} ${isOpen ? 'open' : ''}`}
            // 对于有子菜单的项，也可以显示 tooltip，这里加在父 li 上
            ref={itemRef}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <div
                className="submenu-header"
                onClick={() => setIsOpen(!isOpen)}
                title={item.label}
            >
                <div className="submenu-title">
                    {item.icon && <i className={item.icon}></i>}
                    <div className="menu-text">
                        <span className="menu-label">{item.label}</span>
                        {item.subtitle && <span className="menu-subtitle">{item.subtitle}</span>}
                    </div>
                </div>
                <span className="submenu-arrow">▶</span>
            </div>
            <ul className="submenu-list">
                {item.children!.map((child: MenuItem) => (
                    <SubMenu
                        key={child.id}
                        item={child}
                        routeKey={routeKey}
                        level={level + 1}
                    />
                ))}
            </ul>
            <Tooltip
                title={item.label}
                subtitle={item.subtitle}
                targetRef={itemRef}
                visible={showTooltip}
            />
        </li>
    );
};

interface MenuListProps {
    items: MenuItem[];
    routeKey: string;
}

const MenuList: React.FC<MenuListProps> = ({ items, routeKey }) => {
    if (!items || items.length === 0) {
        return <div className="menu-empty">暂无菜单</div>;
    }

    return (
        <ul className="menu-list">
            {items.map((item: MenuItem) => (
                <SubMenu
                    key={item.id}
                    item={item}
                    routeKey={routeKey}
                    level={1}
                />
            ))}
        </ul>
    );
};

export default MenuList;
