/**
 * 更新页面模板表以支持多版本
 * 1. 移除 page_key 的唯一约束
 * 2. 添加 (page_key, version) 的联合唯一约束
 */
const logger = require('../../utils/logger');

exports.up = function (db) {
  return db.serialize(() => {
    // 1. 重命名旧表
    db.run('ALTER TABLE sys_page_template RENAME TO sys_page_template_old');

    // 2. 创建新表
    db.run(`
      CREATE TABLE sys_page_template (
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

    // 3. 迁移数据
    // 注意：旧表可能没有 is_active, version, backup_time 字段，需要处理
    // 如果之前 schema 已经有了这些字段（比如用户手动添加了），则直接迁移
    // 这里做个两手准备，先检查字段是否存在比较麻烦，直接假设如果之前的检查是对的，已有这些字段
    // 但为了稳健，我们只迁移核心字段，让默认值填充新字段 (version=1, is_active=1)

    // 让我们更严谨一点。之前的 sqlite3 schema 输出显示已有 is_active, version, backup_time。
    // 所以我们可以尝试迁移所有字段。

    db.run(`
      INSERT INTO sys_page_template (id, page_key, title, schema_json, is_active, version, backup_time)
      SELECT id, page_key, title, schema_json, 
             COALESCE(is_active, 1), 
             COALESCE(version, 1), 
             backup_time
      FROM sys_page_template_old
    `);

    // 4. 删除旧表
    db.run('DROP TABLE sys_page_template_old');

    // 5. 重建索引
    db.run('CREATE INDEX idx_page_key_v2 ON sys_page_template(page_key)');
    db.run('CREATE INDEX idx_page_active ON sys_page_template(page_key, is_active)');

    logger.info('Migration 005: Template versioning schema updated');
  });
};

exports.down = function (db) {
  return db.serialize(() => {
    // 回滚：只保留 is_active = 1 的版本，并恢复唯一约束

    db.run('ALTER TABLE sys_page_template RENAME TO sys_page_template_temp');

    db.run(`
      CREATE TABLE sys_page_template (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        page_key TEXT UNIQUE NOT NULL,
        title TEXT NOT NULL,
        schema_json TEXT NOT NULL,
        is_active INTEGER DEFAULT 1, 
        version INTEGER DEFAULT 1, 
        backup_time TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 只恢复当前激活的版本，或者最新版本
    db.run(`
      INSERT INTO sys_page_template (page_key, title, schema_json, is_active, version, backup_time, created_at, updated_at)
      SELECT page_key, title, schema_json, is_active, version, backup_time, created_at, updated_at
      FROM sys_page_template_temp
      WHERE is_active = 1
    `);

    db.run('DROP TABLE sys_page_template_temp');

    db.run('CREATE INDEX idx_page_key ON sys_page_template(page_key)');

    logger.info('Migration 005: Rolled back');
  });
};
