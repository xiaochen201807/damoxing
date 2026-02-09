/**
 * 路由配置 API
 * 管理主路由配置
 */

const express = require('express');
const router = express.Router();
const db = require('../../db');
const logger = require('../../utils/logger');

// GET /api/routes - 获取所有路由配置
router.get('/routes', async (req, res) => {
    logger.info('[Routes API] Fetching all routes');

    const sql = `
        SELECT * FROM sys_routes 
        WHERE is_active = 1 
        ORDER BY order_num ASC, created_at DESC
    `;

    try {
        const rows = await db.all(sql, []);
        logger.info(`[Routes API] Found ${rows.length} active routes`);
        res.json({
            status: 0,
            msg: 'success',
            data: rows
        });
    } catch (err) {
        logger.error('[Routes API] Failed to fetch routes:', err);
        res.status(500).json({
            status: 500,
            msg: '查询路由失败',
            error: err.message
        });
    }
});

// GET /api/routes/:routeKey - 获取单个路由配置
router.get('/routes/:routeKey', async (req, res) => {
    const { routeKey } = req.params;
    logger.info(`[Routes API] Fetching route: ${routeKey}`);

    const sql = 'SELECT * FROM sys_routes WHERE route_key = ?';

    try {
        const row = await db.get(sql, [routeKey]);

        if (!row) {
            return res.status(404).json({
                status: 404,
                msg: '路由不存在'
            });
        }

        res.json({
            status: 0,
            msg: 'success',
            data: row
        });
    } catch (err) {
        logger.error('[Routes API] Failed to fetch route:', err);
        res.status(500).json({
            status: 500,
            msg: '查询路由失败',
            error: err.message
        });
    }
});

// POST /api/routes/:routeKey - 同样支持 POST 方式获取（兼容 AMIS）
router.post('/routes/:routeKey', async (req, res) => {
    const { routeKey } = req.params;
    logger.info(`[Routes API] Fetching route (POST): ${routeKey}`);

    const sql = 'SELECT * FROM sys_routes WHERE route_key = ?';

    try {
        const row = await db.get(sql, [routeKey]);

        if (!row) {
            return res.status(404).json({
                status: 404,
                msg: '路由不存在'
            });
        }

        res.json({
            status: 0,
            msg: 'success',
            data: row
        });
    } catch (err) {
        logger.error('[Routes API] Failed to fetch route:', err);
        res.status(500).json({
            status: 500,
            msg: '查询路由失败',
            error: err.message
        });
    }
});

