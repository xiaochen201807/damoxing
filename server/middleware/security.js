/**
 * 安全中间件配置
 * 包含限流、安全头、CORS 等安全防护措施
 */

const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const logger = require('../utils/logger');

/**
 * 全局限流配置
 * 15 分钟内最多 100 次请求
 */
const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 分钟
    max: 100, // 最多 100 次请求
    message: {
        status: 429,
        msg: '请求过于频繁，请稍后再试',
    },
    standardHeaders: true, // 返回 RateLimit-* 头
    legacyHeaders: false, // 禁用 X-RateLimit-* 头
    handler: (req, res) => {
        logger.warn(`Rate limit exceeded for IP: ${req.ip}, path: ${req.path}`);
        res.status(429).json({
            status: 429,
            msg: '请求过于频繁，请稍后再试',
        });
    },
});

/**
 * AI 接口限流配置
 * 1 分钟内最多 10 次请求
 */
const aiLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 分钟
    max: 10, // 最多 10 次请求
    message: {
        status: 429,
        msg: 'AI 请求过于频繁，请稍后再试',
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        logger.warn(`AI rate limit exceeded for IP: ${req.ip}, path: ${req.path}`);
        res.status(429).json({
            status: 429,
            msg: 'AI 请求过于频繁，请稍后再试',
        });
    },
});

/**
 * Helmet 安全头配置
 */
const helmetConfig = helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"], // AMIS 需要内联样式
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"], // AMIS 需要 eval
            imgSrc: ["'self'", 'data:', 'https:'],
            connectSrc: ["'self'", 'https://api.dify.ai'], // 允许连接到 Dify API
        },
    },
    crossOriginEmbedderPolicy: false, // AMIS 需要跨域资源
});

/**
 * SQL 注入防护检查
 * 检测常见的 SQL 注入模式
 */
const sqlInjectionProtection = (req, res, next) => {
    const sqlPatterns = [
        /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION)\b)/gi,
        /(--|;|\/\*|\*\/|xp_|sp_)/gi,
        /('|(\\')|(;)|(--)|(\/\*))/gi,
    ];

    const checkValue = (value) => {
        if (typeof value === 'string') {
            for (const pattern of sqlPatterns) {
                if (pattern.test(value)) {
                    return true;
                }
            }
        } else if (typeof value === 'object' && value !== null) {
            for (const key in value) {
                if (checkValue(value[key])) {
                    return true;
                }
            }
        }
        return false;
    };

    // 检查 query、body、params
    if (checkValue(req.query) || checkValue(req.body) || checkValue(req.params)) {
        logger.warn(`Potential SQL injection detected from IP: ${req.ip}, path: ${req.path}`);
        return res.status(400).json({
            status: 400,
            msg: '请求包含非法字符',
        });
    }

    next();
};

module.exports = {
    globalLimiter,
    aiLimiter,
    helmetConfig,
    sqlInjectionProtection,
};
