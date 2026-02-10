/**
 * 业务标准库 CRUD 接口
 * 处理标准模板的增删改查
 */

const express = require('express');
const router = express.Router();
const db = require('../../db');
const SqlHelper = require('../../utils/sqlHelper');
const logger = require('../../utils/logger');
const multer = require('multer');
const { authenticateToken } = require('../../middleware/auth');
const fs = require('fs');
const path = require('path');

const upload = multer({ storage: multer.memoryStorage() });

/**
 * 1. 获取列表 (POST /list)
 * 支持分页和关键字查询
 */
router.post('/list', async (req, res) => {
    const { page = 1, perPage = 10, ywblbz, gjsjsf, ywnrfl } = req.body;
    const offset = (page - 1) * perPage;

    let sql = "SELECT * FROM gjj_ywbzk WHERE 1=1";
    let countSql = "SELECT COUNT(*) as total FROM gjj_ywbzk WHERE 1=1";
    const params = [];

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

    // 分页
    sql += " ORDER BY pxh ASC, id DESC";
    const paged = SqlHelper.paginateQuery(sql, params, perPage, offset);

    try {
        const countRow = await db.oracle.get(countSql, params);
        const rows = await db.oracle.all(paged.sql, paged.params);

        res.json({
            status: 0,
            msg: "ok",
            data: {
                items: rows,
                total: countRow ? (countRow.total || countRow.TOTAL) : 0 // Oracle keys might be uppercase
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

    try {
        const sql = "SELECT * FROM gjj_ywbzk WHERE id = ?";
        const row = await db.oracle.get(sql, [id]);

        if (!row) {
            return res.status(404).json({ status: 1, msg: "Record not found" });
        }

        const sxSql = "SELECT * FROM gjj_ywbzksx WHERE mbid = ?";
        const sxRows = await db.oracle.all(sxSql, [id]);

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

    try {
        const { id: savedId } = await db.oracle.transaction(async (tx) => {
            let mbid = id;
            if (id) {
                const updateSql = `UPDATE gjj_ywbzk SET pxh=:1, ywblbz=:2, ywbzz=:3, ywbzjg=:4, ywblbzsm=:5, gjsjsf=:6, ywnrfl=:7, bzfl=:8, gxsj=${SqlHelper.now()} WHERE id=:9`;
                await tx.run(updateSql, [pxh, ywblbz, ywbzz, ywbzjg, ywblbzsm, gjsjsf, ywnrfl, bzfl, id]);
                await tx.run("DELETE FROM gjj_ywbzksx WHERE mbid = :1", [id]);
            } else {
                const insertSql = `INSERT INTO gjj_ywbzk (pxh, ywblbz, ywbzz, ywbzjg, ywblbzsm, gjsjsf, ywnrfl, bzfl) VALUES (:1, :2, :3, :4, :5, :6, :7, :8)`;
                await tx.run(insertSql, [pxh, ywblbz, ywbzz, ywbzjg, ywblbzsm, gjsjsf, ywnrfl, bzfl]);

                // Oracle 获取自增 ID
                const lastRow = await tx.get("SELECT MAX(id) as id FROM gjj_ywbzk");
                mbid = lastRow?.id ?? lastRow?.ID;
            }

            if (ywblbzsxz && Array.isArray(ywblbzsxz)) {
                for (const sx of ywblbzsxz) {
                    const sxInsertSql = `
                        INSERT INTO gjj_ywbzksx (mbid, ywblbzdx, fwdxbq, sxbm, ywblbzsx, sxly, ywblbzyg)
                        VALUES (:1, :2, :3, :4, :5, :6, :7)
                    `;
                    await tx.run(sxInsertSql, [mbid, sx.ywblbzdx, sx.fwdxbq, sx.sxbm, sx.ywblbzsx, sx.sxly, sx.ywblbzyg]);
                }
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
    if (!id) {
        return res.status(400).json({ status: 1, msg: "ID is required" });
    }

    try {
        const sql = "DELETE FROM gjj_ywbzk WHERE id = ?";
        await db.oracle.run(sql, [id]);
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
    try {
        const sql = "SELECT DISTINCT ywblbz as value, ywblbz as label FROM gjj_ywbzk WHERE ywblbz IS NOT NULL";
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
        const standards = await db.oracle.all("SELECT * FROM gjj_ywbzk");
        const attributes = await db.oracle.all("SELECT * FROM gjj_ywbzksx");

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
        return res.download(exportPath, exportFileName, {
            headers: {
                'Access-Control-Expose-Headers': 'Content-Disposition'
            }
        });

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
        await db.oracle.exec(sqlContent);

        logger.info("Import successful");
        res.json({ status: 0, msg: "导入成功" });

    } catch (err) {
        logger.error(`Import failed: ${err.message}`);
        res.status(500).json({ status: 1, msg: "导入失败: " + err.message });
    }
});

module.exports = router;
