/**
 * 业务标准 (规则) CRUD 接口
 * 处理具体业务规则的配置，支持从标准库同步
 */

const express = require('express');
const router = express.Router();
const axios = require('axios');
const db = require('../../db');
const SqlHelper = require('../../utils/sqlHelper');
const logger = require('../../utils/logger');
const { authenticateToken } = require('../../middleware/auth');
const algorithmConfig = require('../../utils/business-algorithms');
const { getAlgorithmDispatchMeta, buildDebugDispatchTip } = require('../../utils/business-algorithm-dispatch');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

// 配置 Multer 内存存储，用于处理文件上传
const upload = multer({ storage: multer.memoryStorage() });

function formatConflictMessage(rows) {
    if (!rows || rows.length === 0) {
        return '';
    }

    return rows
        .map(row => {
            const left = row.mbid_label || row.MBID_LABEL || row.left_label || row.LEFT_LABEL || row.mbid || row.MBID;
            const right = row.hcmbid_label || row.HCMBID_LABEL || row.right_label || row.RIGHT_LABEL || row.hcmbid || row.HCMBID;
            return `${left} 与 ${right}`;
        })
        .join('；');
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

function normalizeSelectionIds(input) {
    if (Array.isArray(input)) {
        return [...new Set(
            input
                .map(item => String(item).trim())
                .filter(Boolean)
        )];
    }

    if (isBlankValue(input)) {
        return [];
    }

    return [...new Set(
        String(input)
            .split(',')
            .map(item => item.trim())
            .filter(Boolean)
    )];
}

function extractSelectedIdsFromAiResult(payload, candidateIds) {
    const candidateIdSet = new Set(
        (candidateIds || [])
            .map(id => Number(id))
            .filter(id => !Number.isNaN(id))
    );
    const summaryParts = [];

    const collectIds = (value) => {
        if (Array.isArray(value)) {
            return value.flatMap(item => collectIds(item));
        }

        if (value && typeof value === 'object') {
            if (Array.isArray(value.selectedIds)) {
                return collectIds(value.selectedIds);
            }
            if (Array.isArray(value.ids)) {
                return collectIds(value.ids);
            }
            if (Array.isArray(value.matchedIds)) {
                return collectIds(value.matchedIds);
            }
            if (Array.isArray(value.recommendationIds)) {
                return collectIds(value.recommendationIds);
            }
            if (Array.isArray(value.items)) {
                return value.items.flatMap(item => {
                    if (typeof item === 'object' && item && (item.selected === true || item.checked === true || item.recommended === true)) {
                        return collectIds(item.id || item.value || item.mbid);
                    }
                    return collectIds(item);
                });
            }
            return [];
        }

        if (isBlankValue(value)) {
            return [];
        }

        const rawValue = String(value).trim();
        if (rawValue.includes(',') || rawValue.includes('，') || rawValue.includes('\n')) {
            return rawValue
                .split(/[\s,，]+/)
                .map(item => item.trim())
                .filter(Boolean);
        }

        return [rawValue];
    };

    const collectSummary = (value) => {
        if (!value || typeof value !== 'object') {
            return;
        }

        ['summary', 'message', 'reason', 'reasoning', 'analysis', 'comment'].forEach(key => {
            const current = value[key];
            if (!isBlankValue(current) && typeof current !== 'object') {
                summaryParts.push(String(current).trim());
            }
        });
    };

    collectSummary(payload);
    if (payload && typeof payload === 'object') {
        collectSummary(payload.data);
        collectSummary(payload.result);
        collectSummary(payload.outputs);
    }

    const selectedIds = [...new Set(
        collectIds(payload)
            .map(id => Number(id))
            .filter(id => !Number.isNaN(id))
            .filter(id => candidateIdSet.has(id))
    )];

    return {
        selectedIds,
        summary: [...new Set(summaryParts.filter(Boolean))].join('\n')
    };
}

async function getBusinessRuleFieldOrder(adapter, mbid) {
    if (!mbid) {
        return [];
    }

    const schemaRows = await adapter.all(
        "SELECT ywblbzsx FROM gjj_ywbzksx WHERE mbid = ? ORDER BY id ASC",
        [mbid]
    );

    return schemaRows
        .map(row => getDefinedValue(row, 'ywblbzsx', 'YWBLBZSX'))
        .filter(Boolean);
}

async function resolveBusinessRuleFieldOrder(adapter, ruleId, mbid) {
    let resolvedMbid = mbid;

    if (!resolvedMbid && ruleId) {
        const ruleRow = await adapter.get("SELECT mbid FROM gjj_ywbz WHERE id = ?", [ruleId]);
        resolvedMbid = getDefinedValue(ruleRow, 'mbid', 'MBID');
    }

    return getBusinessRuleFieldOrder(adapter, resolvedMbid);
}

function appendRuleParamsByFieldOrder(params, rowData, fieldOrder) {
    let kIndex = 1;

    if (fieldOrder.length > 0) {
        for (const fieldName of fieldOrder) {
            if (kIndex > 10) {
                break;
            }

            params.push(fieldName, rowData[fieldName] !== undefined ? rowData[fieldName] : null);
            kIndex++;
        }
    } else {
        Object.keys(rowData).forEach(key => {
            if (key !== 'result' && key !== 'id' && kIndex <= 10) {
                params.push(key, rowData[key]);
                kIndex++;
            }
        });
    }

    while (kIndex <= 10) {
        params.push(null, null);
        kIndex++;
    }
}

function applyCurrentRuleValue(cleanedValues, currentRuleValue) {
    if (isBlankValue(currentRuleValue)) {
        return cleanedValues;
    }

    if (cleanedValues.length === 0) {
        return [{ result: currentRuleValue }];
    }

    if (cleanedValues.length === 1 && isBlankValue(cleanedValues[0].result)) {
        return [{
            ...cleanedValues[0],
            result: currentRuleValue
        }];
    }

    return cleanedValues;
}

function buildDisplayBusinessStandardName(templateName, publicParamValue) {
    const rawTemplateName = isBlankValue(templateName) ? '' : String(templateName);

    if (!rawTemplateName.includes('X') || isBlankValue(publicParamValue)) {
        return rawTemplateName;
    }

    return rawTemplateName.replace(/X/g, String(publicParamValue));
}

async function loadPublicParamValueMap(publicParamIds, organizationNumber, zjgbh, headers = {}) {
    const valueMap = {};
    const distinctParamIds = [...new Set(
        (publicParamIds || [])
            .filter(paramId => !isBlankValue(paramId))
            .map(paramId => String(paramId).trim())
            .filter(Boolean)
    )];

    if (distinctParamIds.length === 0) {
        return valueMap;
    }

    await Promise.all(distinctParamIds.map(async (paramId) => {
        try {
            const result = await fetchPublicParamValue(paramId, organizationNumber || '', zjgbh || '', headers);
            const paramValue = getDefinedValue(result, 'value', 'VALUE');

            if (!isBlankValue(paramValue)) {
                valueMap[paramId] = String(paramValue);
            }
        } catch (err) {
            logger.warn(`[Public Param] Failed to fetch value for ${paramId}: ${err.message}`);
        }
    }));

    return valueMap;
}

function getRequestJgbh(req) {
    return req.body?.jgbh || req.query?.jgbh || req.headers['jgbh'] || req.headers['zzbs'] || '';
}

function getRequestZjgbh(req) {
    return req.body?.zjgbh || req.query?.zjgbh || req.headers['zjgbh'] || req.headers['zzjgdmz'] || '';
}

function getRequestCreatorName(req) {
    return req.body?.creator_name
        || req.headers['xm']
        || req.headers['user-name']
        || req.headers['username']
        || req.headers['userid']
        || req.headers['operator-name']
        || '';
}

async function buildSelectionListData({
    adapter,
    ywblbz,
    ywblbzsm,
    gjsjsf,
    ywnrfl,
    queryJgbh,
    queryZjgbh,
    headers = {}
}) {
    let standardsSql = "SELECT * FROM gjj_ywbzk WHERE 1=1";
    const standardsParams = [];

    if (ywblbz) {
        standardsSql += " AND ywblbz LIKE ?";
        standardsParams.push(`%${ywblbz}%`);
    }
    if (ywblbzsm) {
        standardsSql += " AND ywblbzsm LIKE ?";
        standardsParams.push(`%${ywblbzsm}%`);
    }
    if (gjsjsf) {
        standardsSql += " AND gjsjsf = ?";
        standardsParams.push(gjsjsf);
    }
    if (ywnrfl) {
        standardsSql += " AND ywnrfl = ?";
        standardsParams.push(ywnrfl);
    }

    standardsSql += " ORDER BY pxh ASC, id DESC";

    const coalesce = 'COALESCE';
    let selectedSql = `
        SELECT DISTINCT mbid FROM gjj_ywbz 
        WHERE ${coalesce}(jgbh, '') = ? 
        AND ${coalesce}(zjgbh, '') = ?
    `;
    const selectedParams = [queryJgbh, queryZjgbh];

    if (gjsjsf && gjsjsf.trim() !== '') {
        selectedSql += ` AND ${coalesce}(ywsf, '') = ?`;
        selectedParams.push(gjsjsf);
    }
    if (ywnrfl && ywnrfl.trim() !== '') {
        selectedSql += ` AND ${coalesce}(ywnrfl, '') = ?`;
        selectedParams.push(ywnrfl);
    }

    const standards = await adapter.all(standardsSql, standardsParams);
    const selectedRows = await adapter.all(selectedSql, selectedParams);
    const standardIds = standards.map(item => item.id || item.ID);
    let mutualRows = [];

    if (standardIds.length > 0) {
        const placeholders = standardIds.map(() => '?').join(',');
        mutualRows = await adapter.all(
            `
                SELECT h.mbid, h.hcmbid, t.ywblbz as hc_label
                FROM gjj_ywbzkhc h
                INNER JOIN gjj_ywbzk t ON t.id = h.hcmbid
                WHERE h.mbid IN (${placeholders})
            `,
            standardIds
        );
    }

    const publicParamValueMap = await loadPublicParamValueMap(
        standards
            .filter(item => {
                const templateName = getDefinedValue(item, 'ywblbz', 'YWBLBZ');
                const publicParamId = getDefinedValue(item, 'ywbzz', 'YWBZZ');
                return !isBlankValue(publicParamId)
                    && !isBlankValue(templateName)
                    && String(templateName).includes('X');
            })
            .map(item => getDefinedValue(item, 'ywbzz', 'YWBZZ')),
        queryJgbh,
        queryZjgbh,
        headers
    );

    const selectedIds = new Set(selectedRows.map(row => Number(row.mbid || row.MBID)));
    const mutualMap = new Map();

    mutualRows.forEach(row => {
        const key = Number(row.mbid || row.MBID);
        const current = mutualMap.get(key) || [];
        current.push({
            id: Number(row.hcmbid || row.HCMBID),
            label: row.hc_label || row.HC_LABEL
        });
        mutualMap.set(key, current);
    });

    const items = standards.map(item => {
        const itemId = Number(getDefinedValue(item, 'id', 'ID'));
        const publicParamId = getDefinedValue(item, 'ywbzz', 'YWBZZ');
        const publicParamValue = isBlankValue(publicParamId)
            ? ''
            : publicParamValueMap[String(publicParamId).trim()];

        return {
            ...item,
            display_ywblbz: buildDisplayBusinessStandardName(
                getDefinedValue(item, 'ywblbz', 'YWBLBZ'),
                publicParamValue
            ),
            checked: selectedIds.has(itemId),
            mutualIds: (mutualMap.get(itemId) || []).map(row => row.id),
            mutualLabels: (mutualMap.get(itemId) || []).map(row => row.label),
            disabled: !selectedIds.has(itemId) && (mutualMap.get(itemId) || []).some(row => selectedIds.has(Number(row.id)))
        };
    });

    return {
        items,
        selectedIds: Array.from(selectedIds),
        total: items.length
    };
}

async function syncBusinessRuleSelections({
    adapter,
    syncIds,
    jgbh,
    zjgbh,
    ywsf,
    ywnrfl,
    headers = {}
}) {
    const coalesce = 'COALESCE';
    let existingSql = `
        SELECT id, mbid FROM gjj_ywbz 
        WHERE ${coalesce}(jgbh, '') = ? 
        AND ${coalesce}(zjgbh, '') = ?
    `;
    const existingParams = [jgbh, zjgbh];

    if (ywsf && ywsf.trim() !== '') {
        existingSql += ` AND ${coalesce}(ywsf, '') = ?`;
        existingParams.push(ywsf);
    }
    if (ywnrfl && ywnrfl.trim() !== '') {
        existingSql += ` AND ${coalesce}(ywnrfl, '') = ?`;
        existingParams.push(ywnrfl);
    }

    const existingRows = await adapter.all(existingSql, existingParams);
    const selectedMbids = new Set(normalizeSelectionIds(syncIds).map(String));

    if (selectedMbids.size > 1) {
        const selectedIdList = Array.from(selectedMbids);
        const placeholders = selectedIdList.map(() => '?').join(',');
        const mutualRows = await adapter.all(
            `
                SELECT DISTINCT h.mbid, h.hcmbid, t1.ywblbz as mbid_label, t2.ywblbz as hcmbid_label
                FROM gjj_ywbzkhc h
                INNER JOIN gjj_ywbzk t1 ON t1.id = h.mbid
                INNER JOIN gjj_ywbzk t2 ON t2.id = h.hcmbid
                WHERE h.mbid IN (${placeholders})
                AND h.hcmbid IN (${placeholders})
                AND h.mbid < h.hcmbid
            `,
            [...selectedIdList, ...selectedIdList]
        );

        if (mutualRows.length > 0) {
            throw new Error(`存在互斥业务办理标准，不能同时同步：${formatConflictMessage(mutualRows)}`);
        }
    }

    const idsToDelete = [];
    existingRows.forEach(row => {
        const mbid = String(row.mbid || row.MBID);
        if (!selectedMbids.has(mbid)) {
            idsToDelete.push(row.id || row.ID);
        }
    });

    const existingMbids = new Set(existingRows.map(r => String(r.mbid || r.MBID)));
    const mbidsToInsert = [];
    for (const mbid of selectedMbids) {
        if (!existingMbids.has(mbid)) {
            mbidsToInsert.push(mbid);
        }
    }

    if (idsToDelete.length > 0) {
        const placeholders = idsToDelete.map(() => '?').join(',');
        await adapter.run(
            `DELETE FROM gjj_ywbzsx WHERE ywid IN (SELECT id FROM gjj_ywbz WHERE id IN (${placeholders}) AND ${coalesce}(jgbh, '') = ? AND ${coalesce}(zjgbh, '') = ?)`,
            [...idsToDelete, jgbh, zjgbh]
        );
        await adapter.run(
            `DELETE FROM gjj_ywbz WHERE id IN (${placeholders}) AND ${coalesce}(jgbh, '') = ? AND ${coalesce}(zjgbh, '') = ?`,
            [...idsToDelete, jgbh, zjgbh]
        );
    }

    let insertCount = 0;
    if (mbidsToInsert.length > 0) {
        const placeholders = mbidsToInsert.map(() => '?').join(',');
        const templates = await adapter.all(`SELECT * FROM gjj_ywbzk WHERE id IN (${placeholders})`, mbidsToInsert);
        const publicParamValuesMap = {};
        const distinctPublicParamIds = [...new Set(templates.map(t => t.ywbzz).filter(id => id))];

        if (distinctPublicParamIds.length > 0) {
            await Promise.all(distinctPublicParamIds.map(async (paramId) => {
                try {
                    const result = await fetchPublicParamValue(paramId, jgbh, zjgbh, headers);
                    if (result && result.value) {
                        publicParamValuesMap[paramId] = result.value;
                    }
                } catch (e) {
                    logger.warn(`Batch Sync: Failed to pre-fetch public param value for ${paramId}: ${e.message}`);
                }
            }));
        }

        for (const tpl of templates) {
            const fetchedYwbzzValue = tpl.ywbzz ? (publicParamValuesMap[tpl.ywbzz] || '') : null;

            await adapter.transaction(async (tx) => {
                const insertSql = `
                    INSERT INTO gjj_ywbz (mbid, gzmc, ywsf, ywnrfl, sfqy, jgbh, zjgbh, ywbzz)
                    VALUES (?, ?, ?, ?, 1, ?, ?, ?)
                `;
                await tx.run(insertSql, [tpl.id, tpl.ywblbz, tpl.gjsjsf, tpl.ywnrfl, jgbh, zjgbh, fetchedYwbzzValue]);
            });
            insertCount++;
        }
    }

    return {
        insertCount,
        deleteCount: idsToDelete.length,
        keepCount: existingRows.length - idsToDelete.length
    };
}

function stringifyJson(value) {
    return JSON.stringify(value, null, 2);
}

function parseJsonPayload(payload) {
    if (typeof payload === 'string') {
        const trimmed = payload.trim();
        if (!trimmed) {
            throw new Error('请求参数 JSON 不能为空');
        }

        return JSON.parse(trimmed);
    }

    if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
        return payload;
    }

    throw new Error('请求参数必须为 JSON 对象或 JSON 字符串');
}

