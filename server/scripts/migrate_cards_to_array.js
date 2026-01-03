const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, '../data/database.sqlite');
const PAGE_ID = 253;

const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
        console.error('Could not connect to database', err);
        process.exit(1);
    }
    console.log('Connected to database');
});

db.get('SELECT source_params FROM sys_page_template WHERE id = ?', [PAGE_ID], (err, row) => {
    if (err) {
        console.error('Error fetching row:', err);
        process.exit(1);
    }
    if (!row) {
        console.error(`Page ID ${PAGE_ID} not found`);
        process.exit(1);
    }

    let params = {};
    try {
        if (row.source_params) {
            params = JSON.parse(row.source_params);
        }
    } catch (e) {
        console.error('Error parsing source_params:', e);
        process.exit(1);
    }

    if (params.cards && typeof params.cards === 'string') {
        try {
            console.log('Migrating "cards" from string to object...');
            const cardsArray = JSON.parse(params.cards);
            params.cards = cardsArray;

            const newSourceParams = JSON.stringify(params);

            db.run('UPDATE sys_page_template SET source_params = ? WHERE id = ?', [newSourceParams, PAGE_ID], (err) => {
                if (err) {
                    console.error('Update failed:', err);
                } else {
                    console.log('Successfully migrated cards to array.');
                }
                db.close();
            });
        } catch (e) {
            console.error('Error parsing cards string:', e);
            db.close();
        }
    } else {
        console.log('"cards" is already an object or missing. No migration needed.');
        db.close();
    }
});
