/**
 * 业务标准库 CRUD 接口
 * 处理标准模板的增删改查
 */

const express = require('express');
const router = express.Router();
const db = require('../../db');
const SqlHelper = require('../../utils/sqlHelper');
const logger = require('../../utils/logger');
const {
    parseDialectSql,
    buildDialectSql,
    validateSqlText,
    validateDialectSqlObject,
    DIALECT_LIST
} = require('../../utils/sqlDialectHelper');
const {
    isBusinessStandardMasterEnabled,
    getBusinessStandardWriteDeniedMessage,
    getBusinessStandardImportDisabledMessage
} = require('../../utils/business-standard-access');
const algorithmConfig = require('../../utils/business-algorithms');
const {
    getPublicKeyInfo,
    decryptStandardSqlEnvelope,
    restoreStandardSqlFields
} = require('../../utils/standardSqlEnvelope');
const {
    PACKAGE_TYPES,
    PACKAGE_SCOPES,
    EXECUTION_MODES,
    YWBZK_TABLES,
    buildExportFileName,
    buildExportFileNameAscii,
    assembleExportScript,
    writeExportScript,
    sendExportDownload,
    getExportsDir,
    isAllowedExportHistoryName
} = require('../../utils/exportPackage');
const {
    recordExportScript,
    listExportScripts,
    getExportScriptById,
    pruneExportScripts
} = require('../../utils/exportScriptHistory');
const multer = require('multer');
const { authenticateToken } = require('../../middleware/auth');
const fs = require('fs');
const path = require('path');

const upload = multer({ storage: multer.memoryStorage() });

function decryptStandardSqlRequest(req, res, next) {
    if (!req.body || !req.body.sqlEnvelope) {
        return next();
    }

    try {
        const sqlPayload = decryptStandardSqlEnvelope(req.body.sqlEnvelope);
        req.body = restoreStandardSqlFields(req.body, sqlPayload);
        return next();
    } catch (error) {
        logger.warn(`标准库 SQL 解密失败: ${error.message}, user=${req.user?.username || 'unknown'}, ip=${req.ip}`);
        return res.status(400).json({
            status: 400,
            msg: error.message || '标准库 SQL 解密失败，请刷新页面后重试'
        });
    }
}

function getCountValue(row) {
    if (!row) {
        return 0;
    }

    return row.total || row.TOTAL || 0;
}

function normalizeIdList(value) {
    if (!value) {
        return [];
    }

    const list = Array.isArray(value) ? value : String(value).split(',');

    return [...new Set(
        list
            .map(item => String(item).trim())
            .filter(item => item !== '')
    )];
}

function getDefinedValue(source, ...keys) {
    if (!source) {
        return undefined;
    }

    for (const key of keys) {
        if (Object.prototype.hasOwnProperty.call(source, key) && source[key] !== undefined && source[key] !== null) {
            return source[key];
        }
    }

    return undefined;
}

function isBlankValue(value) {
    return value === undefined || value === null || value === '';
}

function normalizeOptionalText(value) {
    if (isBlankValue(value)) {
        return '';
    }

    return String(value).trim();
}

function normalizeOptionalInteger(value) {
    if (isBlankValue(value)) {
        return null;
    }

    const num = Number(value);
    if (!Number.isInteger(num)) {
        return Number.NaN;
    }

    return num;
}

