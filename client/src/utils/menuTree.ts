/**
 * 菜单树形结构工具函数
 */

import type { MenuItem } from '../types/api';

/**
 * 将扁平菜单列表转换为树形结构
 * @param flatList 扁平菜单列表
 * @returns 树形菜单数组
 */
export function buildMenuTree(flatList: MenuItem[]): MenuItem[] {
    if (!flatList || flatList.length === 0) {
        return [];
    }

    // 创建 ID 到菜单项的映射
    const map = new Map<number, MenuItem>();
    const roots: MenuItem[] = [];

    // 第一遍：创建映射并初始化 children 数组
    flatList.forEach(item => {
        map.set(item.id, { ...item, children: [] });
    });

    // 第二遍：构建父子关系
    flatList.forEach(item => {
        const node = map.get(item.id)!;

        if (item.parent_id === null || item.parent_id === undefined) {
            // 根节点
            roots.push(node);
        } else {
            // 子节点 - 找到父节点并添加
            const parent = map.get(item.parent_id);
            if (parent) {
                parent.children!.push(node);
            } else {
                // 父节点不存在（数据异常），作为根节点处理
                console.warn(`菜单项 ${item.id} 的父节点 ${item.parent_id} 不存在，将作为根节点处理`);
                roots.push(node);
            }
        }
    });

    // 递归排序子节点（按 order 字段）
    const sortChildren = (items: MenuItem[]) => {
        items.sort((a, b) => a.order - b.order || a.id - b.id);
        items.forEach(item => {
            if (item.children && item.children.length > 0) {
                sortChildren(item.children);
            }
        });
    };

    sortChildren(roots);

    return roots;
}

/**
 * 获取菜单项的层级深度
 * @param item 菜单项
 * @param flatList 完整的扁平列表（用于查找父节点）
 * @returns 层级深度（根节点为 0）
 */
export function getMenuDepth(item: MenuItem, flatList: MenuItem[]): number {
    let depth = 0;
    let currentId = item.parent_id;

    while (currentId !== null && currentId !== undefined) {
        depth++;
        const parent = flatList.find(menu => menu.id === currentId);
        if (!parent) break;
        currentId = parent.parent_id;
    }

    return depth;
}

/**
 * 获取菜单项的完整路径（面包屑）
 * @param item 菜单项
 * @param flatList 完整的扁平列表
 * @returns 路径数组，从根到当前节点
 */
export function getMenuPath(item: MenuItem, flatList: MenuItem[]): MenuItem[] {
    const path: MenuItem[] = [item];
    let currentId = item.parent_id;

    while (currentId !== null && currentId !== undefined) {
        const parent = flatList.find(menu => menu.id === currentId);
        if (!parent) break;
        path.unshift(parent);
        currentId = parent.parent_id;
    }

    return path;
}

/**
 * 查找菜单项（递归搜索树形结构）
 * @param tree 树形菜单
 * @param predicate 查找条件
 * @returns 找到的菜单项或 undefined
 */
export function findMenuItem(
    tree: MenuItem[],
    predicate: (item: MenuItem) => boolean
): MenuItem | undefined {
    for (const item of tree) {
        if (predicate(item)) {
            return item;
        }
        if (item.children && item.children.length > 0) {
            const found = findMenuItem(item.children, predicate);
            if (found) return found;
        }
    }
    return undefined;
}

/**
 * 展平树形菜单为列表
 * @param tree 树形菜单
 * @returns 扁平列表
 */
export function flattenMenuTree(tree: MenuItem[]): MenuItem[] {
    const result: MenuItem[] = [];

    const flatten = (items: MenuItem[]) => {
        items.forEach(item => {
            const { children, ...itemWithoutChildren } = item;
            result.push(itemWithoutChildren as MenuItem);
            if (children && children.length > 0) {
                flatten(children);
            }
        });
    };

    flatten(tree);
    return result;
}
