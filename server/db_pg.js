/**
 * PostgreSQL Database Adapter
 *
 * 基于 pg 驱动，提供与 OracleAdapter / DmAdapter 一致的接口。
 * 同时作为 GaussDB、Kingbase 的基类（它们都兼容 PostgreSQL 协议）。
 */

const { Pool } = require('pg');
const logger = require('./utils/logger');
require('dotenv').config();

/**
 * 将 SQL 中的 '?' 占位符转换为 PostgreSQL 的 '$n' 语法
 * 同时兼容已有的 ':n'（Oracle 风格）占位符
 */
function preparePgQuery(sql, params) {
    if (!Array.isArray(params) || params.length === 0 || !sql.includes('?')) {
        // 如果没有 '?' 但有 ':n' 风格，也需要转换
        if (sql.includes(':') && Array.isArray(params) && params.length > 0) {
            return convertOracleBindsToPg(sql, params);
        }
        return { sql, params };
    }

    let newSql = '';
    let lastIndex = 0;
    let paramIndex = 0;
    let inQuote = false;

    for (let i = 0; i < sql.length; i++) {
        const char = sql[i];
        if (char === "'") {
            if (i + 1 < sql.length && sql[i + 1] === "'") {
                i++;
            } else {
                inQuote = !inQuote;
            }
        } else if (char === '?' && !inQuote) {
            paramIndex++;
            newSql += sql.substring(lastIndex, i) + `$${paramIndex}`;
            lastIndex = i + 1;
        }
    }
    newSql += sql.substring(lastIndex);

    // 如果还有 ':n' 风格的绑定，一并转换
    if (newSql.match(/:\d+/)) {
        return convertOracleBindsToPg(newSql, params);
    }

    return { sql: newSql, params };
}

/**
 * 将 ':n' Oracle 风格占位符转换为 '$n' PG 风格
 */
function convertOracleBindsToPg(sql, params) {
    let newSql = '';
    let inQuote = false;

    for (let i = 0; i < sql.length; i++) {
        const char = sql[i];
        if (char === "'") {
            if (i + 1 < sql.length && sql[i + 1] === "'") {
                newSql += "''";
                i++;
                continue;
            }
            inQuote = !inQuote;
            newSql += char;
        } else if (char === ':' && !inQuote) {
            let num = '';
            let j = i + 1;
            while (j < sql.length && sql[j] >= '0' && sql[j] <= '9') {
                num += sql[j];
                j++;
            }
            if (num.length > 0) {
                newSql += `$${num}`;
                i = j - 1;
            } else {
                newSql += char;
            }
        } else {
            newSql += char;
        }
    }

    return { sql: newSql, params };
}

class PgAdapter {
    constructor(config, id) {
        this.config = config;
        this.id = id;
        this.pool = null;
        this.adapterType = 'pg';
    }

    async initialize() {
        try {
            const poolConfig = this._buildPoolConfig();
            // 增加超时设置，防止挂起
            poolConfig.connectionTimeoutMillis = 5000;
            
            this.pool = new Pool(poolConfig);
            // 测试连接
            const client = await this.pool.connect();
            client.release();
            logger.info(`PG Connection Pool [${this.id}] (${this.adapterType}) created successfully.`);
        } catch (err) {
            logger.error(`Error creating PG Connection Pool [${this.id}]: ${err.message}`);
            throw err;
        }
    }

    _buildPoolConfig() {
        const config = { ...this.config };

        // 兼容 connectString 格式: host:port/database 或 host:port
        if (config.connectString && !config.host) {
            const connStr = config.connectString;
            const slashIdx = connStr.indexOf('/');
            let hostPort, database;

            if (slashIdx !== -1) {
                hostPort = connStr.substring(0, slashIdx);
                database = connStr.substring(slashIdx + 1);
            } else {
                hostPort = connStr;
            }

            const colonIdx = hostPort.lastIndexOf(':');
            if (colonIdx !== -1) {
                config.host = hostPort.substring(0, colonIdx);
                config.port = parseInt(hostPort.substring(colonIdx + 1), 10);
            } else {
                config.host = hostPort;
            }

            if (database) {
                config.database = database;
            }
            delete config.connectString;
        }

        // 映射连接池配置
        if (config.poolMin != null) {
            config.min = config.poolMin;
            delete config.poolMin;
        }
        if (config.poolMax != null) {
            config.max = config.poolMax;
            delete config.poolMax;
        }

        // 移除不属于 pg 的配置项
        delete config.loginEncrypt;

        return config;
    }

    async close() {
        if (this.pool) {
            try {
                await this.pool.end();
                logger.info(`PG Connection Pool [${this.id}] closed.`);
            } catch (err) {
                logger.error(`Error closing PG [${this.id}] pool`, err);
            }
        }
    }

    get isOracle() { return false; }
    get isEnabled() { return true; }