function normalizeBusinessStandardAttributeRows(rows) {
    if (!Array.isArray(rows)) {
        return [];
    }

    return rows.map((row, index) => {
        const objectModeFlag = normalizeOptionalText(getDefinedValue(row, 'sfdxsx', 'SFDXSX'));
        const objectNumber = normalizeOptionalText(getDefinedValue(row, 'ywblbzdx', 'YWBLBZDX'));
        const isObjectProperty = objectModeFlag
            ? objectModeFlag !== '0'
            : !isBlankValue(objectNumber);

        if (!isObjectProperty) {
            const customName = normalizeOptionalText(getDefinedValue(row, 'zdsxmc', 'ZDSXMC'));
            const customCode = normalizeOptionalText(getDefinedValue(row, 'zdsxbm', 'ZDSXBM'));

            if (!customName) {
                throw new Error(`第${index + 1}行属性名称不能为空`);
            }

            if (!customCode) {
                throw new Error(`第${index + 1}行属性编码不能为空`);
            }

            return {
                sfdxsx: '0',
                ywblbzdx: null,
                fwdxbq: null,
                sxbm: customName,
                ywblbzsx: customCode,
                sxly: 'page',
                ywblbzyg: null,
                ywblbzyg_dialects: null
            };
        }

        const fieldId = normalizeOptionalText(getDefinedValue(row, 'ywblbzsx', 'YWBLBZSX'));
        const fieldName = normalizeOptionalText(getDefinedValue(row, 'sxbm', 'SXBM')) || fieldId;
        const sourceType = normalizeOptionalText(getDefinedValue(row, 'sxly', 'SXLY')).toLowerCase() === 'sql'
            ? 'sql'
            : 'page';

        if (!objectNumber) {
            throw new Error(`第${index + 1}行业务办理标准属性所属对象不能为空`);
        }

        if (!fieldId) {
            throw new Error(`第${index + 1}行业务办理标准属性不能为空`);
        }

        return {
            sfdxsx: '1',
            ywblbzdx: objectNumber,
            fwdxbq: normalizeOptionalText(getDefinedValue(row, 'fwdxbq', 'FWDXBQ')) || null,
            sxbm: fieldName,
            ywblbzsx: fieldId,
            sxly: sourceType,
            ywblbzyg: sourceType === 'sql' ? getDefinedValue(row, 'ywblbzyg', 'YWBLBZYG') : null,
            ywblbzyg_dialects: sourceType === 'sql' ? getDefinedValue(row, 'ywblbzyg_dialects') : null
        };
    });
}

router.get('/sql-public-key', (req, res) => {
    try {
        res.json({ status: 0, msg: 'success', data: getPublicKeyInfo() });
    } catch (error) {
        logger.error(`获取标准库 SQL 加密公钥失败: ${error.message}`);
        res.status(500).json({ status: 1, msg: '标准库 SQL 加密配置不可用' });
    }
});

/**
 * 1. 获取列表 (POST /list)
 * 支持分页和关键字查询
 */
router.post('/list', async (req, res) => {
    const { page = 1, perPage = 10, ywblbz, zdybm, gjsjsf, ywnrfl, ywblfl } = req.body;
    const jgbh = req.body.jgbh || req.headers['jgbh'] || req.headers['zzbs'] || '';
    const offset = (page - 1) * perPage;

    let sql = `
        SELECT t.*, COALESCE(c.flmc, t.ywnrfl) as ywnrfl_label
        FROM gjj_ywbzk t
        LEFT JOIN gjj_ywnrfl c ON c.gjsjsf = t.gjsjsf AND c.flbm = t.ywnrfl
        WHERE 1=1
    `;
    let countSql = "SELECT COUNT(*) as total FROM gjj_ywbzk WHERE 1=1";
    const params = [];

    if (ywblbz) {
        sql += " AND t.ywblbz LIKE ?";
        countSql += " AND ywblbz LIKE ?";
        params.push(`%${ywblbz}%`);
    }
    if (zdybm) {
        sql += " AND t.zdybm LIKE ?";
        countSql += " AND zdybm LIKE ?";
        params.push(`%${zdybm}%`);
    }
    if (gjsjsf) {
        sql += " AND t.gjsjsf = ?";
        countSql += " AND gjsjsf = ?";
        params.push(gjsjsf);
    }
    if (ywnrfl) {
        sql += " AND t.ywnrfl = ?";
        countSql += " AND ywnrfl = ?";
        params.push(ywnrfl);
    }
    if (ywblfl) {
        sql += " AND COALESCE(t.ywblfl, '1') = ?";
        countSql += " AND COALESCE(ywblfl, '1') = ?";
        params.push(String(ywblfl));
    }

    sql += " ORDER BY t.pxh ASC, t.id DESC";
    const _adapter = db.getByJgbh(typeof jgbh !== 'undefined' ? jgbh : '');
    const paged = SqlHelper.paginateQuery(sql, params, perPage, offset, _adapter);

    try {
        const countRow = await _adapter.get(countSql, params);
        const rows = await _adapter.all(paged.sql, paged.params);
        rows.forEach(row => {
            row.ywblfl = row.ywblfl || row.YWBLFL || '1';
            row.fenzhi = getDefinedValue(row, 'fenzhi', 'FENZHI');
        });

        res.json({
            status: 0,
            msg: "ok",
            data: {
                items: rows,
                total: getCountValue(countRow)
            }
        });
    } catch (err) {
        logger.error(`Failed to query ywbzk: ${err.message}`);
        res.status(500).json({ status: 1, msg: err.message });
    }
});

/**
 * 2. 获取详情 (POST /get)
 * 包含关联的属性组
 */
