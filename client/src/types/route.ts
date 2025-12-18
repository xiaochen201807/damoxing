/**
 * 路由相关类型定义
 */

// 路由配置
export interface RouteConfig {
    id: number;
    route_key: string;
    route_path: string;
    route_name: string;
    icon?: string;
    component_type: 'dynamic' | 'static';
    component_path?: string;
    layout_type: string;
    order_num: number;
    is_active: boolean;
    description?: string;
    created_at: string;
    updated_at: string;
}

// 路由创建参数
export interface CreateRouteParams {
    route_key: string;
    route_path: string;
    route_name: string;
    icon?: string;
    component_type?: 'dynamic' | 'static';
    component_path?: string;
    layout_type?: string;
    order_num?: number;
    description?: string;
}

// 路由更新参数
export interface UpdateRouteParams extends Partial<CreateRouteParams> {
    is_active?: boolean;
}
