/**
 * MCP 渲染辅助工具
 * 用于在 MCP Tool 中渲染 Nunjucks 模板生成组件配置
 */
const nunjucks = require('nunjucks');
const path = require('path');
const logger = require('../utils/logger');
const db = require('../db');

// 配置独立于 HTTP Server 的 Nunjucks 环境
const env = nunjucks.configure(path.join(__dirname, '../templates'), {
    autoescape: false,
    throwOnUndefined: false
});

// 添加自定义 tojson 过滤器（类似 Jinja2）
env.addFilter('tojson', function (obj) {
    return JSON.stringify(obj);
});

/**
 * 渲染单个组件
 * @param {string} templatePath - 模板相对路径 (如 components/bar_chart_panel.j2)
 * @param {object} params - 渲染参数
 * @returns {object} - 解析后的 JSON 对象
 */
function renderComponent(templatePath, params) {
    try {
        const jsonStr = env.render(templatePath, params);
        // 尝试解析为 JSON
        try {
            return JSON.parse(jsonStr);
        } catch (e) {
            // 如果解析失败，可能是因为模板包含注释或格式问题，尝试简单的清理
            // 或者仅仅返回原始字符串（但在页面生成场景通常期望是 JSON）
            logger.warn(`[MCP Renderer] Failed to parse component JSON for ${templatePath}: ${e.message}`);
            // 对于非 JSON 模板（如纯文本片段），直接返回字符串可能不是预期的，
            // 但我们的组件库大多数是 JSON 模板。
            throw new Error(`Template output is not valid JSON: ${e.message}`);
        }
    } catch (error) {
        logger.error(`[MCP Renderer] Render error for ${templatePath}:`, error);
        throw error;
    }
}

/**
 * 组装页面 Schema
 * @param {string} layout - 布局模式 ('simple', 'dashboard')
 * @param {string} title - 页面标题
 * @param {array} componentSchemas - 已渲染的组件 Schema 数组
 * @returns {object} - 完整的 AMIS Page Schema
 */
function assemblePage(layout, title, componentSchemas) {
    const pageSchema = {
        type: "container",
        body: []
    };

    if (layout === 'dashboard' || layout === 'grid') {
        // 仪表盘布局：假设是 Grid，每个组件占一定宽度
        // 简单起见，每行 2 个
        pageSchema.body = {
            type: "grid",
            columns: componentSchemas.map(comp => ({
                body: [comp],
                md: 6 // 默认平分两列
            }))
        };
    } else {
        // 默认流式布局：垂直堆叠
        pageSchema.body = componentSchemas;
    }

    return pageSchema;
}

module.exports = {
    renderComponent,
    assemblePage
};