function buildDebugCaseLabel(row) {
    const caseName = getDefinedValue(row, 'case_name', 'CASE_NAME') || '未命名案例';
    const ywsf = getDefinedValue(row, 'ywsf', 'YWSF');
    const ywnrfl = getDefinedValue(row, 'ywnrfl', 'YWNRFL');
    const resultSummary = getDefinedValue(row, 'result_summary', 'RESULT_SUMMARY');
    const creatorName = getDefinedValue(row, 'creator_name', 'CREATOR_NAME');
    const createdAt = getDefinedValue(row, 'cjsj', 'CJSJ');
    const parts = [caseName];

    if (!isBlankValue(ywsf)) {
        parts.push(`算法=${String(ywsf)}`);
    }

    if (!isBlankValue(ywnrfl)) {
        parts.push(`分类=${String(ywnrfl)}`);
    }

    if (!isBlankValue(resultSummary)) {
        parts.push(String(resultSummary));
    }

    if (!isBlankValue(creatorName)) {
        parts.push(String(creatorName));
    }

    if (!isBlankValue(createdAt)) {
        parts.push(String(createdAt));
    }

    return parts.join(' | ');
}

function buildDebugTemplateResponseData(template, extra) {
    return Object.assign({}, template, extra || {}, { template });
}

function isPayloadParseError(err) {
    if (!err || typeof err.message !== 'string') {
        return false;
    }

    return err.message.includes('JSON') || err.message.includes('请求参数');
}

async function loadDebugTemplateFieldRows(adapter, { ywsf, ywnrfl, jgbh, zjgbh }) {
    const coalesce = 'COALESCE';
    let rows = [];

    if (!isBlankValue(ywsf)) {
        let sql = `
            SELECT DISTINCT s.id, s.ywblbzsx, s.sxbm
            FROM gjj_ywbz r
            INNER JOIN gjj_ywbzksx s ON s.mbid = r.mbid
            WHERE ${coalesce}(r.jgbh, '') = ?
              AND ${coalesce}(r.zjgbh, '') = ?
              AND ${coalesce}(r.ywsf, '') = ?
        `;
        const params = [jgbh || '', zjgbh || '', String(ywsf)];

        if (!isBlankValue(ywnrfl)) {
            sql += ` AND ${coalesce}(r.ywnrfl, '') = ?`;
            params.push(String(ywnrfl));
        }

        sql += ' ORDER BY s.id ASC';
        rows = await adapter.all(sql, params);

        if (rows.length === 0) {
            let fallbackSql = `
                SELECT DISTINCT s.id, s.ywblbzsx, s.sxbm
                FROM gjj_ywbzk t
                INNER JOIN gjj_ywbzksx s ON s.mbid = t.id
                WHERE ${coalesce}(t.gjsjsf, '') = ?
            `;
            const fallbackParams = [String(ywsf)];

            if (!isBlankValue(ywnrfl)) {
                fallbackSql += ` AND ${coalesce}(t.ywnrfl, '') = ?`;
                fallbackParams.push(String(ywnrfl));
            }

            fallbackSql += ' ORDER BY s.id ASC';
            rows = await adapter.all(fallbackSql, fallbackParams);
        }
    }

    return rows;
}

/**
 * 1. 获取列表 (POST /list)
 */
router.post('/list', async (req, res) => {
    const { page = 1, perPage = 10, gzmc, ywsf, ywnrfl } = req.body;
    const offset = (page - 1) * perPage;

    // 从请求头获取当前机构信息
    const jgbh = req.body.jgbh || req.headers['jgbh'] || req.headers['zzbs'] || '';
    const zjgbh = req.body.zjgbh || req.headers['zjgbh'] || req.headers['zzjgdmz'] || '';
    const coalesce = 'COALESCE';

    let sql = `
        SELECT t1.*, t2.ywblbz as template_name, t2.ywblbzsm as template_desc, COALESCE(t3.flmc, t2.ywnrfl, t1.ywnrfl) as ywnrfl_label, t2.bzfl as bzfl_label
        FROM gjj_ywbz t1
        LEFT JOIN gjj_ywbzk t2 ON t1.mbid = t2.id
        LEFT JOIN gjj_ywnrfl t3 ON t3.gjsjsf = t1.ywsf AND t3.flbm = t2.ywnrfl
        WHERE ${coalesce}(t1.jgbh, '') = ? AND ${coalesce}(t1.zjgbh, '') = ?
    `;
    let countSql = `
        SELECT COUNT(*) as total 
        FROM gjj_ywbz t1
        LEFT JOIN gjj_ywbzk t2 ON t1.mbid = t2.id
        WHERE ${coalesce}(t1.jgbh, '') = ? AND ${coalesce}(t1.zjgbh, '') = ?
    `;
    const params = [jgbh, zjgbh];

    if (gzmc) {
        sql += " AND t1.gzmc LIKE ?";
        countSql += " AND t1.gzmc LIKE ?";
        params.push(`%${gzmc}%`);
    }
    if (ywsf) {
        sql += " AND t1.ywsf = ?";
        countSql += " AND t1.ywsf = ?";
        params.push(ywsf);
    }
    if (ywnrfl) {
        sql += " AND t2.ywnrfl = ?";
        countSql += " AND t2.ywnrfl = ?";
        params.push(ywnrfl);
    }

    sql += " ORDER BY t1.ywsf ASC, t2.ywnrfl ASC, t2.bzfl ASC, t1.id DESC";
    const _adapter = db.getByJgbh(typeof jgbh !== 'undefined' ? jgbh : '');
    const paged = SqlHelper.paginateQuery(sql, params, perPage, offset, _adapter);

    try {
        const countRow = await _adapter.get(countSql, params);
        const rows = await _adapter.all(paged.sql, paged.params);
        const items = rows.map(row => ({
            ...row,
            display_ywblbz: buildDisplayBusinessStandardName(
                getDefinedValue(row, 'template_name', 'TEMPLATE_NAME'),
                getDefinedValue(row, 'ywbzz', 'YWBZZ')
            )
        }));

        res.json({
            status: 0,
            msg: "ok",
            data: {
                items,
                total: countRow ? (countRow.total || countRow.TOTAL) : 0
            }
        });
    } catch (err) {
        logger.error(`Failed to query ywbz: ${err.message}`);
        res.status(500).json({ status: 1, msg: err.message });
    }
});

