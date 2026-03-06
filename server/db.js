const fs = require('fs');
const path = require('path');
const dbSqlite = require('./db_sqlite');
const { OracleAdapter } = require('./db_oracle');
const { DmAdapter } = require('./db_dm');
const logger = require('./utils/logger');
const sqlite3 = require('sqlite3').verbose();
require('dotenv').config();

// Global routing map
const routingMap = new Map();
let defaultAdapter = null;
let strictRouting = false;
let initComplete = false;

// Initialize multi-datasource
async function initDataSources() {
    const configPath = path.join(__dirname, 'config/datasources.json');
    if (!fs.existsSync(configPath)) {
        logger.warn('No config/datasources.json found, skipping multi-datasource init');
        return;
    }

    try {
        const conf = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        strictRouting = !!conf.strict_routing;

        const initPromises = [];
        const dsInstances = new Map();

        for (const ds of conf.datasources || []) {
            let adapter;
            if (ds.type === 'oracle') {
                adapter = new OracleAdapter(ds.config, ds.id);
            } else if (ds.type === 'dm') {
                adapter = new DmAdapter(ds.config, ds.id);
            } else {
                logger.warn(`Unknown datasource type: ${ds.type}`);
                continue;
            }

            const p = adapter.initialize().then(() => {
                dsInstances.set(ds.id, adapter);
                if (ds.id === conf.default_datasource) {
                    defaultAdapter = adapter;
                }
                for (const jgbh of ds.jgbh_list || []) {
                    routingMap.set(String(jgbh), adapter);
                }
            }).catch(err => {
                logger.error(`Datasource ${ds.id} failed to initialize:`, err);
            });
            initPromises.push(p);
        }

        await Promise.allSettled(initPromises);
        initComplete = true;
        logger.info(`Multi-Datasource initialization complete. Loaded ${routingMap.size} routing rules.`);
    } catch (e) {
        logger.error('Failed to parse datasources.json', e);
    }
}

// Automatically trigger init but don't block exports
initDataSources();

// Unified Promise-style interface
const db = {
    // Default to SQLite flag
    isOracle: false,

    // Core routing method for multi-tenant
    getByJgbh(jgbh) {
        if (!initComplete) {
            logger.warn('Calling getByJgbh before multi-datasource init finished!');
        }
        if (!jgbh) {
            return defaultAdapter || this.oracleFallback;
        }
        const adapter = routingMap.get(String(jgbh));
        if (adapter) return adapter;

        if (strictRouting) {
            throw new Error(`未找到机构 [${jgbh}] 对应的数据源配置，且开启了严格路由。`);
        }
        return defaultAdapter || this.oracleFallback;
    },

    // Graceful shutdown
    async closeAll() {
        const closures = [];
        for (const adapter of new Set(routingMap.values())) {
            closures.push(adapter.close());
        }
        if (defaultAdapter && !new Set(routingMap.values()).has(defaultAdapter)) {
            closures.push(defaultAdapter.close());
        }
        await Promise.allSettled(closures);
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
        return defaultAdapter || this.oracleFallback;
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
