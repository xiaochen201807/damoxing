/**
 * 通用工具接口
 * 处理公共元数据、下拉列表数据等
 */

const express = require('express');
const router = express.Router();
const dbSqlite = require('../../db');
const dbOracle = require('../../db_oracle');
const logger = require('../../utils/logger');

// Determine which DB to use based on env (helper function)
const getDb = () => {
    if (process.env.ORACLE_ENABLE === 'true') {
        return dbOracle;
    }
    return dbSqlite;
};

// Helper for unified query execution
const queryAll = (sql, params = []) => {
    const isOracle = process.env.ORACLE_ENABLE === 'true';
    const db = getDb();
    
    if (isOracle) return db.all(sql, params);
    
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
};

/**
 * 1. 获取业务内容分类 (POST /business-content-classes)
 * 从 ywbzk 表中提取唯一的业务内容分类
 */
router.post('/business-content-classes', async (req, res) => {
    const sql = "SELECT DISTINCT ywnrfl as value, ywnrfl as label FROM gjj_ywbzk WHERE ywnrfl IS NOT NULL";
    try {
        const rows = await queryAll(sql);
        res.json({ status: 0, msg: "ok", data: rows });
    } catch (err) {
        logger.error(`[Tools API] Failed to fetch business content classes: ${err.message}`);
        res.status(500).json({ status: 1, msg: err.message });
    }
});

/**
 * 2. 获取业务办理标准值 (POST /business-standard-values)
 * 从 ywbzk 表中提取唯一的业务办理标准值 (ywbzz)
 */
router.post('/business-standard-values', async (req, res) => {
    const sql = "SELECT DISTINCT ywbzz as value, ywbzz as label FROM gjj_ywbzk WHERE ywbzz IS NOT NULL";
    try {
        const rows = await queryAll(sql);
        res.json({ status: 0, msg: "ok", data: rows });
    } catch (err) {
        logger.error(`[Tools API] Failed to fetch business standard values: ${err.message}`);
        res.status(500).json({ status: 1, msg: err.message });
    }
});

/**
 * 3. 获取服务对象 (POST /service-objects)
 * 从 ywbzksx 表中提取唯一的服务对象标签 (fwdxbq)
 */
router.post('/service-objects', async (req, res) => {
    const sql = "SELECT DISTINCT fwdxbq as value, fwdxbq as label FROM gjj_ywbzksx WHERE fwdxbq IS NOT NULL";
    try {
        const rows = await queryAll(sql);
        res.json({ status: 0, msg: "ok", data: rows });
    } catch (err) {
        logger.error(`[Tools API] Failed to fetch service objects: ${err.message}`);
        res.status(500).json({ status: 1, msg: err.message });
    }
});

/**
 * 4. 获取业务办理标准属性 (POST /business-standard-attributes)
 * 从 ywbzksx 表中提取唯一的标准属性 (ywblbzsx)
 */
router.post('/business-standard-attributes', async (req, res) => {
    const sql = "SELECT DISTINCT ywblbzsx as value, ywblbzsx as label, sxbm FROM gjj_ywbzksx WHERE ywblbzsx IS NOT NULL";
    try {
        const rows = await queryAll(sql);
        res.json({ status: 0, msg: "ok", data: rows });
    } catch (err) {
        logger.error(`[Tools API] Failed to fetch business standard attributes: ${err.message}`);
        res.status(500).json({ status: 1, msg: err.message });
    }
});

module.exports = router;
