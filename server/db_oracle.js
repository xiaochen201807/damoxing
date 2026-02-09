/**
 * Oracle Database Connection Module
 * 
 * Provides a connection pool and helper methods for executing queries.
 * Wraps oracledb to provide an API similar to sqlite3 for easier migration.
 */

const oracledb = require('oracledb');
const logger = require('./utils/logger');
require('dotenv').config();

// Enable auto-commit by default to match sqlite3 behavior (optional, but safer for web apps)
oracledb.autoCommit = true;

// Automatically convert CLOB to String and BLOB to Buffer
oracledb.fetchAsString = [oracledb.CLOB];
oracledb.fetchAsBuffer = [oracledb.BLOB];

// Output format: Object with column names as keys
oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;

const dbConfig = {
    user: process.env.ORACLE_USER,
    password: process.env.ORACLE_PASSWORD,
    connectString: process.env.ORACLE_CONNECT_STRING,
    poolMin: 2,
    poolMax: 10,
    poolIncrement: 2
};

let pool;

async function initialize() {
    if (process.env.ORACLE_ENABLE !== 'true') {
        logger.info('Oracle DB is disabled via environment variable.');
        return;
    }

    try {
        pool = await oracledb.createPool(dbConfig);
        logger.info('Oracle Connection Pool created successfully.');
    } catch (err) {
        logger.error('Error creating Oracle Connection Pool: ' + err.message);
        // Do not exit process, allowing app to run with SQLite only if needed
    }
}

async function close() {
    if (pool) {
        await pool.close();
        logger.info('Oracle Connection Pool closed.');
    }
}

/**
 * Helper to convert SQL with '?' parameters to Oracle ':n' syntax
 * Handles basic string literal escaping
 */
function prepareOracleQuery(sql, params) {
    if (!Array.isArray(params) || params.length === 0 || !sql.includes('?')) {
        return { sql, params };
    }

    let newSql = '';
    let lastIndex = 0;
    let paramIndex = 0;
    let inQuote = false;

    // If SQL already contains Oracle-style numeric binds (:1, :2, ...),
    // start numbering after the max to avoid collisions when mixing styles.
    let maxExistingBind = 0;
    {
        let scanInQuote = false;
        for (let i = 0; i < sql.length; i++) {
            const ch = sql[i];
            if (ch === "'") {
                if (i + 1 < sql.length && sql[i + 1] === "'") {
                    i++;
                } else {
                    scanInQuote = !scanInQuote;
                }
                continue;
            }
            if (scanInQuote) continue;
            if (ch === ':') {
                let j = i + 1;
                let num = '';
                while (j < sql.length) {
                    const dj = sql[j];
                    if (dj >= '0' && dj <= '9') {
                        num += dj;
                        j++;
                        continue;
                    }
                    break;
                }
                if (num.length) {
                    const n = Number(num);
                    if (Number.isFinite(n) && n > maxExistingBind) {
                        maxExistingBind = n;
                    }
                    i = j - 1;
                }
            }
        }
    }
    paramIndex = maxExistingBind;

    for (let i = 0; i < sql.length; i++) {
        const char = sql[i];
        if (char === "'") {
            // Handle escaped quotes (two single quotes)
            if (i + 1 < sql.length && sql[i+1] === "'") {
                i++; // Skip next quote
            } else {
                inQuote = !inQuote;
            }
        } else if (char === '?' && !inQuote) {
            paramIndex++;
            newSql += sql.substring(lastIndex, i) + `:${paramIndex}`;
            lastIndex = i + 1;
        }
    }
    newSql += sql.substring(lastIndex);

    return { sql: newSql, params };
}

/**
 * Execute a query and return all rows (similar to sqlite3 db.all)
 * @param {string} sql The SQL query
 * @param {Array|Object} params Parameters for the query
 * @returns {Promise<Array>} Array of rows
 */
