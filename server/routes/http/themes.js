/**
 * 主题管理 API 路由
 * 提供主题列表和主题预览功能
 */
const express = require('express');
const router = express.Router();
const db = require('../../db');
const logger = require('../../utils/logger');

// GET /api/themes - 获取主题列表
router.get('/', async (req, res) => {
    const sql = 'SELECT * FROM sys_style_themes WHERE is_active = 1';

    try {
        const rows = await db.all(sql, []);
        
        // 解析 CSS 变量 JSON
        const themes = rows.map(row => ({
            ...row,
            css_variables: row.css_variables ? JSON.parse(row.css_variables) : {}
        }));

        logger.info(`[Themes API] Found ${themes.length} themes`);
        res.json({ status: 0, data: themes });
    } catch (err) {
        logger.error('[Themes API] Failed to query themes:', err);
        res.status(500).json({
            status: 500,
            msg: '查询主题失败',
            error: err.message
        });
    }
});

// GET /api/themes/:themeId - 获取单个主题详情
router.get('/:themeId', async (req, res) => {
    const { themeId } = req.params;

    try {
        const row = await db.get(
            'SELECT * FROM sys_style_themes WHERE theme_id = ? AND is_active = 1',
            [themeId]
        );

        if (!row) {
            return res.status(404).json({
                status: 404,
                msg: '主题不存在'
            });
        }

        const theme = {
            ...row,
            css_variables: row.css_variables ? JSON.parse(row.css_variables) : {}
        };

        logger.info(`[Themes API] Theme found: ${themeId}`);
        res.json({ status: 0, data: theme });
    } catch (err) {
        logger.error('[Themes API] Failed to query theme:', err);
        res.status(500).json({
            status: 500,
            msg: '查询主题失败',
            error: err.message
        });
    }
});

// POST /api/themes/preview - 预览主题效果
router.post('/preview', async (req, res) => {
    const { theme_id, schema } = req.body;

    if (!theme_id) {
        return res.status(400).json({
            status: 400,
            msg: '缺少必填参数: theme_id'
        });
    }

    try {
        // 查询主题配置
        const theme = await db.get(
            'SELECT * FROM sys_style_themes WHERE theme_id = ? AND is_active = 1',
            [theme_id]
        );

        if (!theme) {
            return res.status(404).json({
                status: 404,
                msg: '主题不存在'
            });
        }

        // 返回主题配置 + Schema（前端应用主题后渲染）
        res.json({
            status: 0,
            data: {
                theme: {
                    amis_theme: theme.amis_theme,
                    css_variables: JSON.parse(theme.css_variables || '{}'),
                    custom_css: theme.custom_css
                },
                schema: schema || null
            }
        });
    } catch (err) {
        logger.error('[Themes API] Failed to query theme:', err);
        res.status(500).json({
            status: 500,
            msg: '查询主题失败',
            error: err.message
        });
    }
});

module.exports = router;
