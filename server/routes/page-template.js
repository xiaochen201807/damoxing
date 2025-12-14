/**
 * 页面模板管理路由 (支持多版本备份)
 * 提供页面模板的 CRUD 及备份恢复接口
 */

const express = require('express');
const router = express.Router();
const db = require('../db');
const logger = require('../utils/logger');

// 获取所有页面模板 (仅返回当前活动版本) + 备份数量
router.get('/template', (req, res) => {
    const sql = `
        SELECT 
            t.id, 
            t.page_key, 
            t.title, 
            length(t.schema_json) as schema_size, 
            t.version, 
            t.updated_at,
            (SELECT COUNT(*) FROM sys_page_template WHERE page_key = t.page_key AND is_active = 0) as backup_count
        FROM sys_page_template t
        WHERE t.is_active = 1 
        ORDER BY t.id ASC
    `;

    db.all(sql, [], (err, rows) => {
        if (err) {
            logger.error('[Template] 查询失败:', err);
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

// 获取单个页面模板 (当前活动版本)
router.get('/template/:pageKey', (req, res) => {
    const { pageKey } = req.params;
    const sql = 'SELECT * FROM sys_page_template WHERE page_key = ? AND is_active = 1';

    db.get(sql, [pageKey], (err, row) => {
        if (err) {
            logger.error('[Template] 查询失败:', err);
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

// 获取页面的备份列表
router.get('/template/:pageKey/backups', (req, res) => {
    const { pageKey } = req.params;
    const sql = `
        SELECT id, version, title, backup_time, length(schema_json) as size, created_at 
        FROM sys_page_template 
        WHERE page_key = ? AND is_active = 0 
        ORDER BY version DESC
    `;

    db.all(sql, [pageKey], (err, rows) => {
        if (err) {
            return res.status(500).json({ status: 500, msg: '查询备份失败', error: err.message });
        }
        res.json({ status: 0, data: rows });
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

    try {
        if (typeof schema_json === 'string') JSON.parse(schema_json);
    } catch (e) {
        return res.status(400).json({ status: 400, msg: 'schema_json 必须是有效的 JSON' });
    }

    const schemaStr = typeof schema_json === 'string' ? schema_json : JSON.stringify(schema_json);
    const sql = `INSERT INTO sys_page_template (page_key, title, schema_json, version, is_active) VALUES (?, ?, ?, 1, 1)`;

    db.run(sql, [page_key, title, schemaStr], function (err) {
        if (err) {
            logger.error('[Template] 创建失败:', err);
            if (err.message.includes('UNIQUE constraint failed')) {
                return res.status(409).json({ status: 409, msg: '该页面标识已存在' });
            }
            return res.status(500).json({ status: 500, msg: '创建页面模板失败', error: err.message });
        }

        res.json({
            status: 0,
            msg: 'success',
            data: { id: this.lastID, page_key, title, version: 1 }
        });
    });
});

// 更新页面模板 (自动备份)
router.put('/template/:pageKey', updateTemplate);
router.post('/template/:pageKey', updateTemplate);

function updateTemplate(req, res) {
    const { pageKey } = req.params;
    const { title, schema_json } = req.body;

    // 1. 获取当前活动版本
    db.get('SELECT * FROM sys_page_template WHERE page_key = ? AND is_active = 1', [pageKey], (err, current) => {
        if (err) return res.status(500).json({ status: 500, error: err.message });
        if (!current) return res.status(404).json({ status: 404, msg: '页面模板不存在' });

        const newTitle = title !== undefined ? title : current.title;
        let newSchema = current.schema_json;

        if (schema_json !== undefined) {
            try {
                if (typeof schema_json === 'string') JSON.parse(schema_json);
                newSchema = typeof schema_json === 'string' ? schema_json : JSON.stringify(schema_json);
            } catch (e) {
                return res.status(400).json({ status: 400, msg: 'schema_json 无效' });
            }
        }

        const newVersion = current.version + 1;


        db.serialize(() => {
            db.run('BEGIN TRANSACTION');

            // 2. 将当前版本标记为备份
            db.run("UPDATE sys_page_template SET is_active = 0, backup_time = datetime('now', '+08:00') WHERE id = ?", [current.id]);

            // 3. 插入新版本
            db.run(
                'INSERT INTO sys_page_template (page_key, title, schema_json, version, is_active) VALUES (?, ?, ?, ?, 1)',
                [pageKey, newTitle, newSchema, newVersion],
                function (err) {
                    if (err) {
                        db.run('ROLLBACK');
                        return res.status(500).json({ status: 500, msg: '更新失败', error: err.message });
                    }

                    // 4. 清理旧备份 (保留最近5个)
                    db.run(`
                        DELETE FROM sys_page_template 
                        WHERE page_key = ? AND is_active = 0 
                        AND id NOT IN (
                            SELECT id FROM sys_page_template 
                            WHERE page_key = ? AND is_active = 0 
                            ORDER BY version DESC 
                            LIMIT 5
                        )
                    `, [pageKey, pageKey]);

                    db.run('COMMIT');
                    res.json({
                        status: 0,
                        msg: 'success',
                        data: { page_key: pageKey, version: newVersion, updated: true }
                    });
                }
            );
        });
    });
}

// 恢复备份
router.post('/template/:pageKey/restore', (req, res) => {
    const { pageKey } = req.params;
    const { version } = req.body;

    if (!version) return res.status(400).json({ status: 400, msg: '缺少 version 参数' });

    // 1. 获取目标备份版本
    db.get('SELECT * FROM sys_page_template WHERE page_key = ? AND version = ?', [pageKey, version], (err, targetVersion) => {
        if (err) return res.status(500).json({ status: 500, error: err.message });
        if (!targetVersion) return res.status(404).json({ status: 404, msg: '指定版本不存在' });

        // 2. 获取当前活动版本
        db.get('SELECT * FROM sys_page_template WHERE page_key = ? AND is_active = 1', [pageKey], (err, current) => {
            if (err) return res.status(500).json({ status: 500, error: err.message });

            // 如果没有活动版本（可能被意外删除了），则直接插入新版本，version 取最大+1
            // 这里简单处理：如果有活动版本，版本号+1；如果没有，版本号取 targetVersion.version + 1 (或者查询最大版本)
            // 为了安全，查询最大版本
            db.get('SELECT MAX(version) as max_ver FROM sys_page_template WHERE page_key = ?', [pageKey], (err, verRow) => {
                const newVersion = (verRow ? verRow.max_ver : targetVersion.version) + 1;

                db.serialize(() => {
                    db.run('BEGIN TRANSACTION');

                    if (current) {
                        // 归档当前版本
                        db.run("UPDATE sys_page_template SET is_active = 0, backup_time = datetime('now', '+08:00') WHERE id = ?", [current.id]);
                    }

                    // 插入恢复的版本作为新版本
                    db.run(
                        'INSERT INTO sys_page_template (page_key, title, schema_json, version, is_active) VALUES (?, ?, ?, ?, 1)',
                        [pageKey, targetVersion.title, targetVersion.schema_json, newVersion],
                        function (err) {
                            if (err) {
                                db.run('ROLLBACK');
                                return res.status(500).json({ status: 500, msg: '恢复失败', error: err.message });
                            }
                            db.run('COMMIT');
                            res.json({
                                status: 0,
                                msg: 'success',
                                data: { page_key: pageKey, restored_from: version, new_version: newVersion }
                            });
                        }
                    );
                });
            });
        });
    });
});

// 删除备份
router.delete('/template/:pageKey/backups/:version', (req, res) => {
    const { pageKey, version } = req.params;

    // 不允许删除活动版本
    const sql = 'DELETE FROM sys_page_template WHERE page_key = ? AND version = ? AND is_active = 0';

    db.run(sql, [pageKey, version], function (err) {
        if (err) return res.status(500).json({ status: 500, error: err.message });
        if (this.changes === 0) return res.status(404).json({ status: 404, msg: '备份不存在或为活动版本不可删除' });

        res.json({ status: 0, msg: 'success', deleted: true });
    });
});

// 删除页面模板 (删除所有版本)
router.delete('/template/:pageKey', (req, res) => {
    const { pageKey } = req.params;
    const sql = 'DELETE FROM sys_page_template WHERE page_key = ?';

    db.run(sql, [pageKey], function (err) {
        if (err) {
            logger.error('[Template] 删除失败:', err);
            return res.status(500).json({ status: 500, msg: '删除页面模板失败', error: err.message });
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
