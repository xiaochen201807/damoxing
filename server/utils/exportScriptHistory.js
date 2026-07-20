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
const DEFAULT_KEEP = 30;

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
        // 避免部分 SQLite 版本对索引 DESC 语法不兼容
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
                'filesystem-backfill',
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

async function listExportScripts(options = {}) {
    await ensureExportScriptLogTable();
    try {
        await backfillFromExportsDir(options.packageType);
    } catch (err) {
        logger.warn(`[ExportHistory] backfill skipped: ${err.message}`);
    }

    const limit = Math.min(Math.max(Number(options.limit) || 50, 1), 200);
    const params = [];
    let sql = `SELECT id, package_type, package_scope, file_name, content_sha256,
                      record_count, jgbh, zjgbh, dialect, operator, created_at
               FROM ${TABLE}`;
    if (options.packageType) {
        sql += ' WHERE package_type = ?';
        params.push(options.packageType);
    }
    sql += ' ORDER BY id DESC LIMIT ?';
    params.push(limit);
    return db.all(sql, params);
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
        `[ExportHistory] pruned ${toRemove.length} old records for package_type=${packageType}`
    );
    return toRemove.map(r => r.file_name).filter(Boolean);
}

module.exports = {
    TABLE,
    DEFAULT_KEEP,
    ensureExportScriptLogTable,
    recordExportScript,
    listExportScripts,
    getExportScriptById,
    pruneExportScripts,
    backfillFromExportsDir
};
