const { DmAdapter } = require('../db_dm');

const config = {
    user: process.env.DM_TEST_USER || 'SY_PTDX_CS',
    password: process.env.DM_TEST_PASSWORD || 'SY_PTDX_CS',
    connectString: process.env.DM_TEST_CONNECT_STRING || '127.0.0.1:5236',
    loginEncrypt: process.env.DM_TEST_LOGIN_ENCRYPT === 'true' ? true : false,
    poolMin: Number(process.env.DM_TEST_POOL_MIN || 2),
    poolMax: Number(process.env.DM_TEST_POOL_MAX || 10)
};

function summarizeTypes(row) {
    if (!row || typeof row !== 'object') {
        return {};
    }

    const summary = {};
    for (const [key, value] of Object.entries(row)) {
        summary[key] = {
            type: typeof value,
            value: value instanceof Date ? value.toISOString() : value
        };
    }
    return summary;
}

async function main() {
    const adapter = new DmAdapter(config, 'dm_local_test');

    console.log('=== DM Adapter Test Start ===');
    console.log('Config:', {
        user: config.user,
        connectString: config.connectString,
        loginEncrypt: config.loginEncrypt,
        poolMin: config.poolMin,
        poolMax: config.poolMax
    });

    try {
        await adapter.initialize();
        console.log('Pool initialized successfully.');

        const countRow = await adapter.get('SELECT COUNT(*) as total FROM gjj_ywbzk WHERE 1=1');
        console.log('Count row:', countRow);
        console.log('Count row types:', summarizeTypes(countRow));

        const rows = await adapter.all(
            'SELECT * FROM gjj_ywbzk WHERE 1=1 ORDER BY pxh ASC, id DESC OFFSET ? ROWS FETCH NEXT ? ROWS ONLY',
            [0, 10]
        );

        console.log(`Fetched rows: ${rows.length}`);
        if (rows.length > 0) {
            console.log('First row types:', summarizeTypes(rows[0]));
        }

        const payload = {
            status: 0,
            msg: 'ok',
            data: {
                items: rows,
                total: countRow ? (countRow.total || countRow.TOTAL) : 0
            }
        };

        const serialized = JSON.stringify(payload);
        console.log(`JSON.stringify succeeded, length=${serialized.length}`);
        console.log('Payload preview:', serialized.slice(0, 500));
        console.log('=== DM Adapter Test Success ===');
    } catch (error) {
        console.error('=== DM Adapter Test Failed ===');
        console.error(error && error.stack ? error.stack : error);
        process.exitCode = 1;
    } finally {
        await adapter.close();
    }
}

main();
