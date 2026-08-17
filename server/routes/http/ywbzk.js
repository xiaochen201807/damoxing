/**
 * 业务标准库 CRUD 接口
 * 处理标准模板的增删改查
 */

const express = require('express');
const router = express.Router();
const axios = require('axios');
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
    formatTimestamp,
    buildExportFileName,
    buildExportFileNameAscii,
    assembleExportScript,
    writeExportScript,
    writeExportBinary,
    sendExportDownload,
    getExportsDir,
    isAllowedExportHistoryName
} = require('../../utils/exportPackage');
const { buildAllDialectExportBodies } = require('../../utils/ywbzkExportSql');
const AdmZip = require('adm-zip');
const {
    DEFAULT_KEEP,
    recordExportScript,
    listExportScripts,
    getExportScriptById,
    pruneExportScripts
} = require('../../utils/exportScriptHistory');
const multer = require('multer');
const { authenticateToken } = require('../../middleware/auth');
const fs = require('fs');
const path = require('path');

/**
 * 解码可能被前端 encodeURIComponent 的姓名头
 */
function decodeHeaderName(value) {
    if (value == null) return '';
    let s = String(value).trim();
    if (!s) return '';
    try {
        // 可能被网关/代理多层编码，最多解两次
        for (let i = 0; i < 2; i++) {
            if (!/%[0-9A-Fa-f]{2}/.test(s)) break;
            const decoded = decodeURIComponent(s);
            if (decoded === s) break;
            s = decoded;
        }
    } catch (_e) {
        /* keep raw */
    }
    return s.trim();
}

function isReadableDisplayName(value) {
    const s = String(value == null ? '' : value).trim();
    if (!s) return false;
    // SSO 下 username 常为个人编号 grbh
    if (/^\d{6,}$/.test(s)) return false;
    return true;
}

function pickReadableName(...values) {
    for (const value of values) {
        const s = String(value == null ? '' : value).trim();
        if (isReadableDisplayName(s)) return s;
    }
    return '';
}

function getLoginTokenFromRequest(req) {
    const headers = req.headers || {};
    const body = req.body || {};
    const query = req.query || {};
    return String(
        headers['login-token']
        || headers.login_token
        || body.login_token
        || body.loginToken
        || query.login_token
        || query.loginToken
        || ''
    ).trim();
}

/**
 * JWT/请求头姓名为空时，用 login-token 调统一认证接口取 username
 * 域名从 GATEWAY_VALIDATE_URL 提取 origin，与 tools/cxgzkz 一致
 * GET {origin}/PT/business/token/getUserInfoViaToken?token=...
 */
async function fetchOperatorNameViaLoginToken(loginToken) {
    const token = String(loginToken || '').trim();
    if (!token) return '';

    let gatewayOrigin = '';
    try {
        gatewayOrigin = new URL(process.env.GATEWAY_VALIDATE_URL || '').origin;
    } catch (_e) {
        gatewayOrigin = '';
    }
    if (!gatewayOrigin) {
        logger.warn('[Export] GATEWAY_VALIDATE_URL 未配置，无法调用 getUserInfoViaToken 补全操作人');
        return '';
    }

    const url = `${gatewayOrigin}/PT/business/token/getUserInfoViaToken`;

    try {
        const response = await axios.get(url, {
            params: { token },
            timeout: 5000,
            validateStatus: () => true
        });
        const data = response?.data;
        if (!data || typeof data !== 'object') {
            logger.warn(`[Export] getUserInfoViaToken 无有效响应 status=${response?.status}`);
            return '';
        }

        // 优先取根级 username（业务要求）；再尝试 userinfo JSON 内姓名
        let fromUserinfo = '';
        if (typeof data.userinfo === 'string' && data.userinfo) {
            try {
                const ui = JSON.parse(data.userinfo);
                fromUserinfo = pickReadableName(
                    ui.username,
                    ui.xingming,
                    ui?.zzjgxx?.results?.personmsg?.[0]?.xingming,
                    ui?.zzjgxx?.results?.userData?.name
                );
            } catch (_e) {
                /* ignore parse error */
            }
        }

        const name = pickReadableName(data.username, fromUserinfo);
        if (name) {
            logger.info(`[Export] getUserInfoViaToken 解析操作人: ${name}`);
        } else {
            logger.warn('[Export] getUserInfoViaToken 未解析到可读姓名');
        }
        return name;
    } catch (err) {
        logger.warn(`[Export] getUserInfoViaToken 调用失败: ${err.message}`);
        return '';
    }
}

