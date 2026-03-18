const process = require('process');
const fs = require('fs');
const path = require('path');

// Oracle 风格分页的数据库类型（pg/gauss/kingbase 使用 PG 风格的 LIMIT/OFFSET，与默认一致）
const ORACLE_STYLE_TYPES = new Set(['oracle', 'dm']);

let isOracle = false;
try {
    const configPath = path.join(__dirname, '../config/datasources.json');
    if (fs.existsSync(configPath)) {
        const conf = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        // 只有当所有数据源都是 Oracle/DM 时，全局默认才用 Oracle 风格
        // 混合环境下建议通过 getDialectFor(adapter) 按请求动态选择
        const sources = conf.datasources || [];
        isOracle = sources.length > 0 && sources.every(ds => ORACLE_STYLE_TYPES.has(ds.type));
    }
} catch (e) { }

// Fallback to env vars if config not useful
if (!isOracle) {
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
    }
};

module.exports = SqlHelper;