/**
 * 2. 获取详情 (POST /get)
 */
router.post('/get', async (req, res) => {
    const { id, ywsf } = req.body;
    if (!id) return res.status(400).json({ status: 1, msg: "ID is required" });

    // 从请求头获取当前机构信息
    const jgbh = req.body.jgbh || req.headers['jgbh'] || req.headers['zzbs'] || '';
    const zjgbh = req.body.zjgbh || req.headers['zjgbh'] || req.headers['zzjgdmz'] || '';
    const coalesce = 'COALESCE';

    if (ywsf && !algorithmConfig.isValidAlgorithm(ywsf)) {
        return res.status(400).json({ status: 1, msg: `无效的关键数据算法编码: ${ywsf}` });
    }

    try {
        const sql = `SELECT * FROM gjj_ywbz WHERE id = ? AND ${coalesce}(jgbh, '') = ? AND ${coalesce}(zjgbh, '') = ?`;
        const row = await db.getByJgbh(typeof jgbh !== 'undefined' ? jgbh : '').get(sql, [id, jgbh, zjgbh]);

        if (!row) return res.status(404).json({ status: 1, msg: "Record not found" });

        const sxSql = "SELECT * FROM gjj_ywbzsx WHERE ywid = ?";
        const sxRows = await db.getByJgbh(typeof jgbh !== 'undefined' ? jgbh : '').all(sxSql, [id]);

        const attributes = [];
        sxRows.forEach(row => {
            for (let i = 1; i <= 10; i++) {
                const key = getDefinedValue(row, `k${i}`, `K${i}`);
                const value = getDefinedValue(row, `v${i}`, `V${i}`);
                if (!isBlankValue(key)) { // Oracle might return uppercase
                    attributes.push({
                        sxmc: key,
                        sxz: isBlankValue(value) ? '' : value
                    });
                }
            }
        });

        row.attributes = attributes;
        res.json({ status: 0, msg: "ok", data: row });
    } catch (err) {
        res.status(500).json({ status: 1, msg: err.message });
    }
});


/**
 * 配置表单协议 (POST /config_form) - 动态生成 AMIS 表单以配置规则参数
 * 用于“规则参数配置”操作，支持多行 Combo
 */
router.post('/config_form', async (req, res) => {
    const { id, mbid } = req.body; // 改为从 body 获取
    const jgbh = req.body.jgbh || req.headers['jgbh'] || req.headers['zzbs'] || '';

    if (!id || !mbid) {
        return res.json({
            status: 0,
            msg: "ok",
            data: {
                type: "alert",
                body: "缺少必要参数 (id 或 mbid)"
            }
        });
    }

    try {
        const _adapter = db.getByJgbh(typeof jgbh !== 'undefined' ? jgbh : '');
        const ruleSql = `
            SELECT t1.id, t1.mbid, t1.gzmc, t1.ywsf, t1.ywnrfl, t1.ywbzz,
                   t2.ywblbz as template_name, t2.ywblbzsm as template_desc
            FROM gjj_ywbz t1
            LEFT JOIN gjj_ywbzk t2 ON t1.mbid = t2.id
            WHERE t1.id = ?
        `;
        const ruleRow = await _adapter.get(ruleSql, [id]);

        if (!ruleRow) {
            return res.json({
                status: 0,
                msg: "ok",
                data: {
                    type: "alert",
                    body: "未找到对应业务规则"
                }
            });
        }

        const resolvedMbid = getDefinedValue(ruleRow, 'mbid', 'MBID') || mbid;

        // 1. 查询标准库定义的属性 (gjj_ywbzksx)
        const sqlSchema = `SELECT * FROM gjj_ywbzksx WHERE mbid = ? ORDER BY id ASC`;

        // 2. 查询已保存的属性值 (gjj_ywbzsx 宽表)
        const sqlValues = `
            SELECT * FROM gjj_ywbzsx 
            WHERE ywid = ? 
            ORDER BY row_index ASC, id ASC
        `;

        const schemaRows = await _adapter.all(sqlSchema, [resolvedMbid]);

        // ============================================================
        // gjj_ywbzksx 表字段实际含义说明（与字段名不完全一致）：
        //   sxbm       -> 实际存储：中文名称（如 "贷款情况"），用于显示
        //   ywblbzsx   -> 实际存储：程序化标识 / fieldIdentification（如 "page"），用于表单 name
        //   fwdxbq     -> 服务对象标签（如 "缴存人"），用于显示
        //   ywblbzdx   -> syObjectNumber，用于调用网关 API
        // ============================================================

        // 构建映射表：中文名称(sxbm) -> 程序化标识(ywblbzsx)
        // 用于回显时兼容旧数据（宽表 k 列可能存的是中文名称）
        const chineseNameToFieldId = {};
        schemaRows.forEach(row => {
            const chineseName = getDefinedValue(row, 'sxbm', 'SXBM');         // 中文名称
            const fieldId = getDefinedValue(row, 'ywblbzsx', 'YWBLBZSX');     // 程序化标识

            if (chineseName && fieldId) {
                chineseNameToFieldId[chineseName] = fieldId;
            }
        });

        const valueRows = await _adapter.all(sqlValues, [id]);

        // 将宽表结构 (k1,v1...) 还原为对象数组
        // 宽表 k 列可能存的是旧的中文名(sxbm)或新的程序化标识(ywblbzsx)
        // 统一转换为 ywblbzsx 作为 key，与表单 name 对应
        const cleanedValues = valueRows.map(row => {
            const item = {
                id: getDefinedValue(row, 'id', 'ID'),
                result: getDefinedValue(row, 'result', 'RESULT')
            };

            for (let i = 1; i <= 10; i++) {
                const k = getDefinedValue(row, `k${i}`, `K${i}`);
                const v = getDefinedValue(row, `v${i}`, `V${i}`);
                if (!isBlankValue(k)) {
                    // 如果 k 是中文名称，转换为程序化标识；否则原样使用
                    const key = chineseNameToFieldId[k] || k;
                    item[key] = isBlankValue(v) ? '' : v;
                }
            }
            return item;
        });

        const currentRuleValue = getDefinedValue(ruleRow, 'ywbzz', 'YWBZZ');
        const formValues = applyCurrentRuleValue(cleanedValues, currentRuleValue);

        // 动态构建 Combo 的内部 items (表单列)
        const comboItems = schemaRows.map(field => {
            const chineseName = getDefinedValue(field, 'sxbm', 'SXBM');             // 中文名称，如 "贷款情况"
            const displayLabel = getDefinedValue(field, 'fwdxbq', 'FWDXBQ');        // 服务对象标签，如 "缴存人"
            const syObjectNumber = getDefinedValue(field, 'ywblbzdx', 'YWBLBZDX');  // syObjectNumber
            const fieldId = getDefinedValue(field, 'ywblbzsx', 'YWBLBZSX');          // 程序化标识 / fieldIdentification

            // 标签组合：如 "缴存人-贷款情况"
            const label = (displayLabel && chineseName)
                ? `${displayLabel}-${chineseName}`
                : (displayLabel || chineseName || fieldId);

            if (isBlankValue(syObjectNumber)) {
                return {
                    type: "input-text",
                    name: fieldId,
                    label: label,
                    required: true,
                    clearable: true
                };
            }

            return {
                type: "select",
                name: fieldId,                   // 用程序化标识作为表单字段 name
                label: label,
                required: true,
                searchable: true,
                clearable: true,
                multiple: true,
                joinValues: true,
                source: {
                    method: "post",
                    url: `${process.env.API_ROUTE_PREFIX || '/api'}/tools/business-content-class-options`,
                    data: {
                        syObjectNumber: syObjectNumber || '',
                        fieldIdentification: fieldId   // 传给网关的 fieldIdentification
                    }
                }
            };
        });

        // 添加固定的 "结果" 列
        comboItems.push({
            type: "input-text",
            name: "result",
            label: "结果"
        });

        // 构建完整的 AMIS Schema
        res.json({
            status: 0,
            msg: "ok",
            data: {
                type: "form",
                title: "规则参数配置",
                wrapWithPanel: false,
                api: {
                    method: "post",
                    url: `${process.env.API_ROUTE_PREFIX || '/api'}/ywbz/save_params`,
                    data: {
                        id: id,
                        rules: "$rules" // 将 Combo 的数组数据命名为 rules 提交
                    }
                },
                body: [
                    {
                        type: "combo",
                        name: "rules", // 对应提交数据的 key
                        label: false,
                        multiple: true,
                        multiLine: true,
                        addable: true,
                        removable: true,
                        value: formValues, // 回填数据
                        items: comboItems
                    },
                    {
                        type: "hidden",
                        name: "id",
                        value: id
                    }
                ]
            }
        });
    } catch (err) {
        logger.error(err);
        res.status(500).json({ status: 1, msg: err.message });
    }
});

/**
 * 保存规则参数配置 (支持多行)
 * POST /save_params
 */
router.post('/save_params', async (req, res) => {
    const { id, rules } = req.body;
    const jgbh = req.body.jgbh || req.headers['jgbh'] || req.headers['zzbs'] || '';

    if (!id) {
        return res.json({ status: 1, msg: "缺少规则ID" });
    }

    if (!Array.isArray(rules)) {
        return res.json({ status: 1, msg: "参数格式错误 (rules 应为数组)" });
    }

    try {
        const _adapter = db.getByJgbh(typeof jgbh !== 'undefined' ? jgbh : '');
        const fieldOrder = await resolveBusinessRuleFieldOrder(_adapter, id, null);

        await _adapter.transaction(async (tx) => {
            // 1. 删除旧属性
            await tx.run("DELETE FROM gjj_ywbzsx WHERE ywid = :1", [id]);

            // 2. 插入新属性 (宽表结构：k1,v1...k10,v10)
            const columns = ['ywid', 'row_index', 'result'];
            for (let i = 1; i <= 10; i++) {
                columns.push(`k${i}`, `v${i}`);
            }
            let paramIndex = 1;
            const placeholders = columns.map(() => `:${paramIndex++}`).join(',');
            const insSql = `INSERT INTO gjj_ywbzsx (${columns.join(',')}) VALUES (${placeholders})`;

            for (let rowIndex = 0; rowIndex < rules.length; rowIndex++) {
                const row = rules[rowIndex];
                const params = [id, rowIndex, isBlankValue(row.result) ? '' : row.result];
                appendRuleParamsByFieldOrder(params, row, fieldOrder);

                await tx.run(insSql, params);
            }
        });

        res.json({ status: 0, msg: "保存成功" });
    } catch (err) {
        logger.error(`Failed to save_params: ${err.message}`);
        res.status(500).json({ status: 1, msg: "保存参数失败: " + err.message });
    }
});

/**
 * 3. 获取详情 (GET /:id) - 兼容 LoanBusinessStandard.json
 */
