/**
 * 业务标准库全量导出 SQL 生成器
 *
 * 源数据通常在 Oracle 维护，但脚本需要到 Oracle / 达梦 / PG / Gauss / Kingbase 执行。
 * 因此按「目标方言」生成 SQL，而不是按源库适配器方言生成。
 */

const LONG_TEXT_BYTE_THRESHOLD = 3000;
const ORACLE_CHUNK_CHARS = 1000;
const PG_CHUNK_CHARS = 1000;

const EXPORT_DIALECTS = Object.freeze([
    {
        key: 'oracle',
        label: 'Oracle',
        fileSuffix: 'oracle',
        notes: [
            '超长字符串使用 PL/SQL CLOB + dbms_lob.writeappend，避免 ORA-01704',
            '日期使用 TO_DATE(..., YYYYMMDDHH24MISS)',
            '请用支持 @/脚本 的客户端执行（含 END; /）'
        ]
    },
    {
        key: 'dm',
        label: '达梦 DM',
        fileSuffix: 'dm',
        notes: [
            '超长字符串使用 PL/SQL CLOB + dbms_lob.writeappend（达梦兼容）',
            '日期使用 TO_DATE(..., YYYYMMDDHH24MISS)'
        ]
    },
    {
        key: 'pg',
        label: 'PostgreSQL',
        fileSuffix: 'pg',
        notes: [
            '超长字符串使用 dollar-quote 或分段 || 拼接',
            '日期使用 TIMESTAMP \'YYYY-MM-DD HH24:MI:SS\''
        ]
    },
    {
        key: 'gauss',
        label: 'openGauss/GaussDB',
        fileSuffix: 'gauss',
        notes: [
            '语法按 PostgreSQL 兼容生成',
            '日期使用 TIMESTAMP \'YYYY-MM-DD HH24:MI:SS\''
        ]
    },
    {
        key: 'kingbase',
        label: '人大金仓 Kingbase',
        fileSuffix: 'kingbase',
        notes: [
            '语法按 PostgreSQL 兼容生成',
            '日期使用 TIMESTAMP \'YYYY-MM-DD HH24:MI:SS\''
        ]
    }
]);

function pad2(n) {
    return String(n).padStart(2, '0');
}

function formatDateParts(val) {
    const d = val instanceof Date ? val : new Date(val);
    if (Number.isNaN(d.getTime())) {
        return null;
    }
    return {
        yyyy: d.getFullYear(),
        mm: pad2(d.getMonth() + 1),
        dd: pad2(d.getDate()),
        hh: pad2(d.getHours()),
        mi: pad2(d.getMinutes()),
        ss: pad2(d.getSeconds())
    };
}

