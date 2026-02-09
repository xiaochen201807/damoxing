const isOracle = process.env.ORACLE_ENABLE === 'true';

const SqlHelper = {
    isOracle,

    /**
     * 生成分页 SQL
     * @param {string} sql 原始 SQL (不包含 LIMIT/OFFSET)
     * @param {number} limit 每页条数
     * @param {number} offset 偏移量
     */
    paginate(sql, limit, offset) {
        if (this.isOracle) {
            // Oracle 12c+ syntax
            return `${sql} OFFSET ${offset} ROWS FETCH NEXT ${limit} ROWS ONLY`;
        }
        return `${sql} LIMIT ${limit} OFFSET ${offset}`;
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