router.post('/get', async (req, res) => {
    const { id } = req.body;
    const jgbh = req.body.jgbh || req.headers['jgbh'] || req.headers['zzbs'] || '';
    if (!id) {
        return res.status(400).json({ status: 1, msg: "ID is required" });
    }

    try {
        const sql = "SELECT * FROM gjj_ywbzk WHERE id = ?";
        const row = await db.getByJgbh(typeof jgbh !== 'undefined' ? jgbh : '').get(sql, [id]);

        if (!row) {
            return res.status(404).json({ status: 1, msg: "Record not found" });
        }

        row.ywblfl = row.ywblfl || row.YWBLFL || '1';
        row.fenzhi = getDefinedValue(row, 'fenzhi', 'FENZHI');

        // 拆解 ywbzjg 方言
        row.ywbzjg_dialects = parseDialectSql(row.ywbzjg || row.YWBZJG);

        const sxSql = "SELECT * FROM gjj_ywbzksx WHERE mbid = ? order by id ASC";
        const sxRows = await db.getByJgbh(typeof jgbh !== 'undefined' ? jgbh : '').all(sxSql, [id]);
        const mutualSql = `
            SELECT t.id as value, t.ywblbz as label
            FROM gjj_ywbzkhc h
            INNER JOIN gjj_ywbzk t ON t.id = h.hcmbid
            WHERE h.mbid = ?
            ORDER BY t.pxh ASC, t.id ASC
        `;
        const mutualRows = await db.getByJgbh(typeof jgbh !== 'undefined' ? jgbh : '').all(mutualSql, [id]);

        // 拆解每行属性的 ywblbzyg 方言，并补充前端双模式表单所需字段
        sxRows.forEach(sx => {
            sx.ywblbzyg_dialects = parseDialectSql(sx.ywblbzyg || sx.YWBLBZYG);
            sx.sfdxsx = isBlankValue(getDefinedValue(sx, 'ywblbzdx', 'YWBLBZDX')) ? '0' : '1';
            sx.zdsxmc = normalizeOptionalText(getDefinedValue(sx, 'sxbm', 'SXBM'));
            sx.zdsxbm = normalizeOptionalText(getDefinedValue(sx, 'ywblbzsx', 'YWBLBZSX'));
            sx.sxly = normalizeOptionalText(getDefinedValue(sx, 'sxly', 'SXLY')) || 'page';
        });

        row.ywblbzsxz = sxRows;
        row.hcbzIds = mutualRows.map(item => String(item.value || item.VALUE));
        row.hcbzOptions = mutualRows;
        // 返回方言列表供前端渲染 Tab 页签
        row.dialect_list = DIALECT_LIST;
        res.json({ status: 0, msg: "ok", data: row });
    } catch (err) {
        res.status(500).json({ status: 1, msg: err.message });
    }
});

/**
 * 3. 保存 (新增 or 修改) (POST /save)
 * 自动处理事务和属性组同步
 */
