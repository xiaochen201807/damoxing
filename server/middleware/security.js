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
 * SQL 注入防护检查（优化版）
 * 
 * 【注意】本项目已使用参数化查询（最佳实践），此中间件仅作为额外防护层
 * 
 * 防护策略：
 * 1. 只检测明显的 SQL 注入攻击模式
 * 2. 避免误报合法用户输入（如包含 "--" 的文本）
 * 3. 对于特定字段（如 schema_json）跳过检测
 * 
 * 已移除的过于严格的规则：
 * - 单独的 SQL 关键字（SELECT, INSERT 等）- 用户可能正常输入这些词
 * - 单独的双横线 "--" - 这在中文输入中很常见
 * 
 * 保留的关键模式：
 * - 多个 SQL 注入组合模式
 * - 明显的恶意字符序列
 */
const sqlInjectionProtection = (req, res, next) => {
    // 需要跳过检测的字段（比如 AMIS schema 中可能包含 SQL 关键字）
    const skipFields = ['schema_json', 'config', 'body', 'template', 'schema'];

    // 只检测明显的 SQL 注入组合模式
    const dangerousPatterns = [
        // 注释符号与引号的组合（经典 SQL 注入）
        /['"][\s]*--/gi,                          // ' -- 或 " --
        /['"][\s]*;/gi,                           // '; 或 ";
        /['"][\s]*\/\*/gi,                        // '/* 或 "/*

        // 多个 SQL 关键字的组合（更可能是攻击）
        /\bunion[\s]+select\b/gi,                // UNION SELECT
        /\bselect[\s]+.*[\s]+from\b/gi,          // SELECT ... FROM
        /\bdrop[\s]+table\b/gi,                  // DROP TABLE
        /\binsert[\s]+into\b/gi,                 // INSERT INTO
        /\bdelete[\s]+from\b/gi,                 // DELETE FROM
        /\bexec[\s]*\(/gi,                       // EXEC(
        /\bexecute[\s]*\(/gi,                    // EXECUTE(

        // 危险的存储过程
        /\bxp_cmdshell\b/gi,
        /\bsp_executesql\b/gi,

        // Base64 encoded SQL patterns (高级攻击)
        /U0VMRUNUI|RFTEVU|SU5TRVJU|REVMRVRF/g,
    ];

    const checkValue = (value, fieldName = '') => {
        // 跳过特定字段的检测
        if (skipFields.includes(fieldName)) {
            return false;
        }

        if (typeof value === 'string') {
            // 只有字符串长度超过 10 才检测（过短的字符串不太可能是攻击）
            if (value.length < 10) {
                return false;
            }

            // 检测危险模式
            for (const pattern of dangerousPatterns) {
                if (pattern.test(value)) {
                    logger.warn(`Suspicious SQL pattern detected: ${pattern.toString()}, value: ${value.substring(0, 50)}...`);
                    return true;
                }
            }
        } else if (typeof value === 'object' && value !== null) {
            // 递归检查对象
            for (const key in value) {
                if (checkValue(value[key], key)) {
                    return true;
                }
            }
        }
        return false;
    };

    // 检查 query、body、params
    if (checkValue(req.query) || checkValue(req.body) || checkValue(req.params)) {
        logger.warn(`Potential SQL injection blocked - IP: ${req.ip}, path: ${req.path}, method: ${req.method}`);
        return res.status(400).json({
            status: 400,
            msg: '请求包含可疑内容，已被安全系统拦截',
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
