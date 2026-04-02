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
const algorithmConfig = require('../../utils/business-algorithms');
const { normalizeMalformedBody } = require('../../middleware/requestNormalizer');

// 从 GATEWAY_VALIDATE_URL 环境变量提取网关域名
const GATEWAY_BASE_URL = (() => {
    try {
        const url = new URL(process.env.GATEWAY_VALIDATE_URL || '');
        return url.origin; // 如 https://appcs.jbysoft.com
    } catch {
        return 'https://appcs.jbysoft.com'; // 兜底默认值
    }
})();

function getFirstNonBlankValue(item, keys) {
    if (!item || !Array.isArray(keys)) {
        return undefined;
    }

    for (const key of keys) {
        const value = item[key];
        if (value !== undefined && value !== null && String(value).trim() !== '') {
            return value;
        }
    }

    return undefined;
}

function normalizeBusinessStandardAttribute(item) {
    const value = getFirstNonBlankValue(item, [
        'fieldIdentification',
        'fieldName',
        'coding',
        'id'
    ]);
    const label = getFirstNonBlankValue(item, [
        'sxbm',
        'fieldAliasName',
        'fieldLabel',
        'fieldComment',
        'fieldDescription',
        'fieldDesc',
        'chineseName',
        'name',
        'fieldName',
        'fieldIdentification'
    ]);

    return {
        ...item,
        label: label || value,
        value,
        // 标准库子表 sxbm 约定存中文名称，供编辑回显和导出使用
        sxbm: getFirstNonBlankValue(item, [
            'sxbm',
            'fieldAliasName',
            'fieldLabel',
            'fieldComment',
            'fieldDescription',
            'fieldDesc',
            'chineseName',
            'name',
            'fieldName',
            'fieldIdentification'
        ]) || label || value
    };
}

/**
 * 1. 获取业务内容分类 (POST /business-content-classes)
 * 原：从 ywbzk 表中提取唯一的业务内容分类
 * 现：调用外部网关接口获取数据
 */
router.post('/business-content-classes', async (req, res) => {
    const jgbh = req.body.jgbh || req.headers['jgbh'] || req.headers['zzbs'] || '';
    const gjsjsf = req.body.gjsjsf || req.body.ywsf || '';
    const _adapter = db.getByJgbh(typeof jgbh !== 'undefined' ? jgbh : '');
    let sql = 'SELECT id, gjsjsf, flbm as value, flmc as label, flbm, flmc, pxh, sfqy FROM gjj_ywnrfl WHERE sfqy = ?';
    const params = [1];

    if (gjsjsf) {
        sql += ' AND gjsjsf = ?';
        params.push(gjsjsf);
    }

    sql += ' ORDER BY pxh ASC, id ASC';

    try {
        const rows = await _adapter.all(sql, params);
        res.json({ status: 0, msg: "ok", data: rows });
    } catch (err) {
        logger.error(`[Tools API] Failed to query business-content-classes: ${err.message}`);
        res.status(500).json({ status: 1, msg: err.message });
    }
});

router.post('/business-content-class-options', async (req, res) => {
    const gatewayUrl = `${GATEWAY_BASE_URL}/GLDX/business/common/objectAttributeOptionScope$m=query.service`;
    const { jgbh, login_token } = req.body;

    const headers = {
        'channel': req.headers['channel'],
        'jgbh': jgbh || req.headers['jgbh'],
        'login-token': login_token || req.headers['login-token'],
        'zzbs': req.headers['zzbs'],
        'zzjgdmz': req.headers['zzjgdmz'],
        'Content-Type': 'application/json'
    };

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
        logger.info(`[Tools API] Gateway response status: ${response.status}`);
        const gatewayData = response.data;
        let list = [];

        if (Array.isArray(gatewayData)) {
            list = gatewayData;
        } else if (Array.isArray(gatewayData.results)) {
            list = gatewayData.results;
        } else if (Array.isArray(gatewayData.data)) {
            list = gatewayData.data;
        }

        const resultData = list.map(item => ({
            label: item.name,
            value: item.coding,
            ...item
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
router.post('/business-standard-values', normalizeMalformedBody(), async (req, res) => {
    // 网关接口地址
    const gatewayUrl = `${GATEWAY_BASE_URL}/GLDX/business/common/publicparam$m=query.service`;
    const body = req.body;

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
router.post('/service-objects', normalizeMalformedBody(), async (req, res) => {
    // 网关接口地址
    const gatewayUrl = `${GATEWAY_BASE_URL}/GLDX/business/common/queryxjSxdx.service`;
    const body = req.body;

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
router.post('/business-standard-attributes', normalizeMalformedBody(), async (req, res) => {
    // 网关接口地址
    const gatewayUrl = `${GATEWAY_BASE_URL}/GLDX/business/common/manageObjectProperties$m=query.service`;
    const body = req.body;

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
        // 这里统一兜底多种网关字段，优先取中文别名/标签作为展示名，
        // 同时保持程序化标识(fieldIdentification)作为实际提交值。
        const resultData = list.map(normalizeBusinessStandardAttribute);

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
router.post('/public-param-values', normalizeMalformedBody(), async (req, res) => {
    const body = req.body;

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
router.post('/task-info', normalizeMalformedBody(), async (req, res) => {
    // 网关接口地址
    const gatewayUrl = `${GATEWAY_BASE_URL}/jobApi/jobinfo/getTaskInfo`;
    const body = req.body;

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

/**
 * 7. 获取关键数据算法列表 (GET|POST /business-algorithms)
 * 从本地配置文件读取
 */
router.all('/business-algorithms', (req, res) => {
    try {
        const algorithms = algorithmConfig.getAlgorithms();
        res.json({ status: 0, msg: "ok", data: algorithms });
    } catch (err) {
        logger.error(`[Tools API] Failed to get algorithms: ${err.message}`);
        res.status(500).json({ status: 1, msg: err.message });
    }
});

module.exports = router;
