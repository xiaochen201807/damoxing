const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const logger = require("../utils/logger");

// 数据库路径
const dbPath = path.resolve(__dirname, "../database.sqlite");

// 【修正后的 Schema】
const newSchema = {
  type: "page",
  title: "AI 智能分析助手",
  data: {
    // 默认 prompt
    userPrompt: "生成贷款逾期分析图表",
  },
  body: [
    {
      // 1. 输入区域
      type: "form",
      title: "向 AI 提问",
      target: "ai-result-service", // 提交后刷新下面的 service
      body: [
        {
          type: "textarea",
          name: "userPrompt",
          label: "请输入分析需求",
          required: true,
        },
        {
          type: "submit",
          label: "开始分析",
          level: "primary",
        },
      ],
    },
    {
      type: "divider",
    },
    {
      // 2. 结果展示区域
      type: "service",
      name: "ai-result-service",
      schemaApi: {
        method: "post",
        url: "/api/ai/generate-page",
        data: {
          pageId: "${pageId}",
          // 将表单里的 userPrompt 传给后端
          query: "${userPrompt}",
        },
        // 只有当 userPrompt 有值时才发送请求（避免一进页面就请求）
        sendOn: "this.userPrompt",
      },
    },
  ],
};

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    logger.error("无法连接到数据库:", err.message);
    process.exit(1);
  }
  logger.info("已连接到 SQLite 数据库");
});

// 执行更新操作
const targetKey = "loan_risk";
const jsonString = JSON.stringify(newSchema);
const newTitle = "贷款风险智能分析 (AI驱动版)";

const sql = `UPDATE sys_page_template SET schema_json = ?, title = ? WHERE page_key = ? AND is_active = 1`;

db.run(sql, [jsonString, newTitle, targetKey], function (err) {
  if (err) {
    return logger.error("更新失败:", err.message);
  }

  logger.info(`------------------------------------------------`);
  if (this.changes > 0) {
    logger.info(`✅ 成功修正页面 [${targetKey}] 配置！`);
    logger.info(
      `   核心变更: 已启用 schemaApi 模式，解决了 [object Object] 问题。`
    );
  } else {
    logger.warn(`⚠️  未找到记录，未进行更新。`);
  }
  logger.info(`------------------------------------------------`);

  db.close();
});
