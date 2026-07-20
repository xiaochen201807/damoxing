/**
 * 导出脚本历史台账（SQLite 系统库）
 * 用于业务标准库等「只能 DB 执行」脚本的留痕与下载，避免固定文件名覆盖导致新旧混乱。
 */

const fs = require('fs');
const path = require('path');
const db = require('../db');
const logger = require('./logger');
const { getExportsDir, isAllowedExportHistoryName, PACKAGE_TYPES } = require('./exportPackage');

const TABLE = 'sys_export_script_log';
/** 每种 package_type 最多保留条数，防止表/磁盘无限增长 */
const DEFAULT_KEEP = 200;
const MAX_PAGE_SIZE = 50;

let ensurePromise = null;

async function ensureExportScriptLogTable() {
    if (ensurePromise) return ensurePromise;
    ensurePromise = (async () => {
        await db.run(`
            CREATE TABLE IF NOT EXISTS ${TABLE} (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                package_type TEXT NOT NULL,
                package_scope TEXT NOT NULL,
                file_name TEXT NOT NULL,
                content_sha256 TEXT,
                record_count INTEGER,
                jgbh TEXT,
                zjgbh TEXT,
                dialect TEXT,
                operator TEXT,
                created_at TEXT NOT NULL
            )
        `);
        await db.run(
            `CREATE INDEX IF NOT EXISTS idx_export_script_log_type_time
             ON ${TABLE} (package_type, created_at)`
        );
        await db.run(
            `CREATE INDEX IF NOT EXISTS idx_export_script_log_file
             ON ${TABLE} (file_name)`
        );
    })().catch(err => {
        ensurePromise = null;
        throw err;
    });
    return ensurePromise;
}

/**
 * 存库用 ISO UTC；列表展示用北京时间 YYYY-MM-DD HH:mm:ss
 */
function formatBeijingTime(value) {
    if (!value) return '';
    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime())) {
        return String(value);
    }
    // en-CA 给出 YYYY-MM-DD，再拼 24 小时制时分秒
    const datePart = d.toLocaleDateString('en-CA', { timeZone: 'Asia/Shanghai' });
    const timePart = d.toLocaleTimeString('en-GB', {
        timeZone: 'Asia/Shanghai',
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
    return `${datePart} ${timePart}`;
}

function resolveExportFilePath(fileName) {
    const base = path.basename(String(fileName || ''));
    if (!base || !isAllowedExportHistoryName(base)) {
        return null;
    }
    return path.join(getExportsDir(), base);
}

function exportFileExists(fileName) {
    const full = resolveExportFilePath(fileName);
    if (!full) return false;
    try {
        return fs.existsSync(full);
    } catch (_e) {
        return false;
    }
}

async function recordExportScript(entry = {}) {
    await ensureExportScriptLogTable();
    const createdAt = entry.createdAt || new Date().toISOString();
    const result = await db.run(
        `INSERT INTO ${TABLE}
         (package_type, package_scope, file_name, content_sha256, record_count, jgbh, zjgbh, dialect, operator, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            entry.packageType || '',
            entry.packageScope || 'full',
            entry.fileName || '',
            entry.contentSha256 || '',
            entry.recordCount == null ? null : entry.recordCount,
            entry.jgbh || '',
            entry.zjgbh || '',
            entry.dialect || '',
            entry.operator || '',
            createdAt
        ]
    );
    logger.info(
        `[ExportHistory] recorded id=${result.lastID} type=${entry.packageType} file=${entry.fileName}`
    );
    return { id: result.lastID, createdAt };
}

function guessPackageTypeFromFileName(fileName) {
    const name = String(fileName || '');
    if (/ywbzk/i.test(name) || name.includes('业务标准库') || /BizStandard/i.test(name)) {
        return PACKAGE_TYPES.YWBZK;
    }
    if (/ywbz/i.test(name) || name.includes('关键数据计算模型') || /KeyDataModel/i.test(name)) {
        return PACKAGE_TYPES.YWBZ;
    }
    return '';
}

function guessScopeFromFileName(fileName) {
    const name = String(fileName || '');
    if (name.includes('部分') || /partial/i.test(name)) return 'partial';
    return 'full';
}

/**
 * 扫描 exports 目录中已有脚本，补录尚未入库的历史（兼容升级前导出、台账写入失败等情况）
 * 跳过旧固定名 ywbzk_full_export.*，避免干扰新版带时间戳脚本
 */
async function backfillFromExportsDir(packageType) {
    const exportDir = getExportsDir();
    if (!fs.existsSync(exportDir)) {
        return 0;
    }

    let files = [];
    try {
        files = fs.readdirSync(exportDir);
    } catch (err) {
        logger.warn(`[ExportHistory] read exports dir failed: ${err.message}`);
        return 0;
    }

    let inserted = 0;
    for (const fileName of files) {
        if (!isAllowedExportHistoryName(fileName)) continue;
        // 旧固定文件名：仅保留磁盘文件供兼容，不进历史列表（无操作人/校验，易误导）
        if (/^ywbzk_full_export\.(csv|sql)$/i.test(fileName)) continue;
        if (/^ywbz_(full|partial)_export\.csv$/i.test(fileName)) continue;

        const type = guessPackageTypeFromFileName(fileName);
        if (packageType && type !== packageType) continue;

        const existing = await db.get(
            `SELECT id FROM ${TABLE} WHERE file_name = ? LIMIT 1`,
            [fileName]
        );
        if (existing) continue;

        const fullPath = path.join(exportDir, fileName);
        let createdAt = new Date().toISOString();
        try {
            const stat = fs.statSync(fullPath);
            createdAt = new Date(stat.mtimeMs).toISOString();
        } catch (_e) {
            /* ignore */
        }

        await db.run(
            `INSERT INTO ${TABLE}
             (package_type, package_scope, file_name, content_sha256, record_count, jgbh, zjgbh, dialect, operator, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                type || packageType || '',
                guessScopeFromFileName(fileName),
                fileName,
                '',
                null,
                '',
                '',
                '',
                '系统回填',
                createdAt
            ]
        );
        inserted += 1;
    }

    if (inserted > 0) {
        logger.info(`[ExportHistory] backfilled ${inserted} file(s) from exports dir`);
    }
    return inserted;
}

