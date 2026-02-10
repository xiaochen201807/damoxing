
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);
db.all("SELECT name FROM sqlite_master WHERE type='table' AND name='sys_user'", (err, rows) => {
    if (err) {
        console.error(err);
    } else {
        console.log(rows);
    }
    db.close();
});
