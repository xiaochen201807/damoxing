/**
 * 简化的 HTTP 服务器入口
 * 启动 HTTP API 服务
 */

const { startHttpServer } = require('./services/http-server');
const dbOracle = require('./db_oracle');

// 初始化 Oracle 连接池
dbOracle.initialize();

startHttpServer()
    .then(() => {
        console.log('🚀 HTTP Server initialized successfully');
    })
    .catch(err => {
        console.error('❌ Failed to start HTTP server:', err);
        process.exit(1);
    });
