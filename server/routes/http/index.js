/**
 * HTTP 路由注册
 * 统一管理所有 HTTP API 路由
 */

const db = require("../../db");

// 导入所有路由模块（已经在routes/http/目录下）
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

/**
 * 注册所有 HTTP 路由
 */
function setupHttpRoutes(app) {
    // 健康检查（在限流之前）
    app.use(healthRoutes);

    // === 遗留的内联路由（TODO: 重构到独立文件） ===



    // 根据 pageKey 获取页面模板
    app.get("/api/page/:pageKey", (req, res) => {
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

    app.use("/api/dify", difyConfigRoutes);
    app.use("/api/ai", aiRoutes);
    app.use("/api", routesApi);
    app.use("/api/system", menuRoutes);
    app.use("/api/system", pageTemplateRoutes);
    app.use("/api/system", backendConfigRoutes);
    app.use("/api/system", cacheRoutes);
    app.use("/api/demo", demoChartRoutes);
    app.use("/api/schema", schemaRoutes);
    app.use("/api/themes", themesRoutes);
}

module.exports = setupHttpRoutes;
