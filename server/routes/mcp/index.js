/**
 * MCP 处理器注册
 * 管理所有 MCP Resources, Tools, Prompts
 */

const db = require("../../db");
const logger = require("../../utils/logger");

/**
 * 注册 MCP Resources
 */
function registerResources(server) {
    // Resource: 组件库列表
    server.setRequestHandler("resources/list", async () => {
        return {
            resources: [
                {
                    uri: "component://library",
                    name: "Component Library",
                    description: "Available AMIS components",
                    mimeType: "application/json"
                },
                {
                    uri: "template://catalog",
                    name: "Template Catalog",
                    description: "Available page templates",
                    mimeType: "application/json"
                }
            ]
        };
    });

    // Resource: 读取组件库
    server.setRequestHandler("resources/read", async (request) => {
        const { uri } = request.params;

        if (uri === "component://library") {
            const components = await new Promise((resolve, reject) => {
                db.all(
                    "SELECT * FROM sys_component_library WHERE is_active = 1",
                    [],
                    (err, rows) => {
                        if (err) reject(err);
                        else resolve(rows);
                    }
                );
            });

            return {
                contents: [
                    {
                        uri,
                        mimeType: "application/json",
                        text: JSON.stringify(components, null, 2)
                    }
                ]
            };
        }

        if (uri === "template://catalog") {
            const templates = await new Promise((resolve, reject) => {
                db.all(
                    "SELECT * FROM sys_page_templates_config WHERE is_active = 1",
                    [],
                    (err, rows) => {
                        if (err) reject(err);
                        else resolve(rows);
                    }
                );
            });

            return {
                contents: [
                    {
                        uri,
                        mimeType: "application/json",
                        text: JSON.stringify(templates, null, 2)
                    }
                ]
            };
        }

        throw new Error(`Unknown resource: ${uri}`);
    });

    logger.info("   ✓ MCP Resources registered");
}

/**
 * 注册 MCP Tools
 */
function registerTools(server) {
    // Tool: 查询页面配置
    server.setRequestHandler("tools/list", async () => {
        return {
            tools: [
                {
                    name: "query_page_config",
                    description: "Query page configuration by page_key",
                    inputSchema: {
                        type: "object",
                        properties: {
                            page_key: {
                                type: "string",
                                description: "The page key to query"
                            }
                        },
                        required: ["page_key"]
                    }
                }
            ]
        };
    });

    server.setRequestHandler("tools/call", async (request) => {
        const { name, arguments: args } = request.params;

        if (name === "query_page_config") {
            const { page_key } = args;

            const page = await new Promise((resolve, reject) => {
                db.get(
                    "SELECT * FROM sys_page_template WHERE page_key = ? AND is_active = 1",
                    [page_key],
                    (err, row) => {
                        if (err) reject(err);
                        else resolve(row);
                    }
                );
            });

            if (!page) {
                return {
                    content: [
                        {
                            type: "text",
                            text: `Page not found: ${page_key}`
                        }
                    ]
                };
            }

            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify(page, null, 2)
                    }
                ]
            };
        }

        throw new Error(`Unknown tool: ${name}`);
    });

    logger.info("   ✓ MCP Tools registered");
}

/**
 * 注册所有 MCP 处理器
 */
function setupMcpHandlers(server) {
    logger.info("📋 Registering MCP handlers...");

    registerResources(server);
    registerTools(server);

    logger.info("✅ All MCP handlers registered");
}

module.exports = setupMcpHandlers;
