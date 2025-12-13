/**
 * 全局错误处理中间件
 * 捕获所有未处理的错误并返回统一格式的错误响应
 */

const logger = require('../utils/logger');

/**
 * 404 错误处理
 */
const notFoundHandler = (req, res, next) => {
    const error = new Error(`Not Found - ${req.originalUrl}`);
    error.status = 404;
    next(error);
};

/**
 * 全局错误处理中间件
 */
const errorHandler = (err, req, res, next) => {
    const statusCode = err.status || err.statusCode || 500;
    const message = err.message || 'Internal Server Error';

    // 记录错误日志
    if (statusCode >= 500) {
        logger.error({
            message: err.message,
            stack: err.stack,
            url: req.originalUrl,
            method: req.method,
            ip: req.ip,
            userAgent: req.get('user-agent'),
        });
    } else {
        logger.warn({
            message: err.message,
            url: req.originalUrl,
            method: req.method,
            statusCode,
        });
    }

    // 返回错误响应
    res.status(statusCode).json({
        status: statusCode,
        msg: message,
        ...(process.env.NODE_ENV === 'development' && {
            stack: err.stack,
            error: err,
        }),
    });
};

/**
 * 异步错误包装器
 * 用于包装异步路由处理器，自动捕获错误
 */
const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = {
    notFoundHandler,
    errorHandler,
    asyncHandler,
};
