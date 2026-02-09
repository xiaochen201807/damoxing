const isOracle = process.env.ORACLE_ENABLE === 'true';

const SqlHelper = {
    isOracle,

    toInt(value, fallback) {
        const n = Number.parseInt(String(value), 10);
        return Number.isFinite(n) ? n : fallback;
    },

    /**
     * 生成分页 SQL
     * @param {string} sql 原始 SQL (不包含 LIMIT/OFFSET)
     * @param {number} limit 每页条数
     * @param {number} offset 偏移量
     */
    paginate(sql, limit, offset) {
        const safeLimit = Math.max(1, this.toInt(limit, 10));
        const safeOffset = Math.max(0, this.toInt(offset, 0));
        if (this.isOracle) {
            // Oracle 12c+ syntax
            return `${sql} OFFSET ${safeOffset} ROWS FETCH NEXT ${safeLimit} ROWS ONLY`;
        }
        return `${sql} LIMIT ${safeLimit} OFFSET ${safeOffset}`;
    },

    paginateQuery(sql, params, limit, offset) {
        const safeLimit = Math.max(1, this.toInt(limit, 10));
        const safeOffset = Math.max(0, this.toInt(offset, 0));

        const nextParams = Array.isArray(params) ? [...params] : [];
        if (this.isOracle) {
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
     */
    now() {
        return this.isOracle ? 'SYSTIMESTAMP' : 'CURRENT_TIMESTAMP';
    },

    /**
     * 简单的参数占位符转换 (用于简单的动态 SQL 构建)
     * 注意：这只是一个简单的帮助函数，复杂的参数替换由 DB Adapter 层处理
     */
    param(index) {
        return this.isOracle ? `:${index + 1}` : '?';
    }
};

module.exports = SqlHelper;
