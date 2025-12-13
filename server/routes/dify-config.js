/**
 * Dify 配置管理路由
 * 提供 CRUD 接口管理每个页面的工作流配置
 */

const express = require('express');
const router = express.Router();
const db = require('../db');
const { validate, schemas } = require('../middleware/validator');


// 获取所有配置
router.get('/config', (req, res) => {
    const sql = 'SELECT * FROM sys_dify_config ORDER BY created_at DESC';

    db.all(sql, [], (err, rows) => {
        if (err) {
            console.error('[Dify Config] 查询失败:', err);
            return res.status(500).json({
                status: 500,
                msg: '查询配置失败',
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

// 根据 pageKey 获取配置
router.get('/config/:pageKey', (req, res) => {
    const { pageKey } = req.params;
    const sql = 'SELECT * FROM sys_dify_config WHERE page_key = ?';

    db.get(sql, [pageKey], (err, row) => {
        if (err) {
            console.error('[Dify Config] 查询失败:', err);
            return res.status(500).json({
                status: 500,
                msg: '查询配置失败',
                error: err.message
            });
        }

        if (!row) {
            return res.status(404).json({
                status: 404,
                msg: '配置不存在'
            });
        }

        res.json({
            status: 0,
            msg: 'success',
            data: row
        });
    });
});

// 创建配置
router.post('/config', validate(schemas.difyConfigCreate), (req, res) => {
    const { page_key, workflow_name, api_url, api_key, enabled, description } = req.body;

    // 参数验证
    if (!page_key || !workflow_name || !api_url || !api_key) {
        return res.status(400).json({
            status: 400,
            msg: '缺少必填参数: page_key, workflow_name, api_url, api_key'
        });
    }

    const sql = `
    INSERT INTO sys_dify_config 
    (page_key, workflow_name, api_url, api_key, enabled, description)
    VALUES (?, ?, ?, ?, ?, ?)
  `;

    const params = [
        page_key,
        workflow_name,
        api_url,
        api_key,
        enabled !== undefined ? enabled : 1,
        description || ''
    ];

    db.run(sql, params, function (err) {
        if (err) {
            console.error('[Dify Config] 创建失败:', err);

            if (err.message.includes('UNIQUE constraint failed')) {
                return res.status(409).json({
                    status: 409,
                    msg: '该页面已存在配置，请使用更新接口'
                });
            }

            return res.status(500).json({
                status: 500,
                msg: '创建配置失败',
                error: err.message
            });
        }

        res.json({
            status: 0,
            msg: 'success',
            data: {
                id: this.lastID,
                page_key,
                workflow_name,
                api_url,
                enabled: enabled !== undefined ? enabled : 1,
                description
            }
        });
    });
});

// 更新配置
// 更新配置 (PUT)
router.put('/config/:pageKey', validate(schemas.difyConfigUpdate), validate(schemas.pageKey, 'params'), updateDifyConfig);

// 更新配置 (POST) - AMIS form uses POST
router.post('/config/:pageKey', validate(schemas.difyConfigUpdate), validate(schemas.pageKey, 'params'), updateDifyConfig);

// 更新配置的实际处理函数
function updateDifyConfig(req, res) {
    const { pageKey } = req.params;
    const { workflow_name, api_url, api_key, enabled, description } = req.body;

    // 构建动态更新 SQL
    const updates = [];
    const params = [];

    if (workflow_name !== undefined) {
        updates.push('workflow_name = ?');
        params.push(workflow_name);
    }
    if (api_url !== undefined) {
        updates.push('api_url = ?');
        params.push(api_url);
    }
    if (api_key !== undefined) {
        updates.push('api_key = ?');
        params.push(api_key);
    }
    if (enabled !== undefined) {
        updates.push('enabled = ?');
        params.push(enabled);
    }
    if (description !== undefined) {
        updates.push('description = ?');
        params.push(description);
    }

    if (updates.length === 0) {
        return res.status(400).json({
            status: 400,
            msg: '没有需要更新的字段'
        });
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(pageKey);

    const sql = `UPDATE sys_dify_config SET ${updates.join(', ')} WHERE page_key = ?`;

    db.run(sql, params, function (err) {
        if (err) {
            console.error('[Dify Config] 更新失败:', err);
            return res.status(500).json({
                status: 500,
                msg: '更新配置失败',
                error: err.message
            });
        }

        if (this.changes === 0) {
            return res.status(404).json({
                status: 404,
                msg: '配置不存在'
            });
        }

        res.json({
            status: 0,
            msg: 'success',
            data: { page_key: pageKey, updated: true }
        });
    });
}

// 删除配置
router.delete('/config/:pageKey', validate(schemas.pageKey, 'params'), (req, res) => {
    const { pageKey } = req.params;
    const sql = 'DELETE FROM sys_dify_config WHERE page_key = ?';

    db.run(sql, [pageKey], function (err) {
        if (err) {
            console.error('[Dify Config] 删除失败:', err);
            return res.status(500).json({
                status: 500,
                msg: '删除配置失败',
                error: err.message
            });
        }

        if (this.changes === 0) {
            return res.status(404).json({
                status: 404,
                msg: '配置不存在'
            });
        }

        res.json({
            status: 0,
            msg: 'success',
            data: {
                page_key: pageKey,
                deleted: true
            }
        });
    });
});

module.exports = router;
