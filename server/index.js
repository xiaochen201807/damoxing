// 1. 引入 dotenv (必须在最前面)
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const db = require("./db");
const logger = require("./utils/logger");
const { notFoundHandler, errorHandler } = require("./middleware/errorHandler");
const { globalLimiter, helmetConfig, sqlInjectionProtection } = require("./middleware/security");

// 引入 AI 路由
const aiRoutes = require("./routes/ai");
const difyConfigRoutes = require("./routes/dify-config");
const menuRoutes = require("./routes/menu");
const pageTemplateRoutes = require("./routes/page-template");
const backendConfigRoutes = require("./routes/backend-config");
const demoChartRoutes = require("./routes/demo-chart");


const app = express();
const PORT = 3001;

// 安全头配置（必须在最前面）
app.use(helmetConfig);

// CORS 配置 (允许携带凭证，配合前端 Vite 代理或直接请求)
const corsOptions = {
  origin: ["http://localhost:3000", "http://127.0.0.1:3000"],
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

app.use(cors(corsOptions));
app.use(express.json());

// HTTP 请求日志
app.use(logger.httpLogger);

// 全局限流
app.use(globalLimiter);

// SQL 注入防护
app.use(sqlInjectionProtection);


// API: 获取系统菜单
app.get("/api/system/menu", (req, res) => {
  const sql = "SELECT * FROM sys_menu";
  db.all(sql, [], (err, rows) => {
    if (err) {
      res.status(400).json({ error: err.message });
      return;
    }
    res.json({
      status: 0,
      msg: "success",
      data: rows,
    });
  });
});

// API: 根据 pageKey 获取页面 AMIS 模版
app.get("/api/page/:pageKey", (req, res) => {
  const pageKey = req.params.pageKey;
  const sql = "SELECT * FROM sys_page_template WHERE page_key = ?";

  db.get(sql, [pageKey], (err, row) => {
    if (err) {
      res.status(400).json({ error: err.message });
      return;
    }
    if (row) {
      try {
        const schema = JSON.parse(row.schema_json);
        res.json({
          status: 0,
          msg: "success",
          data: schema,
        });
      } catch (e) {
        res.status(500).json({ error: "Failed to parse schema JSON" });
      }
    } else {
      res.status(404).json({ error: "Page template not found" });
    }
  });
});

// 1. 注册 Dify 配置管理路由
app.use("/api/dify", difyConfigRoutes);

// 2. 注册 AI 路由
app.use("/api/ai", aiRoutes);

// 3. 注册菜单管理路由
app.use("/api/system", menuRoutes);

// 4. 注册页面模板管理路由
app.use("/api/system", pageTemplateRoutes);

// 5. 注册后端配置管理路由
app.use("/api/system", backendConfigRoutes);

// 6. 注册演示图表路由
app.use("/api/demo", demoChartRoutes);

// 3. 404 错误处理（必须在所有路由之后）
app.use(notFoundHandler);

// 4. 全局错误处理中间件（必须在最后）
app.use(errorHandler);

app.listen(PORT, () => {
  logger.info(`Server running on http://localhost:${PORT}`);
  if (process.env.DIFY_API_KEY) {
    logger.info("AI Service: Active (Dify Mode)");
  } else {
    logger.info("AI Service: Active (Mock Mode)");
  }
});