router.get('/:id(\\d+)', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const jgbh = req.query.jgbh || req.headers['jgbh'] || req.headers['zzbs'] || '';

    try {
        const sql = "SELECT * FROM gjj_ywbz WHERE id = ?";
        const row = await db.getByJgbh(typeof jgbh !== 'undefined' ? jgbh : '').get(sql, [id]);

        if (!row) return res.status(404).json({ status: 1, msg: "Record not found" });

        const sxSql = "SELECT * FROM gjj_ywbzsx WHERE ywid = ? ORDER BY row_index ASC, id ASC";
        const sxRows = await db.getByJgbh(typeof jgbh !== 'undefined' ? jgbh : '').all(sxSql, [id]);

        const rule_params = {};
        sxRows.forEach(row => {
            for (let i = 1; i <= 10; i++) {
                const key = getDefinedValue(row, `k${i}`, `K${i}`);
                const value = getDefinedValue(row, `v${i}`, `V${i}`);
                if (!isBlankValue(key)) {
                    rule_params[key] = isBlankValue(value) ? '' : value;
                }
            }
            const resultValue = getDefinedValue(row, 'result', 'RESULT');
            if (!isBlankValue(resultValue)) {
                rule_params.result = resultValue;
            }
        });

        row.rule_params = rule_params;
        res.json({ status: 0, msg: "ok", data: row });
    } catch (err) {
        res.status(500).json({ status: 1, msg: err.message });
    }
});

/**
 * 4. 保存 (POST /save)
 */
