/**
 * 程序控制规则管理 CRUD 接口
 * 对应表 gjj_cxgzkz
 */

const express = require('express');
const router = express.Router();
const axios = require('axios');
const db = require('../../db');
const SqlHelper = require('../../utils/sqlHelper');
const logger = require('../../utils/logger');
const { authenticateToken } = require('../../middleware/auth');
const multer = require('multer');
const { parse: parseCsv } = require('csv-parse/sync');
const { stringify: stringifyCsv } = require('csv-stringify/sync');

const GATEWAY_BASE_URL = (() => {
    try {
        const url = new URL(process.env.GATEWAY_VALIDATE_URL || '');
        return url.origin;
    } catch {
        return 'https://appcs.jbysoft.com';
    }
})();

// 配置 Multer 内存存储，用于处理文件上传
const upload = multer({ storage: multer.memoryStorage() });

function getEnvModeFromJwt(req) {
    const mechanismMmodel = String(req.user?.mechanismMmodel ?? '').trim();
    return mechanismMmodel === '1' ? 'rd' : 'prod';
}

function isModelEnv(req) {
    return getEnvModeFromJwt(req) === 'rd';
}

function normalizeYn(value, fallback) {
    if (value === undefined || value === null || value === '') return fallback;
    const v = String(value).trim().toLowerCase();
    return v === 'y' || v === 'n' ? v : fallback;
}

function getRequestOrg(req) {
    const body = req.body || {};
    return {
        jgbh: body.jgbh || req.headers['jgbh'] || req.headers['zzbs'] || '',
        zjgbh: body.zjgbh || req.headers['zjgbh'] || req.headers['zzjgdmz'] || ''
    };
}

function getHeaderOrg(req) {
    return {
        jgbh: req.headers['jgbh'] || req.headers['zzbs'] || '',
        zjgbh: req.headers['zjgbh'] || req.headers['zzjgdmz'] || ''
    };
}

async function fetchTaskNameMap(req) {
    const body = req.body || {};
    const { jgbh, zjgbh } = getRequestOrg(req);
    const gatewayUrl = `${GATEWAY_BASE_URL}/jobApi/jobinfo/getTaskInfo`;
    const headers = {
        channel: req.headers['channel'] || 'zmd',
        jgbh: jgbh || req.headers['jgbh'],
        'login-token': body.login_token || req.headers['login-token'],
        zzbs: req.headers['zzbs'],
        zzjgdmz: req.headers['zzjgdmz'],
        'Content-Type': 'application/json'
    };
    const payload = {
        sjrwmc: '',
        organizationNumber: zjgbh || jgbh || ''
    };

    try {
        const response = await axios.post(gatewayUrl, payload, { headers, timeout: 10000 });
        const gatewayData = response.data;
        let list = [];

        if (Array.isArray(gatewayData.datas)) {
            list = gatewayData.datas;
        } else if (Array.isArray(gatewayData.data)) {
            list = gatewayData.data;
        } else if (Array.isArray(gatewayData.results)) {
            list = gatewayData.results;
        } else if (Array.isArray(gatewayData)) {
            list = gatewayData;
        }

        const taskNameMap = {};
        for (const item of list) {
            const label = item.label ?? item.sjrwmc ?? item.jsrwmc ?? item.xmbh ?? item.taskName ?? item.name ?? item.text ?? '';
            const value = item.value ?? item.taskNumber ?? item.rwxbh ?? item.id ?? '';
            if (value !== undefined && value !== null && String(value).trim()) {
                taskNameMap[String(value)] = label || String(value);
            }
        }

        return taskNameMap;
    } catch (err) {
        logger.warn(`[cxgzkz] fetchTaskNameMap failed: ${err.message}`);
        return {};
    }
}

function normalizeIdList(ids) {
    if (ids === undefined || ids === null || ids === '') {
        return [];
    }

    return (Array.isArray(ids) ? ids : String(ids).split(','))
        .map(item => String(item).trim())
        .filter(Boolean)
        .map(Number)
        .filter(item => !Number.isNaN(item));
}

function getRowField(row, key) {
    return row?.[key] ?? row?.[String(key).toUpperCase()];
}

