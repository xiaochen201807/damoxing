/**
 * 初始数据库表结构迁移
 * 创建 sys_menu 和 sys_page_template 表
 */
const logger = require('../../utils/logger');

exports.up = function (db) {
  return db.serialize(() => {
    // 创建菜单表
    db.run(`
      CREATE TABLE IF NOT EXISTS sys_menu (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        label TEXT NOT NULL,
        path TEXT NOT NULL,
        icon TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 创建页面模版表
    db.run(`
      CREATE TABLE IF NOT EXISTS sys_page_template (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        page_key TEXT NOT NULL,
        title TEXT NOT NULL,
        schema_json TEXT NOT NULL,
        is_active INTEGER DEFAULT 1,
        version INTEGER DEFAULT 1,
        backup_time TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(page_key, version)
      )
    `);

    // 添加索引
    db.run(`CREATE INDEX IF NOT EXISTS idx_menu_path ON sys_menu(path)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_page_key_v2 ON sys_page_template(page_key)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_page_active ON sys_page_template(page_key, is_active)`);

    logger.info('Migration 001: Initial schema created');
  });
};

exports.down = function (db) {
  return db.serialize(() => {
    db.run('DROP TABLE IF EXISTS sys_page_template');
    db.run('DROP TABLE IF EXISTS sys_menu');
    logger.info('Migration 001: Rolled back');
  });
};
