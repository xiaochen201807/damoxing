/**
 * 程序控制规则管理 CRUD 接口
 * 对应表 gjj_cxgzkz
 */

const express = require('express');
const router = express.Router();
const db = require('../../db');
const SqlHelper = require('../../utils/sqlHelper');
const logger = require('../../utils/logger');
const { authenticateToken } = require('../../middleware/auth');

/**
 * 1. 获取列表 (POST /list)
 */
router.post('/list', async (req, res) => {
    const { page = 1, perPage = 10, rwxbh, gzmc, gztsy, sfqy, sfyxtqy, sfyxtztsy } = req.body;
    const offset = (page - 1) * perPage;

    // 从请求头获取当前机构信息
    const jgbh = req.body.jgbh || req.headers['jgbh'] || req.headers['zzbs'] || '';
    const zjgbh = req.body.zjgbh || req.headers['zjgbh'] || req.headers['zzjgdmz'] || '';
    const coalesce = SqlHelper.isOracle ? 'NVL' : 'IFNULL';

    let sql = `
        SELECT *
        FROM gjj_cxgzkz
        WHERE ${coalesce}(jgbh, '') = ? AND ${coalesce}(zjgbh, '') = ?
    `;
    let countSql = `
        SELECT COUNT(*) as total 
        FROM gjj_cxgzkz
        WHERE ${coalesce}(jgbh, '') = ? AND ${coalesce}(zjgbh, '') = ?
    `;
    const params = [jgbh, zjgbh];

    if (rwxbh) {
        sql += " AND rwxbh = ?";
        countSql += " AND rwxbh = ?";
        params.push(rwxbh);
    }
    if (gzmc) {
        sql += " AND gzmc LIKE ?";
        countSql += " AND gzmc LIKE ?";
        params.push(`%${gzmc}%`);
    }
    if (gztsy) {
        sql += " AND gztsy LIKE ?";
        countSql += " AND gztsy LIKE ?";
        params.push(`%${gztsy}%`);
    }
    if (sfqy) {
        sql += " AND sfqy = ?";
        countSql += " AND sfqy = ?";
        params.push(sfqy);
    }
    if (sfyxtqy) {
        sql += " AND sfyxtqy = ?";
        countSql += " AND sfyxtqy = ?";
        params.push(sfyxtqy);
    }
    if (sfyxtztsy) {
        sql += " AND sfyxtztsy = ?";
        countSql += " AND sfyxtztsy = ?";
        params.push(sfyxtztsy);
    }

    sql += " ORDER BY id DESC";
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
        logger.error(`Failed to query gjj_cxgzkz: ${err.message}`);
        res.status(500).json({ status: 1, msg: err.message });
    }
});

/**
 * 2. 获取详情 (POST /get)
 */
router.post('/get', async (req, res) => {
    const { id } = req.body;
    if (!id) return res.status(400).json({ status: 1, msg: "ID is required" });

    const jgbh = req.body.jgbh || req.headers['jgbh'] || req.headers['zzbs'] || '';
    const zjgbh = req.body.zjgbh || req.headers['zjgbh'] || req.headers['zzjgdmz'] || '';
    const coalesce = SqlHelper.isOracle ? 'NVL' : 'IFNULL';

    try {
        const sql = `SELECT * FROM gjj_cxgzkz WHERE id = ? AND ${coalesce}(jgbh, '') = ? AND ${coalesce}(zjgbh, '') = ?`;
        const row = await db.oracle.get(sql, [id, jgbh, zjgbh]);

        if (!row) return res.status(404).json({ status: 1, msg: "Record not found" });

        res.json({ status: 0, msg: "ok", data: row });
    } catch (err) {
        res.status(500).json({ status: 1, msg: err.message });
    }
});

/**
 * 3. 获取详情 (GET /:id)
 */
router.get('/:id(\\d+)', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const jgbh = req.headers['jgbh'] || req.headers['zzbs'] || '';
    const zjgbh = req.headers['zjgbh'] || req.headers['zzjgdmz'] || '';
    const coalesce = SqlHelper.isOracle ? 'NVL' : 'IFNULL';

    try {
        const sql = `SELECT * FROM gjj_cxgzkz WHERE id = ? AND ${coalesce}(jgbh, '') = ? AND ${coalesce}(zjgbh, '') = ?`;
        const row = await db.oracle.get(sql, [id, jgbh, zjgbh]);

        if (!row) return res.status(404).json({ status: 1, msg: "Record not found" });

        res.json({ status: 0, msg: "ok", data: row });
    } catch (err) {
        res.status(500).json({ status: 1, msg: err.message });
    }
});

/**
 * 4. 保存 (POST /save)
 */