router.post('/save', async (req, res) => {
    const { id, mbid, gzmc, ywsf, gzljsm, yxj, sfqy, rule_params } = req.body;
    // rule_params alias for compatibility
    const attributes = rule_params;

    // 从请求头获取当前机构信息
    const jgbh = req.body.jgbh || req.headers['jgbh'] || req.headers['zzbs'] || '';
    const zjgbh = req.body.zjgbh || req.headers['zjgbh'] || req.headers['zzjgdmz'] || '';
    const coalesce = 'COALESCE';

    if (ywsf && !algorithmConfig.isValidAlgorithm(ywsf)) {
        return res.status(400).json({ status: 1, msg: `无效的关键数据算法编码: ${ywsf}` });
    }

    try {
        const _adapter = db.getByJgbh(typeof jgbh !== 'undefined' ? jgbh : '');
        const fieldOrder = await resolveBusinessRuleFieldOrder(_adapter, id, mbid);
        const { id: savedId } = await _adapter.transaction(async (tx) => {
            let ywid = id;
            if (id) {
                const updateSql = `UPDATE gjj_ywbz SET mbid=?, gzmc=?, ywsf=?, gzljsm=?, yxj=?, sfqy=?, gxsj=${SqlHelper.now(_adapter)} WHERE id=? AND ${coalesce}(jgbh, '') = ? AND ${coalesce}(zjgbh, '') = ?`;
                await tx.run(updateSql, [mbid, gzmc, ywsf, gzljsm, yxj, sfqy, id, jgbh, zjgbh]);
                await tx.run(`DELETE FROM gjj_ywbzsx WHERE ywid IN (SELECT id FROM gjj_ywbz WHERE id = ? AND ${coalesce}(jgbh, '') = ? AND ${coalesce}(zjgbh, '') = ?)`, [id, jgbh, zjgbh]);
            } else {
                const insertSql = `INSERT INTO gjj_ywbz (mbid, gzmc, ywsf, gzljsm, yxj, sfqy, jgbh, zjgbh) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
                const insertResult = await tx.run(insertSql, [mbid, gzmc, ywsf, gzljsm, yxj, sfqy, jgbh, zjgbh]);
                ywid = insertResult.lastID;
            }

            const attrs = attributes;
            if (attrs && typeof attrs === 'object') {
                const columns = ['ywid', 'row_index', 'result'];
                for (let i = 1; i <= 10; i++) {
                    columns.push(`k${i}`);
                    columns.push(`v${i}`);
                }
                const placeholders = columns.map(() => '?').join(',');
                const insSql = `INSERT INTO gjj_ywbzsx (${columns.join(',')}) VALUES (${placeholders})`;

                const insertRow = async (rowIndex, rowData) => {
                    const params = [ywid, rowIndex, isBlankValue(rowData.result) ? '' : rowData.result];
                    appendRuleParamsByFieldOrder(params, rowData, fieldOrder);
                    await tx.run(insSql, params);
                };

                if (Array.isArray(attrs)) {
                    for (let i = 0; i < attrs.length; i++) {
                        await insertRow(i, attrs[i]);
                    }
                } else {
                    await insertRow(0, attrs);
                }
            }

            return { id: ywid };
        });

        res.json({ status: 0, msg: "保存成功", data: { id: savedId } });

    } catch (err) {
        logger.error(`Failed to save ywbz: ${err.message}`);
        res.status(500).json({ status: 1, msg: err.message });
    }
});

/**
 * 5. PUT /:id - 兼容接口
 */
router.put('/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { mbid, gzmc, ywsf, gzljsm, yxj, sfqy, rule_params } = req.body;

    // 从请求头获取当前机构信息
    const jgbh = req.headers['jgbh'] || req.headers['zzbs'] || '';
    const zjgbh = req.headers['zjgbh'] || req.headers['zzjgdmz'] || '';
    const coalesce = 'COALESCE';

    try {
        const _adapter = db.getByJgbh(typeof jgbh !== 'undefined' ? jgbh : '');
        const fieldOrder = await resolveBusinessRuleFieldOrder(_adapter, id, mbid);
        await _adapter.transaction(async (tx) => {
            const updateSql = `
                UPDATE gjj_ywbz SET
                mbid = ?, gzmc = ?, ywsf = ?, gzljsm = ?, yxj = ?, sfqy = ?, gxsj = ${SqlHelper.now(_adapter)}
                WHERE id = ? AND ${coalesce}(jgbh, '') = ? AND ${coalesce}(zjgbh, '') = ?
            `;
            await tx.run(updateSql, [mbid, gzmc, ywsf, gzljsm, yxj, sfqy, id, jgbh, zjgbh]);

            await tx.run(`DELETE FROM gjj_ywbzsx WHERE ywid IN (SELECT id FROM gjj_ywbz WHERE id = ? AND ${coalesce}(jgbh, '') = ? AND ${coalesce}(zjgbh, '') = ?)`, [id, jgbh, zjgbh]);

            if (rule_params && typeof rule_params === 'object') {
                const columns = ['ywid', 'row_index', 'result'];
                for (let i = 1; i <= 10; i++) {
                    columns.push(`k${i}`);
                    columns.push(`v${i}`);
                }
                const placeholders = columns.map(() => '?').join(',');
                const insSql = `INSERT INTO gjj_ywbzsx (${columns.join(',')}) VALUES (${placeholders})`;

                const params = [id, 0, isBlankValue(rule_params.result) ? '' : rule_params.result];
                appendRuleParamsByFieldOrder(params, rule_params, fieldOrder);
                await tx.run(insSql, params);
            }
        });

        res.json({ status: 0, msg: "更新成功" });
    } catch (err) {
        res.status(500).json({ status: 1, msg: err.message });
    }
});

/**
 * 6. 批量同步 (POST /batch)
 * 从标准库模板同步到业务规则表
 */
const { fetchPublicParamValue } = require('../../services/gatewayService');

// ... (existing imports)

/**
 * 6. 批量同步 (POST /batch)
 * 从标准库模板同步到业务规则表
 */
router.post('/batch', async (req, res) => {
    logger.info(`Batch Sync Payload: ${JSON.stringify(req.body)}`);
    const { selected_ids, ids } = req.body; // 兼容 selected_ids 或 ids
    let syncIds = [];

    if (selected_ids) {
        syncIds = normalizeSelectionIds(selected_ids);
    } else if (ids) {
        syncIds = normalizeSelectionIds(ids);
    }

    logger.info(`Parsed syncIds: ${JSON.stringify(syncIds)}, Type: ${typeof syncIds}, IsArray: ${Array.isArray(syncIds)}`);

    if (!syncIds || syncIds.length === 0) {
        logger.warn('Batch Sync Failed: No valid IDs found');
        return res.status(400).json({ status: 1, msg: "请选择同步项" });
    }

    // 处理 jgbh 和 zjgbh 的默认值
    const jgbh = req.body.jgbh || '';
    const zjgbh = req.body.zjgbh || '';
    const ywsf = req.body.ywsf || '';
    const ywnrfl = req.body.ywnrfl || '';

    // 构造请求头，用于网关调用
    const headers = {
        'channel': req.headers['channel'] || '',
        'login-token': req.headers['login-token'] || '',
        'zzbs': req.headers['zzbs'] || '',
        'zzjgdmz': req.headers['zzjgdmz'] || ''
    };

    try {
        const adapter = db.getByJgbh(typeof jgbh !== 'undefined' ? jgbh : '');
        const syncResult = await syncBusinessRuleSelections({
            adapter,
            syncIds,
            jgbh,
            zjgbh,
            ywsf,
            ywnrfl,
            headers
        });

        res.json({
            status: 0,
            msg: `同步成功：新增 ${syncResult.insertCount} 条，移除 ${syncResult.deleteCount} 条，保留 ${syncResult.keepCount} 条`
        });

    } catch (err) {
        logger.error(`Batch sync failed: ${err.message}`);
        res.status(err.message.includes('存在互斥业务办理标准') ? 400 : 500).json({ status: 1, msg: err.message });
    }
});

router.post('/selection_ai_apply', async (req, res) => {
    const policyText = req.body.policy_text || req.body.policyText || req.body.content;
    const analysisPrompt = req.body.analysis_prompt || req.body.analysisPrompt || '';
    const ywsf = req.body.ywsf || req.body.gjsjsf || '';
    const ywnrfl = req.body.ywnrfl || '';
    const ywblbz = req.body.ywblbz || '';
    const ywblbzsm = req.body.ywblbzsm || '';
    const pageId = req.body.pageId || req.body.page_key || 'business_rule';
    const workflowType = req.body.workflow_type || 'ai_analysis';

    if (isBlankValue(policyText)) {
        return res.status(400).json({
            status: 1,
            msg: '请输入需要分析的政策文本'
        });
    }

    const requestJgbh = getRequestJgbh(req) || '';
    const requestZjgbh = getRequestZjgbh(req) || '';
    const headers = {
        'channel': req.headers['channel'] || '',
        'login-token': req.headers['login-token'] || '',
        'zzbs': req.headers['zzbs'] || '',
        'zzjgdmz': req.headers['zzjgdmz'] || ''
    };

    try {
        const adapter = db.getByJgbh(typeof requestJgbh !== 'undefined' ? requestJgbh : '');
        const selectionData = await buildSelectionListData({
            adapter,
            ywblbz,
            ywblbzsm,
            gjsjsf: ywsf,
            ywnrfl,
            queryJgbh: requestJgbh,
            queryZjgbh: requestZjgbh,
            headers
        });

        const candidateItems = selectionData.items.map(item => ({
            id: getDefinedValue(item, 'id', 'ID'),
            name: item.display_ywblbz || getDefinedValue(item, 'ywblbz', 'YWBLBZ'),
            description: getDefinedValue(item, 'ywblbzsm', 'YWBLBZSM'),
            mutualIds: item.mutualIds || [],
            checked: !!item.checked
        }));

        const difyConfig = await db.get(
            'SELECT * FROM sys_dify_config WHERE page_key = ? AND workflow_type = ? AND enabled = 1',
            [pageId, workflowType]
        );
        const difyApiUrl = difyConfig?.api_url || process.env.DIFY_API_URL || 'https://api.dify.ai/v1';
        const difyApiKey = difyConfig?.api_key || process.env.DIFY_API_KEY;

        if (!difyApiKey || difyApiKey === 'YOUR_DIFY_API_KEY') {
            return res.status(500).json({
                status: 1,
                msg: `页面 ${pageId} 的工作流类型 ${workflowType} 未配置`
            });
        }

        let standardRows = [];
        if (!isBlankValue(ywsf)) {
            let standardsSql = 'SELECT id,ywblbz,ywblbzsm FROM gjj_ywbzk WHERE 1=1 AND gjsjsf = ?';
            const standardsParams = [ywsf];

            if (!isBlankValue(ywnrfl)) {
                standardsSql += ' AND ywnrfl = ?';
                standardsParams.push(ywnrfl);
            }

            standardsSql += ' ORDER BY pxh ASC, id DESC';
            standardRows = await adapter.all(standardsSql, standardsParams);
        }

        const requestPayload = {
            inputs: {
                text: policyText,
                data: stringifyJson(standardRows)
            },
            response_mode: 'blocking',
            user: 'amis-user-001'
        };

        logger.info(`[Selection AI] 调用 Dify 工作流: pageId=${pageId}, workflowType=${workflowType}, candidates=${candidateItems.length}`);
        const difyResponse = await axios.post(`${difyApiUrl}/workflows/run`, requestPayload, {
            headers: {
                Authorization: `Bearer ${difyApiKey}`,
                'Content-Type': 'application/json'
            },
            timeout: parseInt(process.env.DIFY_API_TIMEOUT || '300000', 10)
        });

        const workflowData = difyResponse.data;
        if (workflowData?.data?.status !== 'succeeded') {
            return res.status(500).json({
                status: 1,
                msg: 'AI 工作流执行失败',
                difyStatus: workflowData?.data?.status,
                difyError: workflowData?.data?.error || workflowData?.data?.outputs
            });
        }

        let aiResult = workflowData?.data?.outputs?.text;
        if (typeof aiResult === 'string') {
            try {
                aiResult = JSON.parse(aiResult);
            } catch (error) {
                logger.warn(`[Selection AI] 结果不是 JSON，按纯文本处理: ${error.message}`);
            }
        }

        if (aiResult && aiResult.content && Array.isArray(aiResult.content)) {
            const innerText = aiResult.content[0]?.text;
            if (innerText) {
                try {
                    aiResult = JSON.parse(innerText);
                } catch (error) {
                    logger.warn(`[Selection AI] MCP 包装结果解析失败: ${error.message}`);
                }
            }
        }

        const normalized = extractSelectedIdsFromAiResult(
            aiResult,
            candidateItems.map(item => Number(item.id))
        );

        if (normalized.selectedIds.length === 0) {
            return res.status(400).json({
                status: 1,
                msg: 'AI 未返回可匹配的业务办理标准',
                data: {
                    summary: normalized.summary || '',
                    rawResult: aiResult
                }
            });
        }

        const syncResult = await syncBusinessRuleSelections({
            adapter,
            syncIds: normalized.selectedIds,
            jgbh: requestJgbh,
            zjgbh: requestZjgbh,
            ywsf,
            ywnrfl,
            headers
        });

        res.json({
            status: 0,
            msg: `AI 分析完成，已自动同步 ${normalized.selectedIds.length} 条业务办理标准`,
            data: {
                selectedIds: normalized.selectedIds,
                summary: normalized.summary || '',
                syncResult
            }
        });
    } catch (err) {
        logger.error(`[Selection AI] 分析失败: ${err.message}`);
        res.status(err.message.includes('存在互斥业务办理标准') ? 400 : 500).json({
            status: 1,
            msg: err.message
        });
    }
});

/**
 * 7. 删除 (POST /delete)
 */
router.post('/delete', async (req, res) => {
    let { id, jgbh, zjgbh } = req.body; // Use let to allow reassignment
    if (!id) return res.status(400).json({ status: 1, msg: "ID is required" });

    // 从请求头获取当前机构信息 (如果 body 中没有提供)
    if (!jgbh) {
        jgbh = req.headers['jgbh'] || '';
    }
    if (!zjgbh) {
        zjgbh = req.headers['zjgbh'] || '';
    }

    try {
        await db.getByJgbh(typeof jgbh !== 'undefined' ? jgbh : '').transaction(async (tx) => {
            // 1. 验证权限：检查该记录是否属于当前机构
            const coalesce = 'COALESCE';
            const checkSql = `
                SELECT id FROM gjj_ywbz 
                WHERE id = ? 
                AND ${coalesce}(jgbh, '') = ? 
                AND ${coalesce}(zjgbh, '') = ?
            `;
            // 如果 jgbh/zjgbh 为空字符串，也能匹配到数据库中为空的公共记录（如果有的话）
            // 但通常业务上应该严格匹配当前登录人的机构
            const record = await tx.get(checkSql, [id, jgbh, zjgbh]);

            logger.error(`Delete Check: id=${id}, jgbh=${jgbh}, zjgbh=${zjgbh}, record=${JSON.stringify(record)}`);

            if (!record) {
                throw new Error("无权删除此记录或记录不存在");
            }

            // 2. 先删除关联属性表
            await tx.run(`DELETE FROM gjj_ywbzsx WHERE ywid IN (SELECT id FROM gjj_ywbz WHERE id = ? AND ${coalesce}(jgbh, '') = ? AND ${coalesce}(zjgbh, '') = ?)`, [id, jgbh, zjgbh]);

            // 3. 再删除主表
            await tx.run(`DELETE FROM gjj_ywbz WHERE id = ? AND ${coalesce}(jgbh, '') = ? AND ${coalesce}(zjgbh, '') = ?`, [id, jgbh, zjgbh]);
        });

        res.json({ status: 0, msg: "删除成功" });
    } catch (err) {
        logger.error(`Delete failed: ${err.message}`);
        res.status(500).json({ status: 1, msg: err.message });
    }
});

/**
 * 8. DELETE /:id - 兼容接口
 */
router.delete('/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;

    // 从请求头获取当前机构信息
    const jgbh = req.headers['jgbh'] || req.headers['zzbs'] || '';
    const zjgbh = req.headers['zjgbh'] || req.headers['zzjgdmz'] || '';

    try {
        await db.getByJgbh(typeof jgbh !== 'undefined' ? jgbh : '').transaction(async (tx) => {
            // 1. 验证权限
            const coalesce = 'COALESCE';
            const checkSql = `
                SELECT id FROM gjj_ywbz 
                WHERE id = ? 
                AND ${coalesce}(jgbh, '') = ? 
                AND ${coalesce}(zjgbh, '') = ?
            `;
            const record = await tx.get(checkSql, [id, jgbh, zjgbh]);

            if (!record) {
                throw new Error("无权删除此记录或记录不存在");
            }

            // 2. 级联删除
            await tx.run(`DELETE FROM gjj_ywbzsx WHERE ywid IN (SELECT id FROM gjj_ywbz WHERE id = ? AND ${coalesce}(jgbh, '') = ? AND ${coalesce}(zjgbh, '') = ?)`, [id, jgbh, zjgbh]);
            await tx.run(`DELETE FROM gjj_ywbz WHERE id = ? AND ${coalesce}(jgbh, '') = ? AND ${coalesce}(zjgbh, '') = ?`, [id, jgbh, zjgbh]);
        });

        res.json({ status: 0, msg: "删除成功" });
    } catch (err) {
        logger.error(`Delete failed: ${err.message}`);
        res.status(500).json({ status: 1, msg: err.message });
    }
});

/**
 * 9. 获取分类选项 (GET /options/categories)
 */
router.get('/options/categories', async (req, res) => {
    const sql = "SELECT DISTINCT ywnrfl as value, ywnrfl as label FROM gjj_ywbzk WHERE ywnrfl IS NOT NULL";
    const jgbh = getRequestJgbh(req);
    try {
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
    // if (req.user?.role !== 'admin') {
    //     return res.status(403).json({ status: 403, msg: "无导出权限" });
    // }
    // 从请求头获取当前机构信息
    const jgbh = req.body.jgbh || req.headers['jgbh'] || req.headers['zzbs'] || '';
    const zjgbh = req.body.zjgbh || req.headers['zjgbh'] || req.headers['zzjgdmz'] || '';
    const coalesce = 'COALESCE';

    try {
        // 1. 获取当前机构数据
        const rules = await db.getByJgbh(typeof jgbh !== 'undefined' ? jgbh : '').all(`SELECT * FROM gjj_ywbz WHERE ${coalesce}(jgbh, '') = ? AND ${coalesce}(zjgbh, '') = ?`, [jgbh, zjgbh]);
        const ruleIds = rules.map(r => r.id || r.ID).filter(Boolean);
        let attributes = [];
        if (ruleIds.length > 0) {
            const placeholders = ruleIds.map(() => '?').join(',');
            attributes = await db.getByJgbh(typeof jgbh !== 'undefined' ? jgbh : '').all(`SELECT * FROM gjj_ywbzsx WHERE ywid IN (${placeholders})`, ruleIds);
        }

        // 2. 生成 SQL 脚本 (封装在 CSV 中)
        let sqlScript = "-- 业务规则全量导出 (包含规则表和属性表)\n";
        sqlScript += `-- 导出时间: ${new Date().toLocaleString()}\n`;
        sqlScript += `-- 导出记录数: ${rules.length}\n\n`;

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
                return `TO_DATE('${yyyy}${mm}${dd}${hh}${mi}${ss}', 'YYYYMMDDHH24MISS')`;
            }
            return val;
        };

        // 插入规则表数据
        for (const row of rules) {
            const keys = Object.keys(row);
            const values = Object.values(row).map(formatValue);
            sqlScript += `INSERT INTO gjj_ywbz (${keys.join(', ')}) VALUES (${values.join(', ')});\n`;
        }

        // 插入属性表数据
        for (const row of attributes) {
            const keys = Object.keys(row);
            const values = Object.values(row).map(formatValue);
            sqlScript += `INSERT INTO gjj_ywbzsx (${keys.join(', ')}) VALUES (${values.join(', ')});\n`;
        }

        // 3. 落地到服务器磁盘
        const exportFileName = 'ywbz_full_export.csv';
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
        return res.download(exportPath, exportFileName);

    } catch (err) {
        logger.error(`Export failed: ${err.message}`);
        res.status(500).json({ status: 1, msg: "导出失败: " + err.message });
    }
});

// -----------------------------------------------------------------------------
// 辅助函数：解析 INSERT 语句中的列名和 VALUES 值数组
// -----------------------------------------------------------------------------
function parseInsertValues(valsStr) {
    const vals = [];
    let current = '';
    let inQuote = false;
    let parenDepth = 0;
    for (let i = 0; i < valsStr.length; i++) {
        const ch = valsStr[i];
        if (ch === "'" && !inQuote) { inQuote = true; current += ch; }
        else if (ch === "'" && inQuote) {
            if (i + 1 < valsStr.length && valsStr[i + 1] === "'") {
                current += "''"; i++;
            } else {
                inQuote = false; current += ch;
            }
        }
        else if (ch === '(' && !inQuote) { parenDepth++; current += ch; }
        else if (ch === ')' && !inQuote) { parenDepth--; current += ch; }
        else if (ch === ',' && !inQuote && parenDepth === 0) {
            vals.push(current.trim());
            current = '';
        }
        else { current += ch; }
    }
    if (current.trim()) vals.push(current.trim());
    return vals;
}

// -----------------------------------------------------------------------------
// 辅助函数：处理 gjj_ywbz INSERT 语句
//   - 去掉 id 列（让数据库自增）
//   - 替换 jgbh/zjgbh 为当前机构码
//   - 返回 { sql, oldId } 其中 oldId 为被去掉的原始 id 值
// -----------------------------------------------------------------------------
function processYwbzInsert(stmt, jgbh, zjgbh) {
    const colsMatch = stmt.match(/INSERT\s+INTO\s+gjj_ywbz\s*\(([^)]+)\)/i);
    const valsMatch = stmt.match(/VALUES\s*\((.+)\)/is);
    if (!colsMatch || !valsMatch) return { sql: stmt, oldId: null };

    const cols = colsMatch[1].split(',').map(c => c.trim());
    const colsLower = cols.map(c => c.toLowerCase());
    const vals = parseInsertValues(valsMatch[1]);

    // 提取并去掉 id 列
    let oldId = null;
    const idIdx = colsLower.indexOf('id');
    if (idIdx >= 0 && idIdx < vals.length) {
        oldId = vals[idIdx].replace(/'/g, '').trim();
        cols.splice(idIdx, 1);
        vals.splice(idIdx, 1);
        colsLower.splice(idIdx, 1);
    }

    // 替换 jgbh 和 zjgbh
    const jgbhIdx = colsLower.indexOf('jgbh');
    const zjgbhIdx = colsLower.indexOf('zjgbh');
    if (jgbhIdx >= 0 && jgbhIdx < vals.length) {
        vals[jgbhIdx] = `'${jgbh.replace(/'/g, "''")}'`;
    }
    if (zjgbhIdx >= 0 && zjgbhIdx < vals.length) {
        vals[zjgbhIdx] = `'${zjgbh.replace(/'/g, "''")}'`;
    }

    const sql = `INSERT INTO gjj_ywbz (${cols.join(', ')}) VALUES (${vals.join(', ')})`;
    return { sql, oldId };
}

// -----------------------------------------------------------------------------
// 辅助函数：处理 gjj_ywbzsx INSERT 语句 - 替换 ywid 为新 ID
// -----------------------------------------------------------------------------
function replaceYwidInInsert(stmt, idMapping) {
    const colsMatch = stmt.match(/INSERT\s+INTO\s+gjj_ywbzsx\s*\(([^)]+)\)/i);
    const valsMatch = stmt.match(/VALUES\s*\((.+)\)/is);
    if (!colsMatch || !valsMatch) return stmt;

    const cols = colsMatch[1].split(',').map(c => c.trim());
    const colsLower = cols.map(c => c.toLowerCase());
    const vals = parseInsertValues(valsMatch[1]);

    // 去掉 id 列（让数据库自增）
    const idIdx = colsLower.indexOf('id');
    if (idIdx >= 0 && idIdx < vals.length) {
        cols.splice(idIdx, 1);
        vals.splice(idIdx, 1);
        colsLower.splice(idIdx, 1);
    }

    // 替换 ywid 为新 ID
    const ywidIdx = colsLower.indexOf('ywid');
    if (ywidIdx >= 0 && ywidIdx < vals.length) {
        const oldYwid = vals[ywidIdx].replace(/'/g, '').trim();
        const newYwid = idMapping[oldYwid];
        if (newYwid !== undefined) {
            vals[ywidIdx] = String(newYwid);
        }
    }

    return `INSERT INTO gjj_ywbzsx (${cols.join(', ')}) VALUES (${vals.join(', ')})`;
}

// -----------------------------------------------------------------------------
// 导入接口 (支持 CSV/SQL 单文件上传)
// -----------------------------------------------------------------------------
router.post('/import', authenticateToken, upload.single('file'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ status: 1, msg: "请选择文件" });
    }

    // 从请求头获取当前机构信息
    const jgbh = req.body.jgbh || req.headers['jgbh'] || req.headers['zzbs'] || '';
    const zjgbh = req.body.zjgbh || req.headers['zjgbh'] || req.headers['zzjgdmz'] || '';
    logger.info(`Full import: jgbh=${jgbh}, zjgbh=${zjgbh}`);

    try {
        let sqlContent = req.file.buffer.toString('utf8');

        // 移除可能存在的 BOM 头
        if (sqlContent.startsWith('\ufeff')) {
            sqlContent = sqlContent.slice(1);
        }

        // 简单的 SQL 检查
        if (!sqlContent.includes('INSERT INTO') && !sqlContent.includes('DELETE FROM')) {
            return res.status(400).json({ status: 1, msg: "文件内容格式不正确，未包含有效 SQL 语句" });
        }

        // 拆分 SQL 语句（先按行移除注释，再按分号拆分）
        const statements = sqlContent
            .split('\n')
            .filter(line => !line.trim().startsWith('--'))
            .join('\n')
            .split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0);

        // 校验所有 INSERT 语句：gjj_ywbz 的 mbid 不能为空，gjj_ywbzsx 的 ywid 不能为空
        for (const stmt of statements) {
            const upperStmt = stmt.toUpperCase();
            // 校验 gjj_ywbz 的 mbid
            if (upperStmt.match(/^INSERT\s+INTO\s+GJJ_YWBZ\s*\(/)) {
                const colsMatch = stmt.match(/INSERT\s+INTO\s+gjj_ywbz\s*\(([^)]+)\)/i);
                const valsMatch = stmt.match(/VALUES\s*\((.+)\)/is);
                if (colsMatch && valsMatch) {
                    const cols = colsMatch[1].split(',').map(c => c.trim().toLowerCase());
                    const mbidIdx = cols.indexOf('mbid');
                    if (mbidIdx < 0) {
                        return res.status(400).json({ status: 1, msg: "导入失败：文件中的业务规则缺少 mbid 字段" });
                    }
                    const vals = parseInsertValues(valsMatch[1]);
                    const mbidVal = (vals[mbidIdx] || '').replace(/'/g, '').trim();
                    if (!mbidVal || mbidVal.toUpperCase() === 'NULL') {
                        return res.status(400).json({ status: 1, msg: "导入失败：文件中存在 mbid 为空的业务规则，请检查数据" });
                    }
                }
            }
            // 校验 gjj_ywbzsx 的 ywid
            if (upperStmt.match(/^INSERT\s+INTO\s+GJJ_YWBZSX\s*\(/)) {
                const colsMatch = stmt.match(/INSERT\s+INTO\s+gjj_ywbzsx\s*\(([^)]+)\)/i);
                const valsMatch = stmt.match(/VALUES\s*\((.+)\)/is);
                if (colsMatch && valsMatch) {
                    const cols = colsMatch[1].split(',').map(c => c.trim().toLowerCase());
                    const ywidIdx = cols.indexOf('ywid');
                    if (ywidIdx >= 0) {
                        const vals = parseInsertValues(valsMatch[1]);
                        const ywidVal = (vals[ywidIdx] || '').replace(/'/g, '').trim();
                        if (!ywidVal || ywidVal.toUpperCase() === 'NULL') {
                            return res.status(400).json({ status: 1, msg: "导入失败：文件中存在 ywid 为空的规则属性，请检查数据" });
                        }
                    }
                }
            }
        }

        const coalesce = 'COALESCE';

        // 从 INSERT 语句中提取所有 mbid 值（用于精确删除）
        const mbidsToDelete = new Set();
        for (const stmt of statements) {
            const upperStmt = stmt.toUpperCase();
            if (!upperStmt.match(/^INSERT\s+INTO\s+GJJ_YWBZ\s*\(/)) continue;
            const colsMatch = stmt.match(/INSERT\s+INTO\s+gjj_ywbz\s*\(([^)]+)\)/i);
            const valsMatch = stmt.match(/VALUES\s*\((.+)\)/is);
            if (colsMatch && valsMatch) {
                const cols = colsMatch[1].split(',').map(c => c.trim().toLowerCase());
                const mbidIdx = cols.indexOf('mbid');
                if (mbidIdx >= 0) {
                    const vals = parseInsertValues(valsMatch[1]);
                    const mbidVal = (vals[mbidIdx] || '').replace(/'/g, '').trim();
                    if (mbidVal && mbidVal.toUpperCase() !== 'NULL') {
                        mbidsToDelete.add(mbidVal);
                    }
                }
            }
        }

        await db.getByJgbh(typeof jgbh !== 'undefined' ? jgbh : '').transaction(async (tx) => {
            // 1. 按 jgbh + zjgbh + mbid 删除旧数据
            if (mbidsToDelete.size > 0) {
                const mbidArr = Array.from(mbidsToDelete);
                const placeholders = mbidArr.map(() => '?').join(',');
                await tx.run(`DELETE FROM gjj_ywbzsx WHERE ywid IN (SELECT id FROM gjj_ywbz WHERE ${coalesce}(jgbh, '') = ? AND ${coalesce}(zjgbh, '') = ? AND mbid IN (${placeholders}))`, [jgbh, zjgbh, ...mbidArr]);
                await tx.run(`DELETE FROM gjj_ywbz WHERE ${coalesce}(jgbh, '') = ? AND ${coalesce}(zjgbh, '') = ? AND mbid IN (${placeholders})`, [jgbh, zjgbh, ...mbidArr]);
                logger.info(`Full import: deleted existing records for jgbh=${jgbh}, zjgbh=${zjgbh}, mbids=${mbidArr.join(',')}`);
            }

            // 2. 分两遍处理 INSERT 语句
            //    第一遍：gjj_ywbz（去掉id让数据库自增，替换jgbh，建立old→new id映射）
            //    第二遍：gjj_ywbzsx（用映射替换ywid）
            const idMapping = {}; // oldId -> newId
            const ywbzsxStmts = []; // 暂存 gjj_ywbzsx 的 INSERT

            for (const stmt of statements) {
                const upperStmt = stmt.toUpperCase();
                if (upperStmt.startsWith('DELETE') ||
                    upperStmt.startsWith('SELECT') ||
                    upperStmt.startsWith('SHOW') ||
                    upperStmt.startsWith('BEGIN') ||
                    upperStmt.startsWith('COMMIT')) {
                    continue;
                }
                if (upperStmt.startsWith('INSERT INTO GJJ_YWBZ ') || upperStmt.startsWith('INSERT INTO GJJ_YWBZ(')) {
                    const { sql, oldId } = processYwbzInsert(stmt, jgbh, zjgbh);
                    const insertRunResult = await tx.run(sql, []);
                    // 获取数据库自增的新 ID
                    if (oldId) {
                        idMapping[oldId] = insertRunResult.lastID;
                    }
                } else if (upperStmt.startsWith('INSERT INTO GJJ_YWBZSX')) {
                    ywbzsxStmts.push(stmt);
                } else if (upperStmt.startsWith('INSERT')) {
                    await tx.run(stmt, []);
                }
            }

            // 第二遍：处理 gjj_ywbzsx，替换 ywid
            for (const stmt of ywbzsxStmts) {
                const finalStmt = replaceYwidInInsert(stmt, idMapping);
                await tx.run(finalStmt, []);
            }
        });

        logger.info("Full import successful");
        res.json({ status: 0, msg: "导入成功" });

    } catch (err) {
        logger.error(`Import failed: ${err.message}`);
        res.status(500).json({ status: 1, msg: "导入失败: " + err.message });
    }
});

// -----------------------------------------------------------------------------
// 部分导出接口 (仅导出选中记录，不含 DELETE 全表语句)
// -----------------------------------------------------------------------------
router.post('/partial_export', authenticateToken, async (req, res) => {
    const { ids } = req.body;
    const jgbh = getRequestJgbh(req);
    if (!ids) {
        return res.status(400).json({ status: 1, msg: "请选择要导出的记录" });
    }

    // 解析 ID 列表，统一转为数字
    const idList = (Array.isArray(ids) ? ids : String(ids).split(','))
        .map(s => String(s).trim())
        .filter(Boolean)
        .map(Number)
        .filter(n => !isNaN(n));
    if (idList.length === 0) {
        return res.status(400).json({ status: 1, msg: "请选择要导出的记录" });
    }

    try {
        // 1. 查询选中的规则数据
        const placeholders = idList.map(() => '?').join(',');
        const rules = await db.getByJgbh(typeof jgbh !== 'undefined' ? jgbh : '').all(`SELECT * FROM gjj_ywbz WHERE id IN (${placeholders})`, idList);

        // 2. 查询对应的属性数据
        const attributes = await db.getByJgbh(typeof jgbh !== 'undefined' ? jgbh : '').all(`SELECT * FROM gjj_ywbzsx WHERE ywid IN (${placeholders})`, idList);
        logger.info(`Partial export: ids=${idList.join(',')}, rules=${rules.length}, attributes=${attributes.length}`);

        // 3. 生成 SQL 脚本（不含 DELETE 全表语句）
        let sqlScript = "-- 业务规则部分导出 (仅包含选中记录)\n";
        sqlScript += `-- 导出时间: ${new Date().toLocaleString()}\n`;
        sqlScript += `-- 导出记录数: ${rules.length}\n\n`;

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
                return `TO_DATE('${yyyy}${mm}${dd}${hh}${mi}${ss}', 'YYYYMMDDHH24MISS')`;
            }
            return val;
        };

        // 插入规则表数据
        for (const row of rules) {
            const keys = Object.keys(row);
            const values = Object.values(row).map(formatValue);
            sqlScript += `INSERT INTO gjj_ywbz (${keys.join(', ')}) VALUES (${values.join(', ')});\n`;
        }

        // 插入属性表数据
        for (const row of attributes) {
            const keys = Object.keys(row);
            const values = Object.values(row).map(formatValue);
            sqlScript += `INSERT INTO gjj_ywbzsx (${keys.join(', ')}) VALUES (${values.join(', ')});\n`;
        }

        // 4. 落地到服务器磁盘
        const exportFileName = 'ywbz_partial_export.csv';
        const exportDir = path.join(__dirname, '../../exports');
        const exportPath = path.join(exportDir, exportFileName);

        if (!fs.existsSync(exportDir)) {
            fs.mkdirSync(exportDir, { recursive: true });
        }

        fs.writeFileSync(exportPath, '\ufeff' + sqlScript, 'utf8');
        logger.info(`Partial export CSV written to: ${exportPath}, ${rules.length} rules exported`);

        return res.download(exportPath, exportFileName);

    } catch (err) {
        logger.error(`Partial export failed: ${err.message}`);
        res.status(500).json({ status: 1, msg: "部分导出失败: " + err.message });
    }
});

