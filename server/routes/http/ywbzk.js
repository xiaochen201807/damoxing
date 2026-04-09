/**
 * 业务标准库 CRUD 接口
 * 处理标准模板的增删改查
 */

const express = require('express');
const router = express.Router();
const db = require('../../db');
const SqlHelper = require('../../utils/sqlHelper');
const logger = require('../../utils/logger');
const { parseDialectSql, buildDialectSql, validateDialectSqlObject, DIALECT_LIST } = require('../../utils/sqlDialectHelper');
const {
    isBusinessStandardMasterEnabled,
    getBusinessStandardWriteDeniedMessage,
    getBusinessStandardImportDisabledMessage
} = require('../../utils/business-standard-access');
const algorithmConfig = require('../../utils/business-algorithms');
const multer = require('multer');
const { authenticateToken } = require('../../middleware/auth');
const fs = require('fs');
const path = require('path');

const upload = multer({ storage: multer.memoryStorage() });

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

        // 拆解 ywbzjg 方言
        row.ywbzjg_dialects = parseDialectSql(row.ywbzjg || row.YWBZJG);

        const sxSql = "SELECT * FROM gjj_ywbzksx WHERE mbid = ?";
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
router.post('/save', async (req, res) => {
    let {
        id,
        pxh,
        ywblbz,
        tsysxmc,
        tsysxdw,
        zdybm,
        ywbzz,
        ywbzjg,
        ywblbzsm,
        gjsjsf,
        ywnrfl,
        ywblfl,
        bzfl,
        ywblbzsxz,
        hcbzIds
    } = req.body;
    const { ywbzjg_dialects } = req.body;

    // 如果前端传入了方言对象，则组装为 JSON 字符串覆盖 ywbzjg
    if (ywbzjg_dialects && typeof ywbzjg_dialects === 'object') {
        validateDialectSqlObject(ywbzjg_dialects, '业务办理标准结果执行语句');
        ywbzjg = buildDialectSql(ywbzjg_dialects, '业务办理标准结果执行语句');
    } else if (typeof ywbzjg === 'string' && ywbzjg.trim().startsWith('[')) {
        parseDialectSql(ywbzjg, '业务办理标准结果执行语句');
    }
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
        ywblfl = ywblfl ? String(ywblfl) : '1';
        hcbzIds = normalizeIdList(hcbzIds);

        try {
            normalizedAttributeRows = normalizeBusinessStandardAttributeRows(ywblbzsxz);
        } catch (validationError) {
            return res.status(400).json({ status: 1, msg: validationError.message });
        }

        if (!['1', '2'].includes(ywblfl)) {
            return res.status(400).json({ status: 1, msg: `无效的业务办理分类编码: ${ywblfl}` });
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
                const updateSql = `UPDATE gjj_ywbzk SET pxh=:1, ywblbz=:2, tsysxmc=:3, tsysxdw=:4, zdybm=:5, ywbzz=:6, ywbzjg=:7, ywblbzsm=:8, gjsjsf=:9, ywnrfl=:10, ywblfl=:11, bzfl=:12, gxsj=${SqlHelper.now(_adapter)} WHERE id=:13`;
                await tx.run(updateSql, [
                    pxh,
                    ywblbz,
                    tsysxmc || null,
                    tsysxdw || null,
                    zdybm || null,
                    ywbzz,
                    ywbzjg,
                    ywblbzsm,
                    gjsjsf,
                    ywnrfl,
                    ywblfl,
                    bzfl,
                    id
                ]);
                await tx.run("DELETE FROM gjj_ywbzksx WHERE mbid = :1", [id]);
            } else {
                const insertSql = `INSERT INTO gjj_ywbzk (pxh, ywblbz, tsysxmc, tsysxdw, zdybm, ywbzz, ywbzjg, ywblbzsm, gjsjsf, ywnrfl, ywblfl, bzfl) VALUES (:1, :2, :3, :4, :5, :6, :7, :8, :9, :10, :11, :12)`;
                const insertResult = await tx.run(insertSql, [
                    pxh,
                    ywblbz,
                    tsysxmc || null,
                    tsysxdw || null,
                    zdybm || null,
                    ywbzz,
                    ywbzjg,
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
// 导出接口 (生成 CSV 单文件，包含 SQL 脚本以保证全量恢复)
// -----------------------------------------------------------------------------
router.all('/export', authenticateToken, async (req, res) => {
    const jgbh = req.body?.jgbh || req.query?.jgbh || req.headers['jgbh'] || req.headers['zzbs'] || '';
    // if (req.user?.role !== 'admin') {
    //     return res.status(403).json({ status: 403, msg: "无导出权限" });
    // }
    try {
        // 1. 获取所有数据
        const contentClasses = await db.getByJgbh(typeof jgbh !== 'undefined' ? jgbh : '').all("SELECT * FROM gjj_ywnrfl");
        const standards = await db.getByJgbh(typeof jgbh !== 'undefined' ? jgbh : '').all("SELECT * FROM gjj_ywbzk");
        const attributes = await db.getByJgbh(typeof jgbh !== 'undefined' ? jgbh : '').all("SELECT * FROM gjj_ywbzksx");
        const mutualStandards = await db.getByJgbh(typeof jgbh !== 'undefined' ? jgbh : '').all("SELECT * FROM gjj_ywbzkhc");

        // 2. 生成 SQL 脚本 (封装在 CSV 中)
        let sqlScript = "-- 业务标准全量导出 (包含业务内容分类表、标准表、属性表和互斥关系表)\n";
        sqlScript += `-- 导出时间: ${new Date().toLocaleString()}\n\n`;
        // sqlScript += "BEGIN TRANSACTION;\n\n"; // Oracle 不需要显式 BEGIN TRANSACTION

        // 清空旧数据
        sqlScript += "DELETE FROM gjj_ywbzkhc;\n";
        sqlScript += "DELETE FROM gjj_ywbzksx;\n";
        sqlScript += "DELETE FROM gjj_ywbzk;\n\n";
        sqlScript += "DELETE FROM gjj_ywnrfl;\n\n";

        // 辅助函数：格式化值
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

        // 插入业务内容分类表数据
        for (const row of contentClasses) {
            const keys = Object.keys(row);
            const values = Object.values(row).map(formatValue);
            sqlScript += `INSERT INTO gjj_ywnrfl (${keys.join(', ')}) VALUES (${values.join(', ')});\n`;
        }

        // 插入标准表数据
        for (const row of standards) {
            const keys = Object.keys(row);
            const values = Object.values(row).map(formatValue);
            sqlScript += `INSERT INTO gjj_ywbzk (${keys.join(', ')}) VALUES (${values.join(', ')});\n`;
        }

        // 插入属性表数据
        for (const row of attributes) {
            const keys = Object.keys(row);
            const values = Object.values(row).map(formatValue);
            sqlScript += `INSERT INTO gjj_ywbzksx (${keys.join(', ')}) VALUES (${values.join(', ')});\n`;
        }

        for (const row of mutualStandards) {
            const keys = Object.keys(row);
            const values = Object.values(row).map(formatValue);
            sqlScript += `INSERT INTO gjj_ywbzkhc (${keys.join(', ')}) VALUES (${values.join(', ')});\n`;
        }

        // sqlScript += "\nCOMMIT;"; // 导入时自动提交

        // 3. 落地到服务器磁盘
        const exportFileName = 'ywbzk_full_export.csv';
        const exportDir = path.join(__dirname, '../../exports');
        const exportPath = path.join(exportDir, exportFileName);

        // 确保目录存在
        if (!fs.existsSync(exportDir)) {
            fs.mkdirSync(exportDir, { recursive: true });
        }

        // 写入文件 (带 BOM)
        fs.writeFileSync(exportPath, '\ufeff' + sqlScript, 'utf8');
        logger.info(`Export CSV written to: ${exportPath}`);

        // 4. 触发下载
        res.set('Access-Control-Expose-Headers', 'Content-Disposition');
        return res.download(exportPath, exportFileName);

    } catch (err) {
        logger.error(`Export failed: ${err.message}`);
        res.status(500).json({ status: 1, msg: "导出失败: " + err.message });
    }
});

// -----------------------------------------------------------------------------
// 导入接口 (支持 CSV/SQL 单文件上传)
// -----------------------------------------------------------------------------
router.post('/import', authenticateToken, upload.single('file'), async (req, res) => {
    return res.status(403).json({
        status: 403,
        msg: getBusinessStandardImportDisabledMessage()
    });

    const jgbh = req.body?.jgbh || req.headers['jgbh'] || req.headers['zzbs'] || '';
    if (!req.file) {
        return res.status(400).json({ status: 1, msg: "请选择文件" });
    }

    try {
        let sqlContent = req.file.buffer.toString('utf8');

        // 移除可能存在的 BOM 头
        if (sqlContent.startsWith('\ufeff')) {
            sqlContent = sqlContent.slice(1);
        }

        // 先移除纯注释行，避免导出文件头部注释与首条 SQL 合并后被整段跳过
        sqlContent = sqlContent
            .split(/\r?\n/)
            .filter(line => !line.trim().startsWith('--'))
            .join('\n');

        // 简单的 SQL 检查
        if (!sqlContent.includes('INSERT INTO') && !sqlContent.includes('DELETE FROM')) {
            return res.status(400).json({ status: 1, msg: "文件内容格式不正确，未包含有效 SQL 语句" });
        }

        // 执行 SQL
        // await db.getByJgbh(typeof jgbh !== 'undefined' ? jgbh : '').exec(sqlContent);

        // 分割 SQL 语句并逐条执行 (能够正确处理字符串中的分号)
        const splitSqlStatements = (sql) => {
            const stmts = [];
            let buffer = '';
            let inQuote = false;

            for (let i = 0; i < sql.length; i++) {
                const char = sql[i];
                if (char === "'") {
                    // 处理转义引号 ''
                    if (inQuote && i + 1 < sql.length && sql[i + 1] === "'") {
                        buffer += "''";
                        i++;
                        continue;
                    }
                    inQuote = !inQuote;
                }

                if (char === ';' && !inQuote) {
                    const trimmed = buffer.trim();
                    if (trimmed) stmts.push(trimmed);
                    buffer = '';
                } else {
                    buffer += char;
                }
            }
            if (buffer.trim()) stmts.push(buffer.trim());
            return stmts;
        };

        const statements = splitSqlStatements(sqlContent);

        await db.getByJgbh(typeof jgbh !== 'undefined' ? jgbh : '').transaction(async (tx) => {
            for (const sql of statements) {
                // 跳过可能的事务控制语句
                if (['BEGIN TRANSACTION', 'COMMIT', 'ROLLBACK'].includes(sql.toUpperCase())) {
                    continue;
                }

                await tx.exec(sql);
            }
        });

        logger.info("Import successful");
        res.json({ status: 0, msg: "导入成功" });

    } catch (err) {
        logger.error(`Import failed: ${err.message}`);
        res.status(500).json({ status: 1, msg: "导入失败: " + err.message });
    }
});

module.exports = router;
