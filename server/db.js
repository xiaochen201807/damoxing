const sqlite3 = require("sqlite3").verbose();
const path = require("path");

// 数据库文件路径：server/database.sqlite
const dbPath = path.resolve(__dirname, "database.sqlite");

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error("Could not connect to database", err);
  } else {
    console.log("Connected to SQLite database");
    initDb();
  }
});

function initDb() {
  db.serialize(() => {
    // 1. 创建菜单表 sys_menu
    db.run(`
      CREATE TABLE IF NOT EXISTS sys_menu (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        label TEXT,
        path TEXT,
        icon TEXT
      )
    `);

    // 2. 创建页面模版表 sys_page_template
    db.run(`
      CREATE TABLE IF NOT EXISTS sys_page_template (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        page_key TEXT UNIQUE,
        title TEXT,
        schema_json TEXT
      )
    `);

    // 3. 检查并注入 Mock 数据
    checkAndInsertMockData();
  });
}

function checkAndInsertMockData() {
  // --- 注入菜单数据 ---
  db.get("SELECT count(*) as count FROM sys_menu", (err, row) => {
    if (row && row.count === 0) {
      const menus = [
        {
          label: "贷款风险分析",
          path: "/dashboard/loan_risk",
          icon: "fa fa-line-chart",
        },
        {
          label: "服务效能监控",
          path: "/dashboard/service",
          icon: "fa fa-heart",
        },
      ];
      const stmt = db.prepare(
        "INSERT INTO sys_menu (label, path, icon) VALUES (?, ?, ?)"
      );
      menus.forEach((menu) => {
        stmt.run(menu.label, menu.path, menu.icon);
      });
      stmt.finalize();
      console.log("Mock Data: sys_menu inserted.");
    }
  });

  // --- 注入页面模版数据 (Loan Page) ---
  db.get("SELECT count(*) as count FROM sys_page_template", (err, row) => {
    if (row && row.count === 0) {
      // 构建一个简单的 AMIS JSON 配置
      const loanPageSchema = {
        type: "page",
        title: "贷款风险分析驾驶舱",
        body: [
          {
            type: "tpl",
            tpl: "<div style='margin-bottom: 20px; font-size: 1.2rem;'>当前系统风险概览</div>",
          },
          {
            type: "grid",
            columns: [
              {
                body: [
                  {
                    type: "card",
                    header: { title: "今日申请量" },
                    body: "1,284 单",
                  },
                ],
              },
              {
                body: [
                  {
                    type: "card",
                    header: { title: "自动审批率" },
                    body: "85.2%",
                  },
                ],
              },
              {
                body: [
                  {
                    type: "card",
                    header: { title: "风险拦截数" },
                    body: "42 单",
                  },
                ],
              },
            ],
          },
        ],
      };

      const stmt = db.prepare(
        "INSERT INTO sys_page_template (page_key, title, schema_json) VALUES (?, ?, ?)"
      );
      stmt.run("loan_risk", "贷款风险分析", JSON.stringify(loanPageSchema));
      stmt.finalize();
      console.log("Mock Data: sys_page_template (loan_risk) inserted.");
    }
  });
}

module.exports = db;
