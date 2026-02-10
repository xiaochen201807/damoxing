
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(__dirname, 'data/database.sqlite');
const db = new sqlite3.Database(dbPath);

console.log('Using database:', dbPath);

db.serialize(() => {
    db.run(`
        CREATE TABLE IF NOT EXISTS sys_user (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            nickname TEXT,
            email TEXT,
            role TEXT DEFAULT 'user',
            is_active INTEGER DEFAULT 1,
            last_login DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `, (err) => {
        if (err) {
            console.error('Error creating table:', err);
        } else {
            console.log('Table sys_user created or already exists');
        }
    });

    db.all("SELECT name FROM sqlite_master WHERE type='table' AND name='sys_user'", (err, rows) => {
        if (err) {
            console.error(err);
        } else {
            console.log('Verification:', rows);
        }
        db.close();
    });
});
