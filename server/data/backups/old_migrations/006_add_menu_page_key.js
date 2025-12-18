/**
 * 菜单表添加 page_key 字段
 * 自动从现有 path 中提取 page_key（格式: /dashboard/{page_key}）
 */
const logger = require('../../utils/logger');

exports.up = function (db) {
    return db.serialize(() => {
        // 步骤1: 添加 page_key 字段（先不设置UNIQUE）
        db.run(`ALTER TABLE sys_menu ADD COLUMN page_key TEXT`, (err) => {
            if (err) {
                logger.error('Migration 006: Failed to add page_key column:', err);
                return;
            }

            logger.info('Migration 006: Added page_key column');

            // 步骤2: 从现有 path 中提取 page_key 并更新
            db.all(`SELECT id, path FROM sys_menu`, [], (err, rows) => {
                if (err) {
                    logger.error('Migration 006: Failed to query menus:', err);
                    return;
                }

                let updateCount = 0;
                const totalRows = rows.length;

                if (totalRows === 0) {
                    // 没有数据，直接创建索引
                    createUniqueIndex();
                    return;
                }

                rows.forEach((row, index) => {
                    // 提取 page_key：例如 /dashboard/loan_risk -> loan_risk
                    const match = row.path.match(/\/dashboard\/(.+)/);
                    if (match && match[1]) {
                        const pageKey = match[1];
                        db.run(`UPDATE sys_menu SET page_key = ? WHERE id = ?`, [pageKey, row.id], (err) => {
                            updateCount++;
                            if (err) {
                                logger.error(`Migration 006: Failed to update page_key for menu ${row.id}:`, err);
                            } else {
                                logger.info(`Migration 006: Updated menu ${row.id} with page_key: ${pageKey}`);
                            }

                            // 所有更新完成后创建索引
                            if (updateCount === totalRows) {
                                createUniqueIndex();
                            }
                        });
                    } else {
                        updateCount++;
                        if (updateCount === totalRows) {
                            createUniqueIndex();
                        }
                    }
                });
            });
        });

        // 步骤3: 创建唯一索引
        function createUniqueIndex() {
            db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_menu_page_key ON sys_menu(page_key)`, (err) => {
                if (err) {
                    logger.error('Migration 006: Failed to create unique index:', err);
                } else {
                    logger.info('Migration 006: Created unique index on page_key');
                    logger.info('Migration 006: Migration completed successfully');
                }
            });
        }
    });
};

exports.down = function (db) {
    return db.serialize(() => {
        // SQLite 不支持 DROP COLUMN，需要重建表
        db.run(`DROP INDEX IF EXISTS idx_menu_page_key`);

        db.run(`
            CREATE TABLE sys_menu_backup AS 
            SELECT id, label, subtitle, path, icon, created_at FROM sys_menu;
        `);

        db.run(`DROP TABLE sys_menu;`);

        db.run(`
            CREATE TABLE sys_menu (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                label TEXT NOT NULL,
                subtitle TEXT DEFAULT '',
                path TEXT NOT NULL,
                icon TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
        `);

        db.run(`INSERT INTO sys_menu SELECT * FROM sys_menu_backup;`);
        db.run(`DROP TABLE sys_menu_backup;`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_menu_path ON sys_menu(path)`);

        logger.info('Migration 006: Rolled back');
    });
};
