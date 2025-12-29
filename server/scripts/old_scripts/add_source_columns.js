const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, '../database.sqlite');
const db = new sqlite3.Database(DB_PATH);

const ALTER_TABLE_SQL = [
    "ALTER TABLE sys_page_template ADD COLUMN source_template_id TEXT;",
    "ALTER TABLE sys_page_template ADD COLUMN source_params TEXT;"
];

db.serialize(() => {
    console.log('Starting migration: Adding traceability columns...');

    // Check if columns exist first to avoid errors
    db.all("PRAGMA table_info(sys_page_template);", (err, columns) => {
        if (err) {
            console.error('Error fetching table info:', err);
            process.exit(1);
        }

        const columnNames = columns.map(c => c.name);

        ALTER_TABLE_SQL.forEach((sql) => {
            const colName = sql.split('ADD COLUMN ')[1].split(' ')[0];

            if (columnNames.includes(colName)) {
                console.log(`Column ${colName} already exists, skipping.`);
            } else {
                db.run(sql, (err) => {
                    if (err) {
                        console.error(`Error adding column ${colName}:`, err.message);
                    } else {
                        console.log(`Successfully added column: ${colName}`);
                    }
                });
            }
        });
    });
});

// Close database connection after a short delay to allow queries to queue
setTimeout(() => {
    db.close((err) => {
        if (err) {
            console.error('Error closing database:', err.message);
        } else {
            console.log('Migration completed & Database connection closed.');
        }
    });
}, 1000);
