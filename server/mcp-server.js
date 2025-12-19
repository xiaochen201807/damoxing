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
        // 不能使用 console.error，会破坏 stdio 协议
        // 错误已在 mcp-server.js 中通过 logger 记录
        process.exit(1);
    });
