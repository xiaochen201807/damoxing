/**
 * 通用工具接口
 * 处理公共元数据、下拉列表数据等
 */

const express = require('express');
const router = express.Router();
const db = require('../../db');
const logger = require('../../utils/logger');
const axios = require('axios');
const { info } = require('winston');

/**
 * 1. 获取业务内容分类 (POST /business-content-classes)
 * 原：从 ywbzk 表中提取唯一的业务内容分类
 * 现：调用外部网关接口获取数据
 */
router.post('/business-content-classes', async (req, res) => {
    // 网关接口地址
    const gatewayUrl = "https://appcs.jbysoft.com/GLDX/business/common/objectAttributeOptionScope$m=query.service";

    // 1. 提取 Header 参数
    // 前端 Body 中包含了用户信息，优先使用 Body 中的参数
    const { jgbh, login_token, zzbs, zzjgdmz } = req.body; 

    const headers = {
        'channel': req.headers['channel'],
        'jgbh': jgbh || req.headers['jgbh'],
        'login-token': login_token || req.headers['login-token'],
        'zzbs': req.headers['zzbs'],
        'zzjgdmz': req.headers['zzjgdmz'],
        'Content-Type': 'application/json'
    };

    // 2. 构造 Body 参数
    // 使用前端传入的机构编号，其他业务参数暂时使用硬编码默认值
    const payload = {
        "organizationNumber": jgbh,
        "syObjectNumber": req.body.syObjectNumber,
        "fieldIdentification": req.body.fieldIdentification ,
        "superiorCodings": "",
        "isDefault": req.body.isDefault !== undefined ? req.body.isDefault : 0
    };

    logger.info(`[Tools API] Payload to gateway: ${JSON.stringify(payload)}`);


    try {
        const response = await axios.post(gatewayUrl, payload, { headers });        
        // 记录网关响应状态
        logger.info(`[Tools API] Gateway response status: ${response.status}`);        
        // 处理返回数据
        const gatewayData = response.data; 
        logger.info(`[Tools API] Gateway response data: ${JSON.stringify(gatewayData)}`);       
        // 兼容处理：有些网关直接返回数组，有些返回 { code, data, msg }
        // 这里的处理逻辑可能需要根据实际网关返回结构进行调整
        // 根据最新的日志，网关返回结构为 { success: true, results: [...] }
        let list = [];
        if (Array.isArray(gatewayData)) {
            list = gatewayData;
        } else if (Array.isArray(gatewayData.results)) {
            list = gatewayData.results;
        } else if (Array.isArray(gatewayData.data)) {
            list = gatewayData.data;
        }

        // 转换数据格式为 AMIS 下拉框所需的 { label, value }
        const resultData = list.map(item => ({
            label: item.name,
            value: item.coding,
            ...item // 保留原始数据以备不时之需
        }));

        res.json({ status: 0, msg: "ok", data: resultData });

    } catch (err) {
        logger.error(`[Tools API] Failed to call gateway: ${err.message}`);
        if (err.response) {
            logger.error(`[Tools API] Gateway error data: ${JSON.stringify(err.response.data)}`);
        }
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
        const rows = await db.all(sql);
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
        const rows = await db.all(sql);
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
        const rows = await db.all(sql);
        res.json({ status: 0, msg: "ok", data: rows });
    } catch (err) {
        logger.error(`[Tools API] Failed to fetch business standard attributes: ${err.message}`);
        res.status(500).json({ status: 1, msg: err.message });
    }
});

module.exports = router;
