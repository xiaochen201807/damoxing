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

        // 查询关联的属性 (KV)
        const sxSql = "SELECT sxmc, sxz FROM gjj_ywbzsx WHERE ywid = ?";
        db.all(sxSql, [id], (err, sxRows) => {
            if (err) return res.status(500).json({ status: 1, msg: err.message });

            // 转换为 数组 格式供 AMIS combo 使用 (更符合当前模板)
            const attributes = sxRows.map(item => ({
                sxmc: item.sxmc,
                sxz: item.sxz
            }));

            row.attributes = attributes;
            res.json({ status: 0, msg: "ok", data: row });
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

        const sxSql = "SELECT sxmc, sxz FROM gjj_ywbzsx WHERE ywid = ?";
        db.all(sxSql, [id], (err, sxRows) => {
            if (err) return res.status(500).json({ status: 1, msg: err.message });

            const rule_params = {};
            sxRows.forEach(item => {
                rule_params[item.sxmc] = item.sxz;
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

        // 插入新属性 (支持数组 attributes 或对象 rule_params)
        const attrs = attributes || rule_params;
        if (attrs) {
            if (Array.isArray(attrs)) {
                for (const attr of attrs) {
                    if (attr.sxmc && attr.sxz) {
                        await runQuery("INSERT INTO gjj_ywbzsx (ywid, sxmc, sxz) VALUES (?, ?, ?)", [ywid, attr.sxmc, attr.sxz]);
                    }
                }
            } else if (typeof attrs === 'object') {
                for (const [key, value] of Object.entries(attrs)) {
                    await runQuery("INSERT INTO gjj_ywbzsx (ywid, sxmc, sxz) VALUES (?, ?, ?)", [ywid, key, value]);
                }
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
            for (const [key, value] of Object.entries(rule_params)) {
                await runQuery("INSERT INTO gjj_ywbzsx (ywid, sxmc, sxz) VALUES (?, ?, ?)", [id, key, value]);
            }
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
    const syncIds = selected_ids || (ids ? ids.split(',') : null);

    if (!syncIds || !Array.isArray(syncIds)) {
        return res.status(400).json({ status: 1, msg: "请选择同步项" });
    }

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

        const templates = await getStandards(syncIds);

        for (const tpl of templates) {
            // 检查是否已同步过且规则名称一致 (避免重复，这里简单以 mbid 区分)
            // 如果需要支持多次同步不同规则名，可以去掉此限制
            const insertSql = `
                INSERT INTO gjj_ywbz (mbid, gzmc, ywsf, gzljsm, sfqy, jgbh, zjgbh)
                VALUES (?, ?, ?, ?, 1, ?, ?)
            `;
            await runQuery(insertSql, [tpl.id, tpl.ywblbz, tpl.gjsjsf, tpl.ywblbzsm, req.body.jgbh, req.body.zjgbh]);
        }

        res.json({ status: 0, msg: `同步成功，共导入 ${templates.length} 条规则` });

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

                // 内存合并: 构建 Set 加速查找
                const selectedIds = new Set(selectedRows.map(row => row.mbid));

                // 遍历标准库列表，标记 is_selected
                const items = standards.map(item => ({
                    ...item,
                    is_selected: selectedIds.has(item.id) ? 1 : 0
                }));

                res.json({
                    status: 0,
                    msg: "ok",
                    data: {
                        items: items,
                        total: countRow ? countRow.total : 0
                    }
                });
            });
        });
    });
});

module.exports = router;
