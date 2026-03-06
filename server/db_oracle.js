/**
 * Oracle Database Adapter
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
            if (i + 1 < sql.length && sql[i + 1] === "'") {
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

class OracleAdapter {
    constructor(config, id) {
        this.config = config;
        this.id = id;
        this.pool = null;
    }

    async initialize() {
        try {
            this.pool = await oracledb.createPool(this.config);
            logger.info(`Oracle Connection Pool [${this.id}] created successfully.`);
        } catch (err) {
            logger.error(`Error creating Oracle Connection Pool [${this.id}]: ${err.message}`);
            throw err;
        }
    }

    async close() {
        if (this.pool) {
            try {
                await this.pool.close();
                logger.info(`Oracle Connection Pool [${this.id}] closed.`);
            } catch (err) {
                logger.error(`Error closing Oracle Connection Pool [${this.id}]`, err);
            }
        }
    }

    get isOracle() { return true; }
    get isEnabled() { return true; }

    async all(sql, params = []) {
        if (!this.pool) throw new Error(`Oracle pool [${this.id}] not initialized`);
        let connection;
        const start = Date.now();
        const sqlId = Math.random().toString(36).substring(7);

        try {
            connection = await this.pool.getConnection();
            const { sql: finalSql, params: finalParams } = prepareOracleQuery(sql, params);

            logger.info(`[Oracle-${this.id}] [SQL-${sqlId}] ==>  Preparing: ${finalSql}`);
            if (finalParams && (Array.isArray(finalParams) ? finalParams.length > 0 : Object.keys(finalParams).length > 0)) {
                try {
                    logger.info(`[Oracle-${this.id}] [SQL-${sqlId}] ==> Parameters: ${JSON.stringify(finalParams)}`);
                } catch (jsonErr) {
                    logger.warn(`[Oracle-${this.id}] [SQL-${sqlId}] ==> Parameters (cannot stringify): ${String(finalParams)}`);
                }
            }

            const result = await connection.execute(finalSql, finalParams);
            let rows = result.rows || [];

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
            logger.info(`[Oracle-${this.id}] [SQL-${sqlId}] <==      Total: ${rows.length} (${duration}ms)`);
            return rows;
        } catch (err) {
            const duration = Date.now() - start;
            logger.error(`[Oracle-${this.id}] [SQL-${sqlId}] <==      Error: ${err.message} (${duration}ms)`);
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

    async get(sql, params = []) {
        const rows = await this.all(sql, params);
        return rows[0];
    }

    async run(sql, params = []) {
        if (!this.pool) throw new Error(`Oracle pool [${this.id}] not initialized`);
        let connection;
        const start = Date.now();
        const sqlId = Math.random().toString(36).substring(7);

        try {
            connection = await this.pool.getConnection();
            const { sql: finalSql, params: finalParams } = prepareOracleQuery(sql, params);

            logger.info(`[Oracle-${this.id}] [SQL-${sqlId}] ==>  Preparing: ${finalSql}`);
            if (finalParams && (Array.isArray(finalParams) ? finalParams.length > 0 : Object.keys(finalParams).length > 0)) {
                try {
                    logger.info(`[Oracle-${this.id}] [SQL-${sqlId}] ==> Parameters: ${JSON.stringify(finalParams)}`);
                } catch (jsonErr) {
                    logger.warn(`[Oracle-${this.id}] [SQL-${sqlId}] ==> Parameters (cannot stringify): ${String(finalParams)}`);
                }
            }

            const result = await connection.execute(finalSql, finalParams, { autoCommit: true });
            const duration = Date.now() - start;

            logger.info(`[Oracle-${this.id}] [SQL-${sqlId}] <==    Updates: ${result.rowsAffected} (${duration}ms)`);

            return {
                rowsAffected: result.rowsAffected,
                lastID: null
            };
        } catch (err) {
            const duration = Date.now() - start;
            logger.error(`[Oracle-${this.id}] [SQL-${sqlId}] <==      Error: ${err.message} (${duration}ms)`);
            throw err;
        } finally {
            if (connection) {
                try { await connection.close(); } catch (err) { logger.error('[Oracle] Error closing connection', err); }
            }
        }
    }

    async exec(sql) {
        return this.run(sql);
    }

    async withConnection(callback) {
        if (!this.pool) throw new Error(`Oracle pool [${this.id}] not initialized`);
        let connection;
        try {
            connection = await this.pool.getConnection();
            return await callback(connection);
        } catch (err) {
            throw err;
        } finally {
            if (connection) {
                try { await connection.close(); } catch (err) { logger.error('[Oracle] Error closing connection', err); }
            }
        }
    }

    async transaction(work) {
        return this.withConnection(async (connection) => {
            const txId = Math.random().toString(36).substring(7);
            const tx = {
                async all(sql, params = []) {
                    const { sql: finalSql, params: finalParams } = prepareOracleQuery(sql, params);
                    const result = await connection.execute(finalSql, finalParams, { autoCommit: false });
                    let rows = result.rows || [];
                    if (rows.length > 0) {
                        rows = rows.map(row => {
                            const newRow = {};
                            for (const key in row) {
                                newRow[key.toLowerCase()] = row[key];
                            }
                            return newRow;
                        });
                    }
                    return rows;
                },
                async get(sql, params = []) {
                    const rows = await tx.all(sql, params);
                    return rows[0];
                },
                async run(sql, params = []) {
                    const { sql: finalSql, params: finalParams } = prepareOracleQuery(sql, params);
                    const result = await connection.execute(finalSql, finalParams, { autoCommit: false });
                    return { rowsAffected: result.rowsAffected, lastID: null };
                },
                async exec(sql) {
                    await connection.execute(sql, [], { autoCommit: false });
                }
            };

            try {
                logger.info(`[Oracle-${this.id}] [TX-${txId}] BEGIN`);
                const result = await work(tx);
                await connection.commit();
                logger.info(`[Oracle-${this.id}] [TX-${txId}] COMMIT`);
                return result;
            } catch (err) {
                try {
                    logger.warn(`[Oracle-${this.id}] [TX-${txId}] ROLLBACK`);
                    await connection.rollback();
                } catch (rollbackErr) {
                    logger.error(`[Oracle-${this.id}] [TX-${txId}] Rollback failed:`, rollbackErr);
                }
                throw err;
            }
        });
    }
}

module.exports = { OracleAdapter, prepareOracleQuery };
