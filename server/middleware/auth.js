/**
 * JWT 认证中间件
 * 用于验证所有受保护 API 接口的访问权限
 */

const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

// JWT 密钥（从环境变量读取，生产环境务必配置）
const JWT_SECRET = process.env.JWT_SECRET || 'damoxing-default-secret-change-in-production';

// Token 过期时间（默认 24 小时）
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

// 白名单路由（无需鉴权）
const WHITELIST_PATHS = [
    '/health',
    '/api/auth/login',
    '/api/init-package/issue-token',
    '/api/mcp',  // MCP SSE endpoints (带前缀)
    '/mcp',      // MCP SSE endpoints (不带前缀，相对路径)
];

/**
 * 检查路径是否在白名单中
 */
function isWhitelisted(path, apiPrefix) {
    // 检查完整路径
    if (WHITELIST_PATHS.some(whitePath => path === whitePath || path.startsWith(whitePath))) {
        return true;
    }

    // 检查带前缀的路径
    if (apiPrefix && apiPrefix !== '/api') {
        const prefixedPaths = WHITELIST_PATHS.map(p => p.replace('/api', apiPrefix));
        if (prefixedPaths.some(whitePath => path === whitePath || path.startsWith(whitePath))) {
            return true;
        }
    }

    return false;
}

/**
 * JWT 认证中间件
 */
function authenticateToken(req, res, next) {
    const apiPrefix = process.env.API_ROUTE_PREFIX || '/api';

    // 检查是否为白名单路由
    if (isWhitelisted(req.path, apiPrefix)) {
        return next();
    }

    // 从请求头获取 token
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        logger.warn(`未授权访问: ${req.method} ${req.path} from ${req.ip}`);
        return res.status(401).json({
            status: 401,
            msg: '未提供认证令牌，请先登录'
        });
    }

    // 验证 token
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            logger.warn(`Token 验证失败: ${err.message} from ${req.ip}`);
            return res.status(403).json({
                status: 403,
                msg: '认证令牌无效或已过期，请重新登录'
            });
        }

        // 防越权校验：请求头中的 jgbh/zjgbh 必须与 Token 中一致
        const headerJgbh = req.headers['jgbh'] || req.headers['zzbs'] || '';
        const headerZjgbh = req.headers['zjgbh'] || req.headers['zzjgdmz'] || '';
        const tokenJgbh = user.jgbh || '';
        const tokenZjgbh = user.zjgbh || '';

        if (headerJgbh && headerJgbh !== tokenJgbh) {
            logger.warn(`[安全] 机构码不一致: header.jgbh=${headerJgbh}, token.jgbh=${tokenJgbh}, user=${user.username}, ip=${req.ip}, path=${req.path}`);
            return res.status(403).json({
                status: 403,
                msg: '机构信息校验失败，请重新登录'
            });
        }
        if (headerZjgbh && headerZjgbh !== tokenZjgbh) {
            logger.warn(`[安全] 子机构码不一致: header.zjgbh=${headerZjgbh}, token.zjgbh=${tokenZjgbh}, user=${user.username}, ip=${req.ip}, path=${req.path}`);
            return res.status(403).json({
                status: 403,
                msg: '机构信息校验失败，请重新登录'
            });
        }

        // 将用户信息附加到请求对象
        req.user = user;
        next();
    });
}

/**
 * 生成 JWT Token
 */
function generateToken(payload) {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

/**
 * 验证 Token（同步方法）
 */
function verifyToken(token) {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (err) {
        return null;
    }
}

module.exports = {
    authenticateToken,
    generateToken,
    verifyToken,
    JWT_SECRET,
    JWT_EXPIRES_IN
};
