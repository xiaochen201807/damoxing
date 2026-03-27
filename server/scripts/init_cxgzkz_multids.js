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
    oracle: {
        label: 'Oracle',
        AdapterClass: OracleAdapter,
        sqlFile: path.join(__dirname, '../data/init_cxgzkz_oracle.sql')
    },
    dm: {
        label: 'Dameng',
        AdapterClass: DmAdapter,
        sqlFile: path.join(__dirname, '../data/init_cxgzkz_dm.sql')
    },
    pg: {
        label: 'PostgreSQL',
        AdapterClass: PgAdapter,
        sqlFile: path.join(__dirname, '../data/init_cxgzkz_pg_family.sql')
    },
    gauss: {
        label: 'openGauss',
        AdapterClass: GaussAdapter,
        sqlFile: path.join(__dirname, '../data/init_cxgzkz_pg_family.sql')
    },
    kingbase: {
        label: 'Kingbase',
        AdapterClass: KingbaseAdapter,
        sqlFile: path.join(__dirname, '../data/init_cxgzkz_pg_family.sql')
    }
};

function loadDatasourceConfig() {
    if (!fs.existsSync(configPath)) {
        throw new Error('datasources.json not found. Please create it first.');
    }

    return JSON.parse(fs.readFileSync(configPath, 'utf8'));
}

function removeSqlComments(sqlContent) {
    return sqlContent
        .replace(/--.*$/gm, '')
        .replace(/\/\*[\s\S]*?\*\//g, '');
}

function splitSqlStatements(sqlContent) {
    return removeSqlComments(sqlContent)
        .split(';')
        .map(statement => statement.trim())
        .filter(Boolean);
}

function isObjectExistsError(type, err) {
    const message = String(err?.message || err || '');

    if (type === 'oracle') {
        return err?.errorNum === 955 || /ORA-00955|already exists/i.test(message);
    }

    if (type === 'dm') {
        return /already exists|对象.*已存在|名称.*已存在|索引.*已存在|重复/i.test(message);
    }

    return /already exists/i.test(message);
}

async function runForSource(source) {
    const handler = SOURCE_HANDLERS[source.type];
    if (!handler) {
        return;
    }

    if (!fs.existsSync(handler.sqlFile)) {
        throw new Error(`SQL file not found: ${handler.sqlFile}`);
    }

    const adapter = new handler.AdapterClass(source.config, `init_cxgzkz_${source.id}`);
    const sqlContent = fs.readFileSync(handler.sqlFile, 'utf8');
    const statements = splitSqlStatements(sqlContent);

    logger.info(`\n[${handler.label}] Initializing cxgzkz for datasource ${source.id} ...`);
    logger.info(`[${handler.label}] SQL file: ${handler.sqlFile}`);
    logger.info(`[${handler.label}] Statements: ${statements.length}`);

    await adapter.initialize();

    try {
        for (const statement of statements) {
            try {
                logger.info(`[${handler.label}] Executing: ${statement.substring(0, 80)}...`);
                await adapter.exec(statement);
            } catch (err) {
                if (isObjectExistsError(source.type, err)) {
                    logger.warn(`[${handler.label}] Object already exists, skipped: ${err.message}`);
                    continue;
                }
                throw err;
            }
        }

        logger.info(`[${handler.label}] cxgzkz initialization completed for ${source.id}.`);
    } finally {
        await adapter.close();
    }
}

async function main() {
    const conf = loadDatasourceConfig();
    const sources = (conf.datasources || []).filter(source => SOURCE_HANDLERS[source.type]);

    if (sources.length === 0) {
        logger.info('No oracle/dm/pg/gauss/kingbase datasources configured, skipping cxgzkz initialization.');
        return;
    }

    for (const source of sources) {
        await runForSource(source);
    }
}

main().catch(err => {
    logger.error('cxgzkz multi-datasource initialization failed:', err);
    process.exit(1);
});
