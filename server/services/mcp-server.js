/**
 * MCP 服务器启动逻辑
 * 基于 Model Context Protocol SDK
 */

require("dotenv").config();

const { Server } = require("@modelcontextprotocol/sdk/server/index.js");
const { StdioServerTransport } = require("@modelcontextprotocol/sdk/server/stdio.js");
const logger = require("../utils/logger");

// 导入 MCP 处理器
const setupMcpHandlers = require("../routes/mcp");

/**
 * 启动 MCP 服务器
 */
async function startMcpServer() {
    try {
        // 创建 MCP Server 实例
        const server = new Server(
            {
                name: "damoxing-mcp",
                version: "1.0.0"
            },
            {
                capabilities: {
                    resources: {},
                    tools: {},
                    prompts: {}
                }
            }
        );

        logger.info("🔧 Initializing MCP Server...");

        // 注册 MCP 处理器（Resources, Tools, Prompts）
        setupMcpHandlers(server);

        // 使用 stdio 传输层（MCP 标准）
        const transport = new StdioServerTransport();
        await server.connect(transport);

        logger.info("✅ MCP Server started (stdio transport)");
        logger.info("   Name: damoxing-mcp");
        logger.info("   Version: 1.0.0");

        return server;
    } catch (error) {
        logger.error("❌ Failed to start MCP server:", error);
        throw error;
    }
}

module.exports = { startMcpServer };
