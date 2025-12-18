/**
 * 健康检查路由
 * 用于监控服务器状态和依赖服务健康度
 */

const express = require('express');
const router = express.Router();
const db = require('../../db');
const cache = require('../../utils/cache');
const logger = require('../../utils/logger');

/**
 * 简单健康检查
 * GET /health
 * 用于负载均衡器快速检查
 */
router.get('/health', (req, res) => {
    res.status(200).json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
    });
});

/**
 * 详细健康检查
 * GET /health/detailed
 * 检查所有关键依赖
 */
router.get('/health/detailed', async (req, res) => {
    const healthStatus = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        checks: {},
    };

    // 1. 检查数据库连接
    try {
        await new Promise((resolve, reject) => {
            db.get('SELECT 1 as test', (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
        healthStatus.checks.database = {
            status: 'healthy',
            message: 'Database connection OK',
        };
    } catch (error) {
        healthStatus.status = 'unhealthy';
        healthStatus.checks.database = {
            status: 'unhealthy',
            message: error.message,
        };
        logger.error('[Health] Database check failed:', error);
    }

    // 2. 检查缓存系统
    try {
        const cacheStats = cache.getStats();
        const totalKeys =
            cacheStats.menu.keys +
            cacheStats.ai.keys +
            cacheStats.api.keys;

        healthStatus.checks.cache = {
            status: 'healthy',
            message: 'Cache system OK',
            stats: {
                totalKeys,
                menu: cacheStats.menu.keys,
                ai: cacheStats.ai.keys,
                api: cacheStats.api.keys,
            },
        };
    } catch (error) {
        healthStatus.status = 'degraded';
        healthStatus.checks.cache = {
            status: 'unhealthy',
            message: error.message,
        };
        logger.error('[Health] Cache check failed:', error);
    }

    // 3. 检查内存使用
    const memUsage = process.memoryUsage();
    const memUsageMB = {
        rss: Math.round(memUsage.rss / 1024 / 1024),
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
        external: Math.round(memUsage.external / 1024 / 1024),
    };

    // 内存使用超过80%视为警告
    const heapUsagePercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
    healthStatus.checks.memory = {
        status: heapUsagePercent > 80 ? 'warning' : 'healthy',
        usage: memUsageMB,
        heapUsagePercent: Math.round(heapUsagePercent),
    };

    // 4. 检查环境配置
    const requiredEnvVars = ['DIFY_API_URL'];
    const missingEnvVars = requiredEnvVars.filter(key => !process.env[key]);

    healthStatus.checks.environment = {
        status: missingEnvVars.length === 0 ? 'healthy' : 'warning',
        message: missingEnvVars.length === 0
            ? 'All required environment variables set'
            : `Missing optional env vars: ${missingEnvVars.join(', ')}`,
        hasDifyKey: !!process.env.DIFY_API_KEY,
    };

    // 5. 进程信息
    healthStatus.process = {
        pid: process.pid,
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
    };

    // 根据状态返回对应的 HTTP 状态码
    const statusCode = healthStatus.status === 'healthy' ? 200 :
        healthStatus.status === 'degraded' ? 200 : 503;

    res.status(statusCode).json(healthStatus);
});

/**
 * 就绪检查
 * GET /health/ready
 * 检查服务是否准备好接收流量
 */
router.get('/health/ready', async (req, res) => {
    try {
        // 检查数据库是否可用
        await new Promise((resolve, reject) => {
            db.get('SELECT 1', (err) => {
                if (err) reject(err);
                else resolve();
            });
        });

        res.status(200).json({
            ready: true,
            timestamp: new Date().toISOString(),
        });
    } catch (error) {
        logger.error('[Health] Readiness check failed:', error);
        res.status(503).json({
            ready: false,
            error: error.message,
            timestamp: new Date().toISOString(),
        });
    }
});

/**
 * 存活检查
 * GET /health/alive
 * 检查进程是否存活（最轻量）
 */
router.get('/health/alive', (req, res) => {
    res.status(200).json({
        alive: true,
        timestamp: new Date().toISOString(),
    });
});

module.exports = router;