// POST /api/routes - 创建新路由
router.post('/routes', async (req, res) => {
    const {
        route_key,
        route_name,
        component_type = 'dynamic',
        component_path,
        layout_type = 'default',
        order_num = 0,
        description
    } = req.body;

    // 验证必填字段
    if (!route_key || !route_name) {
        return res.status(400).json({
            status: 400,
            msg: '缺少必填字段: route_key, route_name'
        });
    }

    // 自动生成 route_path
    const route_path = `/${route_key}`;
    const icon = null; // 不再使用图标

    logger.info(`[Routes API] Creating route: ${route_key} -> ${route_path}`);

    const sql = `
        INSERT INTO sys_routes 
        (route_key, route_path, route_name, icon, component_type, component_path, layout_type, order_num, description)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    try {
        const result = await db.run(
            sql,
            [route_key, route_path, route_name, icon, component_type, component_path, layout_type, order_num, description]
        );

        logger.info(`[Routes API] Route created: ${route_key} (ID: ${result.lastID})`);
        res.json({
            status: 0,
            msg: '创建成功',
            data: {
                id: result.lastID,
                route_key,
                route_path,
                route_name
            }
        });
    } catch (err) {
        logger.error('[Routes API] Failed to create route:', err);
        const msg = err.message.includes('UNIQUE') ? '路由标识已存在' : '创建路由失败';
        res.status(500).json({
            status: 500,
            msg: msg,
            error: err.message
        });
    }
});

// PUT /api/routes/:routeKey - 更新路由配置
router.put('/routes/:routeKey', async (req, res) => {
    const { routeKey } = req.params;
    const {
        route_name,
        component_type,
        component_path,
        layout_type,
        order_num,
        is_active,
        description
    } = req.body;

    logger.info(`[Routes API] Updating route: ${routeKey}`);

    // 构建动态更新 SQL
    const updates = [];
    const values = [];

    // route_key 不可修改，但如果更新其他信息，自动同步 route_path
    updates.push('route_path = ?');
    values.push(`/${routeKey}`);

    if (route_name !== undefined) {
        updates.push('route_name = ?');
        values.push(route_name);
    }
    // icon 设置为 null，不再使用
    updates.push('icon = ?');
    values.push(null);

    if (component_type !== undefined) {
        updates.push('component_type = ?');
        values.push(component_type);
    }
    if (component_path !== undefined) {
        updates.push('component_path = ?');
        values.push(component_path);
    }
    if (layout_type !== undefined) {
        updates.push('layout_type = ?');
        values.push(layout_type);
    }
    if (order_num !== undefined) {
        updates.push('order_num = ?');
        values.push(order_num);
    }
    if (is_active !== undefined) {
        updates.push('is_active = ?');
        values.push(is_active ? 1 : 0);
    }
    if (description !== undefined) {
        updates.push('description = ?');
        values.push(description);
    }

    if (updates.length === 0) {
        return res.status(400).json({
            status: 400,
            msg: '没有需要更新的字段'
        });
    }

    updates.push("updated_at = datetime('now', '+08:00')");
    values.push(routeKey);

    const sql = `UPDATE sys_routes SET ${updates.join(', ')} WHERE route_key = ?`;

    try {
        const result = await db.run(sql, values);

        if (result.rowsAffected === 0) {
            return res.status(404).json({
                status: 404,
                msg: '路由不存在'
            });
        }

        logger.info(`[Routes API] Route updated: ${routeKey}`);
        res.json({
            status: 0,
            msg: '更新成功',
            data: { route_key: routeKey, changes: result.rowsAffected }
        });
    } catch (err) {
        logger.error('[Routes API] Failed to update route:', err);
        return res.status(500).json({
            status: 500,
            msg: '更新路由失败',
            error: err.message
        });
    }
});

// POST /api/routes/:routeKey/update - 更新路由（POST 方式，AMIS 兼容）
router.post('/routes/:routeKey/update', async (req, res) => {
    const { routeKey } = req.params;
    const {
        route_name,
        component_type,
        component_path,
        layout_type,
        order_num,
        is_active,
        description
    } = req.body;

    logger.info(`[Routes API] Updating route (POST): ${routeKey}`);

    const updates = [];
    const values = [];

    // 自动同步 route_path
    updates.push('route_path = ?');
    values.push(`/${routeKey}`);

    if (route_name !== undefined) {
        updates.push('route_name = ?');
        values.push(route_name);
    }

    // icon 设置为 null
    updates.push('icon = ?');
    values.push(null);

    if (component_type !== undefined) {
        updates.push('component_type = ?');
        values.push(component_type);
    }
    if (component_path !== undefined) {
        updates.push('component_path = ?');
        values.push(component_path);
    }
    if (layout_type !== undefined) {
        updates.push('layout_type = ?');
        values.push(layout_type);
    }
    if (order_num !== undefined) {
        updates.push('order_num = ?');
        values.push(order_num);
    }
    if (is_active !== undefined) {
        updates.push('is_active = ?');
        values.push(is_active ? 1 : 0);
    }
    if (description !== undefined) {
        updates.push('description = ?');
        values.push(description);
    }

    if (updates.length === 0) {
        return res.status(400).json({
            status: 400,
            msg: '没有需要更新的字段'
        });
    }

    updates.push("updated_at = datetime('now', '+08:00')");
    values.push(routeKey);

    const sql = `UPDATE sys_routes SET ${updates.join(', ')} WHERE route_key = ?`;

    try {
        const result = await db.run(sql, values);

        if (result.rowsAffected === 0) {
            return res.status(404).json({
                status: 404,
                msg: '路由不存在'
            });
        }

        logger.info(`[Routes API] Route updated (POST): ${routeKey}`);
        res.json({
            status: 0,
            msg: '更新成功',
            data: { route_key: routeKey, changes: result.rowsAffected }
        });
    } catch (err) {
        logger.error('[Routes API] Failed to update route:', err);
        return res.status(500).json({
            status: 500,
            msg: '更新路由失败',
            error: err.message
        });
    }
});

// DELETE /api/routes/:routeKey - 删除路由（软删除）
router.delete('/routes/:routeKey', async (req, res) => {
    const { routeKey } = req.params;

    // 防止删除系统核心路由
    if (['dashboard', 'system'].includes(routeKey)) {
        return res.status(403).json({
            status: 403,
            msg: '不能删除系统核心路由'
        });
    }

    logger.info(`[Routes API] Deleting route: ${routeKey}`);

    const sql = `UPDATE sys_routes SET is_active = 0, updated_at = datetime('now', '+08:00') WHERE route_key = ?`;

    try {
        const result = await db.run(sql, [routeKey]);

        if (result.rowsAffected === 0) {
            return res.status(404).json({
                status: 404,
                msg: '路由不存在'
            });
        }

        logger.info(`[Routes API] Route deleted: ${routeKey}`);
        res.json({
            status: 0,
            msg: '删除成功',
            data: { route_key: routeKey }
        });
    } catch (err) {
        logger.error('[Routes API] Failed to delete route:', err);
        return res.status(500).json({
            status: 500,
            msg: '删除路由失败',
            error: err.message
        });
    }
});

// POST /api/routes/:routeKey/delete - 删除路由（软删除，POST 方式，AMIS 兼容）
router.post('/routes/:routeKey/delete', async (req, res) => {
    const { routeKey } = req.params;

    // 防止删除系统核心路由
    if (['dashboard', 'system'].includes(routeKey)) {
        return res.status(403).json({
            status: 403,
            msg: '不能删除系统核心路由'
        });
    }

    logger.info(`[Routes API] Deleting route (POST): ${routeKey}`);

    const sql = `UPDATE sys_routes SET is_active = 0, updated_at = datetime('now', '+08:00') WHERE route_key = ?`;

    try {
        const result = await db.run(sql, [routeKey]);

        if (result.rowsAffected === 0) {
            return res.status(404).json({
                status: 404,
                msg: '路由不存在'
            });
        }

        logger.info(`[Routes API] Route deleted (POST): ${routeKey}`);
        res.json({
            status: 0,
            msg: '删除成功',
            data: { route_key: routeKey }
        });
    } catch (err) {
        logger.error('[Routes API] Failed to delete route:', err);
        return res.status(500).json({
            status: 500,
            msg: '删除路由失败',
            error: err.message
        });
    }
});

module.exports = router;