router.post('/save', decryptStandardSqlRequest, async (req, res) => {
    let {
        id,
        pxh,
        ywblbz,
        tsysxmc,
        tsysxdw,
        zdybm,
        ywbzz,
        ywbzjg,
        fenzhi,
        ywblbzsm,
        gjsjsf,
        ywnrfl,
        ywblfl,
        bzfl,
        ywblbzsxz,
        hcbzIds
    } = req.body;
    const { ywbzjg_dialects } = req.body;
    const jgbh = req.body.jgbh || req.headers['jgbh'] || req.headers['zzbs'] || '';
    let normalizedAttributeRows = [];

    if (!isBusinessStandardMasterEnabled(req)) {
        return res.status(403).json({ status: 403, msg: getBusinessStandardWriteDeniedMessage() });
    }

    if (gjsjsf && !algorithmConfig.isValidAlgorithm(gjsjsf)) {
        return res.status(400).json({ status: 1, msg: `无效的关键数据算法编码: ${gjsjsf}` });
    }

    try {
        const _adapter = db.getByJgbh(typeof jgbh !== 'undefined' ? jgbh : '');
        tsysxmc = tsysxmc ? String(tsysxmc).trim() : '';
        tsysxdw = tsysxdw ? String(tsysxdw).trim() : '';
        zdybm = zdybm ? String(zdybm).trim() : '';
        ywbzz = isBlankValue(ywbzz) ? null : String(ywbzz).trim();
        ywblfl = ywblfl ? String(ywblfl) : '1';
        fenzhi = normalizeOptionalInteger(fenzhi);
        hcbzIds = normalizeIdList(hcbzIds);

        const ywbzjgFieldLabel = ywblfl === '2'
            ? '业务条件执行语句'
            : ywblfl === '3'
                ? '业务风险执行语句'
                : '业务办理标准结果执行语句';

        // 如果前端传入了方言对象，则组装为 JSON 字符串覆盖 ywbzjg
        if (ywbzjg_dialects && typeof ywbzjg_dialects === 'object') {
            validateDialectSqlObject(ywbzjg_dialects, ywbzjgFieldLabel);
            ywbzjg = buildDialectSql(ywbzjg_dialects, ywbzjgFieldLabel);
        } else if (typeof ywbzjg === 'string' && ywbzjg.trim().startsWith('[')) {
            parseDialectSql(ywbzjg, ywbzjgFieldLabel);
        } else if (typeof ywbzjg === 'string') {
            validateSqlText(ywbzjg, ywbzjgFieldLabel);
        }

        try {
            normalizedAttributeRows = normalizeBusinessStandardAttributeRows(ywblbzsxz);
        } catch (validationError) {
            return res.status(400).json({ status: 1, msg: validationError.message });
        }

        if (!['1', '2', '3'].includes(ywblfl)) {
            return res.status(400).json({ status: 1, msg: `无效的业务办理分类编码: ${ywblfl}` });
        }

        if (ywblfl === '3') {
            if (fenzhi === null) {
                return res.status(400).json({ status: 1, msg: '风险模式下分值不能为空' });
            }

            if (Number.isNaN(fenzhi) || fenzhi < 1 || fenzhi > 100) {
                return res.status(400).json({ status: 1, msg: '风险分值必须为 1-100 的整数' });
            }
        } else {
            fenzhi = null;
        }

        if (ywblfl !== '1') {
            ywbzz = null;
        }

        if (zdybm) {
            const duplicateSql = id
                ? 'SELECT id FROM gjj_ywbzk WHERE zdybm = ? AND id <> ?'
                : 'SELECT id FROM gjj_ywbzk WHERE zdybm = ?';
            const duplicateParams = id ? [zdybm, id] : [zdybm];
            const duplicateRow = await _adapter.get(duplicateSql, duplicateParams);

            if (duplicateRow) {
                return res.status(400).json({ status: 1, msg: `自定义编码已存在: ${zdybm}` });
            }
        }

        if (ywnrfl) {
            if (!gjsjsf) {
                return res.status(400).json({ status: 1, msg: '选择业务内容分类时必须指定关键数据算法' });
            }

            const classRow = await _adapter.get(
                'SELECT id FROM gjj_ywnrfl WHERE gjsjsf = ? AND flbm = ?',
                [gjsjsf, ywnrfl]
            );

            if (!classRow) {
                return res.status(400).json({ status: 1, msg: `业务内容分类不存在: ${ywnrfl}` });
            }
        }

        if (hcbzIds.length > 0) {
            if (!gjsjsf || !ywnrfl) {
                return res.status(400).json({ status: 1, msg: '设置互斥业务办理标准时必须先选择关键数据算法和业务内容分类' });
            }

            const placeholders = hcbzIds.map(() => '?').join(',');
            const mutualRows = await _adapter.all(
                `SELECT id FROM gjj_ywbzk WHERE id IN (${placeholders}) AND gjsjsf = ? AND ywnrfl = ?`,
                [...hcbzIds, gjsjsf, ywnrfl]
            );
            const validIds = new Set(mutualRows.map(row => String(row.id || row.ID)));

            if (id && validIds.has(String(id))) {
                return res.status(400).json({ status: 1, msg: '互斥业务办理标准不能选择自身' });
            }

            if (validIds.size !== hcbzIds.length) {
                return res.status(400).json({ status: 1, msg: '互斥业务办理标准必须与当前模板属于同一关键数据算法和业务内容分类' });
            }
        }

        const { id: savedId } = await _adapter.transaction(async (tx) => {
            let mbid = id;
            if (id) {
                const updateSql = `UPDATE gjj_ywbzk SET pxh=:1, ywblbz=:2, tsysxmc=:3, tsysxdw=:4, zdybm=:5, ywbzz=:6, ywbzjg=:7, fenzhi=:8, ywblbzsm=:9, gjsjsf=:10, ywnrfl=:11, ywblfl=:12, bzfl=:13, gxsj=${SqlHelper.now(_adapter)} WHERE id=:14`;
                await tx.run(updateSql, [
                    pxh,
                    ywblbz,
                    tsysxmc || null,
                    tsysxdw || null,
                    zdybm || null,
                    ywbzz,
                    ywbzjg,
                    fenzhi,
                    ywblbzsm,
                    gjsjsf,
                    ywnrfl,
                    ywblfl,
                    bzfl,
                    id
                ]);
                await tx.run("DELETE FROM gjj_ywbzksx WHERE mbid = :1", [id]);
            } else {
                const insertSql = `INSERT INTO gjj_ywbzk (pxh, ywblbz, tsysxmc, tsysxdw, zdybm, ywbzz, ywbzjg, fenzhi, ywblbzsm, gjsjsf, ywnrfl, ywblfl, bzfl) VALUES (:1, :2, :3, :4, :5, :6, :7, :8, :9, :10, :11, :12, :13)`;
                const insertResult = await tx.run(insertSql, [
                    pxh,
                    ywblbz,
                    tsysxmc || null,
                    tsysxdw || null,
                    zdybm || null,
                    ywbzz,
                    ywbzjg,
                    fenzhi,
                    ywblbzsm,
                    gjsjsf,
                    ywnrfl,
                    ywblfl,
                    bzfl
                ]);
                mbid = insertResult.lastID;
            }

            if (normalizedAttributeRows.length > 0) {
                for (const sx of normalizedAttributeRows) {
                    // 如果属性行传入了方言对象，组装为 JSON 字符串
                    let sxYwblbzyg = sx.ywblbzyg;
                    if (sx.sxly === 'sql' && sx.ywblbzyg_dialects && typeof sx.ywblbzyg_dialects === 'object') {
                        validateDialectSqlObject(sx.ywblbzyg_dialects, `属性来源执行语句(${sx.ywblbzsx || sx.sxbm || '未命名属性'})`);
                        sxYwblbzyg = buildDialectSql(sx.ywblbzyg_dialects, `属性来源执行语句(${sx.ywblbzsx || sx.sxbm || '未命名属性'})`);
                    } else if (sx.sxly === 'sql' && typeof sxYwblbzyg === 'string' && sxYwblbzyg.trim().startsWith('[')) {
                        parseDialectSql(sxYwblbzyg, `属性来源执行语句(${sx.ywblbzsx || sx.sxbm || '未命名属性'})`);
                    } else if (sx.sxly === 'sql' && typeof sxYwblbzyg === 'string') {
                        validateSqlText(sxYwblbzyg, `属性来源执行语句(${sx.ywblbzsx || sx.sxbm || '未命名属性'})`);
                    } else if (sx.sxly !== 'sql') {
                        sxYwblbzyg = null;
                    }
                    const sxInsertSql = `
                        INSERT INTO gjj_ywbzksx (mbid, ywblbzdx, fwdxbq, sxbm, ywblbzsx, sxly, ywblbzyg)
                        VALUES (:1, :2, :3, :4, :5, :6, :7)
                    `;
                    await tx.run(sxInsertSql, [mbid, sx.ywblbzdx, sx.fwdxbq, sx.sxbm, sx.ywblbzsx, sx.sxly, sxYwblbzyg]);
                }
            }

            await tx.run('DELETE FROM gjj_ywbzkhc WHERE mbid = :1 OR hcmbid = :2', [mbid, mbid]);

            for (const mutualId of hcbzIds) {
                await tx.run(
                    `INSERT INTO gjj_ywbzkhc (mbid, hcmbid, cjsj, gxsj) VALUES (:1, :2, ${SqlHelper.now(_adapter)}, ${SqlHelper.now(_adapter)})`,
                    [mbid, mutualId]
                );
                await tx.run(
                    `INSERT INTO gjj_ywbzkhc (mbid, hcmbid, cjsj, gxsj) VALUES (:1, :2, ${SqlHelper.now(_adapter)}, ${SqlHelper.now(_adapter)})`,
                    [mutualId, mbid]
                );
            }

            return { id: mbid };
        });

        res.json({ status: 0, msg: "保存成功", data: { id: savedId } });

    } catch (err) {
        logger.error(`Failed to save ywbzk: ${err.message}`);
        res.status(500).json({ status: 1, msg: err.message });
    }
});

