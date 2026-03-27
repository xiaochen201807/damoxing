/**
 * Dameng Database Adapter
 * 
 * Provides a connection pool and helper methods for executing queries.
 */

const dmdb = require('dmdb');
const logger = require('./utils/logger');
const { prepareOracleQuery } = require('./db_oracle'); // Reuse Oracle binding parameter converter

// Configuration
dmdb.outFormat = dmdb.OUT_FORMAT_OBJECT;
dmdb.autoCommit = true;
dmdb.fetchAsString = [dmdb.NUMBER, dmdb.CLOB];

function isPlainObject(value) {
    if (!value || typeof value !== 'object') {
        return false;
    }

    const proto = Object.getPrototypeOf(value);
    return proto === Object.prototype || proto === null;
}

function normalizeDmValue(value, seen = new WeakSet()) {
    if (typeof value === 'bigint') {
        const numberValue = Number(value);
        return Number.isSafeInteger(numberValue) ? numberValue : value.toString();
    }

    if (Array.isArray(value)) {
        return value.map(item => normalizeDmValue(item, seen));
    }

    if (value && typeof value === 'object') {
        if (value instanceof Date || Buffer.isBuffer(value)) {
            return value;
        }

        if (!isPlainObject(value)) {
            return value;
        }

        if (seen.has(value)) {
            return null;
        }

        seen.add(value);

        const normalized = {};
        for (const [key, nestedValue] of Object.entries(value)) {
            normalized[key] = normalizeDmValue(nestedValue, seen);
        }

        seen.delete(value);
        return normalized;
    }

    return value;
}

function normalizeDmRow(row) {
    const newRow = {};
    for (const key in row) {
        newRow[key.toLowerCase()] = normalizeDmValue(row[key]);
    }
    return newRow;
}

function normalizeOutBindScalar(value) {
    let current = normalizeDmValue(value);
    while (Array.isArray(current) && current.length === 1) {
        [current] = current;
    }
    return current;
}

function normalizeDmPoolConfig(config = {}) {
    const nextConfig = { ...config };
    const rawConnectString = String(nextConfig.connectString || nextConfig.connectionString || '').trim();

    if (!rawConnectString) {
        throw new Error('Dm datasource connectString is required');
    }

    if (!rawConnectString.startsWith('dm://')) {
        const user = nextConfig.user == null ? '' : String(nextConfig.user);
        const password = nextConfig.password == null ? '' : String(nextConfig.password);
        const auth = user
            ? `${encodeURIComponent(user)}${password !== '' ? `:${encodeURIComponent(password)}` : ''}@`
            : '';

        nextConfig.connectString = `dm://${auth}${rawConnectString}`;
    } else {
        nextConfig.connectString = rawConnectString;
    }

    if (typeof nextConfig.loginEncrypt === 'boolean') {
        const loginEncryptFragment = `loginEncrypt=${String(nextConfig.loginEncrypt)}`;
        nextConfig.connectString += nextConfig.connectString.includes('?')
            ? `&${loginEncryptFragment}`
            : `?${loginEncryptFragment}`;
    }

    delete nextConfig.connectionString;
    return nextConfig;
}

class DmAdapter {
    constructor(config, id) {
        this.config = config;
        this.id = id;
        this.pool = null;
    }

    async initialize() {
        try {
            const poolConfig = normalizeDmPoolConfig(this.config);
            this.pool = await dmdb.createPool(poolConfig);
            logger.info(`Dm Connection Pool [${this.id}] created successfully.`);
        } catch (err) {
            logger.error(`Error creating Dm Connection Pool [${this.id}]: ${err.message}`);
            throw err;
        }
    }

    async close() {
        if (this.pool) {
            try {
                await this.pool.close();
                logger.info(`Dm Connection Pool [${this.id}] closed.`);
            } catch (err) {
                logger.error(`Error closing Dm [${this.id}] pool`, err);
            }
        }
    }

    get isOracle() { return true; } // Map to Oracle since DM syntax is compatible
    get isEnabled() { return true; }

    async all(sql, params = []) {
        if (!this.pool) throw new Error(`Dm pool [${this.id}] not initialized`);
        let connection;
        const start = Date.now();
        const sqlId = Math.random().toString(36).substring(7);

        try {
            connection = await this.pool.getConnection();
            const { sql: finalSql, params: finalParams } = prepareOracleQuery(sql, params);

            logger.info(`[Dm-${this.id}] [SQL-${sqlId}] ==>  Preparing: ${finalSql}`);
            if (finalParams && (Array.isArray(finalParams) ? finalParams.length > 0 : Object.keys(finalParams).length > 0)) {
                try {
                    logger.info(`[Dm-${this.id}] [SQL-${sqlId}] ==> Parameters: ${JSON.stringify(finalParams)}`);
                } catch (jsonErr) {
                    logger.warn(`[Dm-${this.id}] [SQL-${sqlId}] ==> Parameters (cannot stringify)`);
                }
            }

            const result = await connection.execute(finalSql, finalParams);
            let rows = result.rows || [];

            if (rows.length > 0) {
                rows = rows.map(normalizeDmRow);
            }

            const duration = Date.now() - start;
            logger.info(`[Dm-${this.id}] [SQL-${sqlId}] <==      Total: ${rows.length} (${duration}ms)`);
            return rows;
        } catch (err) {
            const duration = Date.now() - start;
            logger.error(`[Dm-${this.id}] [SQL-${sqlId}] <==      Error: ${err.message} (${duration}ms)`);
            throw err;
        } finally {
            if (connection) {
                try { await connection.close(); } catch (err) { logger.error('Error closing connection', err); }
            }
        }
    }