// -----------------------------------------------------------------------------
// 部分导入接口 (先删除对应ID的旧数据，再执行INSERT，替换jgbh)
// -----------------------------------------------------------------------------
router.post('/partial_import', authenticateToken, upload.single('file'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ status: 1, msg: "请选择文件" });
    }

    // 从请求头获取当前机构信息
    const jgbh = req.body.jgbh || req.headers['jgbh'] || req.headers['zzbs'] || '';
    const zjgbh = req.body.zjgbh || req.headers['zjgbh'] || req.headers['zzjgdmz'] || '';
    logger.info(`Partial import: jgbh=${jgbh}, zjgbh=${zjgbh}`);

    try {
        let sqlContent = req.file.buffer.toString('utf8');

        // 移除可能存在的 BOM 头
        if (sqlContent.startsWith('\ufeff')) {
            sqlContent = sqlContent.slice(1);
        }

        // 简单的 SQL 检查
        if (!sqlContent.includes('INSERT INTO')) {
            return res.status(400).json({ status: 1, msg: "文件内容格式不正确，未包含有效 INSERT 语句" });
        }

        // 拆分 SQL 语句（先按行移除注释，再按分号拆分）
        const statements = sqlContent
            .split('\n')
            .filter(line => !line.trim().startsWith('--'))
            .join('\n')
            .split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0);

        // 校验所有 INSERT 语句：gjj_ywbz 的 mbid 不能为空，gjj_ywbzsx 的 ywid 不能为空
        for (const stmt of statements) {
            const upperStmt = stmt.toUpperCase();
            // 校验 gjj_ywbz 的 mbid
            if (upperStmt.match(/^INSERT\s+INTO\s+GJJ_YWBZ\s*\(/)) {
                const colsMatch = stmt.match(/INSERT\s+INTO\s+gjj_ywbz\s*\(([^)]+)\)/i);
                const valsMatch = stmt.match(/VALUES\s*\((.+)\)/is);
                if (colsMatch && valsMatch) {
                    const cols = colsMatch[1].split(',').map(c => c.trim().toLowerCase());
                    const mbidIdx = cols.indexOf('mbid');
                    if (mbidIdx < 0) {
                        return res.status(400).json({ status: 1, msg: "导入失败：文件中的业务规则缺少 mbid 字段" });
                    }
                    const vals = parseInsertValues(valsMatch[1]);
                    const mbidVal = (vals[mbidIdx] || '').replace(/'/g, '').trim();
                    if (!mbidVal || mbidVal.toUpperCase() === 'NULL') {
                        return res.status(400).json({ status: 1, msg: "导入失败：文件中存在 mbid 为空的业务规则，请检查数据" });
                    }
                }
            }
            // 校验 gjj_ywbzsx 的 ywid
            if (upperStmt.match(/^INSERT\s+INTO\s+GJJ_YWBZSX\s*\(/)) {
                const colsMatch = stmt.match(/INSERT\s+INTO\s+gjj_ywbzsx\s*\(([^)]+)\)/i);
                const valsMatch = stmt.match(/VALUES\s*\((.+)\)/is);
                if (colsMatch && valsMatch) {
                    const cols = colsMatch[1].split(',').map(c => c.trim().toLowerCase());
                    const ywidIdx = cols.indexOf('ywid');
                    if (ywidIdx >= 0) {
                        const vals = parseInsertValues(valsMatch[1]);
                        const ywidVal = (vals[ywidIdx] || '').replace(/'/g, '').trim();
                        if (!ywidVal || ywidVal.toUpperCase() === 'NULL') {
                            return res.status(400).json({ status: 1, msg: "导入失败：文件中存在 ywid 为空的规则属性，请检查数据" });
                        }
                    }
                }
            }
        }


        // 从 INSERT INTO gjj_ywbz 语句中提取 mbid 值（用于删除旧数据）
        const mbidsToDelete = new Set();
        for (const stmt of statements) {
            const upperStmt = stmt.toUpperCase();
            if (!upperStmt.match(/^INSERT\s+INTO\s+GJJ_YWBZ\s*\(/)) continue;
            const colsMatch = stmt.match(/INSERT\s+INTO\s+gjj_ywbz\s*\(([^)]+)\)/i);
            const valsMatch = stmt.match(/VALUES\s*\((.+)\)/is);
            if (colsMatch && valsMatch) {
                const cols = colsMatch[1].split(',').map(c => c.trim().toLowerCase());
                const mbidIdx = cols.indexOf('mbid');
                if (mbidIdx >= 0) {
                    const vals = parseInsertValues(valsMatch[1]);
                    const mbidVal = (vals[mbidIdx] || '').replace(/'/g, '').trim();
                    if (mbidVal && mbidVal.toUpperCase() !== 'NULL') {
                        mbidsToDelete.add(mbidVal);
                    }
                }
            }
        }

        let insertCount = 0;
        let deleteCount = mbidsToDelete.size;
        const coalesce = 'COALESCE';

        await db.getByJgbh(typeof jgbh !== 'undefined' ? jgbh : '').transaction(async (tx) => {
            // 1. 按 jgbh + zjgbh + mbid 删除旧数据
            if (mbidsToDelete.size > 0) {
                const mbidArr = Array.from(mbidsToDelete);
                const placeholders = mbidArr.map(() => '?').join(',');
                await tx.run(`DELETE FROM gjj_ywbzsx WHERE ywid IN (SELECT id FROM gjj_ywbz WHERE ${coalesce}(jgbh, '') = ? AND ${coalesce}(zjgbh, '') = ? AND mbid IN (${placeholders}))`, [jgbh, zjgbh, ...mbidArr]);
                await tx.run(`DELETE FROM gjj_ywbz WHERE ${coalesce}(jgbh, '') = ? AND ${coalesce}(zjgbh, '') = ? AND mbid IN (${placeholders})`, [jgbh, zjgbh, ...mbidArr]);
                logger.info(`Partial import: deleted records for mbids=${mbidArr.join(',')}, jgbh=${jgbh}`);
            }

            // 2. 分两遍处理 INSERT（同全量导入逻辑）
            const idMapping = {};
            const ywbzsxStmts = [];

            for (const stmt of statements) {
                const upperStmt = stmt.toUpperCase();
                if (upperStmt.startsWith('DELETE') ||
                    upperStmt.startsWith('SELECT') ||
                    upperStmt.startsWith('SHOW') ||
                    upperStmt.startsWith('BEGIN') ||
                    upperStmt.startsWith('COMMIT')) {
                    continue;
                }
                if (upperStmt.startsWith('INSERT INTO GJJ_YWBZ ') || upperStmt.startsWith('INSERT INTO GJJ_YWBZ(')) {
                    const { sql, oldId } = processYwbzInsert(stmt, jgbh, zjgbh);
                    const insertRunResult = await tx.run(sql, []);
                    insertCount++;
                    if (oldId) {
                        idMapping[oldId] = insertRunResult.lastID;
                    }
                } else if (upperStmt.startsWith('INSERT INTO GJJ_YWBZSX')) {
                    ywbzsxStmts.push(stmt);
                } else if (upperStmt.startsWith('INSERT')) {
                    await tx.run(stmt, []);
                    insertCount++;
                }
            }

            for (const stmt of ywbzsxStmts) {
                const finalStmt = replaceYwidInInsert(stmt, idMapping);
                await tx.run(finalStmt, []);
                insertCount++;
            }
        });

        logger.info(`Partial import successful: deleted ${deleteCount} old records, inserted ${insertCount} statements`);
        res.json({ status: 0, msg: `部分导入成功：替换了 ${deleteCount} 条记录，执行了 ${insertCount} 条插入语句` });

    } catch (err) {
        logger.error(`Partial import failed: ${err.message}`);
        res.status(500).json({ status: 1, msg: "部分导入失败: " + err.message });
    }
});

