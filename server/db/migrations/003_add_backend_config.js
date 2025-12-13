/**
 * 后端配置表迁移
 * 创建 sys_backend_config 表，存储系统后端配置参数
 */

exports.up = function (db) {
    return db.serialize(() => {
        // 创建后端配置表
        db.run(`
      CREATE TABLE IF NOT EXISTS sys_backend_config (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        config_key TEXT UNIQUE NOT NULL,
        config_value TEXT NOT NULL,
        config_type TEXT DEFAULT 'string',
        description TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

        // 添加索引
        db.run(`CREATE INDEX IF NOT EXISTS idx_backend_config_key ON sys_backend_config(config_key)`);

        // 插入默认限流配置
        const defaultConfigs = [
            ['global_rate_limit_window', '900000', 'number', '全局限流时间窗口(毫秒)，默认15分钟'],
            ['global_rate_limit_max', '100', 'number', '全局限流最大请求数'],
            ['ai_rate_limit_window', '60000', 'number', 'AI限流时间窗口(毫秒)，默认1分钟'],
            ['ai_rate_limit_max', '10', 'number', 'AI限流最大请求数']
        ];

        defaultConfigs.forEach(([key, value, type, desc]) => {
            db.run(`
        INSERT OR IGNORE INTO sys_backend_config 
        (config_key, config_value, config_type, description)
        VALUES (?, ?, ?, ?)
      `, [key, value, type, desc]);
        });

        console.log('Migration 003: Backend config table created with default values');
    });
};

exports.down = function (db) {
    return db.serialize(() => {
        db.run('DROP TABLE IF EXISTS sys_backend_config');
        console.log('Migration 003: Rolled back');
    });
};
