// 1. 引入 dotenv (必须在最前面)
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const db = require("./db");

// 引入 AI 路由
const aiRoutes = require("./routes/ai");

const app = express();
const PORT = 3001;

// CORS 配置 (允许携带凭证，配合前端 Vite 代理或直接请求)
const corsOptions = {
  origin: ["http://localhost:3000", "http://127.0.0.1:3000"],
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

app.use(cors(corsOptions));
app.use(express.json());

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

// 2. 注册 AI 路由
app.use("/api/ai", aiRoutes);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  if (process.env.DIFY_API_KEY) {
    console.log("AI Service: Active (Dify Mode)");
  } else {
    console.log("AI Service: Active (Mock Mode)");
  }
});