function pickFirstValue(source, keys) {
    for (const key of keys) {
        if (!Object.prototype.hasOwnProperty.call(source, key)) continue;
        const value = source[key];
        if (value === undefined || value === null) continue;
        const normalized = String(value).trim();
        if (normalized !== '') return normalized;
    }
    return undefined;
}

function normalizeBooleanLike(value, fallback) {
    if (value === undefined || value === null || value === '') return fallback;
    const normalized = String(value).trim().toLowerCase();
    if (['y', 'yes', 'true', '1', '是'].includes(normalized)) return 'y';
    if (['n', 'no', 'false', '0', '否'].includes(normalized)) return 'n';
    return fallback;
}

function normalizeCsvRowToCxgzkzRow(source, jgbh, zjgbh) {
    const row = {
        jgbh,
        zjgbh,
        rwxbh: pickFirstValue(source, ['任务项编号', '任务编号', 'rwxbh', 'RWXBH']),
        gzmc: pickFirstValue(source, ['程序控制规则名称', '规则名称', 'gzmc', 'GZMC']),
        gztsy: pickFirstValue(source, ['程序控制规则提示语', '规则提示语', 'gztsy', 'GZTSY']),
        sfqy: normalizeBooleanLike(pickFirstValue(source, ['是否启用', 'sfqy', 'SFQY']), 'y'),
        sfyxtqy: normalizeBooleanLike(pickFirstValue(source, ['是否允许停启用', 'sfyxtqy', 'SFYXTQY']), 'y'),
        sfyxtztsy: normalizeBooleanLike(pickFirstValue(source, ['是否允许调整提示语', '是否允许停启提示语', 'sfyxtztsy', 'SFYXTZTSY']), 'n'),
        role: pickFirstValue(source, ['角色', 'role', 'ROLE'])
    };

    if (!row.rwxbh) {
        return null;
    }

    return row;
}

function dedupeImportedRows(rows) {
    const rowMap = new Map();
    for (const row of rows) {
        if (!row || !row.rwxbh) continue;
        rowMap.set(String(row.rwxbh), row);
    }
    return Array.from(rowMap.values());
}

function buildExportCsvContent(rows) {
    const exportRows = rows.map(row => ({
        '任务项编号': getRowField(row, 'rwxbh') ?? '',
        '规则名称': getRowField(row, 'gzmc') ?? '',
        '规则提示语': getRowField(row, 'gztsy') ?? '',
        '是否启用': getRowField(row, 'sfqy') ?? '',
        '是否允许停启用': getRowField(row, 'sfyxtqy') ?? '',
        '是否允许调整提示语': getRowField(row, 'sfyxtztsy') ?? '',
        '角色': getRowField(row, 'role') ?? ''
    }));

    return stringifyCsv(exportRows, {
        header: true,
        quoted: true
    });
}

async function sendCxgzkzExport(req, res, ids, logLabel) {
    const { jgbh, zjgbh } = getRequestOrg(req);
    let sql = `SELECT * FROM gjj_cxgzkz WHERE COALESCE(jgbh, '') = ? AND COALESCE(zjgbh, '') = ?`;
    const params = [jgbh, zjgbh];

    if (ids.length > 0) {
        const placeholders = ids.map(() => '?').join(',');
        sql += ` AND id IN (${placeholders})`;
        params.push(...ids);
    }

    sql += ' ORDER BY id';

    const rules = await db.getByJgbh(typeof jgbh !== 'undefined' ? jgbh : '').all(sql, params);
    const csvContent = buildExportCsvContent(rules);
    const exportFileName = 'cxgzkz_export.csv';

    logger.info(`${logLabel} successful for cxgzkz: jgbh=${jgbh}, zjgbh=${zjgbh}, selected=${ids.length}, exported=${rules.length}`);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.attachment(exportFileName);
    return res.send(`\ufeff${csvContent}`);
}

/**
 * 1. 获取列表 (POST /list)
 */
