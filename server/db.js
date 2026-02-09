const dbSqlite = require('./db_sqlite');
const dbOracle = require('./db_oracle');
const logger = require('./utils/logger');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const isOracle = process.env.ORACLE_ENABLE === 'true';

// 统一的 Promise 风格接口
const db = {
    isOracle,
    
    // 原始驱动引用 (尽量避免直接使用，除非需要特定驱动的功能)
    raw: isOracle ? dbOracle.pool : dbSqlite.raw,

    /**
     * 执行查询并返回所有行
     * @param {string} sql 
     * @param {Array|Object} params 
     * @returns {Promise<Array>}
     */
    async all(sql, params = []) {
        if (isOracle) {
            return dbOracle.all(sql, params);
        }
        return new Promise((resolve, reject) => {
            // dbSqlite 是 wrappedDb 对象，包含了 all 方法
            dbSqlite.all(sql, params, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    },

    /**
     * 执行查询并返回第一行
     * @param {string} sql 
     * @param {Array|Object} params 
     * @returns {Promise<Object>}
     */
    async get(sql, params = []) {
        if (isOracle) {
            return dbOracle.get(sql, params);
        }
        return new Promise((resolve, reject) => {
            dbSqlite.get(sql, params, (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    },

    /**
     * 执行增删改命令
     * @param {string} sql 
     * @param {Array|Object} params 
     * @returns {Promise<Object>} { rowsAffected, lastID (SQLite only) }
     */
    async run(sql, params = []) {
        if (isOracle) {
            return dbOracle.run(sql, params);
        }
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
     * 执行多条 SQL 语句 (通常用于 Migration)
     * @param {string} sql 
     * @returns {Promise<void>}
     */
    async exec(sql) {
         if (isOracle) {
             // Oracle driver execute supports simple SQL
             // But db_oracle wrapper maps to execute() which is for single statement usually
             // For migrations, we might need loop.
             // For now, map to run
             return dbOracle.run(sql);
         }
         return new Promise((resolve, reject) => {
             dbSqlite.exec(sql, (err) => {
                 if (err) reject(err);
                 else resolve();
             });
         });
    },

    /**
     * 事务执行器：确保多表写入要么全部成功，要么全部回滚
     * @param {(tx: {all: Function, get: Function, run: Function, exec: Function}) => Promise<any>} work
     */
    async transaction(work) {
        if (isOracle) {
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

        const sqliteDbPath = process.env.DB_PATH || path.join(__dirname, 'data/database.sqlite');
        const isReadOnly = process.env.SQLITE_READONLY === 'true';
        if (isReadOnly) {
            throw new Error('SQLite is in READ-ONLY mode. Transaction write is not allowed.');
        }

        const txDbRaw = await new Promise((resolve, reject) => {
            const conn = new sqlite3.Database(
                sqliteDbPath,
                sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE,
                (err) => {
                    if (err) reject(err);
                    else resolve(conn);
                }
            );
            conn.configure('busyTimeout', 5000);
        });

        const tx = {
            all(sql, params = []) {
                return new Promise((resolve, reject) => {
                    txDbRaw.all(sql, params, (err, rows) => {
                        if (err) reject(err);
                        else resolve(rows);
                    });
                });
            },
            get(sql, params = []) {
                return new Promise((resolve, reject) => {
                    txDbRaw.get(sql, params, (err, row) => {
                        if (err) reject(err);
                        else resolve(row);
                    });
                });
            },
            run(sql, params = []) {
                return new Promise((resolve, reject) => {
                    txDbRaw.run(sql, params, function (err) {
                        if (err) reject(err);
                        else resolve({ rowsAffected: this.changes, lastID: this.lastID });
                    });
                });
            },
            exec(sql) {
                return new Promise((resolve, reject) => {
                    txDbRaw.exec(sql, (err) => {
                        if (err) reject(err);
                        else resolve();
                    });
                });
            }
        };

        try {
            await tx.exec('BEGIN TRANSACTION');
            const result = await work(tx);
            await tx.exec('COMMIT');
            return result;
        } catch (err) {
            try {
                await tx.exec('ROLLBACK');
            } catch (rollbackErr) {
                logger.error('[DB] SQLite rollback failed:', rollbackErr);
            }
            throw err;
        } finally {
            await new Promise((resolve) => txDbRaw.close(() => resolve()));
        }
    }
};

module.exports = db;
