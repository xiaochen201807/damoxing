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
router.get('/menu', async (req, res) => {
    try {
        // 获取查询参数
        const { route_key, include_inactive } = req.query;
        logger.info(`[Menu API] Request received. query: ${JSON.stringify(req.query)}`);

        // 是否包含未关联有效页面的菜单（用于管理后台）
        const showAll = include_inactive === 'true' || include_inactive === '1';

        // 1. 尝试从缓存获取（支持 route_key 和 include_inactive 参数）
        const cacheKey = route_key ? `${route_key}:${showAll}` : showAll ? 'all:true' : undefined;
        const cachedMenu = cache.menu.get(cacheKey);
        if (cachedMenu) {
            logger.info(`[Menu API] Cache hit (key: ${cacheKey || 'default'})`);
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

        logger.info(`[Menu API] Executing SQL: ${sql} with params: ${JSON.stringify(params)}`);

        // 直接 await db.all，因为 db.all 已经是 Promise 封装
        logger.info('[Menu API] Calling db.all...');
        const rows = await db.all(sql, params);
        logger.info(`[Menu API] db.all returned ${rows ? rows.length : 'null'} rows`);

        logger.info(`[Menu API] Query success, rows count: ${rows.length}`);

        // 3. 缓存结果（使用包含 include_inactive 的缓存键）
        try {
            logger.info('[Menu API] Setting cache...');
            cache.menu.set(rows, cacheKey);
            logger.info('[Menu API] Cache set success');
        } catch (cacheErr) {
            logger.error('[Menu API] Cache set failed:', cacheErr);
        }

        logger.info('[Menu API] Sending response...');
        res.json({
            status: 0,
            msg: 'success',
            data: rows
        });
        logger.info('[Menu API] Response sent');

    } catch (err) {
        logger.error('[Menu API] Error:', err);
        res.status(500).json({
            status: 500,
            msg: '查询菜单失败',
            error: err.message
        });
    }
});

// 创建菜单
router.post('/menu', async (req, res) => {
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
    try {
        const row = await db.get('SELECT id FROM sys_menu WHERE page_key = ?', [page_key]);

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

        const result = await db.run(sql, [label, subtitle || '', page_key, path, icon || '', menuOrder, menuRouteKey, parent_id || null]);

        // 清除缓存
        cache.menu.clear();

        logger.info(`[Menu] 创建菜单成功: ${label} (${page_key}, route_key: ${menuRouteKey}, order: ${menuOrder})`);

        res.json({
            status: 0,
            msg: 'success',
            data: {
                id: result.lastID,
                label,
                subtitle,
                page_key,
                path,
                icon,
                route_key
            }
        });
    } catch (err) {
        logger.error('[Menu] 创建/查询失败:', err);
        if (err.message && err.message.includes('UNIQUE constraint failed')) {
            return res.status(409).json({
                status: 409,
                msg: '页面标识已存在'
            });
        }
        return res.status(500).json({
            status: 500,
            msg: '操作失败',
            error: err.message
        });
    }
});

// 删除菜单 - 从 body 中获取 page_key
router.post('/menu/delete', async (req, res) => {
    const { page_key } = req.body;

    if (!page_key) {
        return res.status(400).json({
            status: 400,
            msg: '缺少必填参数: page_key'
        });
    }

    const sql = 'DELETE FROM sys_menu WHERE page_key = ?';

    try {
        const result = await db.run(sql, [page_key]);

        if (result.changes === 0) {
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
            msg: 'success'
        });
    } catch (err) {
        logger.error('[Menu] 删除失败:', err);
        res.status(500).json({
            status: 500,
            msg: '删除失败',
            error: err.message
        });
    }
});

// 更新菜单
router.put('/menu', async (req, res) => {
    const { id, label, subtitle, icon, order, route_key, parent_id } = req.body;

    if (!id) {
        return res.status(400).json({
            status: 400,
            msg: '缺少必填参数: id'
        });
    }

    try {
        // 构建更新 SQL
        let sql = 'UPDATE sys_menu SET updated_at = CURRENT_TIMESTAMP';
        const params = [];

        if (label !== undefined) {
            sql += ', label = ?';
            params.push(label);
        }
        if (subtitle !== undefined) {
            sql += ', subtitle = ?';
            params.push(subtitle);
        }
        if (icon !== undefined) {
            sql += ', icon = ?';
            params.push(icon);
        }
        if (order !== undefined) {
            sql += ', `order` = ?';
            params.push(order);
        }
        if (route_key !== undefined) {
            sql += ', route_key = ?';
            params.push(route_key);
        }
        if (parent_id !== undefined) {
            sql += ', parent_id = ?';
            params.push(parent_id);
        }

        sql += ' WHERE id = ?';
        params.push(id);

        const result = await db.run(sql, params);

        if (result.changes === 0) {
            return res.status(404).json({
                status: 404,
                msg: '菜单不存在'
            });
        }

        // 清除缓存
        cache.menu.clear();

        logger.info(`[Menu] 更新菜单成功: ID ${id}`);

        res.json({
            status: 0,
            msg: 'success'
        });
    } catch (err) {
        logger.error('[Menu] 更新失败:', err);
        res.status(500).json({
            status: 500,
            msg: '更新失败',
            error: err.message
        });
    }
});

module.exports = router;
