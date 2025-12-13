/**
 * 菜单管理路由
 * 提供菜单的 CRUD 接口
 */

const express = require('express');
const router = express.Router();
const db = require('../db');

// 获取所有菜单
router.get('/menu', (req, res) => {
    const sql = 'SELECT * FROM sys_menu ORDER BY id ASC';

    db.all(sql, [], (err, rows) => {
        if (err) {
            console.error('[Menu] 查询失败:', err);
            return res.status(500).json({
                status: 500,
                msg: '查询菜单失败',
                error: err.message
            });
        }

        res.json({
            status: 0,
            msg: 'success',
            data: rows
        });
    });
});

// 创建菜单
router.post('/menu', (req, res) => {
    const { label, subtitle, path, icon } = req.body;

    if (!label) {
        return res.status(400).json({
            status: 400,
            msg: '缺少必填参数: label'
        });
    }

    const sql = `INSERT INTO sys_menu (label, subtitle, path, icon) VALUES (?, ?, ?, ?)`;

    db.run(sql, [label, subtitle || '', path || '', icon || ''], function (err) {
        if (err) {
            console.error('[Menu] 创建失败:', err);
            return res.status(500).json({
                status: 500,
                msg: '创建菜单失败',
                error: err.message
            });
        }

        res.json({
            status: 0,
            msg: 'success',
            data: {
                id: this.lastID,
                label,
                subtitle,
                path,
                icon
            }
        });
    });
});

// 更新菜单 (PUT)
router.put('/menu/:id', updateMenu);

// 更新菜单 (POST) - AMIS form uses POST
router.post('/menu/:id', updateMenu);

// 更新菜单的实际处理函数
function updateMenu(req, res) {
    const { id } = req.params;
    const { label, subtitle, path, icon } = req.body;

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
    if (path !== undefined) {
        updates.push('path = ?');
        params.push(path);
    }
    if (icon !== undefined) {
        updates.push('icon = ?');
        params.push(icon);
    }

    if (updates.length === 0) {
        return res.status(400).json({
            status: 400,
            msg: '没有需要更新的字段'
        });
    }

    params.push(id);
    const sql = `UPDATE sys_menu SET ${updates.join(', ')} WHERE id = ?`;

    db.run(sql, params, function (err) {
        if (err) {
            console.error('[Menu] 更新失败:', err);
            return res.status(500).json({
                status: 500,
                msg: '更新菜单失败',
                error: err.message
            });
        }

        if (this.changes === 0) {
            return res.status(404).json({
                status: 404,
                msg: '菜单不存在'
            });
        }

        res.json({
            status: 0,
            msg: 'success',
            data: { id, updated: true }
        });
    });
}

// 删除菜单
router.delete('/menu/:id', (req, res) => {
    const { id } = req.params;
    const sql = 'DELETE FROM sys_menu WHERE id = ?';

    db.run(sql, [id], function (err) {
        if (err) {
            console.error('[Menu] 删除失败:', err);
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

        res.json({
            status: 0,
            msg: 'success',
            data: { id, deleted: true }
        });
    });
});

module.exports = router;
