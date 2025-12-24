/**
 * MCP SSE Transport Route
 * Provides HTTP/SSE endpoints for Dify integration
 */

const express = require("express");
const router = express.Router();
const { SSEServerTransport } = require("@modelcontextprotocol/sdk/server/sse.js");
const { Server } = require("@modelcontextprotocol/sdk/server/index.js");
const setupMcpHandlers = require("../../routes/mcp");
const logger = require("../../utils/logger");

// Store active transports mapped by session ID
const transports = new Map();

// Initialize a shared MCP server instance (or create per-connection if needed)
// For SSE, we typically need a fresh server per connection or manage via transport
// Standard MCP SDK example uses one server with multiple connections handled by transport?
// Actually, SDK's `server.connect(transport)` binds one transport to the server.
// If we want multiple concurrent clients, we need a factory.

function createMcpServer() {
    const server = new Server(
        {
            name: "damoxing-mcp-sse",
            version: "1.0.0",
        },
        {
            capabilities: {
                resources: {},
                tools: {},
                prompts: {},
            },
        }
    );



    setupMcpHandlers(server);
    return server;
}

/**
 * Middleware: Verify MCP API Key
 * Expects: Authorization: Bearer <MCP_API_KEY>
 */
const verifyMcpAuth = (req, res, next) => {
    const mcpApiKey = process.env.MCP_API_KEY;

    // If no key is configured, allow access (or could fail secure by default?)
    // For ease of use, if not set, we assume dev mode/open access.
    if (!mcpApiKey) {
        return next();
    }

    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).json({ error: "Missing Authorization header" });
    }

    const token = authHeader.split(" ")[1];
    if (token !== mcpApiKey) {
        return res.status(403).json({ error: "Invalid API Key" });
    }

    next();
};

// Apply auth to all routes in this router
router.use(verifyMcpAuth);
router.get("/sse", async (req, res) => {
    logger.info("[MCP SSE] New connection attempt");

    // 使用正确的 messages 端点路径（包含 API 前缀）
    const apiPrefix = process.env.API_ROUTE_PREFIX || '/api';
    const transport = new SSEServerTransport(`${apiPrefix}/mcp/messages`, res);
    const server = createMcpServer();

    // Store transport/server if needed, but SDK handles the limit of `server.connect`?
    // server.connect() returns a promise that resolves when closed?
    // Let's look at SDK usage.

    // Save transport for message handling
    // The SDK's SSEServerTransport creates a session ID and handles the /messages routing internally via `handlePostMessage`?
    // No, `handlePostMessage` is a method on the transport we must call.
    // We need to map `sessionId` to `transport`.

    // NOTE: SSEServerTransport's `sessionId` is generated inside its constructor usually?
    // ACTUALLY: SDK v1.0.4+ implementation details:
    // We need to instantiate transport, then connect server.

    try {
        await server.connect(transport);

        transports.set(transport.sessionId, transport);

        logger.info(`[MCP SSE] Connection established. Session: ${transport.sessionId}`);

        // 监听服务器错误
        server.onerror = (error) => {
            logger.error(`[MCP SSE] Server error for session ${transport.sessionId}:`, error);
        };

        // Cleanup on close
        res.on("close", () => {
            logger.info(`[MCP SSE] Connection closed. Session: ${transport.sessionId}`);
            transports.delete(transport.sessionId);
            server.close();
        });

        // 监听错误事件
        res.on("error", (error) => {
            logger.error(`[MCP SSE] Response error for session ${transport.sessionId}:`, error);
        });

    } catch (error) {
        logger.error("[MCP SSE] Connection error:", error);
        logger.error("[MCP SSE] Error stack:", error.stack);
        if (!res.headersSent) res.sendStatus(500);
    }
});

// POST /messages - Client sends messages here
router.post("/messages", async (req, res) => {
    const sessionId = req.query.sessionId;

    if (!sessionId) {
        return res.status(400).send("Missing sessionId parameter");
    }

    const transport = transports.get(sessionId);
    if (!transport) {
        return res.status(404).send("Session not found");
    }

    try {
        await transport.handlePostMessage(req, res);
    } catch (error) {
        logger.error(`[MCP SSE] Error handling message for session ${sessionId}:`, error);
        res.status(500).send(error.message);
    }
});

module.exports = router;
