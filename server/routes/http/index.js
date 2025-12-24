/**
 * HTTP 路由注册
 * 统一管理所有 HTTP API 路由
 */

const db = require("../../db");
const { authenticateToken } = require("../../middleware/auth");

// 导入所有路由模块（已经在routes/http/目录下）
const authRoutes = require("./auth");
const aiRoutes = require("./ai");
const difyConfigRoutes = require("./dify-config");
const menuRoutes = require("./menu");
const pageTemplateRoutes = require("./page-template");
const backendConfigRoutes = require("./backend-config");
const demoChartRoutes = require("./demo-chart");
const cacheRoutes = require("./cache");
const healthRoutes = require("./health");
const schemaRoutes = require("./schema");
const themesRoutes = require("./themes");
const routesApi = require("./routes");
const mcpSseRoutes = require("./mcp-sse");

// API 路由前缀（从环境变量读取，默认 /api）
const API_PREFIX = process.env.API_ROUTE_PREFIX || '/api';

/**
 * 注册所有 HTTP 路由
 */
function setupHttpRoutes(app) {
    // 健康检查（在限流之前）
    app.use(healthRoutes);

    // === 遗留的内联路由（TODO: 重构到独立文件） ===

    // 根据 pageKey 获取页面模板
    app.get(`${API_PREFIX}/page/:pageKey`, authenticateToken, (req, res) => {
        const pageKey = req.params.pageKey;
        const sql = "SELECT * FROM sys_page_template WHERE page_key = ? and is_active = 1";

        db.get(sql, [pageKey], (err, row) => {
            if (err) {
                res.status(400).json({ error: err.message });
                return;
            }
            if (row) {
                try {
                    const schema = JSON.parse(row.schema_json);
                    res.json({ status: 0, msg: "success", data: schema });
                } catch (e) {
                    res.status(500).json({ error: "Failed to parse schema JSON" });
                }
            } else {
                res.status(404).json({ error: "Page template not found" });
            }
        });
    });

    // === 模块化路由 ===

    // 认证相关路由（无需认证）
    app.use(`${API_PREFIX}/auth`, authRoutes);

    // 以下路由需要 JWT 认证
    app.use(`${API_PREFIX}/dify`, authenticateToken, difyConfigRoutes);
    app.use(`${API_PREFIX}/ai`, authenticateToken, aiRoutes);
    app.use(API_PREFIX, authenticateToken, routesApi);
    app.use(`${API_PREFIX}/system`, authenticateToken, menuRoutes);
    app.use(`${API_PREFIX}/system`, authenticateToken, pageTemplateRoutes);
    app.use(`${API_PREFIX}/system`, authenticateToken, backendConfigRoutes);
    app.use(`${API_PREFIX}/system`, authenticateToken, cacheRoutes);
    app.use(`${API_PREFIX}/demo`, authenticateToken, demoChartRoutes);
    app.use(`${API_PREFIX}/schema`, authenticateToken, schemaRoutes);
    app.use(`${API_PREFIX}/themes`, authenticateToken, themesRoutes);

    // MCP SSE Endpoints (for Dify) - 使用专门的 MCP_API_KEY 认证，不需要 JWT
    app.use(`${API_PREFIX}/mcp`, mcpSseRoutes);

    console.log(`✅ API routes mounted on prefix: ${API_PREFIX}`);
    console.log(`🔒 JWT authentication enabled for protected routes`);
}

module.exports = setupHttpRoutes;
