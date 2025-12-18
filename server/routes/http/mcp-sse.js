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

// GET /sse - Establish SSE connection
router.get("/sse", async (req, res) => {
    logger.info("[MCP SSE] New connection attempt");

    const transport = new SSEServerTransport("/api/mcp/messages", res);
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

        // The transport.sessionId is available after construction or start?
        // We need to know the session ID to route POST messages. 
        // SSEServerTransport in SDK writes the 'endpoint' event which includes the session ID?

        // In SDK 0.6.0+, SSEServerTransport manages life cycle.
        // We need to store it to handle the subsequent POST.

        transports.set(transport.sessionId, transport);

        logger.info(`[MCP SSE] Connection established. Session: ${transport.sessionId}`);

        // Cleanup on close
        res.on("close", () => {
            logger.info(`[MCP SSE] Connection closed. Session: ${transport.sessionId}`);
            transports.delete(transport.sessionId);
            server.close();
        });
    } catch (error) {
        logger.error("[MCP SSE] Connection error:", error);
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
