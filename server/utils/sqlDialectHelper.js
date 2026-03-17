/**
 * SQL 方言解析 / 组装工具
 *
 * 用于标准库 ywbzjg、ywblbzyg 字段的多数据库 SQL 维护。
 * 存储格式：JSON 数组文本  [{ dialect, sql }, ...]
 * 运行时规则：当前数据库优先 → default 回退 → 旧版纯 SQL 兼容
 */

/** 方言列表（与前端 Tab 页签一一对应） */
const DIALECT_LIST = [
    { key: 'default',  label: '默认数据库' },
    { key: 'oracle',   label: 'oracle数据库' },
    { key: 'dm',       label: '达梦数据库' },
    { key: 'gauss',    label: '高斯数据库' },
    { key: 'kingbase', label: '人大金仓数据库' },
    { key: 'pg',       label: 'postgresql数据库' }
];

/**
 * 将字段原始值解析为方言对象
 * @param {string|null} raw - 数据库字段原始值
 * @returns {Object} { default: '', oracle: '', dm: '', gauss: '', kingbase: '', pg: '' }
 */
function parseDialectSql(raw) {
    const result = {};
    DIALECT_LIST.forEach(d => { result[d.key] = ''; });

    if (!raw || typeof raw !== 'string' || raw.trim() === '') {
        return result;
    }

    const trimmed = raw.trim();

    // 尝试 JSON 解析
    if (trimmed.startsWith('[')) {
        try {
            const arr = JSON.parse(trimmed);
            if (Array.isArray(arr)) {
                arr.forEach(item => {
                    if (item && item.dialect && typeof item.sql === 'string') {
                        result[item.dialect] = item.sql;
                    }
                });
                return result;
            }
        } catch (_) {
            // JSON 解析失败，按旧版纯 SQL 处理
        }
    }

    // 旧版纯 SQL → 视为 default
    result.default = raw;
    return result;
}

/**
 * 将方言对象组装为存储字符串
 * - 如果只有 default 且其他全空，则直接返回 default 的纯 SQL（最大兼容性）
 * - 否则组装为 JSON 数组文本
 * @param {Object} dialectObj - { default: '', oracle: '', ... }
 * @returns {string}
 */
function buildDialectSql(dialectObj) {
    if (!dialectObj || typeof dialectObj !== 'object') {
        return '';
    }

    const entries = DIALECT_LIST
        .filter(d => dialectObj[d.key] && dialectObj[d.key].trim() !== '')
        .map(d => ({ dialect: d.key, sql: dialectObj[d.key] }));

    if (entries.length === 0) {
        return '';
    }

    // 仅 default 时直接返回纯 SQL（旧版兼容）
    if (entries.length === 1 && entries[0].dialect === 'default') {
        return entries[0].sql;
    }

    return JSON.stringify(entries);
}

/**
 * 运行时解析出最终 SQL
 * @param {string|null} raw - 字段原始值
 * @param {string} currentDialect - 当前数据库类型 (oracle/dm/pg/gauss/kingbase)
 * @returns {string|null} 最终 SQL，如果无法解析则返回 null
 */
function resolveSql(raw, currentDialect) {
    if (!raw || typeof raw !== 'string' || raw.trim() === '') {
        return null;
    }

    const trimmed = raw.trim();

    // 尝试 JSON 解析
    if (trimmed.startsWith('[')) {
        try {
            const arr = JSON.parse(trimmed);
            if (Array.isArray(arr)) {
                // 先取当前数据库专属
                const specific = arr.find(item => item.dialect === currentDialect);
                if (specific && specific.sql) return specific.sql;

                // 回退到 default
                const fallback = arr.find(item => item.dialect === 'default');
                if (fallback && fallback.sql) return fallback.sql;

                return null;
            }
        } catch (_) {
            // JSON 解析失败，按旧版纯 SQL 处理
        }
    }

    // 旧版纯 SQL → 直接返回
    return raw;
}

module.exports = {
    DIALECT_LIST,
    parseDialectSql,
    buildDialectSql,
    resolveSql
};
