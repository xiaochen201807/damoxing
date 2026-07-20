/**
 * 业务标准库 / 关键数据计算模型 导出脚本包头与防呆工具
 *
 * 两类脚本历史上文件名只差一个字母 (ywbz vs ywbzk)，容易在页面导入时选错。
 * 本模块统一：
 *  - 机器可读 package 头
 *  - 人眼可分的文件名
 *  - 导入侧表白名单 / 包类型校验
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const PACKAGE_TYPES = Object.freeze({
    YWBZK: 'ywbzk',
    YWBZ: 'ywbz'
});

const PACKAGE_SCOPES = Object.freeze({
    FULL: 'full',
    PARTIAL: 'partial'
});

const EXECUTION_MODES = Object.freeze({
    DB_ONLY: 'db-only',
    APP_IMPORT: 'app-import'
});

const PACKAGE_LABELS = Object.freeze({
    [PACKAGE_TYPES.YWBZK]: '业务标准库',
    [PACKAGE_TYPES.YWBZ]: '关键数据计算模型'
});

const YWBZ_ALLOWED_TABLES = Object.freeze(['gjj_ywbz', 'gjj_ywbzsx']);
const YWBZK_TABLES = Object.freeze([
    'gjj_ywbzk',
    'gjj_ywbzksx',
    'gjj_ywbzkhc',
    'gjj_ywnrfl'
]);

const HEADER_KEYS = [
    'package-type',
    'package-scope',
    'package-label',
    'execution-mode',
    'export-time',
    'jgbh',
    'zjgbh',
    'dialect',
    'record-count',
    'content-sha256',
    'tables',
    'operator'
];

function pad2(n) {
    return String(n).padStart(2, '0');
}

function formatTimestamp(date = new Date()) {
    const d = date instanceof Date ? date : new Date(date);
    return (
        `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}` +
        `_${pad2(d.getHours())}${pad2(d.getMinutes())}${pad2(d.getSeconds())}`
    );
}

function formatIsoTime(date = new Date()) {
    const d = date instanceof Date ? date : new Date(date);
    const offsetMin = -d.getTimezoneOffset();
    const sign = offsetMin >= 0 ? '+' : '-';
    const abs = Math.abs(offsetMin);
    const oh = pad2(Math.floor(abs / 60));
    const om = pad2(abs % 60);
    return (
        `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}` +
        `T${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}` +
        `${sign}${oh}:${om}`
    );
}

function sanitizeFileToken(value, fallback = 'unknown') {
    const raw = String(value ?? '').trim();
    if (!raw) return fallback;
    // 文件名安全：保留中文、字母数字，其余替换为下划线
    const cleaned = raw
        .replace(/[\\/:*?"<>|\s]+/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '');
    return cleaned || fallback;
}

/**
 * 生成差异化导出文件名（.sql）
 * 例：业务标准库_ywbzk_全量_20260720_143022.sql
 *     关键数据计算模型_ywbz_全量_1305282025_20260720_143022.sql
 */
function buildExportFileName(options = {}) {
    const packageType = options.packageType;
    const scope = options.scope || PACKAGE_SCOPES.FULL;
    const scopeLabel = scope === PACKAGE_SCOPES.PARTIAL ? '部分' : '全量';
    const ts = options.timestamp || formatTimestamp();
    const label = PACKAGE_LABELS[packageType] || packageType || 'export';

    if (packageType === PACKAGE_TYPES.YWBZK) {
        return `${label}_ywbzk_${scopeLabel}_${ts}.sql`;
    }

    const jgbhPart = sanitizeFileToken(options.jgbh, 'nojgbh');
    return `${label}_ywbz_${scopeLabel}_${jgbhPart}_${ts}.sql`;
}

function sha256Hex(content) {
    return crypto.createHash('sha256').update(String(content ?? ''), 'utf8').digest('hex');
}

