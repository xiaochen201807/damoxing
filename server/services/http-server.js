/**
 * HTTP 服务器启动逻辑
 * 负责配置和启动 Express HTTP 服务器
 */

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const express = require("express");
const cors = require("cors");
const compression = require("compression");
const logger = require("../utils/logger");
const { notFoundHandler, errorHandler } = require("../middleware/errorHandler");
const { globalLimiter, helmetConfig, sqlInjectionProtection } = require("../middleware/security");

// 导入所有 HTTP 路由
const setupHttpRoutes = require("../routes/http");

/**
 * 配置中间件
 */
function setupMiddleware(app) {
    // 信任 Nginx 代理
    app.set('trust proxy', 1);

    // 安全头配置
    app.use(helmetConfig);

    // CORS 配置
    const allowedOrigins = process.env.CORS_ORIGIN
        ? process.env.CORS_ORIGIN.split(',').map(origin => origin.trim())
        : ["http://localhost:3000", "http://127.0.0.1:3000"];

    const corsOptions = {
        origin: (origin, callback) => {
            if (!origin) return callback(null, true);
            if (allowedOrigins.includes('*')) return callback(null, true);

            // Allow localhost on any port (for MCP Inspector, dev tools)
            if (origin.startsWith("http://localhost:") ||
                origin.startsWith("http://127.0.0.1:") ||
                allowedOrigins.includes(origin) ||
                origin.startsWith("http://192.168.") ||
                origin.startsWith("http://10.") ||
                origin.startsWith("http://172.")) {
                callback(null, true);
            } else {
                logger.warn(`CORS blocked request from origin: ${origin}`);
                callback(new Error('Not allowed by CORS'));
            }
        },
        credentials: true,
        methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization", "channel", "login-token", "jgbh", "zzbs", "zzjgdmz"],
        exposedHeaders: ["Content-Disposition"] // 允许前端读取下载文件名
    };

    logger.info(`CORS allowed origins: ${allowedOrigins.join(', ')}`);

    app.use(cors(corsOptions));

    // JSON Body Parser (排除 MCP 消息路由，因为 SDK 需要读取原始流)
    app.use((req, res, next) => {
        if (req.path.includes('/api/mcp/messages')) {
            return next();
        }
        express.json()(req, res, next);
    });

    // Gzip 压缩
    app.use(compression({
        threshold: 1024,
        level: 6,
        filter: (req, res) => {
            if (req.headers['x-no-compression']) return false;
            // 排除 SSE 流式传输
            if (req.headers['accept'] === 'text/event-stream' || req.path.includes('/sse')) return false;
            return compression.filter(req, res);
        }
    }));

    // HTTP 请求日志
    app.use(logger.httpLogger);

    // 全局限流
    app.use(globalLimiter);

    // SQL 注入防护
    app.use(sqlInjectionProtection);
}

/**
 * 启动 HTTP 服务器
 */
async function startHttpServer() {
    const app = express();
    const PORT = process.env.HTTP_PORT || process.env.PORT || 3001;
    const HOST = process.env.HTTP_HOST || '0.0.0.0';

    try {
        // 配置中间件
        setupMiddleware(app);

        // 注册路由
        setupHttpRoutes(app);

        // 错误处理
        app.use(notFoundHandler);
        app.use(errorHandler);

        // 启动服务器
        return new Promise((resolve, reject) => {
            const server = app.listen(PORT, HOST, (err) => {
                if (err) {
                    logger.error('Failed to start HTTP server:', err);
                    reject(err);
                } else {
                    logger.info(`✅ HTTP Server running on http://${HOST}:${PORT}`);
                    if (process.env.DIFY_API_KEY) {
                        logger.info("AI Service: Active (Dify Mode)");
                    } else {
                        logger.info("AI Service: Active (Mock Mode)");
                    }
                    resolve(server);
                }
            });

            server.on('error', (error) => {
                logger.error('HTTP server error:', error);
                reject(error);
            });
        });
    } catch (error) {
        logger.error('Failed to initialize HTTP server:', error);
        throw error;
    }
}

module.exports = { startHttpServer };
