/**
 * 简化的 HTTP 服务器入口
 * 启动 HTTP API 服务
 */

const { startHttpServer } = require('./services/http-server');
// 初始化数据库网关 (已由 db.js 内部自执行)
const db = require('./db');

startHttpServer()
    .then(() => {
        console.log('🚀 HTTP Server initialized successfully');
    })
    .catch(err => {
        console.error('❌ Failed to start HTTP server:', err);
        process.exit(1);
    });
