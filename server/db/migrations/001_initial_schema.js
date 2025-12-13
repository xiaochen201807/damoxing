/**
 * 初始数据库表结构迁移
 * 创建 sys_menu 和 sys_page_template 表
 */

exports.up = function(db) {
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
        page_key TEXT UNIQUE NOT NULL,
        title TEXT NOT NULL,
        schema_json TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 添加索引
    db.run(`CREATE INDEX IF NOT EXISTS idx_menu_path ON sys_menu(path)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_page_key ON sys_page_template(page_key)`);

    console.log('Migration 001: Initial schema created');
  });
};

exports.down = function(db) {
  return db.serialize(() => {
    db.run('DROP TABLE IF EXISTS sys_page_template');
    db.run('DROP TABLE IF EXISTS sys_menu');
    console.log('Migration 001: Rolled back');
  });
};
