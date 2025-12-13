/**
 * Dify 配置表迁移
 * 创建 sys_dify_config 表，支持每个页面独立的工作流配置
 */

exports.up = function (db) {
    return db.serialize(() => {
        // 创建 Dify 配置表
        db.run(`
      CREATE TABLE IF NOT EXISTS sys_dify_config (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        page_key TEXT UNIQUE NOT NULL,
        workflow_name TEXT NOT NULL,
        api_url TEXT NOT NULL,
        api_key TEXT NOT NULL,
        enabled INTEGER DEFAULT 1,
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

        // 添加索引
        db.run(`CREATE INDEX IF NOT EXISTS idx_dify_page_key ON sys_dify_config(page_key)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_dify_enabled ON sys_dify_config(enabled)`);

        // 插入默认配置（如果环境变量存在）
        const defaultUrl = process.env.DIFY_API_URL || 'https://api.dify.ai/v1';
        const defaultKey = process.env.DIFY_API_KEY || '';

        if (defaultKey) {
            db.run(`
        INSERT OR IGNORE INTO sys_dify_config 
        (page_key, workflow_name, api_url, api_key, enabled, description)
        VALUES 
        ('loan_risk', '贷款风险分析工作流', ?, ?, 1, '默认工作流配置')
      `, [defaultUrl, defaultKey]);

            console.log('Migration 002: Default Dify config inserted from environment variables');
        }

        console.log('Migration 002: Dify config table created');
    });
};

exports.down = function (db) {
    return db.serialize(() => {
        db.run('DROP TABLE IF EXISTS sys_dify_config');
        console.log('Migration 002: Rolled back');
    });
};
