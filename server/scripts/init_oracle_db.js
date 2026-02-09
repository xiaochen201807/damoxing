const oracledb = require('oracledb');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const logger = console;

// Oracle Config
const oracleConfig = {
    user: process.env.ORACLE_USER,
    password: process.env.ORACLE_PASSWORD,
    connectString: process.env.ORACLE_CONNECT_STRING,
};

if (!process.env.ORACLE_USER) {
    logger.error("Oracle environment variables not set. Please check .env file.");
    process.exit(1);
}

const SQL_FILE_PATH = path.join(__dirname, '../data/init_business_standards_oracle.sql');

async function run() {
    let connection;

    try {
        logger.info("Connecting to Oracle...");
        connection = await oracledb.getConnection(oracleConfig);
        logger.info("Connected to Oracle.");

        const sqlContent = fs.readFileSync(SQL_FILE_PATH, 'utf8');
        
        // Remove comments
        const cleanSql = sqlContent
            .replace(/--.*$/gm, '') // Remove single line comments
            .replace(/\/\*[\s\S]*?\*\//g, ''); // Remove block comments

        // Split by semicolon
        const statements = cleanSql
            .split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0);

        logger.info(`Found ${statements.length} statements to execute.`);

        for (const sql of statements) {
            try {
                logger.info(`Executing: ${sql.substring(0, 50)}...`);
                await connection.execute(sql);
                logger.info("Success.");
            } catch (err) {
                // Ignore "name is already used by an existing object" error (ORA-00955)
                if (err.errorNum === 955) {
                    logger.warn("Object already exists, skipping.");
                } else {
                    logger.error(`Error executing SQL: ${err.message}`);
                    throw err;
                }
            }
        }

        logger.info("Database initialization completed successfully.");

    } catch (err) {
        logger.error("Initialization failed:", err);
    } finally {
        if (connection) {
            try { await connection.close(); } catch (e) { console.error("Close failed", e); }
        }
    }
}

run();
