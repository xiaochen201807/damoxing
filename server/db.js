const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const logger = require("./utils/logger");

// 从环境变量读取数据库路径（新位置：data/ 目录）
const dbPath = process.env.DB_PATH || path.join(__dirname, "data/database.sqlite");

// 检查是否为只读模式
const isReadOnly = process.env.SQLITE_READONLY === 'true';

// 数据库连接配置
const dbMode = isReadOnly
  ? sqlite3.OPEN_READONLY  // 只读模式
  : sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE;  // 读写模式

logger.info(`Initializing SQLite database at: ${dbPath}`);
logger.info(`Database mode: ${isReadOnly ? 'READ-ONLY' : 'READ-WRITE'}`);

// 创建数据库连接
const db = new sqlite3.Database(dbPath, dbMode, (err) => {
  if (err) {
    logger.error(`Failed to connect to database: ${err.message}`);
    process.exit(1);
  }
  logger.info("Connected to SQLite database successfully");

  if (isReadOnly) {
    logger.warn("⚠️  Database is in READ-ONLY mode. Write operations will fail.");
  }
});

// 配置 SQLite 优化参数
db.configure("busyTimeout", 5000);  // 5秒超时

// 只读模式下的额外优化
if (isReadOnly) {
  // 启用共享缓存模式 (多进程读取优化)
  db.run("PRAGMA cache_size = -64000");  // 64MB 缓存
  db.run("PRAGMA temp_store = MEMORY");  // 临时表存储在内存
  db.run("PRAGMA mmap_size = 268435456"); // 256MB 内存映射
  db.run("PRAGMA page_size = 4096");     // 4KB 页面大小

  logger.info("Applied read-only optimizations for multi-replica deployment");
}

// 错误处理
db.on("error", (err) => {
  logger.error(`Database error: ${err.message}`);
});

module.exports = db;
