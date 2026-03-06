const dmdb = require('dmdb');
const path = require('path');
const fs = require('fs');

const logger = console;
const configPath = path.join(__dirname, '../config/datasources.json');

if (!fs.existsSync(configPath)) {
    logger.error("datasources.json not found. Please create it from the example.");
    process.exit(1);
}

const conf = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const dmSources = (conf.datasources || []).filter(ds => ds.type === 'dm');

if (dmSources.length === 0) {
    logger.info("No Dameng (dm) datasources configured, skipping initialization.");
    process.exit(0);
}

const SQL_FILE_PATH = path.join(__dirname, '../data/init_business_standards_oracle.sql');

async function runForSource(source) {
    let connection;
    try {
        const { user, password, connectString } = source.config;
        logger.info(`Starting initialization for Dameng DS: ${source.id} (${connectString})...`);
        connection = await dmdb.getConnection({ user, password, connectString });
        logger.info(`Connected to Dameng DS: ${source.id}.`);

        const sqlContent = fs.readFileSync(SQL_FILE_PATH, 'utf8');

        // Remove comments
        const cleanSql = sqlContent
            .replace(/--.*$/gm, '')
            .replace(/\/\*[\s\S]*?\*\//g, '');

        // Split by semicolon
        const statements = cleanSql
            .split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0);

        logger.info(`Found ${statements.length} statements to execute on ${source.id}.`);

        for (const sql of statements) {
            try {
                logger.info(`Executing: ${sql.substring(0, 50)}...`);
                await connection.execute(sql);
                logger.info("Success.");
            } catch (err) {
                logger.warn(`Execution warning on ${source.id}: ${err.message}`);
                // Continue despite errors like table already exists
            }
        }
        logger.info(`Dameng initialization completed successfully for ${source.id}.`);
    } catch (err) {
        logger.error(`Initialization failed for ${source.id}:`, err);
    } finally {
        if (connection) {
            try { await connection.close(); } catch (e) { console.error("Close failed", e); }
        }
    }
}

async function runAll() {
    for (const source of dmSources) {
        await runForSource(source);
    }
}

runAll();
