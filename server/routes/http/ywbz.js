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

        // 构建映射表：属性名称 -> 属性编码
        const nameToCodeMap = {};
        schemaRows.forEach(row => {
            const sxbm = row.sxbm || row.SXBM;
            const ywblbzsx = row.ywblbzsx || row.YWBLBZSX;

            if (sxbm && ywblbzsx) {
                nameToCodeMap[ywblbzsx] = sxbm;
            }
        });

        const valueRows = await db.oracle.all(sqlValues, [id]);

        // 将宽表结构 (k1,v1...) 还原为对象数组
        const cleanedValues = valueRows.map(row => {
            const item = {
                id: row.id || row.ID,
                result: row.result || row.RESULT
            };

            // 遍历 k1-k10
            for (let i = 1; i <= 10; i++) {
                const k = row[`k${i}`] || row[`K${i}`];
                const v = row[`v${i}`] || row[`V${i}`];
                if (k) {
                    const key = nameToCodeMap[k] || k;
                    item[key] = v;
                }
            }
            return item;
        });

        // 动态构建 Combo 的内部 items (表单列)
        const comboItems = schemaRows.map(field => {
            const sxbm = field.sxbm || field.SXBM;
            const ywblbzsx = field.ywblbzsx || field.YWBLBZSX;

            return {
                type: "input-text",
                name: sxbm || ywblbzsx, // 优先使用属性编码作为 key
                label: field.ywblbzsx,
                required: true
            };
        });

        // 添加固定的 "结果" 列
        comboItems.push({
            type: "input-text",
            name: "result",
            label: "结果",
            required: true
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

    try {
        const getStandards = (ids) => {
            const placeholders = ids.map(() => '?').join(',');
            return db.oracle.all(`SELECT * FROM gjj_ywbzk WHERE id IN (${placeholders})`, ids);
        };

        // 开启覆盖式同步：先删除该机构下的所有规则，再重新插入选中的项
        logger.info(`Batch Sync: Deleting existing rules for jgbh='${jgbh}', zjgbh='${zjgbh}'`);
        const coalesce = SqlHelper.isOracle ? 'NVL' : 'IFNULL';
        const deleteSql = `DELETE FROM gjj_ywbz WHERE ${coalesce}(jgbh, '') = ? AND ${coalesce}(zjgbh, '') = ?`;
        const deleteResult = await db.oracle.run(deleteSql, [jgbh, zjgbh]);
        logger.info(`Batch Sync: Deleted existing rules. Changes: ${deleteResult.rowsAffected || deleteResult.changes}`);

        const templates = await getStandards(syncIds);
        let syncCount = 0;

        for (const tpl of templates) {
            logger.info(`Batch Sync: Inserting rule for mbid=${tpl.id}, ywblbz='${tpl.ywblbz}'`);
            const insertSql = `
                INSERT INTO gjj_ywbz (mbid, gzmc, ywsf, gzljsm, sfqy, jgbh, zjgbh)
                VALUES (?, ?, ?, ?, 1, ?, ?)
            `;
            await db.oracle.run(insertSql, [tpl.id, tpl.ywblbz, tpl.gjsjsf, tpl.ywblbzsm, jgbh, zjgbh]);
            syncCount++;
        }

        logger.info(`Batch Sync: Completed. Inserted ${syncCount} rules.`);
        res.json({ status: 0, msg: `同步成功，已更新 ${syncCount} 条业务规则` });

    } catch (err) {
        logger.error(`Batch sync failed: ${err.message}`);
        res.status(500).json({ status: 1, msg: err.message });
    }
});

/**
 * 7. 删除 (POST /delete)
 */
router.post('/delete', async (req, res) => {
    const { id } = req.body;
    if (!id) return res.status(400).json({ status: 1, msg: "ID is required" });

    try {
        await db.oracle.run("DELETE FROM gjj_ywbz WHERE id = ?", [id]);
        res.json({ status: 0, msg: "删除成功" });
    } catch (err) {
        res.status(500).json({ status: 1, msg: err.message });
    }
});

/**
 * 8. DELETE /:id - 兼容接口
 */
router.delete('/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    try {
        await db.oracle.run("DELETE FROM gjj_ywbz WHERE id = ?", [id]);
        res.json({ status: 0, msg: "删除成功" });
    } catch (err) {
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
    const offset = (page - 1) * perPage;

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
    // 按 jgbh/zjgbh 查询该机构已同步的所有标准库 ID，不再按 ywsf 过滤
    // （ywsf 值来自标准库的 gjsjsf，与前端筛选条件不总是一致，会导致回显失败）
    const coalesce = SqlHelper.isOracle ? 'NVL' : 'IFNULL';
    let selectedSql = `
        SELECT DISTINCT mbid FROM gjj_ywbz 
        WHERE ${coalesce}(jgbh, '') = ? 
        AND ${coalesce}(zjgbh, '') = ?
    `;
    const selectedParams = [queryJgbh, queryZjgbh];

    // 执行查询 - 改为 Promise 方式
    try {
        const countRow = await db.oracle.get(countSql, standardsParams);
        const standards = await db.oracle.all(standardsSql, standardsQueryParams);
        const selectedRows = await db.oracle.all(selectedSql, selectedParams);

        // 内存合并: 构建 Set 加速查找
        const selectedIds = new Set(selectedRows.map(row => Number(row.mbid)));
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
                total: countRow ? countRow.total : 0
            }
        });
    } catch (err) {
        logger.error(`Failed to query selection_list: ${err.message}`);
        res.status(500).json({ status: 1, msg: err.message });
    }
});


module.exports = router;