    async get(sql, params = []) {
        const rows = await this.all(sql, params);
        return rows[0];
    }

    async run(sql, params = []) {
        if (!this.pool) throw new Error(`Dm pool [${this.id}] not initialized`);
        let connection;
        const start = Date.now();
        const sqlId = Math.random().toString(36).substring(7);

        try {
            connection = await this.pool.getConnection();
            const { sql: finalSql, params: finalParams } = prepareOracleQuery(sql, params);

            // 对 INSERT 语句自动追加 RETURNING id INTO :out 以获取自增主键
            const isInsert = /^\s*INSERT\s+/i.test(finalSql);
            let execSql = finalSql;
            let execParams = finalParams;
            if (isInsert) {
                const dmdb_ = require('dmdb');
                const outBind = { type: dmdb_.NUMBER, dir: dmdb_.BIND_OUT };
                execSql = finalSql.replace(/;?\s*$/, '') + ' RETURNING id INTO :out';
                execParams = Array.isArray(finalParams)
                    ? [...finalParams, outBind]
                    : { ...finalParams, out: outBind };
            }

            logger.info(`[Dm-${this.id}] [SQL-${sqlId}] ==>  Preparing: ${execSql}`);
            if (execParams && (Array.isArray(execParams) ? execParams.length > 0 : Object.keys(execParams).length > 0)) {
                try {
                    logger.info(`[Dm-${this.id}] [SQL-${sqlId}] ==> Parameters: ${JSON.stringify(execParams)}`);
                } catch (jsonErr) {
                    logger.warn(`[Dm-${this.id}] [SQL-${sqlId}] ==> Parameters (cannot stringify)`);
                }
            }

            const result = await connection.execute(execSql, execParams, { autoCommit: true });
            const duration = Date.now() - start;
            const lastID = isInsert
                ? normalizeOutBindScalar(result.outBinds?.[result.outBinds.length - 1] ?? result.outBinds?.out ?? null)
                : null;

            logger.info(`[Dm-${this.id}] [SQL-${sqlId}] <==    Updates: ${result.rowsAffected} (${duration}ms)`);

            return {
                rowsAffected: normalizeDmValue(result.rowsAffected),
                lastID
            };
        } catch (err) {
            const duration = Date.now() - start;
            logger.error(`[Dm-${this.id}] [SQL-${sqlId}] <==      Error: ${err.message} (${duration}ms)`);
            throw err;
        } finally {
            if (connection) {
                try { await connection.close(); } catch (err) { logger.error('Error closing connection', err); }
            }
        }
    }

    async exec(sql) {
        return this.run(sql);
    }

    async withConnection(callback) {
        if (!this.pool) throw new Error(`Dm pool [${this.id}] not initialized`);
        let connection;
        try {
            connection = await this.pool.getConnection();
            return await callback(connection);
        } catch (err) {
            throw err;
        } finally {
            if (connection) {
                try { await connection.close(); } catch (err) { logger.error('Error closing connection', err); }
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
                        rows = rows.map(normalizeDmRow);
                    }
                    return rows;
                },
                async get(sql, params = []) {
                    const rows = await tx.all(sql, params);
                    return rows[0];
                },
                async run(sql, params = []) {
                    const { sql: finalSql, params: finalParams } = prepareOracleQuery(sql, params);
                    const isInsert = /^\s*INSERT\s+/i.test(finalSql);
                    let execSql = finalSql;
                    let execParams = finalParams;
                    if (isInsert) {
                        const dmdb_ = require('dmdb');
                        const outBind = { type: dmdb_.NUMBER, dir: dmdb_.BIND_OUT };
                        execSql = finalSql.replace(/;?\s*$/, '') + ' RETURNING id INTO :out';
                        execParams = Array.isArray(finalParams)
                            ? [...finalParams, outBind]
                            : { ...finalParams, out: outBind };
                    }
                    const result = await connection.execute(execSql, execParams, { autoCommit: false });
                    const lastID = isInsert
                        ? normalizeOutBindScalar(result.outBinds?.[result.outBinds.length - 1] ?? result.outBinds?.out ?? null)
                        : null;
                    return { rowsAffected: normalizeDmValue(result.rowsAffected), lastID };
                },
                async exec(sql) {
                    await connection.execute(sql, [], { autoCommit: false });
                }
            };

            try {
                logger.info(`[Dm-${this.id}] [TX-${txId}] BEGIN`);
                const result = await work(tx);
                await connection.commit();
                logger.info(`[Dm-${this.id}] [TX-${txId}] COMMIT`);
                return result;
            } catch (err) {
                try {
                    logger.warn(`[Dm-${this.id}] [TX-${txId}] ROLLBACK`);
                    await connection.rollback();
                } catch (rollbackErr) {
                    logger.error(`[Dm-${this.id}] [TX-${txId}] Rollback failed:`, rollbackErr);
                }
                throw err;
            }
        });
    }
}

module.exports = { DmAdapter, normalizeDmPoolConfig };
