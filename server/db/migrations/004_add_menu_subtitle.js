/**
 * 菜单表添加副标题字段
 */

exports.up = function (db) {
    return db.serialize(() => {
        // 添加 subtitle 字段
        db.run(`ALTER TABLE sys_menu ADD COLUMN subtitle TEXT DEFAULT ''`);

        console.log('Migration 004: Added subtitle column to sys_menu table');
    });
};

exports.down = function (db) {
    return db.serialize(() => {
        // SQLite 不支持 DROP COLUMN，需要重建表
        db.run(`
            CREATE TABLE sys_menu_backup AS SELECT id, label, path, icon FROM sys_menu;
        `);
        db.run(`DROP TABLE sys_menu;`);
        db.run(`
            CREATE TABLE sys_menu (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                label TEXT NOT NULL,
                path TEXT,
                icon TEXT
            );
        `);
        db.run(`INSERT INTO sys_menu SELECT * FROM sys_menu_backup;`);
        db.run(`DROP TABLE sys_menu_backup;`);

        console.log('Migration 004: Rolled back');
    });
};
