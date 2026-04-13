/**
 * Dify 配置管理路由
 * 提供 CRUD 接口管理每个页面的工作流配置
 */

const express = require('express');
const router = express.Router();
const db = require('../../db');
const logger = require('../../utils/logger');
const { validate, schemas } = require('../../middleware/validator');


function getPageKeyFromRequest(req) {
    const rawPageKey = req.method === 'GET' ? req.query.page_key : req.body.page_key;
    return Array.isArray(rawPageKey) ? rawPageKey[0] : rawPageKey;
}

async function handleListConfigs(req, res) {
    const page_key = getPageKeyFromRequest(req);

    const sql = page_key
        ? 'SELECT * FROM sys_dify_config WHERE page_key = ? ORDER BY created_at DESC'
        : 'SELECT * FROM sys_dify_config ORDER BY created_at DESC';

    const params = page_key ? [page_key] : [];

    try {
        const rows = await db.all(sql, params);
        res.json({
            status: 0,
            msg: 'success',
            data: rows
        });
    } catch (err) {
        logger.error('[Dify Config] 查询失败:', err);
        res.status(500).json({
            status: 500,
            msg: '查询配置失败',
            error: err.message
        });
    }
}

// 获取所有配置 (支持按 page_key 过滤)
router.get('/config', handleListConfigs);
router.post('/config/list', handleListConfigs);

// 根据 id 获取单个配置
router.get('/config/:id', async (req, res) => {
    const { id } = req.params;
    const sql = 'SELECT * FROM sys_dify_config WHERE id = ?';

    try {
        const row = await db.get(sql, [id]);
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
    } catch (err) {
        logger.error('[Dify Config] 查询失败:', err);
        res.status(500).json({
            status: 500,
            msg: '查询配置失败',
            error: err.message
        });
    }
});

// 创建配置 (支持 workflow_type)
router.post('/config', validate(schemas.difyConfigCreate), async (req, res) => {
    const { page_key, workflow_name, workflow_type, api_url, api_key, enabled, description } = req.body;

    // 参数验证
    if (!page_key || !workflow_name || !api_url || !api_key) {
        return res.status(400).json({
            status: 400,
            msg: '缺少必填参数: page_key, workflow_name, api_url, api_key'
        });
    }

    const sql = `
    INSERT INTO sys_dify_config 
    (page_key, workflow_name, workflow_type, api_url, api_key, enabled, description)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `;

    const params = [
        page_key,
        workflow_name,
        workflow_type || 'ai_analysis',
        api_url,
        api_key,
        enabled !== undefined ? enabled : 1,
        description || ''
    ];

    try {
        const result = await db.run(sql, params);
        res.json({
            status: 0,
            msg: 'success',
            data: {
                id: result.lastID,
                page_key,
                workflow_name,
                api_url,
                enabled: enabled !== undefined ? enabled : 1,
                description
            }
        });
    } catch (err) {
        logger.error('[Dify Config] 创建失败:', err);

        if (err.message.includes('UNIQUE constraint failed')) {
            return res.status(409).json({
                status: 409,
                msg: '该页面已存在同名工作流'
            });
        }

        res.status(500).json({
            status: 500,
            msg: '创建配置失败',
            error: err.message
        });
    }
});

// 删除配置 (物理删除) - 根据 id
router.delete('/config/:id', async (req, res) => {
    const { id } = req.params;

    const sql = 'DELETE FROM sys_dify_config WHERE id = ?';

    try {
        const result = await db.run(sql, [id]);

        if (result.rowsAffected === 0) {
            return res.status(404).json({
                status: 404,
                msg: '配置不存在'
            });
        }

        logger.info(`[Dify Config] 删除配置成功: ID ${id}`);

        res.json({
            status: 0,
            msg: 'success',
            data: { id, deleted: true }
        });
    } catch (err) {
        logger.error('[Dify Config] 删除失败:', err);
        return res.status(500).json({
            status: 500,
            msg: '删除配置失败',
            error: err.message
        });
    }
});

// 删除配置 (POST 方式) - AMIS 兼容
router.post('/config/:id/delete', async (req, res) => {
    const { id } = req.params;

    const sql = 'DELETE FROM sys_dify_config WHERE id = ?';

    try {
        const result = await db.run(sql, [id]);

        if (result.rowsAffected === 0) {
            return res.status(404).json({
                status: 404,
                msg: '配置不存在'
            });
        }

        logger.info(`[Dify Config] 删除配置成功 (POST): ID ${id}`);

        res.json({
            status: 0,
            msg: 'success',
            data: { id, deleted: true }
        });
    } catch (err) {
        logger.error('[Dify Config] 删除失败 (POST):', err);
        return res.status(500).json({
            status: 500,
            msg: '删除配置失败',
            error: err.message
        });
    }
});

// 更新配置 (PUT) - 根据 id
router.put('/config/:id', validate(schemas.difyConfigUpdate), updateDifyConfig);

// 更新配置 (POST) - AMIS form uses POST
router.post('/config/:id', validate(schemas.difyConfigUpdate), updateDifyConfig);

// 更新配置的实际处理函数
async function updateDifyConfig(req, res) {
    const { id } = req.params;
    const { workflow_name, workflow_type, api_url, api_key, enabled, description } = req.body;

    // 构建动态更新 SQL
    const updates = [];
    const params = [];

    if (workflow_name !== undefined) {
        updates.push('workflow_name = ?');
        params.push(workflow_name);
    }
    if (workflow_type !== undefined) {
        updates.push('workflow_type = ?');
        params.push(workflow_type);
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
    params.push(id);

    const sql = `UPDATE sys_dify_config SET ${updates.join(', ')} WHERE id = ?`;

    try {
        const result = await db.run(sql, params);

        if (result.rowsAffected === 0) {
            return res.status(404).json({
                status: 404,
                msg: '配置不存在'
            });
        }

        res.json({
            status: 0,
            msg: 'success',
            data: { id, updated: true }
        });
    } catch (err) {
        logger.error('[Dify Config] 更新失败:', err);
        return res.status(500).json({
            status: 500,
            msg: '更新配置失败',
            error: err.message
        });
    }
}

module.exports = router;
