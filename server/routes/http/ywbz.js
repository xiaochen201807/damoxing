/**
 * 业务标准 (规则) CRUD 接口
 * 处理具体业务规则的配置，支持从标准库同步
 */

const express = require('express');
const router = express.Router();
const db = require('../../db');
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
router.post('/list', (req, res) => {
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

    sql += " ORDER BY t1.yxj DESC, t1.id DESC LIMIT ? OFFSET ?";
    const queryParams = [...params, parseInt(perPage), parseInt(offset)];

    db.get(countSql, params, (err, countRow) => {
        if (err) {
            logger.error(`Failed to count ywbz: ${err.message}`);
            return res.status(500).json({ status: 1, msg: err.message });
        }

        db.all(sql, queryParams, (err, rows) => {
            if (err) {
                logger.error(`Failed to query ywbz: ${err.message}`);
                return res.status(500).json({ status: 1, msg: err.message });
            }

            res.json({
                status: 0,
                msg: "ok",
                data: {
                    items: rows,
                    total: countRow ? countRow.total : 0
                }
            });
        });
    });
});

/**
 * 2. 获取详情 (POST /get)
 */
router.post('/get', (req, res) => {
    const { id } = req.body;
    if (!id) return res.status(400).json({ status: 1, msg: "ID is required" });

    const sql = "SELECT * FROM gjj_ywbz WHERE id = ?";
    db.get(sql, [id], (err, row) => {
        if (err) return res.status(500).json({ status: 1, msg: err.message });
        if (!row) return res.status(404).json({ status: 1, msg: "Record not found" });

        // 查询关联的属性 (KV) - 这里的接口用途似乎是返回详情给 AMIS 使用
        // 宽表重构后，attributes 字段可能不再适用原来的 [{sxmc, sxz}] 格式
        // 但为了兼容，我们尝试转换一下？或者直接返回空，视前端是否还在用attributes字段。
        // 从代码看，attributes 是给 AMIS combo 用的，格式是 [{sxmc, sxz}]?
        // 不，看 99 行注释：转换为 数组 格式供 AMIS combo 使用
        // 其实这里的 get 接口和 /config_form 的数据源是一样的。
        // 为保持一致性，重构为类似 config_form 的对象数组结构可能更好。
        // 但如果不改变前端，按原样返回 [{sxmc: 'k', sxz: 'v'}] 结构：

        const sxSql = "SELECT * FROM gjj_ywbzsx WHERE ywid = ?";
        db.all(sxSql, [id], (err, sxRows) => {
            if (err) return res.status(500).json({ status: 1, msg: err.message });

            const attributes = [];
            sxRows.forEach(row => {
                for (let i = 1; i <= 10; i++) {
                    if (row[`k${i}`]) {
                        attributes.push({
                            sxmc: row[`k${i}`],
                            sxz: row[`v${i}`]
                        });
                    }
                }
            });

            row.attributes = attributes;
            res.json({ status: 0, msg: "ok", data: row });
        });
    });
});


/**
 * 配置表单协议 (POST /config_form) - 动态生成 AMIS 表单以配置规则参数
 * 用于“规则参数配置”操作，支持多行 Combo
 */
