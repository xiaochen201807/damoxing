const path = require('path');
const dbSqlite = require('./db_sqlite');
const { DataSourceManager, createDefaultAdapterFactories } = require('@damoxing/datasource-manager');
const logger = require('./utils/logger');
const sqlite3 = require('sqlite3').verbose();
require('dotenv').config();

const datasourceManager = new DataSourceManager({
    configPath: path.join(__dirname, 'config/datasources.json'),
    logger,
    shutdownSignals: ['SIGTERM', 'SIGINT'],
    exitOnShutdownSignal: true,
    adapterFactories: createDefaultAdapterFactories(logger),
});

function describeAdapter(adapter) {
    if (!adapter) {
        return 'none';
    }
    const type = adapter.adapterType || adapter.constructor?.name || 'unknown';
    return `${type}-${adapter.id || 'unnamed'}`;
}

// Initialize multi-datasource
async function initDataSources() {
    try {
        const health = await datasourceManager.initialize();
        for (const datasource of health.datasources || []) {
            if (datasource.isDefault) {
                logger.info(`[DB-Router] Default datasource: ${datasource.type}-${datasource.id}`);
            }
        }
        logger.info(`Multi-Datasource initialization complete. Loaded ${health.routeCount} routing rules.`);
        return health;
    } catch (e) {
        logger.error('Failed to initialize datasource manager', e);
        return datasourceManager.getHealth();
    }
}

const shouldAutoInitDatasources = process.env.DATASOURCE_AUTO_INIT !== 'false' && process.env.NODE_ENV !== 'test';

// Automatically trigger init in runtime, but allow tests/library hosts to initialize explicitly.
const datasourceReadyPromise = shouldAutoInitDatasources
    ? initDataSources()
    : Promise.resolve(datasourceManager.getHealth());

// Unified Promise-style interface
const db = {
    // Default to SQLite flag
    isOracle: false,

    // Core routing method for multi-tenant
    getByJgbh(jgbh) {
        const routeJgbh = typeof jgbh === 'undefined' || jgbh === null ? '' : String(jgbh).trim();
        try {
            const adapter = datasourceManager.getByJgbh(jgbh) || this.oracleFallback;
            if (!routeJgbh) {
                logger.warn(`[DB-Router] Empty jgbh, using default datasource: ${describeAdapter(adapter)}`);
            } else {
                logger.info(`[DB-Router] Routed jgbh=${routeJgbh} -> ${describeAdapter(adapter)}`);
            }
            return adapter;
        } catch (err) {
            logger.error(`[DB-Router] No datasource route for jgbh=${routeJgbh}; ${err.message}`);
            throw err;
        }
    },

    // Graceful shutdown
    async closeAll() {
        await datasourceManager.closeAll();
    },

    async ready() {
        return datasourceReadyPromise;
    },

    async initializeDatasources() {
        return initDataSources();
    },

    getDatasourceHealth() {
        return datasourceManager.getHealth();
    },

    heartbeatDatasources() {
        return datasourceManager.heartbeat();
    },

    // Fallback stub for legacy single-tenant Oracle behavior 
    oracleFallback: {
        get isEnabled() { return true; },
        async all(sql, params) { throw new Error('Legacy db.oracle.all called, please refactor to db.getByJgbh(jgbh).all or database not configured.'); },
        async get(sql, params) { throw new Error('Legacy db.oracle.get called, please refactor to db.getByJgbh(jgbh).get or database not configured.'); },
        async run(sql, params) { throw new Error('Legacy db.oracle.run called, please refactor to db.getByJgbh(jgbh).run or database not configured.'); },
        async exec(sql) { throw new Error('Legacy db.oracle.exec called, please refactor to db.getByJgbh(jgbh).exec or database not configured.'); },
        async transaction() { throw new Error('Legacy db.oracle.transaction called'); }
    },

    // Temporary mapping for legacy code (will fallback if refactoring is incomplete)
    get oracle() {
        // Return default adapter or fallback
        try {
            return datasourceManager.getDefaultHandle() || this.oracleFallback;
        } catch (err) {
            logger.warn(`Default datasource is not ready: ${err.message}`);
            return this.oracleFallback;
        }
    },

    // Raw driver reference (SQLite)
    raw: dbSqlite.raw,

    /**
     * Execute query and return all rows (SQLite)
     */
    async all(sql, params = []) {
        logger.info('[DB] all called');
        return new Promise((resolve, reject) => {
            dbSqlite.all(sql, params, (err, rows) => {
                logger.info(`[DB] all callback. Error: ${err ? err.message : 'none'}`);
                if (err) reject(err);
                else resolve(rows);
            });
        });
    },

    /**
     * Execute query and return first row (SQLite)
     */
    async get(sql, params = []) {
        return new Promise((resolve, reject) => {
            dbSqlite.get(sql, params, (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    },

    /**
     * Execute DML command (SQLite)
     */
    async run(sql, params = []) {
        return new Promise((resolve, reject) => {
            dbSqlite.run(sql, params, function (err) {
                if (err) reject(err);
                else resolve({
                    rowsAffected: this.changes,
                    lastID: this.lastID
                });
            });
        });
    },

    /**
     * Execute multiple SQL statements (SQLite)
     */
    async exec(sql) {
        return new Promise((resolve, reject) => {
            dbSqlite.exec(sql, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    },

    /**
     * Transaction executor (SQLite)
     */
    async transaction(work) {
        const sqliteDbPath = process.env.DB_PATH || path.join(__dirname, 'data/database.sqlite');
        const isReadOnly = process.env.SQLITE_READONLY === 'true';
        if (isReadOnly) {
            throw new Error('SQLite is in READ-ONLY mode. Transaction write is not allowed.');
        }

        const dbConn = new sqlite3.Database(sqliteDbPath);

        const run = (sql, params = []) => new Promise((resolve, reject) => {
            dbConn.run(sql, params, function (err) {
                if (err) reject(err);
                else resolve({ rowsAffected: this.changes, lastID: this.lastID });
            });
        });

        const all = (sql, params = []) => new Promise((resolve, reject) => {
            dbConn.all(sql, params, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });

        const get = (sql, params = []) => new Promise((resolve, reject) => {
            dbConn.get(sql, params, (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        const exec = (sql) => new Promise((resolve, reject) => {
            dbConn.exec(sql, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });

        try {
            await run('BEGIN TRANSACTION');

            const tx = { run, all, get, exec };
            const result = await work(tx);

            await run('COMMIT');
            return result;
        } catch (err) {
            try {
                await run('ROLLBACK');
            } catch (rollbackErr) {
                logger.error('[DB] SQLite rollback failed:', rollbackErr);
            }
            throw err;
        } finally {
            dbConn.close();
        }
    }
};

module.exports = db;