/**
 * 4. 删除 (POST /delete)
 * 包含子表级联删除
 */
router.post('/delete', async (req, res) => {
    const { id } = req.body;
    const jgbh = req.body.jgbh || req.headers['jgbh'] || req.headers['zzbs'] || '';
    if (!id) {
        return res.status(400).json({ status: 1, msg: "ID is required" });
    }

    if (!isBusinessStandardMasterEnabled(req)) {
        return res.status(403).json({ status: 403, msg: getBusinessStandardWriteDeniedMessage() });
    }

    try {
        await db.getByJgbh(typeof jgbh !== 'undefined' ? jgbh : '').transaction(async (tx) => {
            await tx.run('DELETE FROM gjj_ywbzkhc WHERE mbid = :1 OR hcmbid = :2', [id, id]);
            await tx.run('DELETE FROM gjj_ywbzk WHERE id = :1', [id]);
        });
        res.json({ status: 0, msg: "删除成功" });
    } catch (err) {
        logger.error(`Failed to delete ywbzk: ${err.message}`);
        res.status(500).json({ status: 1, msg: err.message });
    }
});

router.post('/mutual-options', async (req, res) => {
    const { id, gjsjsf, ywnrfl } = req.body;
    const jgbh = req.body.jgbh || req.headers['jgbh'] || req.headers['zzbs'] || '';

    if (!gjsjsf || !ywnrfl) {
        return res.json({ status: 0, msg: "ok", data: [] });
    }

    try {
        let sql = `
            SELECT id as value, ywblbz as label, zdybm, ywblbzsm
            FROM gjj_ywbzk
            WHERE gjsjsf = ? AND ywnrfl = ?
        `;
        const params = [gjsjsf, ywnrfl];

        if (id) {
            sql += ' AND id <> ?';
            params.push(id);
        }

        sql += ' ORDER BY pxh ASC, id ASC';
        const rows = await db.getByJgbh(typeof jgbh !== 'undefined' ? jgbh : '').all(sql, params);
        res.json({ status: 0, msg: "ok", data: rows });
    } catch (err) {
        logger.error(`Failed to query mutual options: ${err.message}`);
        res.status(500).json({ status: 1, msg: err.message });
    }
});


