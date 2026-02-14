/**
 * 业务标准 (规则) CRUD 接口
 * 处理具体业务规则的配置，支持从标准库同步
 */

const express = require('express');
const router = express.Router();
const db = require('../../db');
const SqlHelper = require('../../utils/sqlHelper');
const logger = require('../../utils/logger');
const { authenticateToken } = require('../../middleware/auth');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

// 配置 Multer 内存存储，用于处理文件上传
const upload = multer({ storage: multer.memoryStorage() });

/**
 * 1. 获取列表 (POST /list)
 */
router.post('/list', async (req, res) => {
    const { page = 1, perPage = 10, gzmc, ywsf, ywnrfl } = req.body;
    const offset = (page - 1) * perPage;

    let sql = `
        SELECT t1.*, t2.ywblbz as template_name 
        FROM gjj_ywbz t1
        LEFT JOIN gjj_ywbzk t2 ON t1.mbid = t2.id
        WHERE 1=1
    `;
    let countSql = `
        SELECT COUNT(*) as total 
        FROM gjj_ywbz t1
        LEFT JOIN gjj_ywbzk t2 ON t1.mbid = t2.id
        WHERE 1=1
    `;
    const params = [];

    if (gzmc) {
        sql += " AND t1.gzmc LIKE ?";
        countSql += " AND gzmc LIKE ?";
        params.push(`%${gzmc}%`);
    }
    if (ywsf) {
        sql += " AND t1.ywsf = ?";
        countSql += " AND ywsf = ?";
        params.push(ywsf);
    }
    if (ywnrfl) {
        sql += " AND t2.ywnrfl = ?";
        countSql += " AND t2.ywnrfl = ?";
        params.push(ywnrfl);
    }

    sql += " ORDER BY t1.yxj DESC, t1.id DESC";
    const paged = SqlHelper.paginateQuery(sql, params, perPage, offset);

    try {
        const countRow = await db.oracle.get(countSql, params);
        const rows = await db.oracle.all(paged.sql, paged.params);

        res.json({
            status: 0,
            msg: "ok",
            data: {
                items: rows,
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
    const { id } = req.body;
    if (!id) return res.status(400).json({ status: 1, msg: "ID is required" });

    try {
        const sql = "SELECT * FROM gjj_ywbz WHERE id = ?";
        const row = await db.oracle.get(sql, [id]);

        if (!row) return res.status(404).json({ status: 1, msg: "Record not found" });

        const sxSql = "SELECT * FROM gjj_ywbzsx WHERE ywid = ?";
        const sxRows = await db.oracle.all(sxSql, [id]);

        const attributes = [];
        sxRows.forEach(row => {
            for (let i = 1; i <= 10; i++) {
                if (row[`k${i}`] || row[`K${i}`]) { // Oracle might return uppercase
                    attributes.push({
                        sxmc: row[`k${i}`] || row[`K${i}`],
                        sxz: row[`v${i}`] || row[`V${i}`]
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
        // 1. 查询标准库定义的属性 (gjj_ywbzksx)
        const sqlSchema = `SELECT * FROM gjj_ywbzksx WHERE mbid = ? ORDER BY id ASC`;

        // 2. 查询已保存的属性值 (gjj_ywbzsx 宽表)
        const sqlValues = `
            SELECT * FROM gjj_ywbzsx 
            WHERE ywid = ? 
            ORDER BY row_index ASC, id ASC
        `;

        const schemaRows = await db.oracle.all(sqlSchema, [mbid]);

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
            const chineseName = row.sxbm || row.SXBM;         // 中文名称
            const fieldId = row.ywblbzsx || row.YWBLBZSX;     // 程序化标识

            if (chineseName && fieldId) {
                chineseNameToFieldId[chineseName] = fieldId;
            }
        });

        const valueRows = await db.oracle.all(sqlValues, [id]);

        // 将宽表结构 (k1,v1...) 还原为对象数组
        // 宽表 k 列可能存的是旧的中文名(sxbm)或新的程序化标识(ywblbzsx)
        // 统一转换为 ywblbzsx 作为 key，与表单 name 对应
        const cleanedValues = valueRows.map(row => {
            const item = {
                id: row.id || row.ID,
                result: row.result || row.RESULT
            };

            for (let i = 1; i <= 10; i++) {
                const k = row[`k${i}`] || row[`K${i}`];
                const v = row[`v${i}`] || row[`V${i}`];
                if (k) {
                    // 如果 k 是中文名称，转换为程序化标识；否则原样使用
                    const key = chineseNameToFieldId[k] || k;
                    item[key] = v;
                }
            }
            return item;
        });

        // 动态构建 Combo 的内部 items (表单列)
        const comboItems = schemaRows.map(field => {
            const chineseName = field.sxbm || field.SXBM;           // 中文名称，如 "贷款情况"
            const displayLabel = field.fwdxbq || field.FWDXBQ;      // 服务对象标签，如 "缴存人"
            const syObjectNumber = field.ywblbzdx || field.YWBLBZDX; // syObjectNumber
            const fieldId = field.ywblbzsx || field.YWBLBZSX;       // 程序化标识 / fieldIdentification

            // 标签组合：如 "缴存人-贷款情况"
            const label = (displayLabel && chineseName)
                ? `${displayLabel}-${chineseName}`
                : (displayLabel || chineseName || fieldId);

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
                    url: `${process.env.API_ROUTE_PREFIX || '/api'}/tools/business-content-classes`,
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
                        value: cleanedValues, // 回填数据
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

    if (!id) {
        return res.json({ status: 1, msg: "缺少规则ID" });
    }

    if (!Array.isArray(rules)) {
        return res.json({ status: 1, msg: "参数格式错误 (rules 应为数组)" });
    }

    try {
        await db.oracle.transaction(async (tx) => {
            // 1. 删除旧属性
            await tx.run("DELETE FROM gjj_ywbzsx WHERE ywid = :1", [id]);

            // 2. 插入新属性 (宽表结构：k1,v1...k10,v10)
            const columns = ['ywid', 'row_index', 'result'];
            for (let i = 1; i <= 10; i++) {
                columns.push(`k${i}`, `v${i}`);
            }
            // Oracle 参数占位符是 :n
            // 这里我们需要动态构建 :1, :2, ...
            let paramIndex = 1;
            const placeholders = columns.map(() => `:${paramIndex++}`).join(',');
            const insSql = `INSERT INTO gjj_ywbzsx (${columns.join(',')}) VALUES (${placeholders})`;

            for (let rowIndex = 0; rowIndex < rules.length; rowIndex++) {
                const row = rules[rowIndex];
                const params = [id, rowIndex, row.result || ''];
                let kIndex = 1;

                // 提取除 result 和 id 以外的字段填充到 k, v 对中
                Object.keys(row).forEach(key => {
                    if (key !== 'result' && key !== 'id' && kIndex <= 10) {
                        params.push(key, row[key]);
                        kIndex++;
                    }
                });

                // 补齐剩余的 k, v 为空
                while (kIndex <= 10) {
                    params.push(null, null);
                    kIndex++;
                }

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

    try {
        const sql = "SELECT * FROM gjj_ywbz WHERE id = ?";
        const row = await db.oracle.get(sql, [id]);

        if (!row) return res.status(404).json({ status: 1, msg: "Record not found" });

        const sxSql = "SELECT * FROM gjj_ywbzsx WHERE ywid = ? ORDER BY row_index ASC, id ASC";
        const sxRows = await db.oracle.all(sxSql, [id]);

        const rule_params = {};
        sxRows.forEach(row => {
            for (let i = 1; i <= 10; i++) {
                const k = row[`k${i}`] || row[`K${i}`];
                const v = row[`v${i}`] || row[`V${i}`];
                if (k) {
                    rule_params[k] = v;
                }
            }
            if (row.result || row.RESULT) {
                rule_params.result = row.result || row.RESULT;
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

    try {
        const { id: savedId } = await db.oracle.transaction(async (tx) => {
            let ywid = id;
            if (id) {
                const updateSql = `UPDATE gjj_ywbz SET mbid=?, gzmc=?, ywsf=?, gzljsm=?, yxj=?, sfqy=?, gxsj=${SqlHelper.now()} WHERE id=?`;
                await tx.run(updateSql, [mbid, gzmc, ywsf, gzljsm, yxj, sfqy, id]);
                await tx.run("DELETE FROM gjj_ywbzsx WHERE ywid = ?", [id]);
            } else {
                const insertSql = `INSERT INTO gjj_ywbz (mbid, gzmc, ywsf, gzljsm, yxj, sfqy) VALUES (?, ?, ?, ?, ?, ?)`;
                const result = await tx.run(insertSql, [mbid, gzmc, ywsf, gzljsm, yxj, sfqy]);

                // 在 db.oracle.transaction 中必然是 Oracle 环境，直接获取 MAX(id)
                const lastRow = await tx.get("SELECT MAX(id) as id FROM gjj_ywbz");
                ywid = lastRow?.id ?? lastRow?.ID;
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
                    const params = [ywid, rowIndex, rowData.result || ''];
                    let kIndex = 1;
                    Object.keys(rowData).forEach(key => {
                        if (key !== 'result' && key !== 'id' && kIndex <= 10) {
                            params.push(key);
                            params.push(rowData[key]);
                            kIndex++;
                        }
                    });
                    while (kIndex <= 10) { params.push(null); params.push(null); kIndex++; }
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

    try {
        await db.oracle.transaction(async (tx) => {
            const updateSql = `
                UPDATE gjj_ywbz SET 
                mbid = ?, gzmc = ?, ywsf = ?, gzljsm = ?, yxj = ?, sfqy = ?, gxsj = ${SqlHelper.now()}
                WHERE id = ?
            `;
            await tx.run(updateSql, [mbid, gzmc, ywsf, gzljsm, yxj, sfqy, id]);

            await tx.run("DELETE FROM gjj_ywbzsx WHERE ywid = ?", [id]);

            if (rule_params && typeof rule_params === 'object') {
                const columns = ['ywid', 'row_index', 'result'];
                for (let i = 1; i <= 10; i++) {
                    columns.push(`k${i}`);
                    columns.push(`v${i}`);
                }
                const placeholders = columns.map(() => '?').join(',');
                const insSql = `INSERT INTO gjj_ywbzsx (${columns.join(',')}) VALUES (${placeholders})`;

                const params = [id, 0, rule_params.result || ''];
                let kIndex = 1;
                Object.keys(rule_params).forEach(key => {
                    if (key !== 'result' && key !== 'id' && kIndex <= 10) {
                        params.push(key);
                        params.push(rule_params[key]);
                        kIndex++;
                    }
                });
                while (kIndex <= 10) { params.push(null); params.push(null); kIndex++; }
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
        syncIds = Array.isArray(selected_ids) ? selected_ids : String(selected_ids).split(',');
    } else if (ids) {
        syncIds = Array.isArray(ids) ? ids : String(ids).split(',');
    }

    // 过滤空值并去重
    syncIds = [...new Set(syncIds.filter(item => item && String(item).trim() !== '').map(item => String(item).trim()))];

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
        // 1. 查询该范围下已存在的规则
        const coalesce = SqlHelper.isOracle ? 'NVL' : 'IFNULL';
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

        const existingRows = await db.oracle.all(existingSql, existingParams);
        
        const selectedMbids = new Set(syncIds.map(String));

        // 2. 计算需要删除的 (已存在但未选中) - 遍历所有行以处理潜在的重复数据
        const idsToDelete = [];
        existingRows.forEach(row => {
            const mbid = String(row.mbid || row.MBID);
            if (!selectedMbids.has(mbid)) {
                idsToDelete.push(row.id || row.ID);
            }
        });

        // 3. 计算需要新增的 (选中但不存在)
        const existingMbids = new Set(existingRows.map(r => String(r.mbid || r.MBID)));
        const mbidsToInsert = [];
        for (const mbid of selectedMbids) {
            if (!existingMbids.has(mbid)) {
                mbidsToInsert.push(mbid);
            }
        }

        logger.info(`Batch Sync: Existing: ${existingRows.length}, To Delete: ${idsToDelete.length}, To Insert: ${mbidsToInsert.length}`);

        // 4. 执行删除
        if (idsToDelete.length > 0) {
            const placeholders = idsToDelete.map(() => '?').join(',');
            // 先删除关联的属性表
            await db.oracle.run(`DELETE FROM gjj_ywbzsx WHERE ywid IN (${placeholders})`, idsToDelete);
            // 再删除主表
            await db.oracle.run(`DELETE FROM gjj_ywbz WHERE id IN (${placeholders})`, idsToDelete);
        }

        // 5. 执行新增
        let insertCount = 0;
        if (mbidsToInsert.length > 0) {
            const getStandards = (ids) => {
                const placeholders = ids.map(() => '?').join(',');
                return db.oracle.all(`SELECT * FROM gjj_ywbzk WHERE id IN (${placeholders})`, ids);
            };
            
            const templates = await getStandards(mbidsToInsert);

            // --- 预取公共参数值 ---
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
                
                await db.oracle.transaction(async (tx) => {
                    const insertSql = `
                        INSERT INTO gjj_ywbz (mbid, gzmc, ywsf, ywnrfl, sfqy, jgbh, zjgbh, ywbzz)
                        VALUES (?, ?, ?, ?, 1, ?, ?, ?)
                    `;
                    await tx.run(insertSql, [tpl.id, tpl.ywblbz, tpl.gjsjsf, tpl.ywnrfl, jgbh, zjgbh, fetchedYwbzzValue]);
                });
                insertCount++;
            }
        }

        res.json({ 
            status: 0, 
            msg: `同步成功：新增 ${insertCount} 条，移除 ${idsToDelete.length} 条，保留 ${existingRows.length - idsToDelete.length} 条` 
        });

    } catch (err) {
        logger.error(`Batch sync failed: ${err.message}`);
        res.status(500).json({ status: 1, msg: err.message });
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
        await db.oracle.transaction(async (tx) => {
            // 1. 验证权限：检查该记录是否属于当前机构
            const coalesce = SqlHelper.isOracle ? 'NVL' : 'IFNULL';
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
            await tx.run("DELETE FROM gjj_ywbzsx WHERE ywid = ?", [id]);
            
            // 3. 再删除主表
            await tx.run("DELETE FROM gjj_ywbz WHERE id = ?", [id]);
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
        await db.oracle.transaction(async (tx) => {
            // 1. 验证权限
            const coalesce = SqlHelper.isOracle ? 'NVL' : 'IFNULL';
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
            await tx.run("DELETE FROM gjj_ywbzsx WHERE ywid = ?", [id]);
            await tx.run("DELETE FROM gjj_ywbz WHERE id = ?", [id]);
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
    try {
        const rows = await db.oracle.all(sql, []);
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
    try {
        // 1. 获取所有数据
        const rules = await db.oracle.all("SELECT * FROM gjj_ywbz");
        const attributes = await db.oracle.all("SELECT * FROM gjj_ywbzsx");

        // 2. 生成 SQL 脚本 (封装在 CSV 中)
        let sqlScript = "-- 业务规则全量导出 (包含规则表和属性表)\n";
        sqlScript += `-- 导出时间: ${new Date().toLocaleString()}\n\n`;

        // 清空旧数据
        sqlScript += "DELETE FROM gjj_ywbzsx;\n";
        sqlScript += "DELETE FROM gjj_ywbz;\n\n";

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
// 导入接口 (支持 CSV/SQL 单文件上传)
// -----------------------------------------------------------------------------
router.post('/import', authenticateToken, upload.single('file'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ status: 1, msg: "请选择文件" });
    }

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

        // 执行 SQL - Oracle 不支持 exec，需要拆分执行
        const statements = sqlContent
            .split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0 && !s.startsWith('--'));

        await db.oracle.transaction(async (tx) => {
            for (const stmt of statements) {
                const upperStmt = stmt.toUpperCase();
                // 跳过注释和查询语句
                if (upperStmt.startsWith('SELECT') ||
                    upperStmt.startsWith('SHOW') ||
                    upperStmt.startsWith('BEGIN') ||
                    upperStmt.startsWith('COMMIT')) {
                    continue;
                }
                await tx.run(stmt, []);
            }
        });

        logger.info("Import successful");
        res.json({ status: 0, msg: "导入成功" });

    } catch (err) {
        logger.error(`Import failed: ${err.message}`);
        res.status(500).json({ status: 1, msg: "导入失败: " + err.message });
    }
});

/**
 * 10. 获取标准库选择清册 (POST /selection_list)
 * 包含 check 状态反显
 */
router.post('/selection_list', async (req, res) => {
    const { page = 1, perPage = 10, ywblbz, gjsjsf, ywnrfl, jgbh, zjgbh } = req.body;
    
    // Ensure page and perPage are valid numbers (handle empty strings from frontend)
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limit = Math.max(1, parseInt(perPage) || 10);
    const offset = (pageNum - 1) * limit;

    // 规范化查询参数：将 null/undefined 统一转为空字符串，防止 join 失败
    // 假设数据库中存储的空值主要是空字符串 ''
    const queryJgbh = jgbh || '';
    const queryZjgbh = zjgbh || '';

    // 方案二：两次查询 + 内存合并
    // 1. 查询标准库分页列表 (Query Standards)
    let standardsSql = "SELECT * FROM gjj_ywbzk WHERE 1=1";
    let countSql = "SELECT COUNT(*) as total FROM gjj_ywbzk WHERE 1=1";
    const standardsParams = [];

    // 标准库筛选条件
    if (ywblbz) {
        standardsSql += " AND ywblbz LIKE ?";
        countSql += " AND ywblbz LIKE ?";
        standardsParams.push(`%${ywblbz}%`);
    }
    // 注意：gjsjsf 在标准库中是属性，如果前端传了值且确实想筛选标准库类型，则保留此条件
    // 如果前端传 gjsjsf 只是为了匹配规则表，则这里不应加条件。
    // 根据业务语境，"关键数据算法"通常对应标准库里的 gjsjsf 分类，所以这里加上是合理的。
    if (gjsjsf) {
        standardsSql += " AND gjsjsf = ?";
        countSql += " AND gjsjsf = ?";
        standardsParams.push(gjsjsf);
    }
    if (ywnrfl) {
        standardsSql += " AND ywnrfl = ?";
        countSql += " AND ywnrfl = ?";
        standardsParams.push(ywnrfl);
    }

    standardsSql += " ORDER BY pxh ASC, id DESC";
    const paged = SqlHelper.paginateQuery(standardsSql, standardsParams, perPage, offset);
    standardsSql = paged.sql;
    const standardsQueryParams = paged.params;

    // 2. 查询已选中的 mbid (Query Selected IDs)
    // 按 jgbh/zjgbh 查询该机构已同步的所有标准库 ID
    // 逻辑修正：与 batch 接口保持一致，如果前端传了 gjsjsf/ywnrfl，则作为 ywsf/ywnrfl 条件进行过滤
    // 这样能确保 "checked" 状态反映的是"在当前筛选条件下是否已存在"
    const coalesce = SqlHelper.isOracle ? 'NVL' : 'IFNULL';
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

    // 执行查询 - 改为 Promise 方式
    try {
        const countRow = await db.oracle.get(countSql, standardsParams);
        const standards = await db.oracle.all(standardsSql, standardsQueryParams);
        const selectedRows = await db.oracle.all(selectedSql, selectedParams);

        // 内存合并: 构建 Set 加速查找
        const selectedIds = new Set(selectedRows.map(row => Number(row.mbid || row.MBID)));
        logger.info(`[Selection Fix] Selected IDs: ${Array.from(selectedIds).join(',')}`);

        // 遍历标准库列表，标记 checked
        const items = standards.map(item => ({
            ...item,
            checked: selectedIds.has(Number(item.id))
        }));

        res.json({
            status: 0,
            msg: "ok",
            data: {
                items: items,
                selectedIds: Array.from(selectedIds),
                total: countRow ? (countRow.total || countRow.TOTAL) : 0
            }
        });
    } catch (err) {
        logger.error(`Failed to query selection_list: ${err.message}`);
        res.status(500).json({ status: 1, msg: err.message });
    }
});


module.exports = router;

