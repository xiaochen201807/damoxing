/**
 * 菜单管理路由
 * 提供菜单的 CRUD 接口
 */

const express = require('express');
const router = express.Router();
const db = require('../../db');
const logger = require('../../utils/logger');
const cache = require('../../utils/cache');

// 获取所有菜单
router.get('/menu', (req, res) => {
    // 获取查询参数
    const { route_key, include_inactive } = req.query;
    console.log('[DEBUG Menu API] Query params:', req.query);
    console.log('[DEBUG Menu API] route_key:', route_key);
    console.log('[DEBUG Menu API] include_inactive:', include_inactive);

    // 是否包含未关联有效页面的菜单（用于管理后台）
    const showAll = include_inactive === 'true' || include_inactive === '1';

    // 1. 尝试从缓存获取（支持 route_key 和 include_inactive 参数）
    const cacheKey = route_key ? `${route_key}:${showAll}` : showAll ? 'all:true' : undefined;
    const cachedMenu = cache.menu.get(cacheKey);
    if (cachedMenu) {
        logger.debug(`[Menu] Cache hit (key: ${cacheKey || 'default'})`);
        return res.json({
            status: 0,
            msg: 'success',
            data: cachedMenu,
            cached: true,
        });
    }

    // 2. 构建查询SQL
    let sql;
    const params = [];

    if (showAll) {
        // 管理后台模式：使用 LEFT JOIN，显示所有菜单（包括未关联页面的）
        sql = `
            SELECT m.*, p.is_active as page_is_active
            FROM sys_menu m
            LEFT JOIN sys_page_template p ON m.page_key = p.page_key AND p.is_active = 1
            WHERE 1=1
        `;
    } else {
        // 前端导航模式：使用 INNER JOIN，只显示有效页面的菜单
        sql = `
            SELECT m.* 
            FROM sys_menu m
            INNER JOIN sys_page_template p ON m.page_key = p.page_key
            WHERE p.is_active = 1
        `;
    }

    if (route_key) {
        sql += ' AND m.route_key = ?';
        params.push(route_key);
    }

    // 支持层级结构：先按 parent_id 排序（NULL 在前），再按 order 和 id
    sql += ' ORDER BY m.route_key ASC, CASE WHEN m.parent_id IS NULL THEN 0 ELSE 1 END ASC, m.parent_id ASC, m.`order` ASC, m.id ASC';

    db.all(sql, params, (err, rows) => {
        if (err) {
            logger.error('[Menu] 查询失败:', err);
            return res.status(500).json({
                status: 500,
                msg: '查询菜单失败',
                error: err.message
            });
        }

        // 3. 缓存结果（使用包含 include_inactive 的缓存键）
        cache.menu.set(rows, cacheKey);

        res.json({
            status: 0,
            msg: 'success',
            data: rows
        });
    });
});

// 创建菜单
router.post('/menu', (req, res) => {
    const { label, subtitle, page_key, icon, order, route_key, parent_id } = req.body;

    if (!label) {
        return res.status(400).json({
            status: 400,
            msg: '缺少必填参数: label'
        });
    }

    if (!page_key || !page_key.trim()) {
        return res.status(400).json({
            status: 400,
            msg: '缺少必填参数: page_key'
        });
    }

    // 校验 page_key 格式（只允许字母、数字、下划线、连字符）
    if (!/^[a-zA-Z0-9_-]+$/.test(page_key)) {
        return res.status(400).json({
            status: 400,
            msg: 'page_key 只能包含字母、数字、下划线和连字符'
        });
    }

    // 检查 page_key 是否已存在
    db.get('SELECT id FROM sys_menu WHERE page_key = ?', [page_key], (err, row) => {
        if (err) {
            logger.error('[Menu] 查询 page_key 失败:', err);
            return res.status(500).json({
                status: 500,
                msg: '查询失败',
                error: err.message
            });
        }

        if (row) {
            return res.status(409).json({
                status: 409,
                msg: `页面标识 "${page_key}" 已存在，请使用其他标识`
            });
        }

        // 设置默认值
        const menuOrder = order !== undefined ? order : 0;
        const menuRouteKey = route_key || 'dashboard';

        // 自动生成 path (使用 route_key 作为前缀)
        const path = `/${menuRouteKey}/${page_key}`;

        const sql = `
            INSERT INTO sys_menu (label, subtitle, page_key, path, icon, \`order\`, route_key, parent_id) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `;

        db.run(sql, [label, subtitle || '', page_key, path, icon || '', menuOrder, menuRouteKey, parent_id || null], function (err) {
            if (err) {
                logger.error('[Menu] 创建失败:', err);
                if (err.message.includes('UNIQUE constraint failed')) {
                    return res.status(409).json({
                        status: 409,
                        msg: '页面标识已存在'
                    });
                }
                return res.status(500).json({
                    status: 500,
                    msg: '创建菜单失败',
                    error: err.message
                });
            }

            // 清除缓存
            cache.menu.clear();

            logger.info(`[Menu] 创建菜单成功: ${label} (${page_key}, route_key: ${menuRouteKey}, order: ${menuOrder})`);

            res.json({
                status: 0,
                msg: 'success',
                data: {
                    id: this.lastID,
                    label,
                    subtitle,
                    page_key,
                    path,
                    icon,
                    route_key
                }
            });
        });
    });
});

