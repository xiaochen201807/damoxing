/**
 * 菜单相关类型定义
 */

// 菜单项
export interface MenuItem {
    id: number;
    label: string;
    page_key: string;
    route_key: string;
    icon?: string;
    order: number;
    path?: string;
    subtitle?: string;
}

// 菜单创建参数
export interface CreateMenuParams {
    label: string;
    page_key: string;
    route_key?: string;
    icon?: string;
    order?: number;
}

// 菜单查询参数
export interface MenuQueryParams {
    route_key?: string;
}
