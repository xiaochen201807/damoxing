/**
 * 后端配置管理路由
 * 提供系统后端配置的读取和更新接口
 */

const express = require('express');
const router = express.Router();
const db = require('../../db');
const logger = require('../../utils/logger');

// 获取所有后端配置
router.get('/backend-config', async (req, res) => {
    const sql = 'SELECT * FROM sys_backend_config ORDER BY config_key ASC';

    try {
        const rows = await db.all(sql, []);
        // 转换数据类型
        const configs = rows.map(row => ({
            ...row,
            config_value: parseConfigValue(row.config_value, row.config_type)
        }));

        res.json({
            status: 0,
            msg: 'success',
            data: configs
        });
    } catch (err) {
        logger.error('[Backend Config] 查询失败:', err);
        res.status(500).json({
            status: 500,
            msg: '查询后端配置失败',
            error: err.message
        });
    }
});

// 获取单个配置
router.get('/backend-config/:key', async (req, res) => {
    const { key } = req.params;
    const sql = 'SELECT * FROM sys_backend_config WHERE config_key = ?';

    try {
        const row = await db.get(sql, [key]);

        if (!row) {
            return res.status(404).json({
                status: 404,
                msg: '配置不存在'
            });
        }

        res.json({
            status: 0,
            msg: 'success',
            data: {
                ...row,
                config_value: parseConfigValue(row.config_value, row.config_type)
            }
        });
    } catch (err) {
        logger.error('[Backend Config] 查询失败:', err);
        res.status(500).json({
            status: 500,
            msg: '查询配置失败',
            error: err.message
        });
    }
});

// 更新配置 (PUT method)
router.put('/backend-config/:key', updateBackendConfig);

// 更新配置 (POST method) - AMIS form submission uses POST
router.post('/backend-config/:key', updateBackendConfig);

// 更新配置的实际处理函数
async function updateBackendConfig(req, res) {
    const { key } = req.params;
    const { config_value } = req.body;

    if (config_value === undefined) {
        return res.status(400).json({
            status: 400,
            msg: '缺少必填参数: config_value'
        });
    }

    // 验证配置值
    const validation = validateConfigValue(key, config_value);
    if (!validation.valid) {
        return res.status(400).json({
            status: 400,
            msg: validation.message
        });
    }

    const sql = `
    UPDATE sys_backend_config 
    SET config_value = ?, updated_at = CURRENT_TIMESTAMP
    WHERE config_key = ?
  `;

    try {
        const result = await db.run(sql, [String(config_value), key]);

        if (result.rowsAffected === 0) {
            return res.status(404).json({
                status: 404,
                msg: '配置不存在'
            });
        }

        logger.info(`[Backend Config] 配置已更新: ${key} = ${config_value}`);

        res.json({
            status: 0,
            msg: 'success',
            data: {
                config_key: key,
                config_value: config_value,
                updated: true,
                restart_required: true // 提示需要重启服务器
            }
        });
    } catch (err) {
        logger.error('[Backend Config] 更新失败:', err);
        return res.status(500).json({
            status: 500,
            msg: '更新配置失败',
            error: err.message
        });
    }
}

// 辅助函数：解析配置值
function parseConfigValue(value, type) {
    switch (type) {
        case 'number':
            return Number(value);
        case 'boolean':
            return value === 'true' || value === '1';
        case 'json':
            try {
                return JSON.parse(value);
            } catch (e) {
                return value;
            }
        default:
            return value;
    }
}

// 辅助函数：验证配置值
function validateConfigValue(key, value) {
    // 限流配置验证
    if (key.includes('rate_limit_window')) {
        const numValue = Number(value);
        if (isNaN(numValue) || numValue < 1000) {
            return {
                valid: false,
                message: '时间窗口不能小于1000毫秒(1秒)'
            };
        }
        if (numValue > 3600000) {
            return {
                valid: false,
                message: '时间窗口不能大于3600000毫秒(1小时)'
            };
        }
    }

    if (key.includes('rate_limit_max')) {
        const numValue = Number(value);
        if (isNaN(numValue) || numValue < 1) {
            return {
                valid: false,
                message: '最大请求数不能小于1'
            };
        }
        if (numValue > 10000) {
            return {
                valid: false,
                message: '最大请求数不能大于10000'
            };
        }
    }

    return { valid: true };
}

module.exports = router;
