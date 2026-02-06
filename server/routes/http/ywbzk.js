/**
 * 业务标准库 CRUD 接口
 * 处理标准模板的增删改查
 */

const express = require('express');
const router = express.Router();
const db = require('../../db');
const logger = require('../../utils/logger');

/**
 * 1. 获取列表 (POST /list)
 * 支持分页和关键字查询
 */
router.post('/list', (req, res) => {
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

    sql += " ORDER BY pxh ASC, id DESC LIMIT ? OFFSET ?";
    const queryParams = [...params, parseInt(perPage), parseInt(offset)];

    db.get(countSql, params, (err, countRow) => {
        if (err) {
            logger.error(`Failed to count ywbzk: ${err.message}`);
            return res.status(500).json({ status: 1, msg: err.message });
        }

        db.all(sql, queryParams, (err, rows) => {
            if (err) {
                logger.error(`Failed to query ywbzk: ${err.message}`);
                return res.status(500).json({ status: 1, msg: err.message });
            }

            res.json({
                status: 0,
                msg: "ok",
                data: {
                    items: rows,
                    total: countRow.total
                }
            });
        });
    });
});

/**
 * 2. 获取详情 (POST /get)
 * 包含关联的属性组
 */
router.post('/get', (req, res) => {
    const { id } = req.body;
    if (!id) {
        return res.status(400).json({ status: 1, msg: "ID is required" });
    }

    const sql = "SELECT * FROM gjj_ywbzk WHERE id = ?";
    db.get(sql, [id], (err, row) => {
        if (err) {
            return res.status(500).json({ status: 1, msg: err.message });
        }
        if (!row) {
            return res.status(404).json({ status: 1, msg: "Record not found" });
        }

        // 查询关联的属性
        const sxSql = "SELECT * FROM gjj_ywbzksx WHERE mbid = ?";
        db.all(sxSql, [id], (err, sxRows) => {
            if (err) {
                return res.status(500).json({ status: 1, msg: err.message });
            }
            row.ywblbzsxz = sxRows; // 对应 UI 中的 combo name
            res.json({ status: 0, msg: "ok", data: row });
        });
    });
});

/**
 * 3. 保存 (新增 or 修改) (POST /save)
 * 自动处理事务和属性组同步
 */
router.post('/save', async (req, res) => {
    const { id, pxh, ywblbz, ywbzz, ywbzjg, ywblbzsm, gjsjsf, ywnrfl, bzfl, ywblbzsxz } = req.body;

    try {
        // 使用 Promise 封装数据库操作以支持 async/await 流程控制
        const runQuery = (sql, params) => new Promise((resolve, reject) => {
            db.run(sql, params, function (err) {
                if (err) reject(err);
                else resolve(this);
            });
        });

        // 开启事务 (注意: sqlite3 不直接支持 Promise 事务管理，这里我们按顺序执行)
        // 为简单起见，我们先处理主表，再处理子表

        let mbid = id;
        if (id) {
            // 更新
            const updateSql = `
                UPDATE gjj_ywbzk SET 
                pxh = ?, ywblbz = ?, ywbzz = ?, ywbzjg = ?, ywblbzsm = ?, 
                gjsjsf = ?, ywnrfl = ?, bzfl = ?, gxsj = CURRENT_TIMESTAMP
                WHERE id = ?
            `;
            await runQuery(updateSql, [pxh, ywblbz, ywbzz, ywbzjg, ywblbzsm, gjsjsf, ywnrfl, bzfl, id]);

            // 删除原有关联属性，稍后重新插入
            await runQuery("DELETE FROM gjj_ywbzksx WHERE mbid = ?", [id]);
        } else {
            // 新增
            const insertSql = `
                INSERT INTO gjj_ywbzk (pxh, ywblbz, ywbzz, ywbzjg, ywblbzsm, gjsjsf, ywnrfl, bzfl)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `;
            const result = await runQuery(insertSql, [pxh, ywblbz, ywbzz, ywbzjg, ywblbzsm, gjsjsf, ywnrfl, bzfl]);
            mbid = result.lastID;
        }

        // 插入属性组
        if (ywblbzsxz && Array.isArray(ywblbzsxz)) {
            for (const sx of ywblbzsxz) {
                const sxInsertSql = `
                    INSERT INTO gjj_ywbzksx (mbid, ywblbzdx, fwdxbq, ywblbzsx, sxly, ywblbzyg)
                    VALUES (?, ?, ?, ?, ?, ?)
                `;
                await runQuery(sxInsertSql, [mbid, sx.ywblbzdx, sx.fwdxbq, sx.ywblbzsx, sx.sxly, sx.ywblbzyg]);
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
 * 包含子表级联删除 (已经在数据库外键中配置为 ON DELETE CASCADE)
 */
router.post('/delete', (req, res) => {
    const { id } = req.body;
    if (!id) {
        return res.status(400).json({ status: 1, msg: "ID is required" });
    }

    const sql = "DELETE FROM gjj_ywbzk WHERE id = ?";
    db.run(sql, [id], function (err) {
        if (err) {
            logger.error(`Failed to delete ywbzk: ${err.message}`);
            return res.status(500).json({ status: 1, msg: err.message });
        }
        res.json({ status: 0, msg: "删除成功" });
    });
});

module.exports = router;
