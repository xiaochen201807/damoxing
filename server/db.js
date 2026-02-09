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

// -----------------------------------------------------------------------------
// SQL Logging Wrapper (MyBatis Style)
// -----------------------------------------------------------------------------
const formatSql = (sql, params) => {
  if (!params || params.length === 0) return sql;
  let i = 0;
  return sql.replace(/\?/g, () => {
    const val = params[i++];
    if (val === null) return 'NULL';
    if (typeof val === 'string') return `'${val}'`;
    return val;
  });
};

const wrappedDb = {
  // 原始 db 对象引用
  raw: db,

  // 简单转发的方法
  on: db.on.bind(db),
  configure: db.configure.bind(db),
  serialize: db.serialize.bind(db),
  parallelize: db.parallelize.bind(db),
  close: db.close.bind(db),

  // 需要拦截的方法
  run(sql, params, callback) {
    if (typeof params === 'function') {
      callback = params;
      params = [];
    }
    const start = Date.now();
    const sqlId = Math.random().toString(36).substring(7); // 简单的请求ID

    logger.info(`[SQLite] [SQL-${sqlId}] ==>  Preparing: ${sql}`);
    if (params && params.length > 0) {
      logger.info(`[SQLite] [SQL-${sqlId}] ==> Parameters: ${JSON.stringify(params)}`);
    }

    return db.run(sql, params, function (err) {
      const duration = Date.now() - start;
      if (err) {
        logger.error(`[SQLite] [SQL-${sqlId}] <==      Error: ${err.message} (${duration}ms)`);
      } else {
        logger.info(`[SQLite] [SQL-${sqlId}] <==    Updates: ${this.changes} (LastID: ${this.lastID}) (${duration}ms)`);
      }
      if (callback) callback.call(this, err);
    });
  },

  get(sql, params, callback) {
    if (typeof params === 'function') {
      callback = params;
      params = [];
    }
    const start = Date.now();
    const sqlId = Math.random().toString(36).substring(7);

    logger.info(`[SQLite] [SQL-${sqlId}] ==>  Preparing: ${sql}`);
    if (params && params.length > 0) {
      logger.info(`[SQLite] [SQL-${sqlId}] ==> Parameters: ${JSON.stringify(params)}`);
    }

    return db.get(sql, params, function (err, row) {
      const duration = Date.now() - start;
      if (err) {
        logger.error(`[SQLite] [SQL-${sqlId}] <==      Error: ${err.message} (${duration}ms)`);
      } else {
        logger.info(`[SQLite] [SQL-${sqlId}] <==      Total: ${row ? 1 : 0} (${duration}ms)`);
        if (row) {
          logger.info(`[SQLite] [SQL-${sqlId}] <==        H: ${JSON.stringify(row)}`);
        }
      }
      if (callback) callback.call(this, err, row);
    });
  },

  all(sql, params, callback) {
    if (typeof params === 'function') {
      callback = params;
      params = [];
    }
    const start = Date.now();
    const sqlId = Math.random().toString(36).substring(7);

    logger.info(`[SQLite] [SQL-${sqlId}] ==>  Preparing: ${sql}`);
    if (params && params.length > 0) {
      logger.info(`[SQLite] [SQL-${sqlId}] ==> Parameters: ${JSON.stringify(params)}`);
    }

    return db.all(sql, params, function (err, rows) {
      const duration = Date.now() - start;
      if (err) {
        logger.error(`[SQLite] [SQL-${sqlId}] <==      Error: ${err.message} (${duration}ms)`);
      } else {
        logger.info(`[SQLite] [SQL-${sqlId}] <==      Total: ${rows ? rows.length : 0} (${duration}ms)`);
        // 如果结果集不大，可以打印出来；太大就不打印了，或者只打印前几条
        if (rows && rows.length > 0) {
          if (rows.length <= 5) {
            rows.forEach(row => logger.info(`[SQLite] [SQL-${sqlId}] <==        R: ${JSON.stringify(row)}`));
          } else {
            logger.info(`[SQLite] [SQL-${sqlId}] <==        R: (First 5 of ${rows.length})`);
            rows.slice(0, 5).forEach(row => logger.info(`[SQLite] [SQL-${sqlId}] <==        R: ${JSON.stringify(row)}`));
          }
        }
      }
      if (callback) callback.call(this, err, rows);
    });
  },

  exec(sql, callback) {
    const start = Date.now();
    const sqlId = Math.random().toString(36).substring(7);
    logger.info(`[SQLite] [SQL-${sqlId}] ==>  Preparing: ${sql.substring(0, 100)}${sql.length > 100 ? '...' : ''}`);

    return db.exec(sql, function (err) {
      const duration = Date.now() - start;
      if (err) {
        logger.error(`[SQLite] [SQL-${sqlId}] <==      Error: ${err.message} (${duration}ms)`);
      } else {
        logger.info(`[SQLite] [SQL-${sqlId}] <==    Success (${duration}ms)`);
      }
      if (callback) callback.call(this, err);
    });
  }
};

module.exports = wrappedDb;
