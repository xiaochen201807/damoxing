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
                    description: "Available AMIS components with their component_id, params_schema and descriptions. Read this before using generate_page_schema tool.",
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
                    name: "list_components",
                    description: "获取所有可用的组件列表及其参数定义。可用组件：1) chart_with_ai 通用图表组件，支持6种图表类型(pie/bar/line/funnel/radar/gauge)，通过 chart_type 参数控制，支持钻取配置；2) alert 提示框组件，使用 alert_html 参数传入完整HTML内容。",
                    inputSchema: {
                        type: "object",
                        properties: {},
                        required: []
                    }
                },
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
                    description: "根据组件列表和参数生成页面配置 (AMIS Schema)。支持两种模式：1) 单页模式：使用 components 数组；2) 标签页模式：使用 tabs 数组分组显示组件。",
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
                                description: "单页模式：组件列表（与 tabs 二选一）",
                                items: {
                                    type: "object",
                                    properties: {
                                        component_id: { type: "string", description: "组件ID" },
                                        params: { type: "object", description: "组件参数" }
                                    },
                                    required: ["component_id"]
                                }
                            },
                            tabs: {
                                type: "array",
                                description: "标签页模式：多个标签页配置（与 components 二选一）。如果只有1个tab则自动降级为单页模式。",
                                items: {
                                    type: "object",
                                    properties: {
                                        title: { type: "string", description: "标签页标题" },
                                        components: {
                                            type: "array",
                                            description: "该标签页下的组件列表",
                                            items: {
                                                type: "object",
                                                properties: {
                                                    component_id: { type: "string" },
                                                    params: { type: "object" }
                                                },
                                                required: ["component_id"]
                                            }
                                        }
                                    },
                                    required: ["title", "components"]
                                }
                            }
                        }
                    }
                }
            ]
        };
    });

    server.setRequestHandler(CallToolRequestSchema, async (request) => {
        const { name, arguments: args } = request.params;
        const mcpRenderer = require("../../utils/mcp-renderer");

        if (name === "list_components") {
            // 获取所有活跃的组件
            const rawComponents = await new Promise((resolve, reject) => {
                db.all(
                    "SELECT component_id, component_name, description, params_schema, default_params FROM sys_component_library WHERE is_active = 1",
                    [],
                    (err, rows) => {
                        if (err) reject(err);
                        else resolve(rows);
                    }
                );
            });

            // 解析 JSON 字段
            const components = rawComponents.map(row => ({
                component_id: row.component_id,
                name: row.component_name,  // 映射为 name 便于 AI 理解
                description: row.description,
                params_schema: row.params_schema ? JSON.parse(row.params_schema) : {},
                default_params: row.default_params ? JSON.parse(row.default_params) : {}
            }));

            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify(components, null, 2)
                    }
                ]
            };
        }

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
            const { title, layout, components, tabs } = args;

            // 验证参数：components 或 tabs 二选一
            if (!components && !tabs) {
                return {
                    content: [{ type: "text", text: "Missing 'components' or 'tabs' parameter. Please provide one of them." }],
                    isError: true
                };
            }

            const errors = [];

            // 辅助函数：渲染组件列表
            async function renderComponentList(compList, defMap) {
                const rendered = [];
                for (const comp of compList) {
                    const templatePath = defMap.get(comp.component_id);
                    if (!templatePath) {
                        errors.push(`Component not found: ${comp.component_id}`);
                        continue;
                    }
                    try {
                        const schema = mcpRenderer.renderComponent(templatePath, comp.params || {});
                        rendered.push(schema);
                    } catch (e) {
                        errors.push(`Failed to render ${comp.component_id}: ${e.message}`);
                    }
                }
                return rendered;
            }

            // 收集所有组件ID
            let allComponentIds = [];
            if (tabs && Array.isArray(tabs)) {
                tabs.forEach(tab => {
                    if (tab.components && Array.isArray(tab.components)) {
                        allComponentIds.push(...tab.components.map(c => c.component_id));
                    }
                });
            } else if (components && Array.isArray(components)) {
                allComponentIds = components.map(c => c.component_id);
            }

            if (allComponentIds.length === 0) {
                return {
                    content: [{ type: "text", text: "No components specified" }],
                    isError: true
                };
            }

            // 从数据库查询组件信息
            const uniqueIds = [...new Set(allComponentIds)];
            const componentDefs = await new Promise((resolve, reject) => {
                const placeholders = uniqueIds.map(() => '?').join(',');
                db.all(
                    `SELECT component_id, template_path FROM sys_component_library WHERE component_id IN (${placeholders})`,
                    uniqueIds,
                    (err, rows) => {
                        if (err) reject(err);
                        else resolve(rows);
                    }
                );
            });

            // 建立映射
            const defMap = new Map();
            componentDefs.forEach(row => defMap.set(row.component_id, row.template_path));

            let pageSchema;

            if (tabs && Array.isArray(tabs) && tabs.length > 0) {
                // 标签页模式
                const tabsData = [];
                for (const tab of tabs) {
                    const renderedComponents = await renderComponentList(tab.components || [], defMap);
                    tabsData.push({
                        title: tab.title || '未命名标签',
                        renderedComponents
                    });
                }

                if (errors.length > 0) {
                    return {
                        content: [{ type: "text", text: `Errors:\n${errors.join('\n')}` }],
                        isError: true
                    };
                }

                pageSchema = mcpRenderer.assemblePageWithTabs(layout, title, tabsData);
            } else {
                // 单页模式（兼容旧逻辑）
                const renderedComponents = await renderComponentList(components, defMap);

                if (errors.length > 0) {
                    return {
                        content: [{ type: "text", text: `Errors:\n${errors.join('\n')}` }],
                        isError: true
                    };
                }

                pageSchema = mcpRenderer.assemblePage(layout, title, renderedComponents);
            }

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
