const dbSqlite = require('./db_sqlite');
const dbOracle = require('./db_oracle');
const logger = require('./utils/logger');

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
    }
};

module.exports = db;
