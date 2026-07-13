const process = require('process');
const fs = require('fs');
const path = require('path');

// Oracle 风格分页的数据库类型（pg/gauss/kingbase 使用 PG 风格的 LIMIT/OFFSET，与默认一致）
const ORACLE_STYLE_TYPES = new Set(['oracle', 'dm']);

let isOracle = false;
let configLoaded = false;
try {
    const configPath = path.join(__dirname, '../config/datasources.json');
    if (fs.existsSync(configPath)) {
        const conf = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        // 只有当所有数据源都是 Oracle/DM 时，全局默认才用 Oracle 风格
        // 混合环境下建议通过 getDialectFor(adapter) 按请求动态选择
        const sources = conf.datasources || [];
        isOracle = sources.length > 0 && sources.every(ds => ORACLE_STYLE_TYPES.has(ds.type));
        configLoaded = true;
    }
} catch (e) { }

// 仅在没有 datasources.json 时才用环境变量兜底，避免混合库场景被 ORACLE_ENABLE 误覆盖
if (!configLoaded) {
    isOracle = process.env.ORACLE_ENABLE === 'true' || process.env.DM_ENABLE === 'true';
}

/**
 * 根据适配器实例判断是否为 Oracle 风格（Oracle/DM）
 * 在多租户混合数据库场景下，用此函数替代全局 isOracle
 * @param {object} adapter - db.getByJgbh() 返回的适配器实例
 */
function isOracleAdapter(adapter) {
    if (!adapter) return isOracle;
    // OracleAdapter / DmAdapter 的 isOracle getter 返回 true
    return !!adapter.isOracle;
}

const SqlHelper = {
    isOracle,

    toInt(value, fallback) {
        const n = Number.parseInt(String(value), 10);
        return Number.isFinite(n) ? n : fallback;
    },

    /**
     * 根据适配器判断是否 Oracle 风格，用于多租户混合场景
     * @param {object} adapter - db.getByJgbh() 返回的适配器
     */
    isOracleAdapter,

    /**
     * 生成分页 SQL
     * @param {string} sql 原始 SQL (不包含 LIMIT/OFFSET)
     * @param {number} limit 每页条数
     * @param {number} offset 偏移量
     * @param {object} [adapter] 可选，传入后按适配器类型动态判断方言
     */
    paginate(sql, limit, offset, adapter) {
        const safeLimit = Math.max(1, this.toInt(limit, 10));
        const safeOffset = Math.max(0, this.toInt(offset, 0));
        if (adapter ? isOracleAdapter(adapter) : this.isOracle) {
            // Oracle/DM 12c+ syntax
            return `${sql} OFFSET ${safeOffset} ROWS FETCH NEXT ${safeLimit} ROWS ONLY`;
        }
        return `${sql} LIMIT ${safeLimit} OFFSET ${safeOffset}`;
    },

    /**
     * @param {object} [adapter] 可选，传入后按适配器类型动态判断方言
     */
    paginateQuery(sql, params, limit, offset, adapter) {
        const safeLimit = Math.max(1, this.toInt(limit, 10));
        const safeOffset = Math.max(0, this.toInt(offset, 0));

        const nextParams = Array.isArray(params) ? [...params] : [];
        if (adapter ? isOracleAdapter(adapter) : this.isOracle) {
            return {
                sql: `${sql} OFFSET ? ROWS FETCH NEXT ? ROWS ONLY`,
                params: [...nextParams, safeOffset, safeLimit],
            };
        }
        return {
            sql: `${sql} LIMIT ? OFFSET ?`,
            params: [...nextParams, safeLimit, safeOffset],
        };
    },

    /**
     * 获取当前时间戳的 SQL 表达式
     * @param {object} [adapter] 可选，传入后按适配器类型动态判断方言
     */
    now(adapter) {
        return (adapter ? isOracleAdapter(adapter) : this.isOracle) ? 'SYSTIMESTAMP' : 'CURRENT_TIMESTAMP';
    },

    /**
     * 简单的参数占位符转换 (用于简单的动态 SQL 构建)
     * 注意：这只是一个简单的帮助函数，复杂的参数替换由 DB Adapter 层处理
     * @param {object} [adapter] 可选，传入后按适配器类型动态判断方言
     */
    param(index, adapter) {
        return (adapter ? isOracleAdapter(adapter) : this.isOracle) ? `:${index + 1}` : '?';
    },

    /**
     * 将 SQL 脚本切分为单条 SQL 语句执行 (支持识别 Oracle/达梦 的 PL/SQL 块，并在最终返回的语句中剥离斜杠)
     * @param {string} sql
     * @returns {string[]}
     */
    splitSqlStatements(sql) {
        const stmts = [];
        let buffer = '';
        let inQuote = false;
        let inPlSql = false;

        for (let i = 0; i < sql.length; i++) {
            const char = sql[i];

            if (char === "'") {
                // 处理转义引号 ''
                if (inQuote && i + 1 < sql.length && sql[i + 1] === "'") {
                    buffer += "''";
                    i++;
                    continue;
                }
                inQuote = !inQuote;
                buffer += char;
                continue;
            }

            if (!inQuote) {
                // 精准预看是否进入 PL/SQL 块 (DECLARE 或 BEGIN 开头)
                if (!inPlSql && buffer.trim().length === 0) {
                    const next7 = sql.substring(i, i + 7).toUpperCase();
                    if (next7 === 'DECLARE' && (i + 7 === sql.length || /\s/.test(sql[i + 7]))) {
                        inPlSql = true;
                    }
                    const next5 = sql.substring(i, i + 5).toUpperCase();
                    if (next5 === 'BEGIN' && (i + 5 === sql.length || /\s/.test(sql[i + 5]))) {
                        inPlSql = true;
                    }
                }

                // 识别 PL/SQL 块的独立行结束符 /
                if (inPlSql && char === '/' &&
                    (i === 0 || sql[i - 1] === '\n' || sql[i - 1] === '\r') &&
                    (i + 1 === sql.length || sql[i + 1] === '\n' || sql[i + 1] === '\r' || sql[i + 1] === ' ')) {
                    inPlSql = false;
                    const trimmed = buffer.trim();
                    if (trimmed) stmts.push(trimmed);
                    buffer = '';
                    // 跳过斜杠后可能跟着的换行符
                    while (i + 1 < sql.length && (sql[i + 1] === '\r' || sql[i + 1] === '\n')) {
                        i++;
                    }
                    continue;
                }

                // 常规分号切割
                if (!inPlSql && char === ';') {
                    const trimmed = buffer.trim();
                    if (trimmed) stmts.push(trimmed);
                    buffer = '';
                    continue;
                }
            }

            buffer += char;
        }

        if (buffer.trim()) {
            const trimmed = buffer.trim();
            if (trimmed !== '/') {
                stmts.push(trimmed);
            }
        }
        return stmts;
    }
};

module.exports = SqlHelper;
