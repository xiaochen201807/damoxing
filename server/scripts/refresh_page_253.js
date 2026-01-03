const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const nunjucks = require('nunjucks');

const DB_PATH = path.join(__dirname, '../data/database.sqlite');
const TEMPLATES_DIR = path.join(__dirname, '../templates');

const env = nunjucks.configure(TEMPLATES_DIR, {
    autoescape: false,
    noCache: true
});

env.addFilter('tojson', function (value) {
    return JSON.stringify(value);
});
env.addFilter('fromjson', function (str) {
    if (!str) return null;
    try {
        return typeof str === 'string' ? JSON.parse(str) : str;
    } catch (e) {
        return str;
    }
});

const db = new sqlite3.Database(DB_PATH);

const PAGE_KEY = 'tqfw';

db.get('SELECT * FROM sys_page_template WHERE page_key = ? AND is_active = 1', [PAGE_KEY], (err, row) => {
    if (err) {
        console.error('DB Error:', err);
        process.exit(1);
    }
    if (!row) {
        console.error('Page not found');
        process.exit(1);
    }

    let params = {};
    if (row.source_params) {
        try {
            params = JSON.parse(row.source_params);
        } catch (e) {
            console.error('Error parsing source_params', e);
        }
    }

    const context = {
        ...params,
        page_key: row.page_key,
        title: row.title,
        app_theme: 'default'
    };

    const templateFile = 'pages/active_demo.j2';

    console.log('Rendering template...');
    try {
        const schema = env.render(templateFile, context);
        // Validate JSON
        JSON.parse(schema);

        console.log(`Updating database for Page ID ${row.id}...`);
        db.run('UPDATE sys_page_template SET schema_json = ?, updated_at = datetime("now", "+08:00") WHERE id = ?', [schema, row.id], (err) => {
            if (err) {
                console.error('Update Error:', err);
                process.exit(1);
            }
            console.log('Success! Updated schema_json for page ID 253');
            db.close();
        });
    } catch (e) {
        console.error('Render error:', e);
        process.exit(1);
    }
});