router.post('/config_form', (req, res) => {
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

    // 1. 查询标准库定义的属性 (gjj_ywbzksx)
    const sqlSchema = `SELECT * FROM gjj_ywbzksx WHERE mbid = ? ORDER BY id ASC`;

    // 2. 查询已保存的属性值 (gjj_ywbzsx 宽表)
    const sqlValues = `
        SELECT * FROM gjj_ywbzsx 
        WHERE ywid = ? 
        ORDER BY row_index ASC, id ASC
    `;

    db.all(sqlSchema, [mbid], (err, schemaRows) => {
        if (err) {
            logger.error(`Error fetching schema: ${err.message}`);
            return res.json({ status: 1, msg: "获取参数定义失败" });
        }

        // 构建映射表：属性名称 -> 属性编码
        const nameToCodeMap = {};
        schemaRows.forEach(row => {
            if (row.sxbm && row.ywblbzsx) {
                nameToCodeMap[row.ywblbzsx] = row.sxbm;
            }
        });

        db.all(sqlValues, [id], (err, valueRows) => {
            if (err) {
                logger.error(`Error fetching values: ${err.message}`);
                return res.json({ status: 1, msg: "获取参数值失败" });
            }

            // 将宽表结构 (k1,v1...) 还原为对象数组
            const cleanedValues = valueRows.map(row => {
                const item = {
                    id: row.id, // 保留 ID 方便调试或更新
                    result: row.result
                };

                // 遍历 k1-k10
                for (let i = 1; i <= 10; i++) {
                    const k = row[`k${i}`];
                    const v = row[`v${i}`];
                    if (k) {
                        // 尝试将中文名称转换为编码，以匹配表单的 name
                        // 如果 k 已经在 map 中（说明是中文名称且有对应的编码），使用编码
                        // 否则（可能是已经存为编码，或者没有对应关系），保持原样
                        const key = nameToCodeMap[k] || k;
                        item[key] = v;
                    }
                }
                return item;
            });

            // 动态构建 Combo 的内部 items (表单列)
            const comboItems = schemaRows.map(field => {
                return {
                    type: "input-text",
                    name: field.sxbm || field.ywblbzsx, // 优先使用属性编码作为 key
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
        });
    });
});

/**
 * 保存规则参数配置 (支持多行)
 * POST /save_params
 */
router.post('/save_params', (req, res) => {
    const { id, rules } = req.body;

    if (!id) {
        return res.json({ status: 1, msg: "缺少规则ID" });
    }

    if (!Array.isArray(rules)) {
        return res.json({ status: 1, msg: "参数格式错误 (rules 应为数组)" });
    }

    db.serialize(() => {
        db.run("BEGIN TRANSACTION");

        // 1. 删除旧属性
        const delSql = "DELETE FROM gjj_ywbzsx WHERE ywid = ?";
        db.run(delSql, [id], function (err) {
            if (err) {
                db.run("ROLLBACK");
                return res.json({ status: 1, msg: "清理旧参数失败" });
            }

            // 2. 插入新属性 (宽表结构)
            // 支持 k1, v1 ... k10, v10, result
            const columns = ['ywid', 'row_index', 'result'];
            for (let i = 1; i <= 10; i++) {
                columns.push(`k${i}`);
                columns.push(`v${i}`);
            }
            const placeholders = columns.map(() => '?').join(',');
            const insSql = `INSERT INTO gjj_ywbzsx (${columns.join(',')}) VALUES (${placeholders})`;

            // fix: db is a wrapper, use db.raw to access original sqlite3 object for prepare()
            const stmt = db.raw.prepare(insSql);

            try {
                rules.forEach((row, rowIndex) => {
                    const params = [id, rowIndex, row.result || ''];
                    let kIndex = 1;

                    // 遍历对象的 key，排除 result 和 id 加到 k/v 列中
                    Object.keys(row).forEach(key => {
                        if (key !== 'result' && key !== 'id' && kIndex <= 10) {
                            params.push(key);      // k
                            params.push(row[key]); // v
                            kIndex++;
                        }
                    });

                    // 补全剩余的 k/v 为 null
                    while (kIndex <= 10) {
                        params.push(null);
                        params.push(null);
                        kIndex++;
                    }

                    stmt.run(params);
                });
                stmt.finalize();
                db.run("COMMIT", (err) => {
                    if (err) {
                        return res.json({ status: 1, msg: "提交事务失败" });
                    }
                    res.json({ status: 0, msg: "保存成功" });
                });
            } catch (e) {
                db.run("ROLLBACK");
                logger.error(`Error in save_params: ${e.message}`);
                res.json({ status: 1, msg: "保存参数失败: " + e.message });
            }
        });
    });
});

/**
 * 3. 获取详情 (GET /:id) - 兼容 LoanBusinessStandard.json
 */
router.get('/:id', authenticateToken, (req, res) => {
    const { id } = req.params;

    const sql = "SELECT * FROM gjj_ywbz WHERE id = ?";
    db.get(sql, [id], (err, row) => {
        if (err) return res.status(500).json({ status: 1, msg: err.message });
        if (!row) return res.status(404).json({ status: 1, msg: "Record not found" });

        const sxSql = "SELECT * FROM gjj_ywbzsx WHERE ywid = ? ORDER BY row_index ASC, id ASC";
        db.all(sxSql, [id], (err, sxRows) => {
            if (err) return res.status(500).json({ status: 1, msg: err.message });

            // 宽表转对象 (注意：GET /:id 原逻辑是返回单个对象 rule_params，
            // 但如果宽表有多行，兼容性上可能需要调整。
            // 假设这里只取第一行，或者根据业务需求调整。
            // 原逻辑是: 扁平的 KV 对合并到一个 rule_params 对象中。
            // 新逻辑: 如果有多行，怎么合并？暂时保留原行为：全部合并到一个对象。

            const rule_params = {};
            sxRows.forEach(row => {
                for (let i = 1; i <= 10; i++) {
                    const k = row[`k${i}`];
                    const v = row[`v${i}`];
                    if (k) {
                        rule_params[k] = v;
                    }
                }
                // result 怎么处理？原逻辑没有 result 字段的特殊处理。
                if (row.result) {
                    rule_params.result = row.result;
                }
            });

            row.rule_params = rule_params;
            res.json({ status: 0, msg: "ok", data: row });
        });
    });
});

/**
 * 4. 保存 (POST /save)
 */
router.post('/save', async (req, res) => {
    const { id, mbid, gzmc, ywsf, gzljsm, yxj, sfqy, rule_params } = req.body;

    try {
        const runQuery = (sql, params) => new Promise((resolve, reject) => {
            db.run(sql, params, function (err) {
                if (err) reject(err);
                else resolve(this);
            });
        });

        let ywid = id;
        if (id) {
            // 更新
            const updateSql = `
                UPDATE gjj_ywbz SET 
                mbid = ?, gzmc = ?, ywsf = ?, gzljsm = ?, yxj = ?, sfqy = ?, gxsj = CURRENT_TIMESTAMP
                WHERE id = ?
            `;
            await runQuery(updateSql, [mbid, gzmc, ywsf, gzljsm, yxj, sfqy, id]);

            // 清理旧属性
            await runQuery("DELETE FROM gjj_ywbzsx WHERE ywid = ?", [id]);
        } else {
            // 新增
            const insertSql = `
                INSERT INTO gjj_ywbz (mbid, gzmc, ywsf, gzljsm, yxj, sfqy)
                VALUES (?, ?, ?, ?, ?, ?)
            `;
            const result = await runQuery(insertSql, [mbid, gzmc, ywsf, gzljsm, yxj, sfqy]);
            ywid = result.lastID;
        }

        // 插入新属性 (支持以对象形式传入的 rule_params, 视为一行数据)
        const attrs = attributes || rule_params;
        if (attrs && typeof attrs === 'object') {
            // 宽表插入逻辑
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
                await runQuery(insSql, params);
            };

            if (Array.isArray(attrs)) {
                // 如果是数组，插入多行
                for (let i = 0; i < attrs.length; i++) {
                    await insertRow(i, attrs[i]);
                }
            } else {
                // 如果是单对象，插入一行
                await insertRow(0, attrs);
            }
        }

        res.json({ status: 0, msg: "保存成功", data: { id: ywid } });

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
        const runQuery = (sql, params) => new Promise((resolve, reject) => {
            db.run(sql, params, function (err) {
                if (err) reject(err);
                else resolve(this);
            });
        });

        const updateSql = `
            UPDATE gjj_ywbz SET 
            mbid = ?, gzmc = ?, ywsf = ?, gzljsm = ?, yxj = ?, sfqy = ?, gxsj = CURRENT_TIMESTAMP
            WHERE id = ?
        `;
        await runQuery(updateSql, [mbid, gzmc, ywsf, gzljsm, yxj, sfqy, id]);

        await runQuery("DELETE FROM gjj_ywbzsx WHERE ywid = ?", [id]);

        if (rule_params && typeof rule_params === 'object') {
            // 宽表插入逻辑
            const columns = ['ywid', 'row_index', 'result'];
            for (let i = 1; i <= 10; i++) {
                columns.push(`k${i}`);
                columns.push(`v${i}`);
            }
            const placeholders = columns.map(() => '?').join(',');
            const insSql = `INSERT INTO gjj_ywbzsx (${columns.join(',')}) VALUES (${placeholders})`;

            // 单对象插入一行
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
            await runQuery(insSql, params);
        }

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

    // 过滤空值
    syncIds = syncIds.filter(item => item && typeof item === 'string' && item.trim() !== '');

    logger.info(`Parsed syncIds: ${JSON.stringify(syncIds)}, Type: ${typeof syncIds}, IsArray: ${Array.isArray(syncIds)}`);

    if (!syncIds || syncIds.length === 0) {
        logger.warn('Batch Sync Failed: No valid IDs found');
        return res.status(400).json({ status: 1, msg: "请选择同步项" });
    }

    // 处理 jgbh 和 zjgbh 的默认值
    const jgbh = req.body.jgbh || '';
    const zjgbh = req.body.zjgbh || '';

    try {
        const runQuery = (sql, params) => new Promise((resolve, reject) => {
            db.run(sql, params, function (err) {
                if (err) reject(err);
                else resolve(this);
            });
        });

        const getStandards = (ids) => new Promise((resolve, reject) => {
            const placeholders = ids.map(() => '?').join(',');
            db.all(`SELECT * FROM gjj_ywbzk WHERE id IN (${placeholders})`, ids, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });

        // 开启覆盖式同步：先删除该机构下的所有规则，再重新插入选中的项
        logger.info(`Batch Sync: Deleting existing rules for jgbh='${jgbh}', zjgbh='${zjgbh}'`);
        const deleteSql = `DELETE FROM gjj_ywbz WHERE IFNULL(jgbh, '') = ? AND IFNULL(zjgbh, '') = ?`;
        const deleteResult = await runQuery(deleteSql, [jgbh, zjgbh]);
        logger.info(`Batch Sync: Deleted existing rules. Changes: ${deleteResult.changes}`);

        const templates = await getStandards(syncIds);
        let syncCount = 0;

        for (const tpl of templates) {
            logger.info(`Batch Sync: Inserting rule for mbid=${tpl.id}, ywblbz='${tpl.ywblbz}'`);
            const insertSql = `
                INSERT INTO gjj_ywbz (mbid, gzmc, ywsf, gzljsm, sfqy, jgbh, zjgbh)
                VALUES (?, ?, ?, ?, 1, ?, ?)
            `;
            await runQuery(insertSql, [tpl.id, tpl.ywblbz, tpl.gjsjsf, tpl.ywblbzsm, jgbh, zjgbh]);
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
router.post('/delete', (req, res) => {
    const { id } = req.body;
    if (!id) return res.status(400).json({ status: 1, msg: "ID is required" });

    db.run("DELETE FROM gjj_ywbz WHERE id = ?", [id], function (err) {
        if (err) return res.status(500).json({ status: 1, msg: err.message });
        res.json({ status: 0, msg: "删除成功" });
    });
});

/**
 * 8. DELETE /:id - 兼容接口
 */
router.delete('/:id', authenticateToken, (req, res) => {
    const { id } = req.params;
    db.run("DELETE FROM gjj_ywbz WHERE id = ?", [id], function (err) {
        if (err) return res.status(500).json({ status: 1, msg: err.message });
        res.json({ status: 0, msg: "删除成功" });
    });
});

/**
 * 9. 获取分类选项 (GET /options/categories)
 */
router.get('/options/categories', (req, res) => {
    const sql = "SELECT DISTINCT ywnrfl as value, ywnrfl as label FROM gjj_ywbzk WHERE ywnrfl IS NOT NULL";
    db.all(sql, [], (err, rows) => {
        if (err) return res.status(500).json({ status: 1, msg: err.message });
        res.json({ status: 0, msg: "ok", data: rows });
    });
});

// -----------------------------------------------------------------------------
// 导出接口 (生成 CSV 单文件，包含 SQL 脚本以保证全量恢复)
// -----------------------------------------------------------------------------
router.all('/export', authenticateToken, async (req, res) => {
    try {
        // 1. 获取所有数据
        const rules = await new Promise((resolve, reject) => {
            db.all("SELECT * FROM gjj_ywbz", (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });

        const attributes = await new Promise((resolve, reject) => {
            db.all("SELECT * FROM gjj_ywbzsx", (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });

        // 2. 生成 SQL 脚本 (封装在 CSV 中)
        let sqlScript = "-- 业务规则全量导出 (包含规则表和属性表)\n";
        sqlScript += `-- 导出时间: ${new Date().toLocaleString()}\n\n`;
        sqlScript += "BEGIN TRANSACTION;\n\n";

        // 清空旧数据
        sqlScript += "DELETE FROM gjj_ywbzsx;\n";
        sqlScript += "DELETE FROM gjj_ywbz;\n\n";

        // 插入规则表数据
        for (const row of rules) {
            const keys = Object.keys(row);
            const values = Object.values(row).map(val => {
                if (val === null) return "NULL";
                if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`;
                return val;
            });
            sqlScript += `INSERT INTO gjj_ywbz (${keys.join(', ')}) VALUES (${values.join(', ')});\n`;
        }

        // 插入属性表数据
        for (const row of attributes) {
            const keys = Object.keys(row);
            const values = Object.values(row).map(val => {
                if (val === null) return "NULL";
                if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`;
                return val;
            });
            sqlScript += `INSERT INTO gjj_ywbzsx (${keys.join(', ')}) VALUES (${values.join(', ')});\n`;
        }

        sqlScript += "\nCOMMIT;";

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

        // 执行 SQL
        await new Promise((resolve, reject) => {
            db.exec(sqlContent, (err) => {
                if (err) reject(err);
                else resolve();
            });
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
router.post('/selection_list', (req, res) => {
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

    standardsSql += " ORDER BY pxh ASC, id DESC LIMIT ? OFFSET ?";
    const standardsQueryParams = [...standardsParams, parseInt(perPage), parseInt(offset)];

    // 2. 查询已选中的 mbid (Query Selected IDs)
    // 只需要查询符合当前环境(ywsf/jgbh/zjgbh)的 mbid 列表
    let selectedSql = `
        SELECT DISTINCT mbid FROM gjj_ywbz 
        WHERE 1=1
        AND (? = '' OR IFNULL(ywsf, '') = ?)
        AND IFNULL(jgbh, '') = ? 
        AND IFNULL(zjgbh, '') = ?
    `;
    // 注意：这里的 gjsjsf 对应规则表的 ywsf
    const selectedParams = [gjsjsf, gjsjsf, queryJgbh, queryZjgbh];

    // 执行查询
    db.get(countSql, standardsParams, (err, countRow) => {
        if (err) {
            logger.error(`Failed to count standards: ${err.message}`);
            return res.status(500).json({ status: 1, msg: err.message });
        }

        db.all(standardsSql, standardsQueryParams, (err, standards) => {
            if (err) {
                logger.error(`Failed to query standards: ${err.message}`);
                return res.status(500).json({ status: 1, msg: err.message });
            }

            // 获取已选 ID 列表
            db.all(selectedSql, selectedParams, (err, selectedRows) => {
                if (err) {
                    logger.error(`Failed to query selected rules: ${err.message}`);
                    return res.status(500).json({ status: 1, msg: err.message });
                }

                // 内存合并: 构建 Set 加速查找 (统一转为字符串比较，防止类型不一致)
                const selectedIds = new Set(selectedRows.map(row => Number(row.mbid)));
                logger.info(`[Selection Fix] Selected IDs: ${Array.from(selectedIds).join(',')}`);

                // 遍历标准库列表，标记 checked
                const items = standards.map(item => {
                    const isSelected = selectedIds.has(Number(item.id));
                    // logger.info(`[Selection Fix] Item ID: ${item.id}, Type: ${typeof item.id}, IsSelected: ${isSelected}`);
                    return {
                        ...item,
                        checked: isSelected
                    };
                });

                res.json({
                    status: 0,
                    msg: "ok",
                    data: {
                        items: items,
                        selectedIds: Array.from(selectedIds),
                        total: countRow ? countRow.total : 0
                    }
                });
            });
        });
    });
});


module.exports = router;

