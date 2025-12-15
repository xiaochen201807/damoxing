/**
 * 菜单管理路由
 * 提供菜单的 CRUD 接口
 */

const express = require('express');
const router = express.Router();
const db = require('../db');
const logger = require('../utils/logger');
const cache = require('../utils/cache');

// 获取所有菜单（带缓存）
router.get('/menu', (req, res) => {
    // 1. 先尝试从缓存获取
    const cachedMenu = cache.menu.get();
    if (cachedMenu) {
        logger.debug('[Menu] Cache hit');
        return res.json({
            status: 0,
            msg: 'success',
            data: cachedMenu,
            cached: true, // 标识数据来自缓存
        });
    }

    // 2. 缓存未命中，查询数据库
    const sql = 'SELECT * FROM sys_menu ORDER BY id ASC';

    db.all(sql, [], (err, rows) => {
        if (err) {
            logger.error('[Menu] 查询失败:', err);
            return res.status(500).json({
                status: 500,
                msg: '查询菜单失败',
                error: err.message
            });
        }

        // 3. 缓存查询结果
        cache.menu.set(rows);

        res.json({
            status: 0,
            msg: 'success',
            data: rows
        });
    });
});

// 创建菜单
router.post('/menu', (req, res) => {
    const { label, subtitle, page_key, icon } = req.body;

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

        // 自动生成 path
        const path = `/dashboard/${page_key}`;

        const sql = `INSERT INTO sys_menu (label, subtitle, page_key, path, icon) VALUES (?, ?, ?, ?, ?)`;

        db.run(sql, [label, subtitle || '', page_key, path, icon || ''], function (err) {
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

            logger.info(`[Menu] 创建菜单成功: ${label} (${page_key})`);

            res.json({
                status: 0,
                msg: 'success',
                data: {
                    id: this.lastID,
                    label,
                    subtitle,
                    page_key,
                    path,
                    icon
                }
            });
        });
    });
});

// 删除菜单 - 从 body 中获取 page_key (必须在 /:pageKey 路由之前)
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
    const { label, subtitle, icon, page_key: newPageKey } = req.body;

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
            // 自动更新 path
            updates.push('path = ?');
            params.push(`/dashboard/${newPageKey}`);
        }
        if (icon !== undefined) {
            updates.push('icon = ?');
            params.push(icon);
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
    }
}


module.exports = router;