router.post('/save', async (req, res) => {
    const { id, rwxbh, gzmc, gztsy, sfqy, sfyxtqy, sfyxtztsy, role } = req.body;

    const jgbh = req.body.jgbh || req.headers['jgbh'] || req.headers['zzbs'] || '';
    const zjgbh = req.body.zjgbh || req.headers['zjgbh'] || req.headers['zzjgdmz'] || '';
    const coalesce = SqlHelper.isOracle ? 'NVL' : 'IFNULL';

    try {
        const { id: savedId } = await db.oracle.transaction(async (tx) => {
            let rowId = id;
            if (id) {
                const updateSql = `UPDATE gjj_cxgzkz SET rwxbh=?, gzmc=?, gztsy=?, sfqy=?, sfyxtqy=?, sfyxtztsy=?, role=? WHERE id=? AND ${coalesce}(jgbh, '') = ? AND ${coalesce}(zjgbh, '') = ?`;
                await tx.run(updateSql, [rwxbh, gzmc, gztsy, sfqy, sfyxtqy, sfyxtztsy, role, id, jgbh, zjgbh]);
            } else {
                const insertSql = `INSERT INTO gjj_cxgzkz (jgbh, zjgbh, rwxbh, gzmc, gztsy, sfqy, sfyxtqy, sfyxtztsy, role) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
                await tx.run(insertSql, [jgbh, zjgbh, rwxbh, gzmc, gztsy, sfqy, sfyxtqy, sfyxtztsy, role]);

                const lastRow = await tx.get("SELECT MAX(id) as id FROM gjj_cxgzkz");
                rowId = lastRow?.id ?? lastRow?.ID;
            }
            return { id: rowId };
        });

        res.json({ status: 0, msg: "保存成功", data: { id: savedId } });
    } catch (err) {
        logger.error(`Failed to save gjj_cxgzkz: ${err.message}`);
        res.status(500).json({ status: 1, msg: err.message });
    }
});

/**
 * 5. PUT /:id
 */
router.put('/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { rwxbh, gzmc, gztsy, sfqy, sfyxtqy, sfyxtztsy, role } = req.body;

    const jgbh = req.headers['jgbh'] || req.headers['zzbs'] || '';
    const zjgbh = req.headers['zjgbh'] || req.headers['zzjgdmz'] || '';
    const coalesce = SqlHelper.isOracle ? 'NVL' : 'IFNULL';

    try {
        const updateSql = `
            UPDATE gjj_cxgzkz SET 
            rwxbh=?, gzmc=?, gztsy=?, sfqy=?, sfyxtqy=?, sfyxtztsy=?, role=?
            WHERE id = ? AND ${coalesce}(jgbh, '') = ? AND ${coalesce}(zjgbh, '') = ?
        `;
        await db.oracle.run(updateSql, [rwxbh, gzmc, gztsy, sfqy, sfyxtqy, sfyxtztsy, role, id, jgbh, zjgbh]);

        res.json({ status: 0, msg: "更新成功" });
    } catch (err) {
        res.status(500).json({ status: 1, msg: err.message });
    }
});

/**
 * 6. 删除 (POST /delete)
 */
router.post('/delete', async (req, res) => {
    let { id, jgbh, zjgbh } = req.body;
    if (!id) return res.status(400).json({ status: 1, msg: "ID is required" });

    if (!jgbh) jgbh = req.headers['jgbh'] || '';
    if (!zjgbh) zjgbh = req.headers['zjgbh'] || '';

    try {
        const coalesce = SqlHelper.isOracle ? 'NVL' : 'IFNULL';
        const checkSql = `
            SELECT id FROM gjj_cxgzkz 
            WHERE id = ? 
            AND ${coalesce}(jgbh, '') = ? 
            AND ${coalesce}(zjgbh, '') = ?
        `;
        const record = await db.oracle.get(checkSql, [id, jgbh, zjgbh]);

        if (!record) {
            return res.status(403).json({ status: 1, msg: "无权删除此记录或记录不存在" });
        }

        await db.oracle.run(`DELETE FROM gjj_cxgzkz WHERE id = ? AND ${coalesce}(jgbh, '') = ? AND ${coalesce}(zjgbh, '') = ?`, [id, jgbh, zjgbh]);

        res.json({ status: 0, msg: "删除成功" });
    } catch (err) {
        logger.error(`Delete failed: ${err.message}`);
        res.status(500).json({ status: 1, msg: err.message });
    }
});

/**
 * 7. DELETE /:id
 */
router.delete('/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;

    const jgbh = req.headers['jgbh'] || req.headers['zzbs'] || '';
    const zjgbh = req.headers['zjgbh'] || req.headers['zzjgdmz'] || '';
    const coalesce = SqlHelper.isOracle ? 'NVL' : 'IFNULL';

    try {
        const checkSql = `
            SELECT id FROM gjj_cxgzkz 
            WHERE id = ? 
            AND ${coalesce}(jgbh, '') = ? 
            AND ${coalesce}(zjgbh, '') = ?
        `;
        const record = await db.oracle.get(checkSql, [id, jgbh, zjgbh]);

        if (!record) {
            return res.status(403).json({ status: 1, msg: "无权删除此记录或记录不存在" });
        }

        await db.oracle.run(`DELETE FROM gjj_cxgzkz WHERE id = ? AND ${coalesce}(jgbh, '') = ? AND ${coalesce}(zjgbh, '') = ?`, [id, jgbh, zjgbh]);

        res.json({ status: 0, msg: "删除成功" });
    } catch (err) {
        logger.error(`Delete failed: ${err.message}`);
        res.status(500).json({ status: 1, msg: err.message });
    }
});


module.exports = router;