function buildPackageHeader(meta = {}) {
    const packageType = meta.packageType;
    const scope = meta.scope || PACKAGE_SCOPES.FULL;
    const executionMode =
        meta.executionMode ||
        (packageType === PACKAGE_TYPES.YWBZK ? EXECUTION_MODES.DB_ONLY : EXECUTION_MODES.APP_IMPORT);
    const label = meta.packageLabel || PACKAGE_LABELS[packageType] || packageType || '';
    const tables = Array.isArray(meta.tables) ? meta.tables.join(',') : String(meta.tables || '');
    const lines = [
        `-- ============================================================`,
        `-- 【${label}】导出脚本 — 请勿与其它类型脚本混用`,
        packageType === PACKAGE_TYPES.YWBZK
            ? `-- 【仅允许数据库客户端执行，禁止页面导入】`
            : `-- 【仅可在「关键数据计算模型」页面导入，不可用于业务标准库】`,
        `-- ============================================================`,
        `-- @package-type: ${packageType || ''}`,
        `-- @package-scope: ${scope}`,
        `-- @package-label: ${label}`,
        `-- @execution-mode: ${executionMode}`,
        `-- @export-time: ${meta.exportTime || formatIsoTime()}`,
        `-- @jgbh: ${meta.jgbh == null ? '' : meta.jgbh}`,
        `-- @zjgbh: ${meta.zjgbh == null ? '' : meta.zjgbh}`,
        `-- @dialect: ${meta.dialect || ''}`,
        `-- @record-count: ${meta.recordCount == null ? '' : meta.recordCount}`,
        `-- @content-sha256: ${meta.contentSha256 || ''}`,
        `-- @tables: ${tables}`,
        `-- @operator: ${meta.operator || ''}`,
        `--`
    ];
    return lines.join('\n') + '\n';
}

/**
 * 解析脚本头部的 @key: value 元数据（忽略 BOM）
 */
function parsePackageHeader(sqlContent) {
    let text = String(sqlContent || '');
    if (text.charCodeAt(0) === 0xfeff) {
        text = text.slice(1);
    }

    const header = {};
    const lines = text.split(/\r?\n/);
    for (const line of lines.slice(0, 80)) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('--')) {
            // 遇到非注释行即结束头解析
            if (trimmed.length > 0) break;
            continue;
        }
        const m = trimmed.match(/^--\s*@([a-z0-9-]+)\s*:\s*(.*)$/i);
        if (m) {
            header[m[1].toLowerCase()] = String(m[2] ?? '').trim();
        }
    }

    if (Object.keys(header).length === 0) {
        return null;
    }

    return {
        packageType: header['package-type'] || '',
        packageScope: header['package-scope'] || '',
        packageLabel: header['package-label'] || '',
        executionMode: header['execution-mode'] || '',
        exportTime: header['export-time'] || '',
        jgbh: header.jgbh || '',
        zjgbh: header.zjgbh || '',
        dialect: header.dialect || '',
        recordCount: header['record-count'] || '',
        contentSha256: header['content-sha256'] || '',
        tables: header.tables || '',
        operator: header.operator || '',
        raw: header
    };
}

function stripBom(content) {
    let text = String(content || '');
    if (text.charCodeAt(0) === 0xfeff) {
        text = text.slice(1);
    }
    return text;
}

/**
 * 去掉 SQL 注释行（用于执行），解析包头请先用 parsePackageHeader
 */
function stripSqlCommentLines(sqlContent) {
    return String(sqlContent || '')
        .split(/\r?\n/)
        .filter(line => !line.trim().startsWith('--'))
        .join('\n');
}

/**
 * 从 SQL 语句中提取表名（INSERT/DELETE/UPDATE/TRUNCATE）
 */