router.post('/list', async (req, res) => {
    const { page = 1, perPage = 10, rwxbh, gzmc, gztsy, sfqy, sfyxtqy, sfyxtztsy } = req.body;
    const offset = (page - 1) * perPage;

    // 从请求头获取当前机构信息
    const jgbh = req.body.jgbh || req.headers['jgbh'] || req.headers['zzbs'] || '';
    const zjgbh = req.body.zjgbh || req.headers['zjgbh'] || req.headers['zzjgdmz'] || '';
    let sql = `
        SELECT *
        FROM gjj_cxgzkz
        WHERE COALESCE(jgbh, '') = ? AND COALESCE(zjgbh, '') = ?
    `;
    let countSql = `
        SELECT COUNT(*) as total
        FROM gjj_cxgzkz
        WHERE COALESCE(jgbh, '') = ? AND COALESCE(zjgbh, '') = ?
    `;
    const params = [jgbh, zjgbh];

    if (rwxbh) {
        sql += " AND rwxbh = ?";
        countSql += " AND rwxbh = ?";
        params.push(rwxbh);
    }
    if (gzmc) {
        sql += " AND gzmc LIKE ?";
        countSql += " AND gzmc LIKE ?";
        params.push(`%${gzmc}%`);
    }
    if (gztsy) {
        sql += " AND gztsy LIKE ?";
        countSql += " AND gztsy LIKE ?";
        params.push(`%${gztsy}%`);
    }
    if (sfqy) {
        sql += " AND sfqy = ?";
        countSql += " AND sfqy = ?";
        params.push(sfqy);
    }
    if (sfyxtqy) {
        sql += " AND sfyxtqy = ?";
        countSql += " AND sfyxtqy = ?";
        params.push(sfyxtqy);
    }
    if (sfyxtztsy) {
        sql += " AND sfyxtztsy = ?";
        countSql += " AND sfyxtztsy = ?";
        params.push(sfyxtztsy);
    }

    sql += " ORDER BY id DESC";
    const adapter = db.getByJgbh(typeof jgbh !== 'undefined' ? jgbh : '');
    const paged = SqlHelper.paginateQuery(sql, params, perPage, offset, adapter);

    try {
        const countRow = await db.getByJgbh(typeof jgbh !== 'undefined' ? jgbh : '').get(countSql, params);
        const adapter = db.getByJgbh(typeof jgbh !== 'undefined' ? jgbh : '');
        const rows = await adapter.all(paged.sql, paged.params);
        const taskNameMap = await fetchTaskNameMap(req);
        const envMode = getEnvModeFromJwt(req);
        const items = rows.map(row => {
            const rwxbhValue = row.rwxbh ?? row.RWXBH;
            return {
                ...row,
                rwxmc: taskNameMap[String(rwxbhValue)] || rwxbhValue
            };
        });

        res.json({
            status: 0,
            msg: "ok",
            data: {
                items,
                total: countRow ? (countRow.total || countRow.TOTAL) : 0,
                env_mode: envMode
            }
        });
    } catch (err) {
        logger.error(`Failed to query gjj_cxgzkz: ${err.message}`);
        res.status(500).json({ status: 1, msg: err.message });
    }
});

/**
 * 2. 获取详情 (POST /get)
 */
router.post('/get', async (req, res) => {
    const { id } = req.body;
    if (!id) return res.status(400).json({ status: 1, msg: "ID is required" });

    const jgbh = req.body.jgbh || req.headers['jgbh'] || req.headers['zzbs'] || '';
    const zjgbh = req.body.zjgbh || req.headers['zjgbh'] || req.headers['zzjgdmz'] || '';
    const coalesce = 'COALESCE';

    try {
        const sql = `SELECT * FROM gjj_cxgzkz WHERE id = ? AND ${coalesce}(jgbh, '') = ? AND ${coalesce}(zjgbh, '') = ?`;
        const row = await db.getByJgbh(typeof jgbh !== 'undefined' ? jgbh : '').get(sql, [id, jgbh, zjgbh]);

        if (!row) return res.status(404).json({ status: 1, msg: "Record not found" });

        res.json({ status: 0, msg: "ok", data: { ...row, env_mode: getEnvModeFromJwt(req) } });
    } catch (err) {
        res.status(500).json({ status: 1, msg: err.message });
    }
});

/**
 * 3. 获取详情 (GET /:id)
 */