// 删除菜单 - 从 body 中获取 page_key
router.post('/menu/delete', (req, res) => {
    const { page_key } = req.body;

    if (!page_key) {
        return res.status(400).json({
            status: 400,
            msg: '缺少必填参数: page_key'
        });
    }

    const sql = 'DELETE FROM sys_menu WHERE page_key = ?';

    db.run(sql, [page_key], function (err) {
        if (err) {
            logger.error('[Menu] 删除失败:', err);
            return res.status(500).json({
                status: 500,
                msg: '删除菜单失败',
                error: err.message
            });
        }

        if (this.changes === 0) {
            return res.status(404).json({
                status: 404,
                msg: '菜单不存在'
            });
        }

        // 清除缓存
        cache.menu.clear();

        logger.info(`[Menu] 删除菜单成功: ${page_key}`);

        res.json({
            status: 0,
            msg: 'success',
            data: { page_key, deleted: true }
        });
    });
});

// 更新菜单 (PUT)
router.put('/menu/:pageKey', updateMenu);

// 更新菜单 (POST) - AMIS 兼容
router.post('/menu/:pageKey', updateMenu);

// 更新菜单的实际处理函数
function updateMenu(req, res) {
    const { pageKey } = req.params;
    const { label, subtitle, icon, page_key: newPageKey, order, route_key, parent_id } = req.body;

    // 1. 如果要修改 page_key，需要检查新 key 是否已存在
    if (newPageKey !== undefined && newPageKey !== pageKey) {
        if (!newPageKey.trim()) {
            return res.status(400).json({ status: 400, msg: 'page_key 不能为空' });
        }
        if (!/^[a-zA-Z0-9_-]+$/.test(newPageKey)) {
            return res.status(400).json({ status: 400, msg: 'page_key 只能包含字母、数字、下划线和连字符' });
        }

        // 检查新 page_key 是否被其他菜单占用
        // 注意：这里需要排除掉自己。怎么排除？需要先查出自己的ID吗？
        // 其实可以直接 WHERE page_key = ? AND page_key != ? (db level check)
        // 或者简单点：查 page_key = ?，如果存在，且 row.page_key != current pageKey (unnecessary if we update WHERE page_key = current)
        // 实际上：check existing for `newPageKey`
        db.get('SELECT id FROM sys_menu WHERE page_key = ?', [newPageKey], (err, row) => {
            if (err) return res.status(500).json({ status: 500, error: err.message });
            if (row) {
                return res.status(409).json({ status: 409, msg: `页面标识 "${newPageKey}" 已被其他菜单使用` });
            }
            performUpdate();
        });
    } else {
        performUpdate();
    }

    function performUpdate() {
        // 先查询当前菜单信息，以便正确更新 path
        db.get('SELECT page_key, route_key FROM sys_menu WHERE page_key = ?', [pageKey], (err, currentMenu) => {
            if (err) {
                return res.status(500).json({ status: 500, error: err.message });
            }
            if (!currentMenu) {
                return res.status(404).json({ status: 404, msg: '菜单不存在' });
            }

            const updates = [];
            const params = [];

            if (label !== undefined) {
                updates.push('label = ?');
                params.push(label);
            }
            if (subtitle !== undefined) {
                updates.push('subtitle = ?');
                params.push(subtitle);
            }
            if (newPageKey !== undefined && newPageKey !== pageKey) {
                updates.push('page_key = ?');
                params.push(newPageKey);
            }
            if (icon !== undefined) {
                updates.push('icon = ?');
                params.push(icon);
            }
            if (order !== undefined) {
                updates.push('`order` = ?');
                params.push(order);
            }
            if (route_key !== undefined) {
                updates.push('route_key = ?');
                params.push(route_key);
            }
            if (parent_id !== undefined) {
                updates.push('parent_id = ?');
                params.push(parent_id || null);
            }

            // 如果 route_key 或 page_key 有变化，需要更新 path
            if (route_key !== undefined || (newPageKey !== undefined && newPageKey !== pageKey)) {
                const finalRouteKey = route_key !== undefined ? route_key : currentMenu.route_key;
                const finalPageKey = (newPageKey !== undefined && newPageKey !== pageKey) ? newPageKey : currentMenu.page_key;
                updates.push('path = ?');
                params.push(`/${finalRouteKey}/${finalPageKey}`);
            }

            if (updates.length === 0) {
                return res.status(400).json({ status: 400, msg: '没有需要更新的字段' });
            }

            params.push(pageKey);
            const sql = `UPDATE sys_menu SET ${updates.join(', ')} WHERE page_key = ?`;

            db.run(sql, params, function (err) {
                if (err) {
                    logger.error('[Menu] 更新失败:', err);
                    return res.status(500).json({ status: 500, msg: '更新菜单失败', error: err.message });
                }

                if (this.changes === 0) {
                    return res.status(404).json({ status: 404, msg: '菜单不存在' });
                }

                // 清除缓存
                cache.menu.clear();

                // 如果 pageKey 变了，返回新的；否则返回旧的
                const distinctKey = (newPageKey !== undefined && newPageKey !== pageKey) ? newPageKey : pageKey;

                logger.info(`[Menu] 更新菜单成功: ${distinctKey}`);

                res.json({
                    status: 0,
                    msg: 'success',
                    data: { page_key: distinctKey, updated: true }
                });
            });
        });
    }
}


module.exports = router;