function escapeSqlLiteral(val) {
    return String(val).replace(/'/g, "''");
}

function isPgFamily(dialectKey) {
    return dialectKey === 'pg' || dialectKey === 'gauss' || dialectKey === 'kingbase';
}

function isOracleFamily(dialectKey) {
    return dialectKey === 'oracle' || dialectKey === 'dm';
}

function formatScalarValue(val, dialectKey) {
    if (val === null || val === undefined) return 'NULL';
    if (typeof val === 'number') {
        return Number.isFinite(val) ? String(val) : 'NULL';
    }
    if (typeof val === 'boolean') {
        return val ? '1' : '0';
    }
    if (val instanceof Date || (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(val))) {
        const parts = formatDateParts(val);
        if (!parts) return 'NULL';
        if (isOracleFamily(dialectKey)) {
            return `TO_DATE('${parts.yyyy}${parts.mm}${parts.dd}${parts.hh}${parts.mi}${parts.ss}', 'YYYYMMDDHH24MISS')`;
        }
        return `TIMESTAMP '${parts.yyyy}-${parts.mm}-${parts.dd} ${parts.hh}:${parts.mi}:${parts.ss}'`;
    }
    if (Buffer.isBuffer(val)) {
        return formatScalarValue(val.toString('utf8'), dialectKey);
    }
    if (typeof val === 'object') {
        // JSON/对象字段按文本落库
        return `'${escapeSqlLiteral(JSON.stringify(val))}'`;
    }
    return `'${escapeSqlLiteral(val)}'`;
}

function buildOracleFamilyLongText(varName, text) {
    const chars = Array.from(String(text));
    const chunks = [];
    for (let i = 0; i < chars.length; i += ORACLE_CHUNK_CHARS) {
        chunks.push(chars.slice(i, i + ORACLE_CHUNK_CHARS).join(''));
    }
    if (chunks.length === 0) {
        chunks.push('');
    }

    const declareLine = `    ${varName} CLOB;`;
    const assignLines = [];
    assignLines.push(`    ${varName} := '${escapeSqlLiteral(chunks[0])}';`);
    for (let k = 1; k < chunks.length; k++) {
        const chunk = chunks[k];
        const chunkLen = Array.from(chunk).length;
        assignLines.push(
            `    dbms_lob.writeappend(${varName}, ${chunkLen}, '${escapeSqlLiteral(chunk)}');`
        );
    }
    return { declareLine, assignLines, valueExpr: varName };
}

function pickDollarTag(text) {
    // 避免内容本身包含 $tag$
    const base = 'ywbzk';
    if (!String(text).includes(`$${base}$`)) {
        return base;
    }
    for (let i = 1; i < 1000; i++) {
        const tag = `${base}${i}`;
        if (!String(text).includes(`$${tag}$`)) {
            return tag;
        }
    }
    return `ywbzk${Date.now()}`;
}

function buildPgFamilyLongText(text) {
    const str = String(text);
    // 优先 dollar-quote：可读性好，且不受单引号转义影响
    if (!str.includes('\0')) {
        const tag = pickDollarTag(str);
        return `$${tag}$${str}$${tag}$`;
    }

    // 极端兜底：分段单引号拼接
    const chars = Array.from(str);
    const parts = [];
    for (let i = 0; i < chars.length; i += PG_CHUNK_CHARS) {
        parts.push(`'${escapeSqlLiteral(chars.slice(i, i + PG_CHUNK_CHARS).join(''))}'`);
    }
    return parts.length ? parts.join(' || ') : "''";
}

/**
 * 生成单行 INSERT（可能展开为 PL/SQL 块）
 */
function buildInsertStatement(tableName, row, dialectKey) {
    const keys = Object.keys(row || {});
    if (keys.length === 0) {
        return '';
    }

    const declareVars = [];
    const assignLines = [];
    const insertValues = [];
    let hasClobVar = false;
    let varIndex = 1;

    for (const key of keys) {
        const val = row[key];

        if (typeof val === 'string' && Buffer.byteLength(val, 'utf8') > LONG_TEXT_BYTE_THRESHOLD) {
            if (isOracleFamily(dialectKey)) {
                const varName = `v_clob_${varIndex++}`;
                const built = buildOracleFamilyLongText(varName, val);
                declareVars.push(built.declareLine);
                assignLines.push(...built.assignLines);
                insertValues.push(built.valueExpr);
                hasClobVar = true;
                continue;
            }
            if (isPgFamily(dialectKey)) {
                insertValues.push(buildPgFamilyLongText(val));
                continue;
            }
        }

        insertValues.push(formatScalarValue(val, dialectKey));
    }

    if (isOracleFamily(dialectKey) && hasClobVar) {
        let sql = 'DECLARE\n';
        sql += `${declareVars.join('\n')}\n`;
        sql += 'BEGIN\n';
        sql += `${assignLines.join('\n')}\n`;
        sql += `    INSERT INTO ${tableName} (${keys.join(', ')}) VALUES (${insertValues.join(', ')});\n`;
        sql += 'END;\n/\n';
        return sql;
    }

    return `INSERT INTO ${tableName} (${keys.join(', ')}) VALUES (${insertValues.join(', ')});\n`;
}

function buildDeletePreamble() {
    return [
        'DELETE FROM gjj_ywbzkhc;',
        'DELETE FROM gjj_ywbzksx;',
        'DELETE FROM gjj_ywbzk;',
        'DELETE FROM gjj_ywnrfl;',
        ''
    ].join('\n');
}

/**
 * 生成某个目标方言的完整 SQL 正文（不含 package 头）
 */
function buildDialectExportBody(dialectKey, datasets = {}) {
    const dialectMeta = EXPORT_DIALECTS.find(d => d.key === dialectKey);
    const label = dialectMeta?.label || dialectKey;
    const notes = dialectMeta?.notes || [];

    const contentClasses = datasets.contentClasses || [];
    const standards = datasets.standards || [];
    const attributes = datasets.attributes || [];
    const mutualStandards = datasets.mutualStandards || [];

    let body = '';
    body += `-- 业务标准库全量导出正文\n`;
    body += `-- 目标方言: ${label} (${dialectKey})\n`;
    body += `-- 警告：本脚本含全表 DELETE，仅允许在数据库客户端按运维流程执行\n`;
    for (const note of notes) {
        body += `-- 说明: ${note}\n`;
    }
    body += '\n';
    body += buildDeletePreamble();
    body += '\n';

    body += `-- gjj_ywnrfl (${contentClasses.length})\n`;
    for (const row of contentClasses) {
        body += buildInsertStatement('gjj_ywnrfl', row, dialectKey);
    }
    body += '\n';

    body += `-- gjj_ywbzk (${standards.length})\n`;
    for (const row of standards) {
        body += buildInsertStatement('gjj_ywbzk', row, dialectKey);
    }
    body += '\n';

    body += `-- gjj_ywbzksx (${attributes.length})\n`;
    for (const row of attributes) {
        body += buildInsertStatement('gjj_ywbzksx', row, dialectKey);
    }
    body += '\n';

    body += `-- gjj_ywbzkhc (${mutualStandards.length})\n`;
    for (const row of mutualStandards) {
        body += buildInsertStatement('gjj_ywbzkhc', row, dialectKey);
    }

    return body;
}

/**
 * 生成全部目标方言脚本正文
 * @returns {Array<{key,label,fileSuffix,sqlBody}>}
 */
function buildAllDialectExportBodies(datasets = {}) {
    return EXPORT_DIALECTS.map(d => ({
        key: d.key,
        label: d.label,
        fileSuffix: d.fileSuffix,
        sqlBody: buildDialectExportBody(d.key, datasets)
    }));
}

module.exports = {
    EXPORT_DIALECTS,
    LONG_TEXT_BYTE_THRESHOLD,
    buildInsertStatement,
    buildDialectExportBody,
    buildAllDialectExportBodies,
    formatScalarValue,
    isOracleFamily,
    isPgFamily
};