/**
 * 10. 获取标准库选择清册 (POST /selection_list)
 * 包含 check 状态反显
 */
router.post('/selection_list', async (req, res) => {
    const { ywblbz, ywblbzsm, gjsjsf, ywnrfl } = req.body;
    const requestJgbh = getRequestJgbh(req);
    const requestZjgbh = getRequestZjgbh(req);

    // 规范化查询参数：将 null/undefined 统一转为空字符串，防止 join 失败
    const queryJgbh = requestJgbh || '';
    const queryZjgbh = requestZjgbh || '';

    try {
        const _adapter = db.getByJgbh(typeof requestJgbh !== 'undefined' ? requestJgbh : '');
        const headers = {
            'channel': req.headers['channel'] || '',
            'login-token': req.headers['login-token'] || '',
            'zzbs': req.headers['zzbs'] || '',
            'zzjgdmz': req.headers['zzjgdmz'] || ''
        };
        const data = await buildSelectionListData({
            adapter: _adapter,
            ywblbz,
            ywblbzsm,
            gjsjsf,
            ywnrfl,
            queryJgbh,
            queryZjgbh,
            headers
        });

        logger.info(`[Selection Fix] Selected IDs: ${data.selectedIds.join(',')}`);

        res.json({
            status: 0,
            msg: "ok",
            data
        });
    } catch (err) {
        logger.error(`Failed to query selection_list: ${err.message}`);
        res.status(500).json({ status: 1, msg: err.message });
    }
});



/**
 * 11. 调试模板生成 (POST /debug_template)
 */
