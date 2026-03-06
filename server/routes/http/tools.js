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

// 从 GATEWAY_VALIDATE_URL 环境变量提取网关域名
const GATEWAY_BASE_URL = (() => {
    try {
        const url = new URL(process.env.GATEWAY_VALIDATE_URL || '');
        return url.origin; // 如 https://appcs.jbysoft.com
    } catch {
        return 'https://appcs.jbysoft.com'; // 兜底默认值
    }
})();

/**
 * 1. 获取业务内容分类 (POST /business-content-classes)
 * 原：从 ywbzk 表中提取唯一的业务内容分类
 * 现：调用外部网关接口获取数据
 */
router.post('/business-content-classes', async (req, res) => {
    // 网关接口地址
    const gatewayUrl = `${GATEWAY_BASE_URL}/GLDX/business/common/objectAttributeOptionScope$m=query.service`;

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
        "fieldIdentification": req.body.fieldIdentification,
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
 * 原：从 ywbzk 表中提取唯一的业务办理标准值 (ywbzz)
 * 现：调用外部网关接口获取公共参数
 */
router.post('/business-standard-values', async (req, res) => {
    // 网关接口地址
    const gatewayUrl = `${GATEWAY_BASE_URL}/GLDX/business/common/publicparam$m=query.service`;

    // 1. 预处理 Body 参数 (修复前端可能发送的畸形数据)
    let body = req.body;
    if (body && body['0'] === '{') {
        try {
            const keys = Object.keys(body).filter(k => /^\d+$/.test(k)).map(Number).sort((a, b) => a - b);
            const jsonStr = keys.map(k => body[String(k)]).join('');
            const parsedParams = JSON.parse(jsonStr);
            body = { ...body, ...parsedParams };
            logger.info(`[Tools API] Reconstructed malformed body params: ${jsonStr}`);
        } catch (e) {
            logger.warn(`[Tools API] Failed to reconstruct body: ${e.message}`);
        }
    }

    // 2. 提取 Header 参数
    const { jgbh, login_token, zzbs, zzjgdmz } = body;

    const headers = {
        'channel': req.headers['channel'],
        'jgbh': jgbh || req.headers['jgbh'],
        'login-token': login_token || req.headers['login-token'],
        'zzbs': req.headers['zzbs'],
        'zzjgdmz': req.headers['zzjgdmz'],
        'Content-Type': 'application/json'
    };

    // 3. 构造 Body 参数
    const payload = {
        "organizationNumber": jgbh,
        "name": body.name || "",
        "publicParamId": body.publicParamId || ""
    };

    logger.info(`[Tools API] Payload to gateway (standard-values): ${JSON.stringify(payload)}`);

    try {
        const response = await axios.post(gatewayUrl, payload, { headers });
        const gatewayData = response.data;
        // 处理返回数据
        let list = [];
        // 根据用户提供的样例，数据在 data 字段中，results 字段为空数组
        // 所以优先检查 data 字段
        if (Array.isArray(gatewayData.data) && gatewayData.data.length > 0) {
            list = gatewayData.data;
        } else if (Array.isArray(gatewayData.results) && gatewayData.results.length > 0) {
            list = gatewayData.results;
        } else if (Array.isArray(gatewayData)) {
            list = gatewayData;
        }

        // 转换数据格式为 AMIS 下拉框所需的 { label, value }
        const resultData = list.map(item => ({
            label: item.name,
            value: item.publicParamId,
            ...item
        }));

        res.json({ status: 0, msg: "ok", data: resultData });
    } catch (err) {
        logger.error(`[Tools API] Failed to call gateway (standard-values): ${err.message}`);
        if (err.response) {
            logger.error(`[Tools API] Gateway error data: ${JSON.stringify(err.response.data)}`);
        }
        res.status(500).json({ status: 1, msg: err.message });
    }
});

/**
 * 3. 获取服务对象 (POST /service-objects)
 * 原：从 ywbzksx 表中提取唯一的服务对象标签 (fwdxbq)
 * 现：调用外部网关接口获取服务对象
 */
router.post('/service-objects', async (req, res) => {
    // 网关接口地址
    const gatewayUrl = `${GATEWAY_BASE_URL}/GLDX/business/common/queryxjSxdx.service`;

    // 1. 预处理 Body 参数
    let body = req.body;
    if (body && body['0'] === '{') {
        try {
            const keys = Object.keys(body).filter(k => /^\d+$/.test(k)).map(Number).sort((a, b) => a - b);
            const jsonStr = keys.map(k => body[String(k)]).join('');
            const parsedParams = JSON.parse(jsonStr);
            body = { ...body, ...parsedParams };
            logger.info(`[Tools API] Reconstructed malformed body params: ${jsonStr}`);
        } catch (e) {
            logger.warn(`[Tools API] Failed to reconstruct body: ${e.message}`);
        }
    }

    // 2. 提取 Header 参数
    const { jgbh, login_token, zzbs, zzjgdmz } = body;

    const headers = {
        'channel': req.headers['channel'],
        'jgbh': jgbh || req.headers['jgbh'],
        'login-token': login_token || req.headers['login-token'],
        'zzbs': req.headers['zzbs'],
        'zzjgdmz': req.headers['zzjgdmz'],
        'Content-Type': 'application/json'
    };

    // 3. 构造 Body 参数
    const payload = {
        "organizationNumber": jgbh,
        "syObjectNumber": body.syObjectNumber || "03124", // 默认为 03124 (缴存)
        "syObjectName": body.syObjectName || "",
        "page": body.page || 1,
        "size": body.size || 100
    };

    logger.info(`[Tools API] Payload to gateway (service-objects): ${JSON.stringify(payload)}`);

    try {
        const response = await axios.post(gatewayUrl, payload, { headers });
        const gatewayData = response.data;

        // 处理返回数据
        let list = [];
        if (Array.isArray(gatewayData.data) && gatewayData.data.length > 0) {
            list = gatewayData.data;
        } else if (Array.isArray(gatewayData.results) && gatewayData.results.length > 0) {
            list = gatewayData.results;
        } else if (Array.isArray(gatewayData)) {
            list = gatewayData;
        }

        // 转换数据格式为 AMIS 下拉框所需的 { label, value }
        const resultData = list.map(item => ({
            label: item.syObjectName,
            value: item.syObjectNumber, // 保持原逻辑，使用名称作为 value
            ...item
        }));

        res.json({ status: 0, msg: "ok", data: resultData });
    } catch (err) {
        logger.error(`[Tools API] Failed to call gateway (service-objects): ${err.message}`);
        if (err.response) {
            logger.error(`[Tools API] Gateway error data: ${JSON.stringify(err.response.data)}`);
        }
        res.status(500).json({ status: 1, msg: err.message });
    }
});

/**
 * 4. 获取业务办理标准属性 (POST /business-standard-attributes)
 * 原：从 ywbzksx 表中提取唯一的标准属性 (ywblbzsx)
 * 现：调用外部网关接口获取对象属性
 */
router.post('/business-standard-attributes', async (req, res) => {
    // 网关接口地址
    const gatewayUrl = `${GATEWAY_BASE_URL}/GLDX/business/common/manageObjectProperties$m=query.service`;

    // 1. 预处理 Body 参数
    let body = req.body;
    if (body && body['0'] === '{') {
        try {
            const keys = Object.keys(body).filter(k => /^\d+$/.test(k)).map(Number).sort((a, b) => a - b);
            const jsonStr = keys.map(k => body[String(k)]).join('');
            const parsedParams = JSON.parse(jsonStr);
            body = { ...body, ...parsedParams };
            logger.info(`[Tools API] Reconstructed malformed body params: ${jsonStr}`);
        } catch (e) {
            logger.warn(`[Tools API] Failed to reconstruct body: ${e.message}`);
        }
    }

    // 2. 提取 Header 参数
    const { jgbh, login_token, zzbs, zzjgdmz } = body;

    const headers = {
        'channel': req.headers['channel'],
        'jgbh': jgbh || req.headers['jgbh'],
        'login-token': login_token || req.headers['login-token'],
        'zzbs': req.headers['zzbs'],
        'zzjgdmz': req.headers['zzjgdmz'],
        'Content-Type': 'application/json'
    };

    // 3. 构造 Body 参数
    // 如果前端没有传 syObjectNumber，但传了 ywblbzdx (业务办理标准对象)，尝试从中提取或映射
    // 这里暂时假设前端会传入 syObjectNumber，或者我们给一个默认值
    const payload = {
        "organizationNumber": jgbh,
        "syObjectNumber": body.syObjectNumber,
        "fieldName": body.fieldName || "",
        "page": body.page || 1,
        "size": body.size || 1000
    };

    logger.info(`[Tools API] Payload to gateway (standard-attributes): ${JSON.stringify(payload)}`);

    try {
        const response = await axios.post(gatewayUrl, payload, { headers });
        const gatewayData = response.data;

        // 处理返回数据
        let list = [];
        if (Array.isArray(gatewayData.data) && gatewayData.data.length > 0) {
            list = gatewayData.data;
        } else if (Array.isArray(gatewayData.results) && gatewayData.results.length > 0) {
            list = gatewayData.results;
        } else if (Array.isArray(gatewayData)) {
            list = gatewayData;
        }

        // 转换数据格式为 AMIS 下拉框所需的 { label, value, sxbm }
        // 根据最新的返回样例：fieldName -> label/value, fieldIdentification -> sxbm
        const resultData = list.map(item => ({
            label: item.fieldName,
            value: item.fieldIdentification,
            ...item
        }));

        res.json({ status: 0, msg: "ok", data: resultData });
    } catch (err) {
        logger.error(`[Tools API] Failed to call gateway (standard-attributes): ${err.message}`);
        if (err.response) {
            logger.error(`[Tools API] Gateway error data: ${JSON.stringify(err.response.data)}`);
        }
        res.status(500).json({ status: 1, msg: err.message });
    }
});

const { fetchPublicParamValue } = require('../../services/gatewayService');

// ... (existing imports)

/**
 * 5. 获取公共参数值 (POST /public-param-values)
 * 调用外部网关接口获取公共参数的具体值
 */
router.post('/public-param-values', async (req, res) => {
    // 1. 预处理 Body 参数
    let body = req.body;
    if (body && body['0'] === '{') {
        try {
            const keys = Object.keys(body).filter(k => /^\d+$/.test(k)).map(Number).sort((a, b) => a - b);
            const jsonStr = keys.map(k => body[String(k)]).join('');
            const parsedParams = JSON.parse(jsonStr);
            body = { ...body, ...parsedParams };
        } catch (e) {
            logger.warn(`[Tools API] Failed to reconstruct body: ${e.message}`);
        }
    }

    // 2. 提取 Header 参数
    const { jgbh, login_token, zzbs, zzjgdmz } = body;
    const headers = {
        'channel': req.headers['channel'],
        'jgbh': jgbh || req.headers['jgbh'],
        'login-token': login_token || req.headers['login-token'],
        'zzbs': req.headers['zzbs'],
        'zzjgdmz': req.headers['zzjgdmz']
    };

    try {
        const result = await fetchPublicParamValue(
            body.publicParamId,
            jgbh,
            body.zjgbh,
            headers
        );

        if (result) {
            return res.json(result);
        } else {
            return res.json({ status: 0, msg: "ok", data: [] });
        }
    } catch (err) {
        res.status(500).json({ status: 1, msg: err.message });
    }
});

/**
 * 6. 获取任务项 (POST /task-info)
 * 调用外部网关接口获取任务项列表（支持模糊查询）
 */
router.post('/task-info', async (req, res) => {
    // 网关接口地址
    const gatewayUrl = `${GATEWAY_BASE_URL}/jobApi/jobinfo/getTaskInfo`;

    // 1. 预处理 Body 参数
    let body = req.body;
    if (body && body['0'] === '{') {
        try {
            const keys = Object.keys(body).filter(k => /^\d+$/.test(k)).map(Number).sort((a, b) => a - b);
            const jsonStr = keys.map(k => body[String(k)]).join('');
            const parsedParams = JSON.parse(jsonStr);
            body = { ...body, ...parsedParams };
            logger.info(`[Tools API] Reconstructed malformed body params: ${jsonStr}`);
        } catch (e) {
            logger.warn(`[Tools API] Failed to reconstruct body: ${e.message}`);
        }
    }

    // 2. 提取 Header 参数
    const { jgbh, login_token, zzbs, zzjgdmz } = body;
    const headers = {
        'channel': req.headers['channel'] || 'zmd',
        'jgbh': jgbh || req.headers['jgbh'],
        'login-token': login_token || req.headers['login-token'],
        'zzbs': req.headers['zzbs'],
        'zzjgdmz': req.headers['zzjgdmz'],
        'Content-Type': 'application/json'
    };

    // 3. 构造 Body 参数
    const payload = {
        // 使用前端传入的查询关键字和机构编号
        "sjrwmc": body.sjrwmc || body.jsrwmc || body.keyword || "",
        "organizationNumber": body.zjgbh||body.jgbh || jgbh || ""
    };

    logger.info(`[Tools API] Payload to gateway (task-info): ${JSON.stringify(payload)}`);

    try {
        const response = await axios.post(gatewayUrl, payload, { headers });
        const gatewayData = response.data;

        // 处理返回数据，样例返回的是 { datas: [...] }
        let list = [];
        if (Array.isArray(gatewayData.datas)) {
            list = gatewayData.datas;
        } else if (Array.isArray(gatewayData.data)) {
            list = gatewayData.data;
        } else if (Array.isArray(gatewayData.results)) {
            list = gatewayData.results;
        } else if (Array.isArray(gatewayData)) {
            list = gatewayData;
        }

        // 转换数据格式为 AMIS 下拉框所需的 { label, value }
        const resultData = list
            .map(item => {
                const label =
                    item.label ??
                    item.sjrwmc ??
                    item.jsrwmc ??
                    item.xmbh ??
                    item.taskName ??
                    item.name ??
                    item.text ??
                    '';
                const value =
                    item.value ??
                    item.taskNumber ??
                    item.rwxbh ??
                    item.id ??
                    '';
                return {
                    label,
                    value,
                    ...item
                };
            })
            .filter(item => item.label !== '' && item.value !== '');

        res.json({ status: 0, msg: "ok", data: resultData });
    } catch (err) {
        logger.error(`[Tools API] Failed to call gateway (task-info): ${err.message}`);
        if (err.response) {
            logger.error(`[Tools API] Gateway error data: ${JSON.stringify(err.response.data)}`);
        }
        res.status(500).json({ status: 1, msg: err.message });
    }
});

module.exports = router;
