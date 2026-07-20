/**
 * 导出脚本历史台账（SQLite 系统库）
 * 用于业务标准库等「只能 DB 执行」脚本的留痕与下载，避免固定文件名覆盖导致新旧混乱。
 */

const db = require('../db');
const logger = require('./logger');

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
        await db.run(
            `CREATE INDEX IF NOT EXISTS idx_export_script_log_type_time
             ON ${TABLE} (package_type, created_at DESC)`
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
    return { id: result.lastID, createdAt };
}

async function listExportScripts(options = {}) {
    await ensureExportScriptLogTable();
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
    pruneExportScripts
};
