#!/usr/bin/env node
/**
 * MCP 服务器入口
 * 独立运行的 MCP (Model Context Protocol) 服务
 */

const { startMcpServer } = require('./services/mcp-server');

startMcpServer()
    .then(() => {
        // MCP 服务通过 stdio 通信，不需要打印到 stdout
        // 所有日志通过 logger 输出到文件
    })
    .catch(err => {
        console.error('❌ Failed to start MCP server:', err);
        process.exit(1);
    });
