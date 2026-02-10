const dbSqlite = require('./db_sqlite');
const dbOracle = require('./db_oracle');
const logger = require('./utils/logger');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Oracle 是否启用（仅作为功能开关）
const oracleEnabled = process.env.ORACLE_ENABLE === 'true';

// 统一的 Promise 风格接口
const db = {
    // 默认指向 SQLite (系统库)
    isOracle: false, 
    
    // 暴露 Oracle 专用接口
    oracle: {
        get isEnabled() {
            return oracleEnabled;
        },
        async all(sql, params = []) {
            if (!oracleEnabled) throw new Error('Oracle is disabled');
            return dbOracle.all(sql, params);
        },
        async get(sql, params = []) {
            if (!oracleEnabled) throw new Error('Oracle is disabled');
            return dbOracle.get(sql, params);
        },
        async run(sql, params = []) {
            if (!oracleEnabled) throw new Error('Oracle is disabled');
            return dbOracle.run(sql, params);
        },
        async exec(sql) {
            if (!oracleEnabled) throw new Error('Oracle is disabled');
            return dbOracle.run(sql); // map to run
        },
        // Oracle 专用事务
        async transaction(work) {
             if (!oracleEnabled) throw new Error('Oracle is disabled');
             return dbOracle.withConnection(async (connection) => {
                const tx = {
                    async all(sql, params = []) {
                        const { sql: finalSql, params: finalParams } = dbOracle.prepareOracleQuery(sql, params);
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
                        const { sql: finalSql, params: finalParams } = dbOracle.prepareOracleQuery(sql, params);
                        const result = await connection.execute(finalSql, finalParams, { autoCommit: false });
                        return { rowsAffected: result.rowsAffected, lastID: null };
                    },
                    async exec(sql) {
                        await connection.execute(sql, [], { autoCommit: false });
                    },
                };

                try {
                    const result = await work(tx);
                    await connection.commit();
                    return result;
                } catch (err) {
                    try {
                        await connection.rollback();
                    } catch (rollbackErr) {
                        logger.error('[DB] Oracle rollback failed:', rollbackErr);
                    }
                    throw err;
                }
            });
        }
    },
    
    // 原始驱动引用 (SQLite)
    raw: dbSqlite.raw,

    /**
     * 执行查询并返回所有行 (SQLite)
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
     * 执行查询并返回第一行 (SQLite)
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
     * 执行增删改命令 (SQLite)
     */
    async run(sql, params = []) {
        return new Promise((resolve, reject) => {
            dbSqlite.run(sql, params, function(err) {
                if (err) reject(err);
                else resolve({ 
                    rowsAffected: this.changes,
                    lastID: this.lastID 
                });
            });
        });
    },

    /**
     * 执行多条 SQL 语句 (SQLite)
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
     * 事务执行器 (SQLite)
     */
    async transaction(work) {
        const sqliteDbPath = process.env.DB_PATH || path.join(__dirname, 'data/database.sqlite');
        const isReadOnly = process.env.SQLITE_READONLY === 'true';
        if (isReadOnly) {
            throw new Error('SQLite is in READ-ONLY mode. Transaction write is not allowed.');
        }

        // 创建独立连接用于事务
        const dbConn = new sqlite3.Database(sqliteDbPath);
        
        // 包装 Promise
        const run = (sql, params = []) => new Promise((resolve, reject) => {
            dbConn.run(sql, params, function(err) {
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
