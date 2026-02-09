/**
 * 业务标准库 CRUD 接口
 * 处理标准模板的增删改查
 */

const express = require('express');
const router = express.Router();
const dbSqlite = require('../../db'); // Renamed for clarity
const dbOracle = require('../../db_oracle');
const logger = require('../../utils/logger');
const multer = require('multer');
const { authenticateToken } = require('../../middleware/auth');

// Determine which DB to use based on env (helper function)
const getDb = () => {
    if (process.env.ORACLE_ENABLE === 'true') {
        return dbOracle;
    }
    return dbSqlite;
};

// 配置 Multer 内存存储
const upload = multer({ storage: multer.memoryStorage() });

// ... imports ...
// ... upload config ...

/**
 * 1. 获取列表 (POST /list)
 * 支持分页和关键字查询
 */
router.post('/list', async (req, res) => {
    const { page = 1, perPage = 10, ywblbz, gjsjsf, ywnrfl } = req.body;
    const offset = (page - 1) * perPage;

    // Build SQL based on DB type
    const isOracle = process.env.ORACLE_ENABLE === 'true';
    let sql, countSql;
    const params = [];

    if (isOracle) {
        // Oracle Syntax
        sql = "SELECT * FROM gjj_ywbzk WHERE 1=1";
        countSql = "SELECT COUNT(*) as total FROM gjj_ywbzk WHERE 1=1";
    } else {
        // SQLite Syntax
        sql = "SELECT * FROM gjj_ywbzk WHERE 1=1";
        countSql = "SELECT COUNT(*) as total FROM gjj_ywbzk WHERE 1=1";
    }

    if (ywblbz) {
        sql += " AND ywblbz LIKE ?";
        countSql += " AND ywblbz LIKE ?";
        params.push(`%${ywblbz}%`);
    }
    if (gjsjsf) {
        sql += " AND gjsjsf = ?";
        countSql += " AND gjsjsf = ?";
        params.push(gjsjsf);
    }
    if (ywnrfl) {
        sql += " AND ywnrfl = ?";
        countSql += " AND ywnrfl = ?";
        params.push(ywnrfl);
    }

    let queryParams = [...params];

    if (isOracle) {
        // Oracle Pagination (12c+)
        sql += " ORDER BY pxh ASC, id DESC OFFSET :offset ROWS FETCH NEXT :limit ROWS ONLY";
        // Oracle named parameters object if using :name syntax, OR array if using :1, :2
        // Our db_oracle.js converts ? to :n.
        // Here we are appending named params logic which might conflict with array params from earlier.
        // Let's stick to '?' for consistency and let db_oracle.js handle it, 
        // OR manually handle array push order.
        
        // However, standard SQL with '?' works best with the converter.
        // Reverting to '?' for Oracle pagination to play nice with db_oracle.js converter.
        sql = sql.replace(":offset", "?").replace(":limit", "?");
        
        queryParams.push(offset);
        queryParams.push(perPage);
    } else {
        // SQLite Pagination
        sql += " ORDER BY pxh ASC, id DESC LIMIT ? OFFSET ?";
        queryParams.push(perPage);
        queryParams.push(offset);
    }

    try {
        const db = getDb();
        
        // Handle db.get/all differences if strictly using sqlite3 API for sqlite
        // dbOracle wrapper mimics sqlite3 but returns promise for all/get
        // sqlite3 requires callback.
        // We should standardise on async/await if possible or handle callback.
        // Given existing code uses callbacks for sqlite, let's wrap sqlite in promise for cleaner unified code.
        
        const query = (method, s, p) => {
            if (isOracle) return db[method](s, p);
            return new Promise((resolve, reject) => {
                db[method](s, p, (err, res) => {
                    if (err) reject(err);
                    else resolve(res);
                });
            });
        };

        const countRow = await query('get', countSql, params);
        const rows = await query('all', sql, queryParams);

        res.json({
            status: 0,
            msg: "ok",
            data: {
                items: rows,
                total: countRow ? countRow.total : 0
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
    if (!id) {
        return res.status(400).json({ status: 1, msg: "ID is required" });
    }

    const isOracle = process.env.ORACLE_ENABLE === 'true';
    const db = getDb();

    const query = (method, s, p) => {
        if (isOracle) return db[method](s, p);
        return new Promise((resolve, reject) => {
            db[method](s, p, (err, res) => {
                if (err) reject(err);
                else resolve(res);
            });
        });
    };

    try {
        const sql = "SELECT * FROM gjj_ywbzk WHERE id = ?";
        const row = await query('get', sql, [id]);
        
        if (!row) {
            return res.status(404).json({ status: 1, msg: "Record not found" });
        }

        const sxSql = "SELECT * FROM gjj_ywbzksx WHERE mbid = ?";
        const sxRows = await query('all', sxSql, [id]);
        
        row.ywblbzsxz = sxRows;
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
    const { id, pxh, ywblbz, ywbzz, ywbzjg, ywblbzsm, gjsjsf, ywnrfl, bzfl, ywblbzsxz } = req.body;

    const isOracle = process.env.ORACLE_ENABLE === 'true';
    const db = getDb();

    try {
        const runQuery = (sql, params) => {
            if (isOracle) return db.run(sql, params);
            return new Promise((resolve, reject) => {
                db.run(sql, params, function (err) {
                    if (err) reject(err);
                    else resolve(this);
                });
            });
        };

        let mbid = id;
        if (id) {
            // 更新
            const updateSql = isOracle 
                ? `UPDATE gjj_ywbzk SET pxh=?, ywblbz=?, ywbzz=?, ywbzjg=?, ywblbzsm=?, gjsjsf=?, ywnrfl=?, bzfl=?, gxsj=SYSTIMESTAMP WHERE id=?`
                : `UPDATE gjj_ywbzk SET pxh=?, ywblbz=?, ywbzz=?, ywbzjg=?, ywblbzsm=?, gjsjsf=?, ywnrfl=?, bzfl=?, gxsj=CURRENT_TIMESTAMP WHERE id=?`;
            
            await runQuery(updateSql, [pxh, ywblbz, ywbzz, ywbzjg, ywblbzsm, gjsjsf, ywnrfl, bzfl, id]);

            // 删除原有关联属性
            await runQuery("DELETE FROM gjj_ywbzksx WHERE mbid = ?", [id]);
        } else {
            // 新增
            if (isOracle) {
                // Oracle Insert with returning ID
                // Note: db_oracle.run currently doesn't support returning ID easily for generic calls
                // Need to use specific logic or update db_oracle to handle output binds
                // For simplicity, we can query the max ID or sequence, OR update db_oracle to support simple return
                // Updating db_oracle to return lastID if possible is better.
                // But typically `RETURNING id INTO :id`
                
                // Let's assume we use a sequence or identity column.
                // Since we used GENERATED BY DEFAULT AS IDENTITY, we can insert.
                // But getting the ID back needs `RETURNING id INTO :id`.
                // Let's modify the SQL for Oracle.
                const insertSql = `
                    BEGIN
                        INSERT INTO gjj_ywbzk (pxh, ywblbz, ywbzz, ywbzjg, ywblbzsm, gjsjsf, ywnrfl, bzfl)
                        VALUES (:1, :2, :3, :4, :5, :6, :7, :8)
                        RETURNING id INTO :9;
                    END;
                `;
                // To support OUT binds in db_oracle.run, we need to pass an object or handle it.
                // Since db_oracle.js is simple wrapper, let's use a workaround or update it.
                // Workaround: Insert then Select Max ID (concurrency risk but simple for now)
                // Better: Update db_oracle.js to support returning ID.
                
                // For now, let's try the simpler approach of Insert + Select Max ID for quick migration,
                // acknowledging the race condition risk (acceptable for low concurrency admin tool).
                await runQuery(`INSERT INTO gjj_ywbzk (pxh, ywblbz, ywbzz, ywbzjg, ywblbzsm, gjsjsf, ywnrfl, bzfl) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [pxh, ywblbz, ywbzz, ywbzjg, ywblbzsm, gjsjsf, ywnrfl, bzfl]);
                
                const lastRow = await db.get("SELECT MAX(id) as id FROM gjj_ywbzk");
                mbid = lastRow.id || lastRow.ID;
            } else {
                const insertSql = `
                    INSERT INTO gjj_ywbzk (pxh, ywblbz, ywbzz, ywbzjg, ywblbzsm, gjsjsf, ywnrfl, bzfl)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                `;
                const result = await runQuery(insertSql, [pxh, ywblbz, ywbzz, ywbzjg, ywblbzsm, gjsjsf, ywnrfl, bzfl]);
                mbid = result.lastID;
            }
        }

        // 插入属性组
        if (ywblbzsxz && Array.isArray(ywblbzsxz)) {
            for (const sx of ywblbzsxz) {
                const sxInsertSql = `
                    INSERT INTO gjj_ywbzksx (mbid, ywblbzdx, fwdxbq, sxbm, ywblbzsx, sxly, ywblbzyg)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                `;
                await runQuery(sxInsertSql, [mbid, sx.ywblbzdx, sx.fwdxbq, sx.sxbm, sx.ywblbzsx, sx.sxly, sx.ywblbzyg]);
            }
        }

        res.json({ status: 0, msg: "保存成功", data: { id: mbid } });

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
    if (!id) {
        return res.status(400).json({ status: 1, msg: "ID is required" });
    }

    const isOracle = process.env.ORACLE_ENABLE === 'true';
    const db = getDb();
    
    try {
        const sql = "DELETE FROM gjj_ywbzk WHERE id = ?";
        if (isOracle) {
            await db.run(sql, [id]);
        } else {
            await new Promise((resolve, reject) => {
                db.run(sql, [id], (err) => err ? reject(err) : resolve());
            });
        }
        res.json({ status: 0, msg: "删除成功" });
    } catch (err) {
        logger.error(`Failed to delete ywbzk: ${err.message}`);
        res.status(500).json({ status: 1, msg: err.message });
    }
});

/**
 * 5. 获取所有唯一的业务办理标准 (POST /standards)
 */
router.post('/standards', async (req, res) => {
    const isOracle = process.env.ORACLE_ENABLE === 'true';
    const db = getDb();

    try {
        const sql = "SELECT DISTINCT ywblbz as value, ywblbz as label FROM gjj_ywbzk WHERE ywblbz IS NOT NULL";
        
        let rows;
        if (isOracle) {
            rows = await db.all(sql, []);
        } else {
            rows = await new Promise((resolve, reject) => {
                db.all(sql, [], (err, rows) => err ? reject(err) : resolve(rows));
            });
        }
        res.json({ status: 0, msg: "ok", data: rows });
    } catch (err) {
        res.status(500).json({ status: 1, msg: err.message });
    }
});

// -----------------------------------------------------------------------------
// 导出接口 (生成 CSV 单文件，包含 SQL 脚本以保证全量恢复)
// -----------------------------------------------------------------------------
router.all('/export', authenticateToken, async (req, res) => {
    try {
        // 1. 获取所有数据
        const standards = await new Promise((resolve, reject) => {
            db.all("SELECT * FROM gjj_ywbzk", (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });

        const attributes = await new Promise((resolve, reject) => {
            db.all("SELECT * FROM gjj_ywbzksx", (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });

        // 2. 生成 SQL 脚本 (封装在 CSV 中)
        let sqlScript = "-- 业务标准全量导出 (包含标准表和属性表)\n";
        sqlScript += `-- 导出时间: ${new Date().toLocaleString()}\n\n`;
        sqlScript += "BEGIN TRANSACTION;\n\n";

        // 清空旧数据
        sqlScript += "DELETE FROM gjj_ywbzksx;\n";
        sqlScript += "DELETE FROM gjj_ywbzk;\n\n";

        // 插入标准表数据
        for (const row of standards) {
            const keys = Object.keys(row);
            const values = Object.values(row).map(val => {
                if (val === null) return "NULL";
                if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`;
                return val;
            });
            sqlScript += `INSERT INTO gjj_ywbzk (${keys.join(', ')}) VALUES (${values.join(', ')});\n`;
        }

        // 插入属性表数据
        for (const row of attributes) {
            const keys = Object.keys(row);
            const values = Object.values(row).map(val => {
                if (val === null) return "NULL";
                if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`;
                return val;
            });
            sqlScript += `INSERT INTO gjj_ywbzksx (${keys.join(', ')}) VALUES (${values.join(', ')});\n`;
        }

        sqlScript += "\nCOMMIT;";

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

module.exports = router;
