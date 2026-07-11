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
const DIALECT_KEY_SET = new Set(DIALECT_LIST.map(item => item.key));
const DEFAULT_MAX_SQL_BYTES = 64 * 1024;

function getMaxSqlBytes() {
    const configured = Number(process.env.STANDARD_SQL_MAX_BYTES);
    return Number.isInteger(configured) && configured > 0 ? configured : DEFAULT_MAX_SQL_BYTES;
}

function validateSqlText(value, fieldLabel = 'SQL') {
    if (typeof value !== 'string') {
        throw new Error(`${fieldLabel} 必须是字符串`);
    }
    if (value.includes('\0')) {
        throw new Error(`${fieldLabel} 不能包含空字符`);
    }
    if (Buffer.byteLength(value, 'utf8') > getMaxSqlBytes()) {
        throw new Error(`${fieldLabel} 超过允许的 ${getMaxSqlBytes()} 字节`);
    }
    return value;
}

function createEmptyDialectMap() {
    const result = {};
    DIALECT_LIST.forEach(d => { result[d.key] = ''; });
    return result;
}

function parseDialectEntries(raw, fieldLabel = 'SQL 方言配置') {
    const trimmed = String(raw || '').trim();

    if (!trimmed) {
        return [];
    }

    let arr;
    try {
        arr = JSON.parse(trimmed);
    } catch (err) {
        throw new Error(`${fieldLabel} 不是合法的 JSON 数组文本`);
    }

    if (!Array.isArray(arr)) {
        throw new Error(`${fieldLabel} 必须是 JSON 数组`);
    }

    return arr.map((item, index) => {
        if (!item || typeof item !== 'object' || Array.isArray(item)) {
            throw new Error(`${fieldLabel} 第 ${index + 1} 项必须是对象`);
        }

        const dialect = String(item.dialect || '').trim();
        if (!dialect) {
            throw new Error(`${fieldLabel} 第 ${index + 1} 项缺少 dialect`);
        }
        if (!DIALECT_KEY_SET.has(dialect)) {
            throw new Error(`${fieldLabel} 第 ${index + 1} 项包含不支持的 dialect: ${dialect}`);
        }
        validateSqlText(item.sql, `${fieldLabel} 第 ${index + 1} 项的 sql`);

        return {
            dialect,
            sql: item.sql
        };
    });
}

function validateDialectSqlObject(dialectObj, fieldLabel = 'SQL 方言配置') {
    if (!dialectObj || typeof dialectObj !== 'object' || Array.isArray(dialectObj)) {
        throw new Error(`${fieldLabel} 必须是对象`);
    }

    const unknownKeys = Object.keys(dialectObj).filter(key => !DIALECT_KEY_SET.has(key));
    if (unknownKeys.length > 0) {
        throw new Error(`${fieldLabel} 包含不支持的方言键: ${unknownKeys.join(', ')}`);
    }

    for (const key of Object.keys(dialectObj)) {
        const value = dialectObj[key];
        if (value === undefined || value === null || value === '') {
            continue;
        }
        validateSqlText(value, `${fieldLabel}.${key}`);
    }

    return dialectObj;
}

/**
 * 将字段原始值解析为方言对象
 * @param {string|null} raw - 数据库字段原始值
 * @returns {Object} { default: '', oracle: '', dm: '', gauss: '', kingbase: '', pg: '' }
 */
function parseDialectSql(raw, fieldLabel = 'SQL 方言配置') {
    const result = createEmptyDialectMap();

    if (!raw || typeof raw !== 'string' || raw.trim() === '') {
        return result;
    }

    const trimmed = raw.trim();

    // 尝试 JSON 解析
    if (trimmed.startsWith('[')) {
        const entries = parseDialectEntries(trimmed, fieldLabel);
        entries.forEach(item => {
            result[item.dialect] = item.sql;
        });
        return result;
    }

    // 旧版纯 SQL → 视为 default
    validateSqlText(raw, fieldLabel);
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
function buildDialectSql(dialectObj, fieldLabel = 'SQL 方言配置') {
    if (!dialectObj) {
        return '';
    }
    validateDialectSqlObject(dialectObj, fieldLabel);

    const entries = DIALECT_LIST
        .filter(d => typeof dialectObj[d.key] === 'string' && dialectObj[d.key].trim() !== '')
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
        const entries = parseDialectEntries(trimmed, 'SQL 方言配置');
        const specific = entries.find(item => item.dialect === currentDialect && item.sql);
        if (specific) return specific.sql;

        const fallback = entries.find(item => item.dialect === 'default' && item.sql);
        if (fallback) return fallback.sql;

        return null;
    }

    // 旧版纯 SQL → 直接返回
    return raw;
}

module.exports = {
    DIALECT_LIST,
    validateSqlText,
    validateDialectSqlObject,
    parseDialectSql,
    buildDialectSql,
    resolveSql
};
