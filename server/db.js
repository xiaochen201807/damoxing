const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const logger = require("./utils/logger");

// 数据库文件路径：server/database.sqlite
const dbPath = path.resolve(__dirname, "database.sqlite");

/**
 * 数据库连接实例
 * 
 * 注意：
 * 1. 此模块仅负责提供数据库连接
 * 2. 数据库表结构由 db/migrations/ 中的迁移脚本管理
 * 3. 首次运行请执行: npm run db:migrate
 * 4. Mock 数据已移至迁移脚本中
 */
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    logger.error("Could not connect to database", err);
    process.exit(1); // 数据库连接失败应该终止进程
  } else {
    logger.info("Connected to SQLite database:", dbPath);
    logger.info("Database ready. Run 'npm run db:migrate' if tables are missing.");
  }
});

module.exports = db;
