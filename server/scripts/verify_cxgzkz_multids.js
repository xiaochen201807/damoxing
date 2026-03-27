const fs = require('fs');
const path = require('path');

const { OracleAdapter } = require('../db_oracle');
const { DmAdapter } = require('../db_dm');
const { PgAdapter, GaussAdapter, KingbaseAdapter } = require('../db_pg');

const logger = console;
const configPath = process.env.DATASOURCES_CONFIG_PATH
    ? path.resolve(process.env.DATASOURCES_CONFIG_PATH)
    : path.join(__dirname, '../config/datasources.json');

const SOURCE_HANDLERS = {
    oracle: { label: 'Oracle', AdapterClass: OracleAdapter },
    dm: { label: 'Dameng', AdapterClass: DmAdapter },
    pg: { label: 'PostgreSQL', AdapterClass: PgAdapter },
    gauss: { label: 'openGauss', AdapterClass: GaussAdapter },
    kingbase: { label: 'Kingbase', AdapterClass: KingbaseAdapter }
};

function loadDatasourceConfig() {
    if (!fs.existsSync(configPath)) {
        throw new Error('datasources.json not found. Please create it first.');
    }

    return JSON.parse(fs.readFileSync(configPath, 'utf8'));
}

function buildVerifyPayload(sourceId) {
    const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    return {
        jgbh: `verify_${sourceId}`,
        zjgbh: `verify_${sourceId}_child`,
        sxbh: `CXGZKZ_${suffix}`,
        gzmc: `cxgzkz-verify-${suffix}`,
        gztsy: `cxgzkz verify payload ${suffix}`,
        sfqy: 'y',
        sfyxtqy: 'y',
        sfyxtztsy: 'n',
        role: 'verify'
    };
}

async function verifyForSource(source) {
    const handler = SOURCE_HANDLERS[source.type];
    const adapter = new handler.AdapterClass(source.config, `verify_cxgzkz_${source.id}`);

    logger.info(`\n[${handler.label}] Verifying cxgzkz on datasource ${source.id} ...`);
    await adapter.initialize();

    try {
        const countRow = await adapter.get('SELECT COUNT(*) AS total FROM gjj_cxgzkz');
        logger.info(`[${handler.label}] Table exists, current row count: ${countRow?.total ?? countRow?.TOTAL ?? 0}`);

        const payload = buildVerifyPayload(source.id);

        await adapter.transaction(async (tx) => {
            const inserted = await tx.run(
                `INSERT INTO gjj_cxgzkz (jgbh, zjgbh, sxbh, gzmc, gztsy, sfqy, sfyxtqy, sfyxtztsy, role)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    payload.jgbh,
                    payload.zjgbh,
                    payload.sxbh,
                    payload.gzmc,
                    payload.gztsy,
                    payload.sfqy,
                    payload.sfyxtqy,
                    payload.sfyxtztsy,
                    payload.role
                ]
            );

            const insertedRow = await tx.get('SELECT * FROM gjj_cxgzkz WHERE id = ?', [inserted.lastID]);
            if (!insertedRow) {
                throw new Error('Insert verification failed: inserted row not found');
            }

            const nextPrompt = `${payload.gztsy} updated`;
            await tx.run('UPDATE gjj_cxgzkz SET gztsy = ? WHERE id = ?', [nextPrompt, inserted.lastID]);

            const updatedRow = await tx.get('SELECT gztsy FROM gjj_cxgzkz WHERE id = ?', [inserted.lastID]);
            const updatedPrompt = updatedRow?.gztsy ?? updatedRow?.GZTSY;
            if (updatedPrompt !== nextPrompt) {
                throw new Error(`Update verification failed: expected "${nextPrompt}", got "${updatedPrompt}"`);
            }

            await tx.run('DELETE FROM gjj_cxgzkz WHERE id = ?', [inserted.lastID]);

            const deletedRow = await tx.get('SELECT id FROM gjj_cxgzkz WHERE id = ?', [inserted.lastID]);
            if (deletedRow) {
                throw new Error('Delete verification failed: deleted row still exists');
            }
        });

        logger.info(`[${handler.label}] cxgzkz verification passed for ${source.id}.`);
    } finally {
        await adapter.close();
    }
}

async function main() {
    const conf = loadDatasourceConfig();
    const sources = (conf.datasources || []).filter(source => SOURCE_HANDLERS[source.type]);

    if (sources.length === 0) {
        logger.info('No oracle/dm/pg/gauss/kingbase datasources configured, skipping cxgzkz verification.');
        return;
    }

    for (const source of sources) {
        await verifyForSource(source);
    }
}

main().catch(err => {
    logger.error('cxgzkz multi-datasource verification failed:', err);
    process.exit(1);
});
