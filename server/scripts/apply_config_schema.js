const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, '../data/database.sqlite');
const SCHEMA_PATH = path.join(__dirname, '../config_page_schema.json');

const db = new sqlite3.Database(DB_PATH);

console.log('🔄 Loading schema from:', SCHEMA_PATH);

try {
    const rawData = fs.readFileSync(SCHEMA_PATH, 'utf8');
    const newConfigSchema = JSON.parse(rawData);

    const UPDATE_SQL = `
        UPDATE sys_page_template 
        SET schema_json = ?, updated_at = datetime('now', '+08:00')
        WHERE page_key = 'config' AND is_active = 1
    `;

    db.run(UPDATE_SQL, [JSON.stringify(newConfigSchema)], function (err) {
        if (err) {
            console.error('❌ Update failed:', err.message);
            process.exit(1);
        }

        if (this.changes === 0) {
            console.error('❌ Page "config" not found or inactive');
            process.exit(1);
        }

        console.log('✅ Schema updated successfully!');
        console.log(`   Rows affected: ${this.changes}`);
        db.close();
    });

} catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
}