// -----------------------------------------------------------------------------
// 获取当前机构是否允许维护业务标准库（基于 JWT 中 mechanismMmodel）
// -----------------------------------------------------------------------------
router.post('/mode', async (req, res) => {
    try {
        res.json({
            status: 0,
            msg: "ok",
            data: {
                business_standard_editable: isBusinessStandardMasterEnabled(req)
            }
        });
    } catch (err) {
        logger.error(`Get ywbzk mode failed: ${err.message}`);
        res.status(500).json({ status: 1, msg: err.message });
    }
});
/**
 * 5. 获取所有唯一的业务办理标准 (POST /standards)
 */
router.post('/standards', async (req, res) => {
    const jgbh = req.body.jgbh || req.headers['jgbh'] || req.headers['zzbs'] || '';
    try {
        const sql = "SELECT DISTINCT ywblbz as value, ywblbz as label FROM gjj_ywbzk WHERE ywblbz IS NOT NULL";
        const rows = await db.getByJgbh(typeof jgbh !== 'undefined' ? jgbh : '').all(sql, []);
        res.json({ status: 0, msg: "ok", data: rows });
    } catch (err) {
        res.status(500).json({ status: 1, msg: err.message });
    }
});

// -----------------------------------------------------------------------------
// 导出接口 (生成带 package 头的 .sql，时间戳文件名，写入导出历史)
// -----------------------------------------------------------------------------
router.all('/export', authenticateToken, async (req, res) => {
    const jgbh = req.body?.jgbh || req.query?.jgbh || req.headers['jgbh'] || req.headers['zzbs'] || '';
    const zjgbh = req.body?.zjgbh || req.query?.zjgbh || req.headers['zjgbh'] || req.headers['zzjgdmz'] || '';
    try {
        const _adapter = db.getByJgbh(typeof jgbh !== 'undefined' ? jgbh : '');
        // 1. 获取所有数据
        const contentClasses = await _adapter.all("SELECT * FROM gjj_ywnrfl");
        const standards = await _adapter.all("SELECT * FROM gjj_ywbzk");
        const attributes = await _adapter.all("SELECT * FROM gjj_ywbzksx");
        const mutualStandards = await _adapter.all("SELECT * FROM gjj_ywbzkhc");

        // 2. 生成 SQL 正文（破坏性 DELETE + INSERT）
        let sqlBody = "-- 业务标准库全量导出正文 (业务内容分类 / 标准 / 属性 / 互斥)\n";
        sqlBody += "-- 警告：本脚本含全表 DELETE，仅允许在数据库客户端按运维流程执行\n\n";

        sqlBody += "DELETE FROM gjj_ywbzkhc;\n";
        sqlBody += "DELETE FROM gjj_ywbzksx;\n";
        sqlBody += "DELETE FROM gjj_ywbzk;\n";
        sqlBody += "DELETE FROM gjj_ywnrfl;\n\n";

        const formatValue = (val) => {
            if (val === null || val === undefined) return "NULL";
            if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`;
            if (val instanceof Date) {
                const yyyy = val.getFullYear();
                const mm = String(val.getMonth() + 1).padStart(2, '0');
                const dd = String(val.getDate()).padStart(2, '0');
                const hh = String(val.getHours()).padStart(2, '0');
                const mi = String(val.getMinutes()).padStart(2, '0');
                const ss = String(val.getSeconds()).padStart(2, '0');
                // 使用无冒号格式，避免 Oracle 驱动误判为绑定变量 (NJS-098)
                return `TO_DATE('${yyyy}${mm}${dd}${hh}${mi}${ss}', 'YYYYMMDDHH24MISS')`;
            }
            return val;
        };

        // 辅助函数：生成插入 SQL (支持 Oracle CLOB 字段的超长处理，避开 ORA-01704 错误和 PL/SQL 32K 字面量限制)
        const buildInsertStatement = (tableName, row, isOracle) => {
            const keys = Object.keys(row);
            const declareVars = [];
            const assignLines = [];
            const insertValues = [];

            let hasClobVar = false;
            let varIndex = 1;

            for (const key of keys) {
                const val = row[key];
                const formattedVal = formatValue(val);

                // 根据 UTF-8 字节数判断是否超过 3000 字节，规避 Oracle 单条 SQL 4000 字节限制
                if (isOracle && typeof val === 'string' && Buffer.byteLength(val, 'utf8') > 3000) {
                    const varName = `v_clob_${varIndex++}`;
                    declareVars.push(`    ${varName} CLOB;`);

                    // 使用 Array.from 确保按真正的 Unicode 字符拆分，防止 Emoji 截断和代理对计数错误
                    const chars = Array.from(val);
                    const chunks = [];
                    const chunkSize = 1000;
                    for (let i = 0; i < chars.length; i += chunkSize) {
                        chunks.push(chars.slice(i, i + chunkSize).join(''));
                    }

                    // 第一段直接初始化赋值
                    const escapedChunk0 = chunks[0].replace(/'/g, "''");
                    assignLines.push(`    ${varName} := '${escapedChunk0}';`);

                    // 剩余段使用 dbms_lob.writeappend 追加
                    for (let k = 1; k < chunks.length; k++) {
                        const escapedChunkK = chunks[k].replace(/'/g, "''");
                        const chunkLen = Array.from(chunks[k]).length;
                        assignLines.push(`    dbms_lob.writeappend(${varName}, ${chunkLen}, '${escapedChunkK}');`);
                    }

                    insertValues.push(varName);
                    hasClobVar = true;
                } else {
                    insertValues.push(formattedVal);
                }
            }

            if (isOracle && hasClobVar) {
                let sql = "DECLARE\n";
                sql += declareVars.join('\n') + '\n';
                sql += "BEGIN\n";
                sql += assignLines.join('\n') + '\n';
                sql += `    INSERT INTO ${tableName} (${keys.join(', ')}) VALUES (${insertValues.join(', ')});\n`;
                sql += "END;\n/\n";
                return sql;
            } else {
                return `INSERT INTO ${tableName} (${keys.join(', ')}) VALUES (${insertValues.join(', ')});\n`;
            }
        };

        const isOracle = SqlHelper.isOracleAdapter(_adapter);
        const dialect = isOracle
            ? 'oracle'
            : (typeof SqlHelper.isDmAdapter === 'function' && SqlHelper.isDmAdapter(_adapter)
                ? 'dm'
                : (String(_adapter?.dbType || _adapter?.type || '')));

        for (const row of contentClasses) {
            sqlBody += buildInsertStatement('gjj_ywnrfl', row, isOracle);
        }
        for (const row of standards) {
            sqlBody += buildInsertStatement('gjj_ywbzk', row, isOracle);
        }
        for (const row of attributes) {
            sqlBody += buildInsertStatement('gjj_ywbzksx', row, isOracle);
        }
        for (const row of mutualStandards) {
            sqlBody += buildInsertStatement('gjj_ywbzkhc', row, isOracle);
        }

        const recordCount = standards.length;
        const operator = req.user?.username || req.user?.name || '';
        const { content, contentSha256 } = assembleExportScript({
            packageType: PACKAGE_TYPES.YWBZK,
            scope: PACKAGE_SCOPES.FULL,
            executionMode: EXECUTION_MODES.DB_ONLY,
            jgbh,
            zjgbh,
            dialect: String(dialect || ''),
            recordCount,
            tables: YWBZK_TABLES,
            operator
        }, sqlBody);

        const exportFileName = buildExportFileName({
            packageType: PACKAGE_TYPES.YWBZK,
            scope: PACKAGE_SCOPES.FULL
        });
        const { filePath } = writeExportScript(exportFileName, content);

        try {
            await recordExportScript({
                packageType: PACKAGE_TYPES.YWBZK,
                packageScope: PACKAGE_SCOPES.FULL,
                fileName: exportFileName,
                contentSha256,
                recordCount,
                jgbh,
                zjgbh,
                dialect: String(dialect || ''),
                operator
            });
            const pruned = await pruneExportScripts(PACKAGE_TYPES.YWBZK, 30);
            for (const oldName of pruned) {
                if (!isAllowedExportHistoryName(oldName)) continue;
                const oldPath = path.join(getExportsDir(), path.basename(oldName));
                if (fs.existsSync(oldPath)) {
                    try { fs.unlinkSync(oldPath); } catch (_e) { /* ignore */ }
                }
            }
        } catch (histErr) {
            logger.warn(`Export history record failed: ${histErr.message}`);
        }

        logger.info(`Export SQL written to: ${filePath}`);
        const exportFileNameAscii = buildExportFileNameAscii({
            packageType: PACKAGE_TYPES.YWBZK,
            scope: PACKAGE_SCOPES.FULL
        });
        return sendExportDownload(res, filePath, exportFileName, exportFileNameAscii);

    } catch (err) {
        logger.error(`Export failed: ${err.message}`);
        res.status(500).json({ status: 1, msg: "导出失败: " + err.message });
    }
});

// -----------------------------------------------------------------------------
// 导出历史列表（标准库脚本管理）
// -----------------------------------------------------------------------------
router.get('/export_history', authenticateToken, async (req, res) => {
    try {
        const rows = await listExportScripts({
            packageType: PACKAGE_TYPES.YWBZK,
            limit: Number(req.query.limit) || 50
        });
        res.json({
            status: 0,
            data: {
                items: rows.map(r => ({
                    id: r.id,
                    package_type: r.package_type,
                    package_scope: r.package_scope,
                    file_name: r.file_name,
                    content_sha256: r.content_sha256,
                    record_count: r.record_count,
                    jgbh: r.jgbh,
                    zjgbh: r.zjgbh,
                    dialect: r.dialect,
                    operator: r.operator,
                    created_at: r.created_at
                }))
            }
        });
    } catch (err) {
        logger.error(`List export history failed: ${err.message}`);
        res.status(500).json({ status: 1, msg: '查询导出历史失败: ' + err.message });
    }
});

// -----------------------------------------------------------------------------
// 按历史记录下载标准库脚本
// -----------------------------------------------------------------------------
router.get('/export_history/:id/download', authenticateToken, async (req, res) => {
    try {
        const row = await getExportScriptById(req.params.id);
        if (!row || row.package_type !== PACKAGE_TYPES.YWBZK) {
            return res.status(404).json({ status: 404, msg: '导出记录不存在' });
        }
        if (!isAllowedExportHistoryName(row.file_name)) {
            return res.status(400).json({ status: 400, msg: '非法文件名' });
        }
        const fullPath = path.join(getExportsDir(), path.basename(row.file_name));
        if (!fs.existsSync(fullPath)) {
            return res.status(404).json({ status: 404, msg: '脚本文件已不在服务器，请重新导出' });
        }
        // 历史文件本身是中文名；ASCII 回退用关键词替换中文
        const asciiFallback = String(row.file_name)
            .replace(/业务标准库/g, 'BizStandard')
            .replace(/关键数据计算模型/g, 'KeyDataModel')
            .replace(/全量/g, 'full')
            .replace(/部分/g, 'partial')
            .replace(/[^ -~]/g, '_');
        return sendExportDownload(res, fullPath, row.file_name, asciiFallback);
    } catch (err) {
        logger.error(`Download export history failed: ${err.message}`);
        res.status(500).json({ status: 1, msg: '下载失败: ' + err.message });
    }
});

// -----------------------------------------------------------------------------
// 导入接口（永久禁用：标准库只能通过数据库客户端执行导出脚本）
// -----------------------------------------------------------------------------
router.post('/import', authenticateToken, upload.single('file'), async (req, res) => {
    return res.status(403).json({
        status: 403,
        msg: getBusinessStandardImportDisabledMessage()
    });
});

module.exports = router;
