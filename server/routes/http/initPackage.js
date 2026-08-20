/**
 * 数据初始化聚合打包接口路由
 * 提供供外部 Java / 运维自动化程序调用的数据打包接口及安全长期 Token 颁发接口
 */

const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const logger = require('../../utils/logger');
const { authenticateToken, JWT_SECRET } = require('../../middleware/auth');
const { getInitPackageData, TABLE_EXECUTION_ORDER } = require('../../services/initPackageService');

/**
 * 校验请求是否来自本机回环地址（Localhost）
 */
function isLocalhostRequest(req) {
    const candidateIps = [
        req.ip,
        req.connection?.remoteAddress,
        req.socket?.remoteAddress,
        req.connection?.socket?.remoteAddress
    ].filter(Boolean);

    const isLocal = ip => {
        const normalized = String(ip).trim().toLowerCase();
        return (
            normalized === '127.0.0.1' ||
            normalized === '::1' ||
            normalized === '::ffff:127.0.0.1' ||
            normalized === 'localhost'
        );
    };

    return candidateIps.some(isLocal);
}

/**
 * 获取初始化数据包 (POST /api/init-package/data 及 GET /api/init-package/data)
 */
async function handleGetInitPackageData(req, res) {
    try {
        const payload = req.method === 'POST' ? (req.body || {}) : req.query;

        // 提取 sourceJgbh 与 sourceZjgbh（兼容大小写）
        const rawSourceJgbh = payload.sourceJgbh !== undefined ? payload.sourceJgbh : payload.sourcejgbh;
        const rawSourceZjgbh = payload.sourceZjgbh !== undefined ? payload.sourceZjgbh : payload.sourcezjgbh;

        const sourceJgbh = rawSourceJgbh !== undefined && rawSourceJgbh !== null ? String(rawSourceJgbh).trim() : '';
        const sourceZjgbh = rawSourceZjgbh !== undefined && rawSourceZjgbh !== null ? String(rawSourceZjgbh).trim() : '';

        // 必输项校验
        if (!sourceJgbh || !sourceZjgbh) {
            return res.status(400).json({
                status: 1,
                msg: '缺少必输参数: sourceJgbh 和 sourceZjgbh 不能为空'
            });
        }

        const rawTargetJgbh = payload.targetJgbh !== undefined ? payload.targetJgbh : payload.targetjgbh;
        const rawTargetZjgbh = payload.targetZjgbh !== undefined ? payload.targetZjgbh : payload.targetzjgbh;
        const targetJgbh = rawTargetJgbh !== undefined && rawTargetJgbh !== null ? String(rawTargetJgbh).trim() : undefined;
        const targetZjgbh = rawTargetZjgbh !== undefined && rawTargetZjgbh !== null ? String(rawTargetZjgbh).trim() : undefined;

        let modules = payload.modules;
        if (typeof modules === 'string') {
            modules = modules.split(',').map(m => m.trim()).filter(Boolean);
        }

        const data = await getInitPackageData({
            sourceJgbh,
            sourceZjgbh,
            targetJgbh,
            targetZjgbh,
            modules
        });

        return res.json({
            status: 0,
            msg: '获取初始化数据成功',
            data
        });
    } catch (err) {
        logger.error(`[InitPackage] Failed to extract data: ${err.message}`, { stack: err.stack });
        return res.status(500).json({
            status: 1,
            msg: `获取初始化数据失败: ${err.message}`
        });
    }
}

/**
 * 颁发长期 Token 接口（POST /api/init-package/issue-token）
 * 出于安全防护考虑，仅允许服务器本机 Localhost 访问
 */
function handleIssueToken(req, res) {
    if (!isLocalhostRequest(req)) {
        logger.warn(`[Security] 拦截非本机调用 issue-token 接口: IP=${req.ip}`);
        return res.status(403).json({
            status: 403,
            msg: '出于安全考虑，Token 颁发接口仅限服务器本机 (Localhost) 访问'
        });
    }

    try {
        const {
            username = 'java_service',
            role = 'admin',
            jgbh = '',
            zjgbh = '',
            nickname = 'Java初始化运维服务',
            xingming = 'Java初始化运维服务',
            expiresIn = '3650d'
        } = req.body || {};

        const payload = {
            id: 0,
            username: String(username).trim(),
            role: String(role).trim(),
            jgbh: String(jgbh || '').trim(),
            zjgbh: String(zjgbh || '').trim(),
            nickname: String(nickname || '').trim(),
            xingming: String(xingming || '').trim()
        };

        const token = jwt.sign(payload, JWT_SECRET, { expiresIn });

        logger.info(`[InitPackage] 本机成功颁发长期 Token: user=${payload.username}, role=${payload.role}, expiresIn=${expiresIn}, jgbh=${payload.jgbh || '-'}`);

        return res.json({
            status: 0,
            msg: 'Token 颁发成功',
            data: {
                token,
                expiresIn,
                payload
            }
        });
    } catch (err) {
        logger.error(`[InitPackage] 颁发 Token 失败: ${err.message}`);
        return res.status(500).json({
            status: 1,
            msg: `颁发 Token 失败: ${err.message}`
        });
    }
}

// 路由挂载
router.get('/data', authenticateToken, handleGetInitPackageData);
router.post('/data', authenticateToken, handleGetInitPackageData);

router.get('/meta', authenticateToken, (req, res) => {
    return res.json({
        status: 0,
        data: {
            tableExecutionOrder: TABLE_EXECUTION_ORDER,
            supportedModules: ['ywbzk', 'ywbz', 'cxgzkz'],
            format: 'tabular-json'
        }
    });
});

// 本机专用 Token 颁发接口（无需预先带有 Token）
router.post('/issue-token', handleIssueToken);

module.exports = router;