router.post('/debug_template', async (req, res) => {
    const ywsf = isBlankValue(req.body.ywsf) ? '' : String(req.body.ywsf);
    const ywnrfl = isBlankValue(req.body.ywnrfl) ? '' : String(req.body.ywnrfl);
    const jgbh = getRequestJgbh(req);
    const zjgbh = getRequestZjgbh(req);
    const _adapter = db.getByJgbh(typeof jgbh !== 'undefined' ? jgbh : '');
    const template = { ywsf, ywnrfl, jgbh, zjgbh };
    const dispatchMeta = getAlgorithmDispatchMeta(ywsf);
    const debugDispatchTip = buildDebugDispatchTip(dispatchMeta, ywnrfl);

    try {
        let fieldRows = [];
        let fieldKeys = [];
        let tip = '';

        if (isBlankValue(ywsf)) {
            tip = '未选择关键数据算法，已生成基础调试模板。';
        } else if (ywsf === '1' && isBlankValue(ywnrfl)) {
            tip = '最大可提取额需先选择业务内容分类，已生成基础调试模板。';
        } else {
            fieldRows = await loadDebugTemplateFieldRows(_adapter, { ywsf, ywnrfl, jgbh, zjgbh });

            fieldRows.forEach(row => {
                const key = getDefinedValue(row, 'ywblbzsx', 'YWBLBZSX', 'sxbm', 'SXBM');
                if (!isBlankValue(key) && !fieldKeys.includes(String(key))) {
                    fieldKeys.push(String(key));
                }
            });

            fieldKeys.forEach(key => {
                if (!Object.prototype.hasOwnProperty.call(template, key)) {
                    template[key] = '';
                }
            });

            tip = fieldKeys.length > 0
                ? `已根据当前算法与业务内容分类生成 ${fieldKeys.length} 个业务参数。`
                : '当前筛选条件下未找到业务参数定义，已生成基础调试模板。';
        }

        res.json({
            status: 0,
            msg: 'ok',
            data: buildDebugTemplateResponseData(template, {
                debugInput: stringifyJson(template),
                fieldCount: fieldKeys.length,
                tip,
                debugTemplateTip: tip,
                debugDispatchTip,
                dispatchMeta
            })
        });
    } catch (err) {
        logger.error(`Failed to build debug template: ${err.message}`);
        res.status(500).json({ status: 1, msg: '生成调试模板失败: ' + err.message });
    }
});

/**
 * 12. 调试案例列表 (POST /debug_case/list)
 */
router.post('/debug_case/list', async (req, res) => {
    const { ywsf, ywnrfl, keyword } = req.body;
    const jgbh = getRequestJgbh(req);
    const zjgbh = getRequestZjgbh(req);
    const coalesce = 'COALESCE';
    const _adapter = db.getByJgbh(typeof jgbh !== 'undefined' ? jgbh : '');
    let sql = `
        SELECT id, case_name, ywsf, ywnrfl, result_summary, creator_name, cjsj
        FROM gjj_ywbz_debug_case
        WHERE ${coalesce}(jgbh, '') = ?
          AND ${coalesce}(zjgbh, '') = ?
    `;
    const params = [jgbh || '', zjgbh || ''];

    if (!isBlankValue(ywsf)) {
        sql += ` AND ${coalesce}(ywsf, '') = ?`;
        params.push(String(ywsf));
    }

    if (!isBlankValue(ywnrfl)) {
        sql += ` AND ${coalesce}(ywnrfl, '') = ?`;
        params.push(String(ywnrfl));
    }

    if (!isBlankValue(keyword)) {
        sql += ' AND case_name LIKE ?';
        params.push(`%${String(keyword).trim()}%`);
    }

    sql += ' ORDER BY cjsj DESC, id DESC';

    try {
        const rows = await _adapter.all(sql, params);
        res.json({
            status: 0,
            msg: 'ok',
            data: rows.map(row => ({
                ...row,
                value: String(getDefinedValue(row, 'id', 'ID')),
                label: buildDebugCaseLabel(row)
            }))
        });
    } catch (err) {
        logger.error(`Failed to query debug cases: ${err.message}`);
        res.status(500).json({ status: 1, msg: '查询调试案例失败: ' + err.message });
    }
});

/**
 * 13. 调试案例详情 (POST /debug_case/get)
 */
router.post('/debug_case/get', async (req, res) => {
    const { id } = req.body;
    const jgbh = getRequestJgbh(req);
    const zjgbh = getRequestZjgbh(req);
    const coalesce = 'COALESCE';
    const _adapter = db.getByJgbh(typeof jgbh !== 'undefined' ? jgbh : '');

    if (!id) {
        return res.status(400).json({ status: 1, msg: '案例ID不能为空' });
    }

    try {
        const row = await _adapter.get(
            `
                SELECT *
                FROM gjj_ywbz_debug_case
                WHERE id = ?
                  AND ${coalesce}(jgbh, '') = ?
                  AND ${coalesce}(zjgbh, '') = ?
            `,
            [id, jgbh || '', zjgbh || '']
        );

        if (!row) {
            return res.status(404).json({ status: 1, msg: '调试案例不存在' });
        }

        const requestJsonText = getDefinedValue(row, 'request_json', 'REQUEST_JSON') || '{}';
        const requestJson = parseJsonPayload(requestJsonText);

        res.json({
            status: 0,
            msg: 'ok',
            data: {
                ...row,
                request_json: requestJson,
                debugInput: stringifyJson(requestJson)
            }
        });
    } catch (err) {
        logger.error(`Failed to load debug case: ${err.message}`);
        res.status(500).json({ status: 1, msg: '查询调试案例详情失败: ' + err.message });
    }
});

/**
 * 14. 保存调试案例 (POST /debug_case/save)
 */
router.post('/debug_case/save', async (req, res) => {
    const ywsf = isBlankValue(req.body.ywsf) ? '' : String(req.body.ywsf);
    const ywnrfl = isBlankValue(req.body.ywnrfl) ? '' : String(req.body.ywnrfl);
    const caseName = req.body.case_name ? String(req.body.case_name).trim() : '';
    const resultSummary = getDefinedValue(req.body, 'result_summary');
    const jgbh = getRequestJgbh(req);
    const zjgbh = getRequestZjgbh(req);
    const creatorName = getRequestCreatorName(req);
    const _adapter = db.getByJgbh(typeof jgbh !== 'undefined' ? jgbh : '');

    if (!caseName) {
        return res.status(400).json({ status: 1, msg: '案例名称不能为空' });
    }

    if (isBlankValue(resultSummary)) {
        return res.status(400).json({ status: 1, msg: '仅支持保存调试成功的案例，请先完成调试' });
    }

    try {
        const requestJson = parseJsonPayload(req.body.request_json);
        const requestJsonText = stringifyJson(requestJson);
        const columns = ['ywsf', 'ywnrfl', 'case_name', 'request_json', 'result_summary', 'creator_name', 'jgbh', 'zjgbh', 'cjsj', 'gxsj'];
        const params = [
            ywsf || null,
            ywnrfl || null,
            caseName,
            requestJsonText,
            String(resultSummary),
            creatorName || null,
            jgbh || '',
            zjgbh || ''
        ];
        const placeholders = columns
            .map((_, index) => (index >= columns.length - 2 ? SqlHelper.now(_adapter) : SqlHelper.param(index, _adapter)))
            .join(', ');
        const sql = `INSERT INTO gjj_ywbz_debug_case (${columns.join(', ')}) VALUES (${placeholders})`;
        const result = await _adapter.run(sql, params);

        res.json({
            status: 0,
            msg: '保存成功',
            data: {
                id: result?.lastID || null
            }
        });
    } catch (err) {
        if (isPayloadParseError(err)) {
            return res.status(400).json({ status: 1, msg: err.message });
        }

        logger.error(`Failed to save debug case: ${err.message}`);
        res.status(500).json({ status: 1, msg: '保存调试案例失败: ' + err.message });
    }
});

/**
 * 15. 调试接口 (POST /debug)
 * 转发请求至网关 HFB/business/ywbz/zhixing$m=execute.service
 */
const { gatewayRequest } = require('../../services/gatewayService');

router.post('/debug', async (req, res) => {
    try {
        const payload = typeof req.body?.debugInput === 'string'
            ? parseJsonPayload(req.body.debugInput)
            : req.body;
        logger.info(`Debug Payload: ${JSON.stringify(payload)}`);

        // 构建网关请求参数
        // HFB/business/ywbz/zhixing$m=execute.service
        // 入参: ywsf, ywnrfl, jgbh, zjgbh, 及其他页面属性

        // 构造请求头
        const headers = {
            'channel': req.headers['channel'] || '',
            'login-token': req.headers['login-token'] || '',
            'zzbs': req.headers['zzbs'] || '',
            'zzjgdmz': req.headers['zzjgdmz'] || ''
        };

        // 调用网关服务
        // 注意：gatewayRequest 需要支持自定义 path
        // 这里假设 gatewayRequest(path, data, headers)
        const gatewayPath = 'HFB/business/ywbz/zhixing$m=execute.service';
        const result = await gatewayRequest(gatewayPath, payload, headers);

        logger.info(`Debug Result: ${JSON.stringify(result)}`);

        // 返回网关结果
        return res.json({ status: 0, msg: "调试成功", data: result });

    } catch (err) {
        if (isPayloadParseError(err)) {
            return res.status(400).json({ status: 1, msg: err.message });
        }

        logger.error(`Debug failed: ${err.message}`);
        res.status(500).json({ status: 1, msg: "调试失败: " + err.message });
    }
});

/**
 * 16. 调试日志查询 (POST /debug_log)
 * 查询 gjj_ywblbz_log 表
 */
router.post('/debug_log', async (req, res) => {
    const { pcid, ywsf } = req.body;
    const jgbh = getRequestJgbh(req);
    if (!pcid) {
        return res.status(400).json({ status: 1, msg: "PCID is required" });
    }

    try {
        const sql = `
            SELECT 
                pcid, 
                zxyj as content, 
                zxjg as result, 
                cjsj as time, 
                yjlx as type
            FROM gjj_ywblbz_log 
            WHERE pcid = ?
            ORDER BY cjsj ASC
        `;
        const rows = await db.getByJgbh(typeof jgbh !== 'undefined' ? jgbh : '').all(sql, [pcid]);

        // 格式化数据
        const formattedRows = rows.map((row, index) => ({
            id: index + 1,
            step: `步骤 ${index + 1}`,
            content: row.content || row.CONTENT || row.zxyj,
            result: getDefinedValue(row, 'result', 'RESULT', 'zxjg', 'ZXJG'),
            time: row.time || row.TIME || row.cjsj,
            type: (row.type || row.TYPE || row.yjlx) === '1' ? 'SQL' : '标准结果'
        }));
        const dispatchMeta = getAlgorithmDispatchMeta(ywsf);

        if (!isBlankValue(dispatchMeta.algorithmCode)) {
            formattedRows.unshift({
                id: 0,
                step: '分发信息',
                content: `统一入口 ${dispatchMeta.entryProcedure} 已按算法 ${dispatchMeta.algorithmCode}（${dispatchMeta.algorithmLabel}）进入 ${dispatchMeta.currentBranch}。`,
                result: dispatchMeta.plannedProcedure
                    ? `规划子过程：${dispatchMeta.plannedProcedure}`
                    : dispatchMeta.currentBranch,
                time: '',
                type: '算法分支'
            });
        }

        res.json({
            status: 0,
            msg: "ok",
            data: {
                rows: formattedRows
            }
        });
    } catch (err) {
        logger.error(`Debug log query failed: ${err.message}`);
        res.status(500).json({ status: 1, msg: "查询日志失败: " + err.message });
    }
});

module.exports = router;
