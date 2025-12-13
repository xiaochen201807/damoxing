/**
 * 页面模板管理路由
 * 提供页面模板的 CRUD 接口
 */

const express = require('express');
const router = express.Router();
const db = require('../db');

// 获取所有页面模板
router.get('/template', (req, res) => {
    const sql = 'SELECT id, page_key, title, length(schema_json) as schema_size FROM sys_page_template ORDER BY id ASC';

    db.all(sql, [], (err, rows) => {
        if (err) {
            console.error('[Template] 查询失败:', err);
            return res.status(500).json({
                status: 500,
                msg: '查询页面模板失败',
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

// 获取单个页面模板（包含完整schema）
router.get('/template/:pageKey', (req, res) => {
    const { pageKey } = req.params;
    const sql = 'SELECT * FROM sys_page_template WHERE page_key = ?';

    db.get(sql, [pageKey], (err, row) => {
        if (err) {
            console.error('[Template] 查询失败:', err);
            return res.status(500).json({
                status: 500,
                msg: '查询页面模板失败',
                error: err.message
            });
        }

        if (!row) {
            return res.status(404).json({
                status: 404,
                msg: '页面模板不存在'
            });
        }

        res.json({
            status: 0,
            msg: 'success',
            data: row
        });
    });
});

// 创建页面模板
router.post('/template', (req, res) => {
    const { page_key, title, schema_json } = req.body;

    if (!page_key || !title || !schema_json) {
        return res.status(400).json({
            status: 400,
            msg: '缺少必填参数: page_key, title, schema_json'
        });
    }

    // 验证 schema_json 是否为有效的 JSON
    try {
        if (typeof schema_json === 'string') {
            JSON.parse(schema_json);
        }
    } catch (e) {
        return res.status(400).json({
            status: 400,
            msg: 'schema_json 必须是有效的 JSON 格式'
        });
    }

    const schemaStr = typeof schema_json === 'string' ? schema_json : JSON.stringify(schema_json);
    const sql = `INSERT INTO sys_page_template (page_key, title, schema_json) VALUES (?, ?, ?)`;

    db.run(sql, [page_key, title, schemaStr], function (err) {
        if (err) {
            console.error('[Template] 创建失败:', err);

            if (err.message.includes('UNIQUE constraint failed')) {
                return res.status(409).json({
                    status: 409,
                    msg: '该页面标识已存在'
                });
            }

            return res.status(500).json({
                status: 500,
                msg: '创建页面模板失败',
                error: err.message
            });
        }

        res.json({
            status: 0,
            msg: 'success',
            data: {
                id: this.lastID,
                page_key,
                title
            }
        });
    });
});

// 更新页面模板 (PUT)
router.put('/template/:pageKey', updateTemplate);

// 更新页面模板 (POST) - AMIS form uses POST
router.post('/template/:pageKey', updateTemplate);

// 更新页面模板的实际处理函数
function updateTemplate(req, res) {
    const { pageKey } = req.params;
    const { title, schema_json } = req.body;

    const updates = [];
    const params = [];

    if (title !== undefined) {
        updates.push('title = ?');
        params.push(title);
    }

    if (schema_json !== undefined) {
        // 验证 schema_json
        try {
            if (typeof schema_json === 'string') {
                JSON.parse(schema_json);
            }
        } catch (e) {
            return res.status(400).json({
                status: 400,
                msg: 'schema_json 必须是有效的 JSON 格式'
            });
        }

        updates.push('schema_json = ?');
        const schemaStr = typeof schema_json === 'string' ? schema_json : JSON.stringify(schema_json);
        params.push(schemaStr);
    }

    if (updates.length === 0) {
        return res.status(400).json({
            status: 400,
            msg: '没有需要更新的字段'
        });
    }

    params.push(pageKey);
    const sql = `UPDATE sys_page_template SET ${updates.join(', ')} WHERE page_key = ?`;

    db.run(sql, params, function (err) {
        if (err) {
            console.error('[Template] 更新失败:', err);
            return res.status(500).json({
                status: 500,
                msg: '更新页面模板失败',
                error: err.message
            });
        }

        if (this.changes === 0) {
            return res.status(404).json({
                status: 404,
                msg: '页面模板不存在'
            });
        }

        res.json({
            status: 0,
            msg: 'success',
            data: { page_key: pageKey, updated: true }
        });
    });
}

// 删除页面模板
router.delete('/template/:pageKey', (req, res) => {
    const { pageKey } = req.params;
    const sql = 'DELETE FROM sys_page_template WHERE page_key = ?';

    db.run(sql, [pageKey], function (err) {
        if (err) {
            console.error('[Template] 删除失败:', err);
            return res.status(500).json({
                status: 500,
                msg: '删除页面模板失败',
                error: err.message
            });
        }

        if (this.changes === 0) {
            return res.status(404).json({
                status: 404,
                msg: '页面模板不存在'
            });
        }

        res.json({
            status: 0,
            msg: 'success',
            data: { page_key: pageKey, deleted: true }
        });
    });
});

module.exports = router;
