/**
 * MCP 处理器注册
 * 管理所有 MCP Resources, Tools, Prompts
 */

const db = require("../../db");
const logger = require("../../utils/logger");

const {
    ListResourcesRequestSchema,
    ReadResourceRequestSchema,
    ListToolsRequestSchema,
    CallToolRequestSchema,
    ListPromptsRequestSchema,
    GetPromptRequestSchema
} = require("@modelcontextprotocol/sdk/types.js");

/**
 * 注册 MCP Resources
 */
function registerResources(server) {
    // Resource: 组件库列表
    server.setRequestHandler(ListResourcesRequestSchema, async () => {
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
    server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
        const { uri } = request.params;

        if (uri === "component://library") {
            const rawComponents = await new Promise((resolve, reject) => {
                db.all(
                    "SELECT * FROM sys_component_library WHERE is_active = 1",
                    [],
                    (err, rows) => {
                        if (err) reject(err);
                        else resolve(rows);
                    }
                );
            });

            // Parse JSON fields so LLM sees structured data
            const components = rawComponents.map(row => ({
                ...row,
                params_schema: row.params_schema ? JSON.parse(row.params_schema) : {},
                default_params: row.default_params ? JSON.parse(row.default_params) : {}
            }));

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
    server.setRequestHandler(ListToolsRequestSchema, async () => {
        return {
            tools: [
                {
                    name: "query_page_config",
                    description: "查询指定页面的配置 (AMIS Schema)",
                    inputSchema: {
                        type: "object",
                        properties: {
                            page_key: {
                                type: "string",
                                description: "页面唯一标识 (page_key)"
                            }
                        },
                        required: ["page_key"]
                    }
                },
                {
                    name: "generate_page_schema",
                    description: "根据组件列表和参数生成页面配置 (AMIS Schema)",
                    inputSchema: {
                        type: "object",
                        properties: {
                            title: {
                                type: "string",
                                description: "页面标题",
                                default: "AI生成页面"
                            },
                            layout: {
                                type: "string",
                                description: "布局模式",
                                enum: ["simple", "dashboard"],
                                default: "simple"
                            },
                            components: {
                                type: "array",
                                description: "组件列表",
                                items: {
                                    type: "object",
                                    properties: {
                                        component_id: {
                                            type: "string",
                                            description: "组件ID (来自 component://library)"
                                        },
                                        params: {
                                            type: "object",
                                            description: "组件参数 (对应组件的 params_schema)"
                                        }
                                    },
                                    required: ["component_id"]
                                }
                            }
                        },
                        required: ["components"]
                    }
                }
            ]
        };
    });

    server.setRequestHandler(CallToolRequestSchema, async (request) => {
        const { name, arguments: args } = request.params;
        const mcpRenderer = require("../../utils/mcp-renderer");

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
                    ],
                    isError: true
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

        if (name === "generate_page_schema") {
            const { title, layout, components } = args;
            const renderedComponents = [];
            const errors = [];

            // 1. 获取所有需要的组件模板路径
            const componentIds = components.map(c => c.component_id);
            if (componentIds.length === 0) {
                return {
                    content: [{ type: "text", text: "No components specified" }],
                    isError: true
                };
            }

            // 从数据库查询组件信息
            const componentDefs = await new Promise((resolve, reject) => {
                const placeholders = componentIds.map(() => '?').join(',');
                db.all(
                    `SELECT component_id, template_path FROM sys_component_library WHERE component_id IN (${placeholders})`,
                    componentIds,
                    (err, rows) => {
                        if (err) reject(err);
                        else resolve(rows);
                    }
                );
            });

            // 建立映射
            const defMap = new Map();
            componentDefs.forEach(row => defMap.set(row.component_id, row.template_path));

            // 2. 逐个渲染
            for (const comp of components) {
                const templatePath = defMap.get(comp.component_id);
                if (!templatePath) {
                    errors.push(`Component not found: ${comp.component_id}`);
                    continue;
                }

                try {
                    const schema = mcpRenderer.renderComponent(templatePath, comp.params || {});
                    renderedComponents.push(schema);
                } catch (e) {
                    errors.push(`Failed to render ${comp.component_id}: ${e.message}`);
                }
            }

            if (errors.length > 0) {
                return {
                    content: [{ type: "text", text: `Errors:\n${errors.join('\n')}` }],
                    isError: true
                };
            }

            // 3. 组装页面
            const pageSchema = mcpRenderer.assemblePage(layout, title, renderedComponents);

            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify(pageSchema, null, 2)
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
