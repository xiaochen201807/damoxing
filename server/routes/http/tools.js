/**
 * 通用工具接口
 * 处理公共元数据、下拉列表数据等
 */

const express = require('express');
const router = express.Router();
const db = require('../../db');
const logger = require('../../utils/logger');

/**
 * 1. 获取业务内容分类 (POST /business-content-classes)
 * 从 ywbzk 表中提取唯一的业务内容分类
 */
router.post('/business-content-classes', (req, res) => {
    const sql = "SELECT DISTINCT ywnrfl as value, ywnrfl as label FROM gjj_ywbzk WHERE ywnrfl IS NOT NULL";
    db.all(sql, [], (err, rows) => {
        if (err) {
            logger.error(`[Tools API] Failed to fetch business content classes: ${err.message}`);
            return res.status(500).json({ status: 1, msg: err.message });
        }
        res.json({ status: 0, msg: "ok", data: rows });
    });
});

/**
 * 2. 获取业务办理标准值 (POST /business-standard-values)
 * 从 ywbzk 表中提取唯一的业务办理标准值 (ywbzz)
 */
router.post('/business-standard-values', (req, res) => {
    const sql = "SELECT DISTINCT ywbzz as value, ywbzz as label FROM gjj_ywbzk WHERE ywbzz IS NOT NULL";
    db.all(sql, [], (err, rows) => {
        if (err) {
            logger.error(`[Tools API] Failed to fetch business standard values: ${err.message}`);
            return res.status(500).json({ status: 1, msg: err.message });
        }
        res.json({ status: 0, msg: "ok", data: rows });
    });
});

/**
 * 3. 获取服务对象 (POST /service-objects)
 * 从 ywbzksx 表中提取唯一的服务对象标签 (fwdxbq)
 */
router.post('/service-objects', (req, res) => {
    const sql = "SELECT DISTINCT fwdxbq as value, fwdxbq as label FROM gjj_ywbzksx WHERE fwdxbq IS NOT NULL";
    db.all(sql, [], (err, rows) => {
        if (err) {
            logger.error(`[Tools API] Failed to fetch service objects: ${err.message}`);
            return res.status(500).json({ status: 1, msg: err.message });
        }
        res.json({ status: 0, msg: "ok", data: rows });
    });
});

/**
 * 4. 获取业务办理标准属性 (POST /business-standard-attributes)
 * 从 ywbzksx 表中提取唯一的标准属性 (ywblbzsx)
 */
router.post('/business-standard-attributes', (req, res) => {
    const sql = "SELECT DISTINCT ywblbzsx as value, ywblbzsx as label, sxbm FROM gjj_ywbzksx WHERE ywblbzsx IS NOT NULL";
    db.all(sql, [], (err, rows) => {
        if (err) {
            logger.error(`[Tools API] Failed to fetch business standard attributes: ${err.message}`);
            return res.status(500).json({ status: 1, msg: err.message });
        }
        res.json({ status: 0, msg: "ok", data: rows });
    });
});

module.exports = router;
