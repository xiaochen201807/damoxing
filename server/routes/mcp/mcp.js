/**
 * MCP Server API 路由
 * 实现 Model Context Protocol (JSON-RPC 2.0)
 * 供 Dify 工作流调用，生成 AMIS 组件和页面
 */
const express = require('express');
const router = express.Router();
const nunjucks = require('nunjucks');
const path = require('path');
const logger = require('../../utils/logger');

// 配置 Nunjucks
const env = nunjucks.configure(path.join(__dirname, '../templates'), {
    autoescape: false,
    throwOnUndefined: false
});

// MCP 工具列表（符合 MCP 规范）
const MCP_TOOLS = [
    {
        name: 'create_chart',
        description: '创建图表组件（柱状图、折线图、饼图等）',
        inputSchema: {
            type: 'object',
            properties: {
                chart_type: {
                    type: 'string',
                    enum: ['bar', 'line', 'funnel', 'radar', 'gauge'],
                    description: '图表类型'
                },
                api_url: {
                    type: 'string',
                    description: '数据API地址'
                },
                height: {
                    type: 'integer',
                    default: 350,
                    description: '图表高度（像素）'
                },
                config: {
                    type: 'object',
                    description: '图表额外配置（颜色、样式等）'
                }
            },
            required: ['chart_type', 'api_url']
        }
    },
    {
        name: 'create_page',
        description: '创建完整的AMIS页面（包含标题、多个组件）',
        inputSchema: {
            type: 'object',
            properties: {
                title: {
                    type: 'string',
                    description: '页面标题'
                },
                subtitle: {
                    type: 'string',
                    description: '页面副标题'
                },
                components: {
                    type: 'array',
                    items: {
                        type: 'object',
                        description: '页面包含的组件列表'
                    },
                    description: '页面组件数组'
                }
            },
            required: ['title', 'components']
        }
    }
];

// POST /api/mcp - MCP JSON-RPC 2.0 处理
router.post('/', async (req, res) => {
    const { jsonrpc, method, params, id } = req.body;

    // 验证 JSON-RPC 格式
    if (jsonrpc !== '2.0') {
        logger.error('[MCP] Invalid JSON-RPC version:', jsonrpc);
        return res.json({
            jsonrpc: '2.0',
            error: { code: -32600, message: 'Invalid Request' },
            id: id || null
        });
    }

    try {
        switch (method) {
            case 'tools/list':
                // 返回可用工具列表
                logger.info('[MCP] Listing available tools');
                return res.json({
                    jsonrpc: '2.0',
                    result: { tools: MCP_TOOLS },
                    id
                });

            case 'tools/call':
                // 调用工具
                const { name, arguments: args } = params;
                logger.info(`[MCP] Calling tool: ${name}`);
                const result = await handleToolCall(name, args);

                return res.json({
                    jsonrpc: '2.0',
                    result,
                    id
                });

            default:
                logger.error('[MCP] Unknown method:', method);
                return res.json({
                    jsonrpc: '2.0',
                    error: { code: -32601, message: 'Method not found' },
                    id
                });
        }
    } catch (error) {
        logger.error('[MCP] Error:', error);
        return res.json({
            jsonrpc: '2.0',
            error: { code: -32603, message: error.message },
            id: id || null
        });
    }
});

// 工具调用处理
async function handleToolCall(toolName, args) {
    switch (toolName) {
        case 'create_chart':
            return await createChart(args);

        case 'create_page':
            return await createPage(args);

        default:
            throw new Error(`Unknown tool: ${toolName}`);
    }
}

// 创建图表组件
async function createChart({ chart_type, api_url, height, config }) {
    const componentMap = {
        'bar': 'bar_chart_panel.j2',
        'line': 'line_chart_panel.j2',
        'funnel': 'funnel_chart_panel.j2',
        'radar': 'radar_chart_panel.j2',
        'gauge': 'gauge_chart_panel.j2'
    };

    const template = componentMap[chart_type];
    if (!template) {
        throw new Error(`Unsupported chart type: ${chart_type}`);
    }

    // 构造参数
    const params = {
        [`${chart_type}_api_url`]: api_url,
        [`${chart_type}_height`]: height || 350,
        ...config
    };

    try {
        // 渲染组件
        const componentJson = env.render(`components/${template}`, params);
        const parsed = JSON.parse(componentJson); // 验证 JSON

        logger.info(`[MCP] Chart component created: ${chart_type}`);
        return {
            content: [{
                type: 'text',
                text: JSON.stringify(parsed, null, 2)
            }]
        };
    } catch (error) {
        logger.error(`[MCP] Failed to create chart: ${chart_type}`, error);
        throw new Error(`Failed to render chart template: ${error.message}`);
    }
}

// 创建完整页面
async function createPage({ title, subtitle, components }) {
    const pageSchema = {
        type: 'page',
        title,
        subTitle: subtitle,
        body: components
    };

    logger.info(`[MCP] Page created: ${title}`);
    return {
        content: [{
            type: 'text',
            text: JSON.stringify(pageSchema, null, 2)
        }]
    };
}

module.exports = router;