/**
 * 导出历史「操作人」展示名（同步路径，不含远端补全）：
 * 1) 请求头 xingming（前端从 gateway_info 透传）
 * 2) JWT 中的 nickname/xingming
 * 3) 请求体/查询里的 xingming
 * 4) 最后回退 username（SSO 下常为个人编号）
 */
function resolveExportOperator(req) {
    const headers = req.headers || {};
    const body = req.body || {};
    const query = req.query || {};
    const u = req.user || {};

    const fromHeader = decodeHeaderName(
        headers.xingming || headers['x-xingming'] || headers['x-user-name'] || headers['x-nickname']
    );
    const fromBody = String(body.xingming || body.nickname || body.operator_name || query.xingming || '').trim();
    const candidates = [
        fromHeader,
        fromBody,
        u.nickname,
        u.xingming,
        u.name,
        u.realName,
        u.realname,
        u.displayName,
        u.username
    ]
        .map(v => (v == null ? '' : String(v).trim()))
        .filter(Boolean);

    const named = candidates.find(v => isReadableDisplayName(v));
    if (named) return named;
    return candidates[0] || '';
}

/**
 * 异步解析操作人：本地可读姓名优先；否则用 login-token 调 getUserInfoViaToken 取 username
 */
async function resolveExportOperatorAsync(req) {
    const local = resolveExportOperator(req);
    if (isReadableDisplayName(local)) {
        return local;
    }

    const loginToken = getLoginTokenFromRequest(req);
    if (!loginToken) {
        logger.warn('[Export] 操作人本地为空且无 login-token，回退编号');
        return local;
    }

    const remoteName = await fetchOperatorNameViaLoginToken(loginToken);
    if (isReadableDisplayName(remoteName)) {
        return remoteName;
    }
    return local;
}

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
// 导出接口
// 源数据通常在 Oracle 维护，但脚本要到 Oracle/OceanBase Oracle/达梦/PG/Gauss/Kingbase 执行：
// 按目标方言生成多份 SQL，并打包 zip 下载（内含各方言 .sql + README）
// -----------------------------------------------------------------------------
router.all('/export', authenticateToken, async (req, res) => {
    const jgbh = req.body?.jgbh || req.query?.jgbh || req.headers['jgbh'] || req.headers['zzbs'] || '';
    const zjgbh = req.body?.zjgbh || req.query?.zjgbh || req.headers['zjgbh'] || req.headers['zzjgdmz'] || '';
    try {
        const _adapter = db.getByJgbh(typeof jgbh !== 'undefined' ? jgbh : '');
        // 1. 获取所有数据（与源库类型无关，只取数据）
        const contentClasses = await _adapter.all("SELECT * FROM gjj_ywnrfl");
        const standards = await _adapter.all("SELECT * FROM gjj_ywbzk");
        const attributes = await _adapter.all("SELECT * FROM gjj_ywbzksx");
        const mutualStandards = await _adapter.all("SELECT * FROM gjj_ywbzkhc");

        const datasets = { contentClasses, standards, attributes, mutualStandards };
        const dialectBodies = buildAllDialectExportBodies(datasets);
        const recordCount = standards.length;
        const operator = await resolveExportOperatorAsync(req);
        const sourceDialect = String(
            _adapter?.adapterType || _adapter?.type || _adapter?.dbType || _adapter?.constructor?.name || 'unknown'
        );
        const exportTs = formatTimestamp();
        const dialectKeys = dialectBodies.map(d => d.key).join(',');

        logger.info(
            `[Export] ywbzk multi-dialect package: source=${sourceDialect}, targets=${dialectKeys}, rows=${recordCount}, operator="${operator}"`
        );

        // 2. 为每个目标方言生成带 package 头的 SQL，并打入 zip
        const zip = new AdmZip();
        const sqlFiles = [];
        const contentHashes = [];

        for (const item of dialectBodies) {
            const { content, contentSha256 } = assembleExportScript({
                packageType: PACKAGE_TYPES.YWBZK,
                scope: PACKAGE_SCOPES.FULL,
                executionMode: EXECUTION_MODES.DB_ONLY,
                jgbh,
                zjgbh,
                dialect: item.key,
                recordCount,
                tables: YWBZK_TABLES,
                operator
            }, item.sqlBody);

            // zip 内使用稳定短文件名，便于运维挑选
            const entryName = `ywbzk_full_${item.fileSuffix}.sql`;
            zip.addFile(entryName, Buffer.from(`\ufeff${content}`, 'utf8'));
            sqlFiles.push({
                dialect: item.key,
                label: item.label,
                entryName,
                contentSha256
            });
            contentHashes.push(`${item.key}:${contentSha256}`);
        }

        const readmeLines = [
            '业务标准库全量导出（多方言包）',
            '================================',
            '',
            `导出时间戳: ${exportTs}`,
            `源库适配器: ${sourceDialect}`,
            `标准条数: ${recordCount}`,
            `操作人: ${operator || '-'}`,
            `机构: jgbh=${jgbh || '-'} zjgbh=${zjgbh || '-'}`,
            '',
            '使用说明：',
            '1. 在标准库主环境完成维护后导出本压缩包；',
            '2. 按目标环境选择对应方言脚本执行：',
            ...sqlFiles.map(f => `   - ${f.entryName}  →  ${f.label} (${f.dialect})`),
            '3. 脚本含全表 DELETE，执行前请备份目标库；',
            '4. 禁止在「关键数据计算模型」页面导入本包内任何脚本；',
            '5. Oracle/OceanBase Oracle/达梦超长字段使用 CLOB 分段写入；PG/Gauss/Kingbase 使用 dollar-quote 或拼接。',
            '',
            '各方言脚本 content-sha256：',
            ...sqlFiles.map(f => `   - ${f.entryName}: ${f.contentSha256}`),
            ''
        ];
        zip.addFile('README.txt', Buffer.from(readmeLines.join('\n'), 'utf8'));

        const zipBuffer = zip.toBuffer();
        const packageSha256 = require('crypto').createHash('sha256').update(zipBuffer).digest('hex');

        const exportFileName = buildExportFileName({
            packageType: PACKAGE_TYPES.YWBZK,
            scope: PACKAGE_SCOPES.FULL,
            dialect: '多方言',
            timestamp: exportTs,
            extension: 'zip'
        });
        const exportFileNameAscii = buildExportFileNameAscii({
            packageType: PACKAGE_TYPES.YWBZK,
            scope: PACKAGE_SCOPES.FULL,
            dialect: 'multidialect',
            timestamp: exportTs,
            extension: 'zip'
        });
        const { filePath } = writeExportBinary(exportFileName, zipBuffer);

        try {
            await recordExportScript({
                packageType: PACKAGE_TYPES.YWBZK,
                packageScope: PACKAGE_SCOPES.FULL,
                fileName: exportFileName,
                contentSha256: packageSha256,
                recordCount,
                jgbh,
                zjgbh,
                dialect: `multi(${dialectKeys});source=${sourceDialect}`,
                operator
            });
            // 最多保留 200 条历史，同步删除磁盘上的旧脚本
            const pruned = await pruneExportScripts(PACKAGE_TYPES.YWBZK, DEFAULT_KEEP);
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

        logger.info(`Export ZIP written to: ${filePath}, sha256=${packageSha256}, files=${sqlFiles.map(f => f.entryName).join(',')}`);
        return sendExportDownload(res, filePath, exportFileName, exportFileNameAscii);

    } catch (err) {
        logger.error(`Export failed: ${err.message}`);
        res.status(500).json({ status: 1, msg: "导出失败: " + err.message });
    }
});

// -----------------------------------------------------------------------------
// 导出历史列表（标准库脚本管理）
// 兼容 GET/POST；支持 page/perPage 分页，总量上限 200
// -----------------------------------------------------------------------------
async function handleExportHistoryList(req, res) {
    try {
        const src = { ...(req.query || {}), ...(req.body || {}) };
        // AMIS CRUD 常见分页字段：page / perPage
        const page = Number(src.page) || 1;
        const perPage = Number(src.perPage || src.pageSize || src.limit) || 10;
        const result = await listExportScripts({
            packageType: PACKAGE_TYPES.YWBZK,
            page,
            perPage
        });
        const items = result.items || [];
        res.json({
            status: 0,
            msg: '',
            data: {
                items,
                rows: items,
                total: result.total,
                count: result.total,
                page: result.page,
                perPage: result.perPage
            }
        });
    } catch (err) {
        logger.error(`List export history failed: ${err.message}`);
        res.json({
            status: 1,
            msg: '查询导出历史失败: ' + (err.message || '未知错误'),
            data: { items: [], rows: [], total: 0, count: 0, page: 1, perPage: 10 }
        });
    }
}
router.get('/export_history', authenticateToken, handleExportHistoryList);
router.post('/export_history', authenticateToken, handleExportHistoryList);

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
            return res.status(404).json({
                status: 404,
                msg: `脚本文件已不在服务器（${row.file_name}），请重新执行全量导出后再下载`
            });
        }
        const asciiFallback = String(row.file_name)
            .replace(/业务标准库/g, 'BizStandard')
            .replace(/关键数据计算模型/g, 'KeyDataModel')
            .replace(/全量/g, 'full')
            .replace(/部分/g, 'partial')
            .replace(/[^\x20-\x7E]/g, '_');
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
