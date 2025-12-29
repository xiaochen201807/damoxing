const db = require('../db');

db.get('SELECT schema_json FROM sys_page_template WHERE page_key = ? AND is_active = 1', ['config'], (err, row) => {
    if (err || !row) {
        console.error('Error:', err || 'No data');
        process.exit(1);
    }

    const schema = JSON.parse(row.schema_json);
    console.log('=== Schema Structure ===');
    console.log('Type:', typeof schema);
    console.log('Is Array:', Array.isArray(schema));
    console.log('');

    if (Array.isArray(schema)) {
        console.log('Array length:', schema.length);
        console.log('First element title:', schema[0]?.title);
        console.log('Titles:', schema.map(t => t.title));
    } else {
        console.log('Object keys:', Object.keys(schema));
        console.log('schema.type:', schema.type);
        console.log('schema.body exists:', !!schema.body);

        if (schema.body) {
            console.log('schema.body type:', typeof schema.body);
            console.log('schema.body is Array:', Array.isArray(schema.body));
            console.log('schema.body keys:', Object.keys(schema.body));
            console.log('schema.body.type:', schema.body.type);
            console.log('schema.body.tabs exists:', !!schema.body.tabs);

            if (schema.body.tabs) {
                console.log('schema.body.tabs is Array:', Array.isArray(schema.body.tabs));
                console.log('schema.body.tabs length:', schema.body.tabs.length);
                console.log('Tab titles:', schema.body.tabs.map(t => t.title));
            }
        }
    }

    process.exit(0);
});