router.get('/:id(\\d+)', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const jgbh = req.headers['jgbh'] || req.headers['zzbs'] || '';
    const zjgbh = req.headers['zjgbh'] || req.headers['zzjgdmz'] || '';
    const coalesce = 'COALESCE';

    try {
        const sql = `SELECT * FROM gjj_cxgzkz WHERE id = ? AND ${coalesce}(jgbh, '') = ? AND ${coalesce}(zjgbh, '') = ?`;
        const row = await db.getByJgbh(typeof jgbh !== 'undefined' ? jgbh : '').get(sql, [id, jgbh, zjgbh]);

        if (!row) return res.status(404).json({ status: 1, msg: "Record not found" });

        res.json({ status: 0, msg: "ok", data: { ...row, env_mode: getEnvModeFromJwt(req) } });
    } catch (err) {
        res.status(500).json({ status: 1, msg: err.message });
    }
});

/**
 * 4. 保存 (POST /save)
 */
router.post('/save', async (req, res) => {
    const { id, rwxbh, gzmc, gztsy, sfqy, sfyxtqy, sfyxtztsy, role } = req.body;

    const jgbh = req.body.jgbh || req.headers['jgbh'] || req.headers['zzbs'] || '';
    const zjgbh = req.body.zjgbh || req.headers['zjgbh'] || req.headers['zzjgdmz'] || '';
    const coalesce = 'COALESCE';
    const modelEnv = isModelEnv(req);

    try {
        const { id: savedId } = await db.getByJgbh(typeof jgbh !== 'undefined' ? jgbh : '').transaction(async (tx) => {
            let rowId = id;
            if (id) {
                const existing = await tx.get(
                    `SELECT * FROM gjj_cxgzkz WHERE id = ? AND ${coalesce}(jgbh, '') = ? AND ${coalesce}(zjgbh, '') = ?`,
                    [id, jgbh, zjgbh]
                );
                if (!existing) {
                    throw new Error('记录不存在或无权限修改');
                }

                const current = {
                    rwxbh: existing.rwxbh ?? existing.RWXBH,
                    gzmc: existing.gzmc ?? existing.GZMC,
                    gztsy: existing.gztsy ?? existing.GZTSY,
                    sfqy: existing.sfqy ?? existing.SFQY,
                    sfyxtqy: existing.sfyxtqy ?? existing.SFYXTQY,
                    sfyxtztsy: existing.sfyxtztsy ?? existing.SFYXTZTSY,
                    role: existing.role ?? existing.ROLE
                };

                const next = {
                    rwxbh: rwxbh ?? current.rwxbh,
                    gzmc: gzmc ?? current.gzmc,
                    gztsy: modelEnv || current.sfyxtztsy !== 'n'
                        ? (gztsy !== undefined ? gztsy : current.gztsy)
                        : current.gztsy,
                    sfqy: modelEnv || current.sfyxtqy !== 'n'
                        ? normalizeYn(sfqy, current.sfqy || 'y')
                        : current.sfqy,
                    sfyxtqy: modelEnv
                        ? normalizeYn(sfyxtqy, current.sfyxtqy || 'y')
                        : current.sfyxtqy,
                    sfyxtztsy: modelEnv
                        ? normalizeYn(sfyxtztsy, current.sfyxtztsy || 'n')
                        : current.sfyxtztsy,
                    role: role !== undefined ? role : current.role
                };

                const updateSql = `UPDATE gjj_cxgzkz SET rwxbh=?, gzmc=?, gztsy=?, sfqy=?, sfyxtqy=?, sfyxtztsy=?, role=? WHERE id=? AND ${coalesce}(jgbh, '') = ? AND ${coalesce}(zjgbh, '') = ?`;
                await tx.run(updateSql, [next.rwxbh, next.gzmc, next.gztsy, next.sfqy, next.sfyxtqy, next.sfyxtztsy, next.role, id, jgbh, zjgbh]);
            } else {
                const nextSfyxtqy = modelEnv ? normalizeYn(sfyxtqy, 'y') : 'y';
                const nextSfyxtztsy = modelEnv ? normalizeYn(sfyxtztsy, 'y') : 'y';
                const insertSql = `INSERT INTO gjj_cxgzkz (jgbh, zjgbh, rwxbh, gzmc, gztsy, sfqy, sfyxtqy, sfyxtztsy, role) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
                await tx.run(insertSql, [
                    jgbh,
                    zjgbh,
                    rwxbh,
                    gzmc,
                    gztsy,
                    normalizeYn(sfqy, 'y'),
                    nextSfyxtqy,
                    nextSfyxtztsy,
                    role
                ]);

                const lastRow = await tx.get("SELECT MAX(id) as id FROM gjj_cxgzkz");
                rowId = lastRow?.id ?? lastRow?.ID;
            }
            return { id: rowId };
        });

        res.json({ status: 0, msg: "保存成功", data: { id: savedId } });
    } catch (err) {
        logger.error(`Failed to save gjj_cxgzkz: ${err.message}`);
        res.status(500).json({ status: 1, msg: err.message });
    }
});

/**
 * 5. PUT /:id
 */
router.put('/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { rwxbh, gzmc, gztsy, sfqy, sfyxtqy, sfyxtztsy, role } = req.body;

    const jgbh = req.body.jgbh || req.headers['jgbh'] || req.headers['zzbs'] || '';
    const zjgbh = req.body.zjgbh || req.headers['zjgbh'] || req.headers['zzjgdmz'] || '';
    const coalesce = 'COALESCE';
    const modelEnv = isModelEnv(req);

    try {
        await db.getByJgbh(typeof jgbh !== 'undefined' ? jgbh : '').transaction(async (tx) => {
            const existing = await tx.get(
                `SELECT * FROM gjj_cxgzkz WHERE id = ? AND ${coalesce}(jgbh, '') = ? AND ${coalesce}(zjgbh, '') = ?`,
                [id, jgbh, zjgbh]
            );
            if (!existing) {
                throw new Error('记录不存在或无权限修改');
            }

            const current = {
                rwxbh: existing.rwxbh ?? existing.RWXBH,
                gzmc: existing.gzmc ?? existing.GZMC,
                gztsy: existing.gztsy ?? existing.GZTSY,
                sfqy: existing.sfqy ?? existing.SFQY,
                sfyxtqy: existing.sfyxtqy ?? existing.SFYXTQY,
                sfyxtztsy: existing.sfyxtztsy ?? existing.SFYXTZTSY,
                role: existing.role ?? existing.ROLE
            };

            const next = {
                rwxbh: rwxbh ?? current.rwxbh,
                gzmc: gzmc ?? current.gzmc,
                gztsy: modelEnv || current.sfyxtztsy !== 'n'
                    ? (gztsy !== undefined ? gztsy : current.gztsy)
                    : current.gztsy,
                sfqy: modelEnv || current.sfyxtqy !== 'n'
                    ? normalizeYn(sfqy, current.sfqy || 'y')
                    : current.sfqy,
                sfyxtqy: modelEnv
                    ? normalizeYn(sfyxtqy, current.sfyxtqy || 'y')
                    : current.sfyxtqy,
                sfyxtztsy: modelEnv
                    ? normalizeYn(sfyxtztsy, current.sfyxtztsy || 'n')
                    : current.sfyxtztsy,
                role: role !== undefined ? role : current.role
            };

            const updateSql = `UPDATE gjj_cxgzkz SET rwxbh=?, gzmc=?, gztsy=?, sfqy=?, sfyxtqy=?, sfyxtztsy=?, role=? WHERE id = ? AND ${coalesce}(jgbh, '') = ? AND ${coalesce}(zjgbh, '') = ?`;
            await tx.run(updateSql, [next.rwxbh, next.gzmc, next.gztsy, next.sfqy, next.sfyxtqy, next.sfyxtztsy, next.role, id, jgbh, zjgbh]);
        });

        res.json({ status: 0, msg: "更新成功" });
    } catch (err) {
        res.status(500).json({ status: 1, msg: err.message });
    }
});

/**
 * 6. 删除 (POST /delete)
 */
router.post('/delete', async (req, res) => {
    let { id, jgbh, zjgbh } = req.body;
    if (!id) return res.status(400).json({ status: 1, msg: "ID is required" });

    if (!jgbh) jgbh = req.headers['jgbh'] || '';
    if (!zjgbh) zjgbh = req.headers['zjgbh'] || '';

    try {
        const coalesce = 'COALESCE';
        const checkSql = `
            SELECT id FROM gjj_cxgzkz 
            WHERE id = ? 
            AND ${coalesce}(jgbh, '') = ? 
            AND ${coalesce}(zjgbh, '') = ?
        `;
        const record = await db.getByJgbh(typeof jgbh !== 'undefined' ? jgbh : '').get(checkSql, [id, jgbh, zjgbh]);

        if (!record) {
            return res.status(403).json({ status: 1, msg: "无权删除此记录或记录不存在" });
        }

        await db.getByJgbh(typeof jgbh !== 'undefined' ? jgbh : '').run(`DELETE FROM gjj_cxgzkz WHERE id = ? AND ${coalesce}(jgbh, '') = ? AND ${coalesce}(zjgbh, '') = ?`, [id, jgbh, zjgbh]);

        res.json({ status: 0, msg: "删除成功" });
    } catch (err) {
        logger.error(`Delete failed: ${err.message}`);
        res.status(500).json({ status: 1, msg: err.message });
    }
});

/**
 * 7. DELETE /:id
 */
router.delete('/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;

    const jgbh = req.headers['jgbh'] || req.headers['zzbs'] || '';
    const zjgbh = req.headers['zjgbh'] || req.headers['zzjgdmz'] || '';
    const coalesce = 'COALESCE';

    try {
        const checkSql = `
            SELECT id FROM gjj_cxgzkz 
            WHERE id = ? 
            AND ${coalesce}(jgbh, '') = ? 
            AND ${coalesce}(zjgbh, '') = ?
        `;
        const record = await db.getByJgbh(typeof jgbh !== 'undefined' ? jgbh : '').get(checkSql, [id, jgbh, zjgbh]);

        if (!record) {
            return res.status(403).json({ status: 1, msg: "无权删除此记录或记录不存在" });
        }

        await db.getByJgbh(typeof jgbh !== 'undefined' ? jgbh : '').run(`DELETE FROM gjj_cxgzkz WHERE id = ? AND ${coalesce}(jgbh, '') = ? AND ${coalesce}(zjgbh, '') = ?`, [id, jgbh, zjgbh]);

        res.json({ status: 0, msg: "删除成功" });
    } catch (err) {
        logger.error(`Delete failed: ${err.message}`);
        res.status(500).json({ status: 1, msg: err.message });
    }
});

// -----------------------------------------------------------------------------
// 获取当前机构运行模式（基于 JWT 中 mechanismMmodel）
// -----------------------------------------------------------------------------
router.post('/mode', async (req, res) => {
    try {
        res.json({ status: 0, msg: "ok", data: { env_mode: getEnvModeFromJwt(req) } });
    } catch (err) {
        logger.error(`Get cxgzkz mode failed: ${err.message}`);
        res.status(500).json({ status: 1, msg: err.message });
    }
});

// -----------------------------------------------------------------------------
// 导出接口（勾选则导出勾选记录，未勾选则导出当前机构全部记录）
// -----------------------------------------------------------------------------
router.all('/export', authenticateToken, async (req, res) => {
    try {
        const ids = normalizeIdList(req.body?.ids ?? req.query?.ids);
        return await sendCxgzkzExport(req, res, ids, 'Export');
    } catch (err) {
        logger.error(`Export failed: ${err.message}`);
        res.status(500).json({ status: 1, msg: "导出失败: " + err.message });
    }
});

// -----------------------------------------------------------------------------
// 辅助函数：解析 INSERT 语句中的 VALUES
// -----------------------------------------------------------------------------
function parseInsertValues(valsStr) {
    const vals = [];
    let current = '';
    let inQuote = false;
    let parenDepth = 0;

    for (let i = 0; i < valsStr.length; i++) {
        const ch = valsStr[i];
        if (ch === "'" && !inQuote) {
            inQuote = true;
            current += ch;
        } else if (ch === "'" && inQuote) {
            if (i + 1 < valsStr.length && valsStr[i + 1] === "'") {
                current += "''";
                i++;
            } else {
                inQuote = false;
                current += ch;
            }
        } else if (ch === '(' && !inQuote) {
            parenDepth++;
            current += ch;
        } else if (ch === ')' && !inQuote) {
            parenDepth--;
            current += ch;
        } else if (ch === ',' && !inQuote && parenDepth === 0) {
            vals.push(current.trim());
            current = '';
        } else {
            current += ch;
        }
    }

    if (current.trim()) vals.push(current.trim());
    return vals;
}

// -----------------------------------------------------------------------------
// 辅助函数：解析 SQL 字面量
// -----------------------------------------------------------------------------
function parseSqlLiteral(token) {
    const t = String(token).trim();
    if (/^null$/i.test(t)) return null;
    if (/^'.*'$/s.test(t)) return t.slice(1, -1).replace(/''/g, "'");
    if (/^-?\d+(\.\d+)?$/.test(t)) return Number(t);
    return t;
}

// -----------------------------------------------------------------------------
// 辅助函数：解析 gjj_cxgzkz INSERT 语句为对象
//   - 去掉 id
//   - 强制替换 jgbh/zjgbh
// -----------------------------------------------------------------------------
function parseCxgzkzInsertToRow(stmt, jgbh, zjgbh) {
    const colsMatch = stmt.match(/INSERT\s+INTO\s+gjj_cxgzkz\s*\(([^)]+)\)/i);
    const valsMatch = stmt.match(/VALUES\s*\((.+)\)/is);
    if (!colsMatch || !valsMatch) return null;

    const cols = colsMatch[1].split(',').map(c => c.trim().toLowerCase());
    const vals = parseInsertValues(valsMatch[1]);
    if (cols.length !== vals.length) return null;

    const row = {};
    cols.forEach((col, idx) => {
        row[col] = parseSqlLiteral(vals[idx]);
    });

    delete row.id;
    row.jgbh = jgbh;
    row.zjgbh = zjgbh;
    row.sfqy = normalizeYn(row.sfqy, 'y');
    row.sfyxtqy = normalizeYn(row.sfyxtqy, 'y');
    row.sfyxtztsy = normalizeYn(row.sfyxtztsy, 'n');
    return row;
}

async function insertCxgzkzRow(tx, row) {
    if (!row.rwxbh || !row.gzmc) {
        throw new Error('导入数据缺少必填字段 rwxbh 或 gzmc');
    }

    const insertSql = `
        INSERT INTO gjj_cxgzkz (jgbh, zjgbh, rwxbh, gzmc, gztsy, sfqy, sfyxtqy, sfyxtztsy, role)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    await tx.run(insertSql, [
        row.jgbh,
        row.zjgbh,
        row.rwxbh,
        row.gzmc,
        row.gztsy ?? null,
        normalizeYn(row.sfqy, 'y'),
        normalizeYn(row.sfyxtqy, 'y'),
        normalizeYn(row.sfyxtztsy, 'n'),
        row.role ?? null
    ]);
}

// -----------------------------------------------------------------------------
// 导入接口（页面统一为 CSV 导入，后端按环境模式决定覆盖策略）
// -----------------------------------------------------------------------------
router.post('/import', authenticateToken, upload.single('file'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ status: 1, msg: "请选择文件" });
    }

    const { jgbh, zjgbh } = getHeaderOrg(req);
    const coalesce = 'COALESCE';

    try {
        const envMode = getEnvModeFromJwt(req);
        const modelEnv = envMode === 'rd';
        let insertCount = 0;
        let updateCount = 0;
        let fileContent = req.file.buffer.toString('utf8');
        if (fileContent.startsWith('\ufeff')) {
            fileContent = fileContent.slice(1);
        }

        let importedRows = [];
        if (fileContent.toUpperCase().includes('INSERT INTO')) {
            const statements = fileContent
                .split('\n')
                .filter(line => !line.trim().startsWith('--'))
                .join('\n')
                .split(';')
                .map(s => s.trim())
                .filter(s => s.length > 0);

            for (const stmt of statements) {
                const upperStmt = stmt.toUpperCase();
                if (
                    upperStmt.startsWith('DELETE') ||
                    upperStmt.startsWith('SELECT') ||
                    upperStmt.startsWith('SHOW') ||
                    upperStmt.startsWith('BEGIN') ||
                    upperStmt.startsWith('COMMIT')
                ) {
                    continue;
                }
                if (upperStmt.startsWith('INSERT INTO GJJ_CXGZKZ ') || upperStmt.startsWith('INSERT INTO GJJ_CXGZKZ(')) {
                    const row = parseCxgzkzInsertToRow(stmt, jgbh, zjgbh);
                    if (row && row.rwxbh) {
                        importedRows.push(row);
                    }
                }
            }
        } else {
            const records = parseCsv(fileContent, {
                columns: true,
                bom: true,
                skip_empty_lines: true,
                trim: true,
                relax_column_count: true
            });

            importedRows = records
                .map(record => normalizeCsvRowToCxgzkzRow(record, jgbh, zjgbh))
                .filter(Boolean);
        }

        importedRows = dedupeImportedRows(importedRows);

        if (importedRows.length === 0) {
            return res.status(400).json({ status: 1, msg: "文件中未解析到可导入的程序控制规则数据，请检查 CSV 中是否包含任务项编号列" });
        }

        await db.getByJgbh(typeof jgbh !== 'undefined' ? jgbh : '').transaction(async (tx) => {
            const existingRows = await tx.all(
                `SELECT * FROM gjj_cxgzkz WHERE ${coalesce}(jgbh, '') = ? AND ${coalesce}(zjgbh, '') = ? ORDER BY id DESC`,
                [jgbh, zjgbh]
            );
            const existingMap = new Map();
            for (const row of existingRows) {
                const key = row.rwxbh ?? row.RWXBH;
                if (key !== undefined && key !== null && !existingMap.has(String(key))) {
                    existingMap.set(String(key), row);
                }
            }

            for (const imported of importedRows) {
                const key = String(imported.rwxbh);
                const existing = existingMap.get(key);

                if (!existing) {
                    await insertCxgzkzRow(tx, imported);
                    insertCount++;
                    continue;
                }

                const idVal = existing.id ?? existing.ID;
                const current = {
                    gzmc: existing.gzmc ?? existing.GZMC,
                    gztsy: existing.gztsy ?? existing.GZTSY,
                    sfqy: existing.sfqy ?? existing.SFQY,
                    sfyxtqy: existing.sfyxtqy ?? existing.SFYXTQY,
                    sfyxtztsy: existing.sfyxtztsy ?? existing.SFYXTZTSY,
                    role: existing.role ?? existing.ROLE
                };

                const next = {
                    rwxbh: imported.rwxbh,
                    gzmc: imported.gzmc ?? current.gzmc,
                    gztsy: modelEnv ? (imported.gztsy ?? current.gztsy) : current.gztsy,
                    sfqy: modelEnv ? normalizeYn(imported.sfqy, current.sfqy || 'y') : current.sfqy,
                    sfyxtqy: normalizeYn(imported.sfyxtqy, current.sfyxtqy || 'y'),
                    sfyxtztsy: normalizeYn(imported.sfyxtztsy, current.sfyxtztsy || 'n'),
                    role: current.role
                };

                const updateSql = `
                    UPDATE gjj_cxgzkz
                    SET rwxbh = ?, gzmc = ?, gztsy = ?, sfqy = ?, sfyxtqy = ?, sfyxtztsy = ?, role = ?
                    WHERE id = ? AND ${coalesce}(jgbh, '') = ? AND ${coalesce}(zjgbh, '') = ?
                `;
                await tx.run(updateSql, [
                    next.rwxbh,
                    next.gzmc,
                    next.gztsy,
                    next.sfqy,
                    next.sfyxtqy,
                    next.sfyxtztsy,
                    next.role,
                    idVal,
                    jgbh,
                    zjgbh
                ]);
                updateCount++;
            }
        });

        logger.info(`Import successful for cxgzkz: env_mode=${envMode}, jgbh=${jgbh}, zjgbh=${zjgbh}, inserted=${insertCount}, updated=${updateCount}`);
        if (envMode === 'prod') {
            return res.json({ status: 0, msg: `导入成功（生产环境）：新增 ${insertCount} 条，更新 ${updateCount} 条，仅更新 rwxbh/gzmc/sfyxtqy/sfyxtztsy` });
        }
        res.json({ status: 0, msg: `导入成功（模型环境）：新增 ${insertCount} 条，更新 ${updateCount} 条，按文件更新 rwxbh/gzmc/gztsy/sfqy/sfyxtqy/sfyxtztsy` });
    } catch (err) {
        logger.error(`Import failed for cxgzkz: ${err.message}`);
        res.status(500).json({ status: 1, msg: "导入失败: " + err.message });
    }
});


module.exports = router;
