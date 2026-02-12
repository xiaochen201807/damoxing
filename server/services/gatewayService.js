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
 * 获取公共参数值
 * @param {string} publicParamId - 公共参数ID
 * @param {string} organizationNumber - 机构编号
 * @param {string} zjgbh - 子机构编号
 * @param {object} headers - 请求头 (包含 channel, login-token 等)
 * @returns {Promise<object>} - 返回包含 value 的结果对象
 */
async function fetchPublicParamValue(publicParamId, organizationNumber, zjgbh, headers = {}) {
    const gatewayUrl = `${GATEWAY_BASE_URL}/GLDX/business/common/publicparamvalue$m=query.service`;

    const payload = {
        "publicParamId": publicParamId,
        "organizationNumber": organizationNumber,
        "zjgbh": zjgbh || ""
    };

    logger.info(`[Gateway Service] Fetching public param value. Payload: ${JSON.stringify(payload)}`);

    try {
        const response = await axios.post(gatewayUrl, payload, {
            headers: {
                'Content-Type': 'application/json',
                ...headers
            },
            timeout: 30000 // max-time 30s
        });
        const gatewayData = response.data;

        // 特殊处理：如果返回的是单个对象且包含 paramValue
        if (gatewayData.data && !Array.isArray(gatewayData.data)) {
            const resultData = {
                ...gatewayData.data,
                value: gatewayData.data.paramValue
            };
            logger.info(`[Gateway Service] Success: ${JSON.stringify(resultData)}`);
            return resultData;
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
            const item = list[0]; // 默认取第一个
            const resultData = {
                ...item,
                value: item.value || item.coding || item.id
            };
            logger.info(`[Gateway Service] Success (from array): ${JSON.stringify(resultData)}`);
            return resultData;
        }

        logger.warn(`[Gateway Service] No data found for publicParamId: ${publicParamId}`);
        return null;

    } catch (err) {
        logger.error(`[Gateway Service] Failed: ${err.message}`);
        if (err.response) {
            logger.error(`[Gateway Service] Error data: ${JSON.stringify(err.response.data)}`);
        }
        throw err;
    }
}

module.exports = {
    fetchPublicParamValue
};