async function all(sql, params = []) {
    if (!pool) throw new Error('Oracle pool not initialized');
    let connection;
    const start = Date.now();
    const sqlId = Math.random().toString(36).substring(7);

    try {
        connection = await pool.getConnection();
        
        const { sql: finalSql, params: finalParams } = prepareOracleQuery(sql, params);

        logger.info(`[Oracle] [SQL-${sqlId}] ==>  Preparing: ${finalSql}`);
        if (finalParams && (Array.isArray(finalParams) ? finalParams.length > 0 : Object.keys(finalParams).length > 0)) {
            try {
                logger.info(`[Oracle] [SQL-${sqlId}] ==> Parameters: ${JSON.stringify(finalParams)}`);
            } catch (jsonErr) {
                logger.warn(`[Oracle] [SQL-${sqlId}] ==> Parameters (cannot stringify): ${String(finalParams)}`);
            }
        }

        const result = await connection.execute(finalSql, finalParams);
        let rows = result.rows || [];
        
        // Convert keys to lowercase to match SQLite/Application expectations
        if (rows.length > 0) {
            rows = rows.map(row => {
                const newRow = {};
                for (const key in row) {
                    newRow[key.toLowerCase()] = row[key];
                }
                return newRow;
            });
        }

        const duration = Date.now() - start;

        logger.info(`[Oracle] [SQL-${sqlId}] <==      Total: ${rows.length} (${duration}ms)`);
        return rows;
    } catch (err) {
        const duration = Date.now() - start;
        logger.error(`[Oracle] [SQL-${sqlId}] <==      Error: ${err.message} (${duration}ms)`);
        throw err;
    } finally {
        if (connection) {
            try {
                await connection.close();
            } catch (err) {
                logger.error('[Oracle] Error closing connection', err);
            }
        }
    }
}

/**
 * Execute a query and return a single row (similar to sqlite3 db.get)
 * @param {string} sql The SQL query
 * @param {Array|Object} params Parameters for the query
 * @returns {Promise<Object>} Single row object or undefined
 */
async function get(sql, params = []) {
    const rows = await all(sql, params);
    return rows[0];
}

/**
 * Execute a command (INSERT, UPDATE, DELETE) (similar to sqlite3 db.run)
 * @param {string} sql The SQL query
 * @param {Array|Object} params Parameters for the query
 * @returns {Promise<Object>} Object containing { rowsAffected, lastID (if applicable) }
 */
async function run(sql, params = []) {
    if (!pool) throw new Error('Oracle pool not initialized');
    let connection;
    const start = Date.now();
    const sqlId = Math.random().toString(36).substring(7);

    try {
        connection = await pool.getConnection();
        
        const { sql: finalSql, params: finalParams } = prepareOracleQuery(sql, params);
        
        logger.info(`[Oracle] [SQL-${sqlId}] ==>  Preparing: ${finalSql}`);
        if (finalParams && (Array.isArray(finalParams) ? finalParams.length > 0 : Object.keys(finalParams).length > 0)) {
            try {
                logger.info(`[Oracle] [SQL-${sqlId}] ==> Parameters: ${JSON.stringify(finalParams)}`);
            } catch (jsonErr) {
                logger.warn(`[Oracle] [SQL-${sqlId}] ==> Parameters (cannot stringify): ${String(finalParams)}`);
            }
        }

        const result = await connection.execute(finalSql, finalParams, { autoCommit: true });
        const duration = Date.now() - start;

        logger.info(`[Oracle] [SQL-${sqlId}] <==    Updates: ${result.rowsAffected} (${duration}ms)`);
        
        return {
            rowsAffected: result.rowsAffected,
            lastID: null // Oracle doesn't return lastID automatically without RETURNING clause
        };
    } catch (err) {
        const duration = Date.now() - start;
        logger.error(`[Oracle] [SQL-${sqlId}] <==      Error: ${err.message} (${duration}ms)`);
        throw err;
    } finally {
        if (connection) {
            try {
                await connection.close();
            } catch (err) {
                logger.error('[Oracle] Error closing connection', err);
            }
        }
    }
}

/**
 * Helper to run query with explicit connection (transaction support)
 */
async function withConnection(callback) {
    if (!pool) throw new Error('Oracle pool not initialized');
    let connection;
    try {
        connection = await pool.getConnection();
        return await callback(connection);
    } catch (err) {
        throw err;
    } finally {
        if (connection) {
            try {
                await connection.close();
            } catch (err) {
                logger.error('[Oracle] Error closing connection', err);
            }
        }
    }
}

module.exports = {
    initialize,
    close,
    all,
    get,
    run,
    withConnection,
    prepareOracleQuery,
    pool // exposed for advanced usage
};