    async all(sql, params = []) {
        if (!this.pool) throw new Error(`PG pool [${this.id}] not initialized`);
        const start = Date.now();
        const sqlId = Math.random().toString(36).substring(7);

        try {
            const { sql: finalSql, params: finalParams } = preparePgQuery(sql, params);

            logger.info(`[PG-${this.id}] [SQL-${sqlId}] ==>  Preparing: ${finalSql}`);
            if (finalParams && finalParams.length > 0) {
                try {
                    logger.info(`[PG-${this.id}] [SQL-${sqlId}] ==> Parameters: ${JSON.stringify(finalParams)}`);
                } catch (jsonErr) {
                    logger.warn(`[PG-${this.id}] [SQL-${sqlId}] ==> Parameters (cannot stringify)`);
                }
            }

            const result = await this.pool.query(finalSql, finalParams);
            let rows = result.rows || [];

            // PG 默认返回小写字段名，但为了一致性，统一转小写
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
            logger.info(`[PG-${this.id}] [SQL-${sqlId}] <==      Total: ${rows.length} (${duration}ms)`);
            return rows;
        } catch (err) {
            const duration = Date.now() - start;
            logger.error(`[PG-${this.id}] [SQL-${sqlId}] <==      Error: ${err.message} (${duration}ms)`);
            throw err;
        }
    }

    async get(sql, params = []) {
        const rows = await this.all(sql, params);
        return rows[0];
    }

    async run(sql, params = []) {
        if (!this.pool) throw new Error(`PG pool [${this.id}] not initialized`);
        const start = Date.now();
        const sqlId = Math.random().toString(36).substring(7);

        try {
            const isInsert = /^\s*INSERT\s+/i.test(sql);
            // 对 INSERT 自动追加 RETURNING id 以获取自增主键（如果没有已有的 RETURNING 子句）
            const needsReturning = isInsert && !/RETURNING\s+/i.test(sql);
            const execSql = needsReturning ? sql.replace(/;?\s*$/, '') + ' RETURNING id' : sql;
            const { sql: finalSql, params: finalParams } = preparePgQuery(execSql, params);

            logger.info(`[PG-${this.id}] [SQL-${sqlId}] ==>  Preparing: ${finalSql}`);
            if (finalParams && finalParams.length > 0) {
                try {
                    logger.info(`[PG-${this.id}] [SQL-${sqlId}] ==> Parameters: ${JSON.stringify(finalParams)}`);
                } catch (jsonErr) {
                    logger.warn(`[PG-${this.id}] [SQL-${sqlId}] ==> Parameters (cannot stringify)`);
                }
            }

            const result = await this.pool.query(finalSql, finalParams);
            const duration = Date.now() - start;
            const lastID = needsReturning ? (result.rows?.[0]?.id ?? null) : null;

            logger.info(`[PG-${this.id}] [SQL-${sqlId}] <==    Updates: ${result.rowCount} (${duration}ms)`);

            return {
                rowsAffected: result.rowCount,
                lastID
            };
        } catch (err) {
            const duration = Date.now() - start;
            logger.error(`[PG-${this.id}] [SQL-${sqlId}] <==      Error: ${err.message} (${duration}ms)`);
            throw err;
        }
    }

    async exec(sql) {
        return this.run(sql);
    }

    async transaction(work) {
        if (!this.pool) throw new Error(`PG pool [${this.id}] not initialized`);
        const client = await this.pool.connect();
        const txId = Math.random().toString(36).substring(7);

        const tx = {
            async all(sql, params = []) {
                const { sql: finalSql, params: finalParams } = preparePgQuery(sql, params);
                const result = await client.query(finalSql, finalParams);
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
                const isInsert = /^\s*INSERT\s+/i.test(sql);
                const needsReturning = isInsert && !/RETURNING\s+/i.test(sql);
                const execSql = needsReturning ? sql.replace(/;?\s*$/, '') + ' RETURNING id' : sql;
                const { sql: finalSql, params: finalParams } = preparePgQuery(execSql, params);
                const result = await client.query(finalSql, finalParams);
                const lastID = needsReturning ? (result.rows?.[0]?.id ?? null) : null;
                return { rowsAffected: result.rowCount, lastID };
            },
            async exec(sql) {
                await client.query(sql);
            }
        };

        try {
            logger.info(`[PG-${this.id}] [TX-${txId}] BEGIN`);
            await client.query('BEGIN');
            const result = await work(tx);
            await client.query('COMMIT');
            logger.info(`[PG-${this.id}] [TX-${txId}] COMMIT`);
            return result;
        } catch (err) {
            try {
                logger.warn(`[PG-${this.id}] [TX-${txId}] ROLLBACK`);
                await client.query('ROLLBACK');
            } catch (rollbackErr) {
                logger.error(`[PG-${this.id}] [TX-${txId}] Rollback failed:`, rollbackErr);
            }
            throw err;
        } finally {
            client.release();
        }
    }
}

/**
 * GaussDB 适配器 — 继承 PgAdapter
 * GaussDB 兼容 PostgreSQL 协议，使用 pg 驱动
 */
class GaussAdapter extends PgAdapter {
    constructor(config, id) {
        super(config, id);
        this.adapterType = 'gauss';
    }
}

/**
 * Kingbase 适配器 — 继承 PgAdapter
 * 人大金仓兼容 PostgreSQL 协议，使用 pg 驱动
 */
class KingbaseAdapter extends PgAdapter {
    constructor(config, id) {
        super(config, id);
        this.adapterType = 'kingbase';
    }
}

module.exports = { PgAdapter, GaussAdapter, KingbaseAdapter, preparePgQuery };