/**
 * 分页列表
 * @returns {{ items: Array, total: number, page: number, perPage: number }}
 */
async function listExportScripts(options = {}) {
    await ensureExportScriptLogTable();
    try {
        await backfillFromExportsDir(options.packageType);
    } catch (err) {
        logger.warn(`[ExportHistory] backfill skipped: ${err.message}`);
    }

    // 列表时也裁剪，防止历史膨胀
    if (options.packageType) {
        try {
            const pruned = await pruneExportScripts(options.packageType, DEFAULT_KEEP);
            for (const oldName of pruned) {
                const full = resolveExportFilePath(oldName);
                if (full && fs.existsSync(full)) {
                    try { fs.unlinkSync(full); } catch (_e) { /* ignore */ }
                }
            }
        } catch (err) {
            logger.warn(`[ExportHistory] prune on list skipped: ${err.message}`);
        }
    }

    const page = Math.max(Number(options.page) || 1, 1);
    const perPage = Math.min(Math.max(Number(options.perPage) || 10, 1), MAX_PAGE_SIZE);
    const offset = (page - 1) * perPage;
    const params = [];
    let where = '';
    if (options.packageType) {
        where = ' WHERE package_type = ?';
        params.push(options.packageType);
    }

    const countRow = await db.get(
        `SELECT COUNT(*) AS total FROM ${TABLE}${where}`,
        params
    );
    const total = Number(countRow?.total || countRow?.TOTAL || 0);

    const rows = await db.all(
        `SELECT id, package_type, package_scope, file_name, content_sha256,
                record_count, jgbh, zjgbh, dialect, operator, created_at
         FROM ${TABLE}${where}
         ORDER BY id DESC
         LIMIT ? OFFSET ?`,
        [...params, perPage, offset]
    );

    const items = rows.map(r => {
        const fileExists = exportFileExists(r.file_name);
        return {
            id: r.id,
            package_type: r.package_type,
            package_scope: r.package_scope,
            file_name: r.file_name,
            content_sha256: r.content_sha256 || '',
            record_count: r.record_count,
            jgbh: r.jgbh,
            zjgbh: r.zjgbh,
            dialect: r.dialect || '',
            operator: r.operator || '',
            created_at: r.created_at,
            created_at_display: formatBeijingTime(r.created_at),
            file_exists: fileExists ? 1 : 0,
            downloadable: fileExists
        };
    });

    return { items, total, page, perPage };
}

async function getExportScriptById(id) {
    await ensureExportScriptLogTable();
    return db.get(
        `SELECT id, package_type, package_scope, file_name, content_sha256,
                record_count, jgbh, zjgbh, dialect, operator, created_at
         FROM ${TABLE} WHERE id = ?`,
        [id]
    );
}

/**
 * 保留每种 package_type 最近 keep 条，返回被淘汰的 file_name 列表（供删磁盘）
 */
async function pruneExportScripts(packageType, keep = DEFAULT_KEEP) {
    await ensureExportScriptLogTable();
    const keepN = Math.max(Number(keep) || DEFAULT_KEEP, 1);
    const rows = await db.all(
        `SELECT id, file_name FROM ${TABLE}
         WHERE package_type = ?
         ORDER BY id DESC`,
        [packageType]
    );
    if (rows.length <= keepN) {
        return [];
    }
    const toRemove = rows.slice(keepN);
    const ids = toRemove.map(r => r.id);
    const placeholders = ids.map(() => '?').join(',');
    await db.run(`DELETE FROM ${TABLE} WHERE id IN (${placeholders})`, ids);
    logger.info(
        `[ExportHistory] pruned ${toRemove.length} old records for package_type=${packageType}, keep=${keepN}`
    );
    return toRemove.map(r => r.file_name).filter(Boolean);
}

module.exports = {
    TABLE,
    DEFAULT_KEEP,
    MAX_PAGE_SIZE,
    ensureExportScriptLogTable,
    recordExportScript,
    listExportScripts,
    getExportScriptById,
    pruneExportScripts,
    backfillFromExportsDir,
    formatBeijingTime,
    exportFileExists,
    resolveExportFilePath
};