function extractTableName(statement) {
    const sql = String(statement || '').trim();
    if (!sql) return null;
    const m = sql.match(
        /^(?:INSERT\s+INTO|DELETE\s+FROM|UPDATE|TRUNCATE\s+TABLE)\s+([`"[\]]?)([a-zA-Z0-9_]+)\1/i
    );
    return m ? m[2].toLowerCase() : null;
}

function collectReferencedTables(statements) {
    const tables = new Set();
    for (const stmt of statements) {
        const table = extractTableName(stmt);
        if (table) tables.add(table);
    }
    return Array.from(tables);
}

/**
 * 校验「关键数据计算模型」导入文件：拒绝标准库脚本与越权表
 * @returns {{ ok: true, header, tables } | { ok: false, status, msg }}
 */
function validateYwbzImportPackage(sqlContent, options = {}) {
    const content = stripBom(sqlContent);
    const header = parsePackageHeader(content);

    if (header) {
        if (header.packageType === PACKAGE_TYPES.YWBZK) {
            return {
                ok: false,
                status: 400,
                msg: '导入失败：这是【业务标准库】脚本，不能在【关键数据计算模型】页面导入。请使用「关键数据计算模型_ywbz_*.sql」。'
            };
        }
        if (header.packageType && header.packageType !== PACKAGE_TYPES.YWBZ) {
            return {
                ok: false,
                status: 400,
                msg: `导入失败：脚本包类型为「${header.packageType}」，与关键数据计算模型不匹配。`
            };
        }
        if (header.executionMode === EXECUTION_MODES.DB_ONLY) {
            return {
                ok: false,
                status: 400,
                msg: '导入失败：该脚本标记为仅允许数据库客户端执行，禁止页面导入。'
            };
        }
    }

    const statements = (options.statements || splitSqlStatements(content)).filter(Boolean);
    const tables = collectReferencedTables(statements);

    const forbidden = tables.filter(t => YWBZK_TABLES.includes(t));
    if (forbidden.length > 0) {
        return {
            ok: false,
            status: 400,
            msg:
                '导入失败：文件引用了业务标准库表（' +
                forbidden.join(', ') +
                '），这通常是【业务标准库】导出脚本。请改用「关键数据计算模型」导出的脚本。'
        };
    }

    const disallowed = tables.filter(t => !YWBZ_ALLOWED_TABLES.includes(t));
    if (disallowed.length > 0) {
        return {
            ok: false,
            status: 400,
            msg:
                '导入失败：文件包含不允许的表（' +
                disallowed.join(', ') +
                '）。关键数据计算模型仅允许 gjj_ywbz / gjj_ywbzsx。'
        };
    }

    if (tables.length === 0 && !options.allowEmptyTables) {
        // 可能只有空内容；交由后续 INSERT 检查处理
        if (!header) {
            return {
                ok: true,
                header: null,
                tables,
                legacy: true,
                warning: '脚本缺少 package 头，已按表白名单兜底校验；建议使用新版导出脚本。'
            };
        }
    }

    return {
        ok: true,
        header,
        tables,
        legacy: !header
    };
}

/**
 * 简易按分号拆分（与现有导入逻辑兼容：先去注释行）
 */
function splitSqlStatements(sqlContent) {
    return stripSqlCommentLines(sqlContent)
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0);
}

function getExportsDir() {
    return process.env.EXPORTS_DIR || path.join(__dirname, '../exports');
}

function ensureExportsDir(dir = getExportsDir()) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
}

/**
 * 写入导出文件（带 BOM），返回 { fileName, filePath, contentSha256, byteLength }
 */
function writeExportScript(fileName, bodyContent, options = {}) {
    const exportDir = ensureExportsDir(options.exportDir);
    const safeName = path.basename(fileName);
    const filePath = path.join(exportDir, safeName);
    const body = String(bodyContent || '');
    // 包头里的 content-sha256 先按正文计算；若头已含空 hash，可在外层重写
    const contentSha256 = sha256Hex(body);
    const full = (options.withBom === false ? '' : '﻿') + body;
    fs.writeFileSync(filePath, full, 'utf8');
    return {
        fileName: safeName,
        filePath,
        contentSha256,
        byteLength: Buffer.byteLength(full, 'utf8'),
        exportDir
    };
}

/**
 * 组装完整脚本：先写正文算 hash，再把 hash 填入头
 */
function assembleExportScript(meta, sqlBody) {
    const body = stripBom(sqlBody);
    const contentSha256 = sha256Hex(body);
    const header = buildPackageHeader({
        ...meta,
        contentSha256
    });
    return {
        content: header + '\n' + body,
        contentSha256,
        header
    };
}

function isAllowedExportHistoryName(fileName) {
    const name = path.basename(String(fileName || ''));
    if (!name || name.includes('..') || name.includes('/') || name.includes('\\')) {
        return false;
    }
    return (
        /^业务标准库_ywbzk_.+\.sql$/u.test(name) ||
        /^关键数据计算模型_ywbz_.+\.sql$/u.test(name) ||
        /^ywbzk_full_export\.(csv|sql)$/i.test(name) ||
        /^ywbz_(full|partial)_export\.csv$/i.test(name)
    );
}

module.exports = {
    PACKAGE_TYPES,
    PACKAGE_SCOPES,
    EXECUTION_MODES,
    PACKAGE_LABELS,
    YWBZ_ALLOWED_TABLES,
    YWBZK_TABLES,
    HEADER_KEYS,
    formatTimestamp,
    formatIsoTime,
    sanitizeFileToken,
    buildExportFileName,
    sha256Hex,
    buildPackageHeader,
    parsePackageHeader,
    stripBom,
    stripSqlCommentLines,
    extractTableName,
    collectReferencedTables,
    validateYwbzImportPackage,
    splitSqlStatements,
    getExportsDir,
    ensureExportsDir,
    writeExportScript,
    assembleExportScript,
    isAllowedExportHistoryName
};
