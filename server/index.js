require("dotenv").config();

const express = require("express");
const cors = require("cors");
const compression = require("compression"); // Gzip 压缩
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
const cacheRoutes = require("./routes/cache");
const healthRoutes = require("./routes/health");


const app = express();
const PORT = 3001;

// 安全头配置（必须在最前面）
app.use(helmetConfig);

// CORS 配置 (允许携带凭证，配合前端 Vite 代理或直接请求)
// 从环境变量读取允许的源，支持多个域名（逗号分隔）
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map(origin => origin.trim())
  : ["http://localhost:3000", "http://127.0.0.1:3000"];

const corsOptions = {
  origin: (origin, callback) => {
    // 允许没有 origin 的请求（如 Postman, curl）
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin) ||
      origin.startsWith("http://192.168.") ||
      origin.startsWith("http://10.") ||
      origin.startsWith("http://172.")) {
      callback(null, true);
    } else {
      logger.warn(`CORS blocked request from origin: ${origin} `);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

logger.info(`CORS allowed origins: ${allowedOrigins.join(', ')} `);

app.use(cors(corsOptions));
app.use(express.json());

// Gzip 压缩（应该在其他中间件之前）
app.use(compression({
  // 只压缩大于1KB的响应
  threshold: 1024,
  // 压缩级别 (0-9, 6是默认值，平衡速度和压缩率)
  level: 6,
  // 过滤函数：决定哪些响应需要压缩
  filter: (req, res) => {
    // 不压缩已经压缩的内容
    if (req.headers['x-no-compression']) {
      return false;
    }
    // 使用compression的默认过滤器
    return compression.filter(req, res);
  }
}));

// HTTP 请求日志
app.use(logger.httpLogger);

// 健康检查路由（放在限流之前，避免影响监控）
app.use(healthRoutes);

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
  const sql = "SELECT * FROM sys_page_template WHERE page_key = ? and is_active = 1";

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

// 7. 注册缓存管理路由
app.use("/api/system", cacheRoutes);

// 404 错误处理（必须在所有路由之后）
app.use(notFoundHandler);

// 全局错误处理中间件（必须在最后）
app.use(errorHandler);

app.listen(PORT, () => {
  logger.info(`Server running on http://localhost:${PORT}`);
  if (process.env.DIFY_API_KEY) {
    logger.info("AI Service: Active (Dify Mode)");
  } else {
    logger.info("AI Service: Active (Mock Mode)");
  }
});

