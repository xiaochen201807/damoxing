import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import type { MenuItem } from '../../types/api';
import './Menu.css';

interface SubMenuProps {
    item: MenuItem;
    routeKey: string;
    level?: number;
}

const SubMenu: React.FC<SubMenuProps> = ({ item, routeKey, level = 1 }) => {
    const [isOpen, setIsOpen] = useState(false);
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

    if (!hasChildren) {
        // 没有子菜单，渲染普通菜单项
        return (
            <li className={`menu-item level-${level}`}>
                <Link
                    to={`/${routeKey}/${item.page_key}`}
                    className={
                        location.pathname === `/${routeKey}/${item.page_key}`
                            ? 'menu-link active'
                            : 'menu-link'
                    }
                >
                    {item.icon && <i className={item.icon}></i>}
                    <div className="menu-text">
                        <span className="menu-label">{item.label}</span>
                        {item.subtitle && <span className="menu-subtitle">{item.subtitle}</span>}
                    </div>
                </Link>
            </li>
        );
    }

    // 有子菜单，渲染可折叠的子菜单
    return (
        <li className={`submenu level-${level} ${isOpen ? 'open' : ''}`}>
            <div
                className="submenu-header"
                onClick={() => setIsOpen(!isOpen)}
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
