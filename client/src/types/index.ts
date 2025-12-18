/**
 * 类型定义入口文件
 * 统一导出所有类型定义
 */

/**
 * 类型定义统一导出
 */

// API 相关 - 重命名导出避免冲突
export type { ApiResponse as ApiResponseOld, MenuItem as MenuItemOld } from './api';

// 模型相关
export * from './models';

// 新增类型 - 优先使用新定义
export * from './route';
export * from './menu';
export * from './page';
export * from './response';

// AMIS 相关
export * from './amis';
