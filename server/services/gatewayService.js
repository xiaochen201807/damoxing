const axios = require('axios');
const logger = require('../utils/logger');

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
 * 通用网关请求
 * @param {string} path - 接口路径 (如 /GLDX/business/...)
 * @param {object} data - 请求体
 * @param {object} headers - 请求头
 * @returns {Promise<object>} - 返回 data 部分
 */
async function gatewayRequest(path, data = {}, headers = {}) {
    // 确保 path 以 / 开头或正确拼接
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    const url = `${GATEWAY_BASE_URL}${cleanPath}`;

    logger.info(`[Gateway Request] POST ${url}, Payload: ${JSON.stringify(data)}`);

    try {
        const response = await axios.post(url, data, {
            headers: {
                'Content-Type': 'application/json',
                ...headers
            },
            timeout: 30000
        });

        // 记录响应摘要
        if (response.data) {
            const preview = JSON.stringify(response.data).substring(0, 200);
            logger.info(`[Gateway Response] Success: ${preview}...`);
        }

        return response.data;
    } catch (err) {
        logger.error(`[Gateway Request] Failed: ${err.message}`);
        if (err.response) {
            logger.error(`[Gateway Request] Error data: ${JSON.stringify(err.response.data)}`);
        }
        throw err;
    }
}

/**
 * 获取公共参数值
 * @param {string} publicParamId - 公共参数ID
 * @param {string} organizationNumber - 机构编号
 * @param {string} zjgbh - 子机构编号
 * @param {object} headers - 请求头 (包含 channel, login-token 等)
 * @returns {Promise<object>} - 返回包含 value 的结果对象
 */
async function fetchPublicParamValue(publicParamId, organizationNumber, zjgbh, headers = {}) {
    const path = '/GLDX/business/common/publicparamvalue$m=query.service';

    const payload = {
        "publicParamId": publicParamId,
        "organizationNumber": organizationNumber,
        "zjgbh": zjgbh || ""
    };

    try {
        const gatewayData = await gatewayRequest(path, payload, headers);

        // 特殊处理：如果返回的是单个对象且包含 paramValue
        if (gatewayData.data && !Array.isArray(gatewayData.data)) {
            return {
                ...gatewayData.data,
                value: gatewayData.data.paramValue
            };
        }

        // 处理数组返回
        let list = [];
        if (Array.isArray(gatewayData.data)) {
            list = gatewayData.data;
        } else if (Array.isArray(gatewayData.results)) {
            list = gatewayData.results;
        } else if (Array.isArray(gatewayData)) {
            list = gatewayData;
        }

        if (list.length > 0) {
            const item = list[0];
            return {
                ...item,
                value: item.value || item.coding || item.id
            };
        }

        logger.warn(`[Gateway Service] No data found for publicParamId: ${publicParamId}`);
        return null;

    } catch (err) {
        // gatewayRequest 已经 log 了 error，这里只需抛出
        throw err;
    }
}

module.exports = {
    fetchPublicParamValue,
    gatewayRequest
};
