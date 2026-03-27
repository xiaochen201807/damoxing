const fs = require('fs');
const path = require('path');
const logger = require('./logger');

let algorithmsConfig = null;
let algorithmMap = null;

/**
 * 加载关键数据算法配置
 */
function loadAlgorithms() {
    try {
        const configPath = path.join(__dirname, '../config/business-algorithms.json');
        const fileContent = fs.readFileSync(configPath, 'utf8');
        const parsed = JSON.parse(fileContent);
        
        // 按 sort 排序并只保留 enabled: true 的项
        algorithmsConfig = parsed
            .filter(item => item.enabled !== false)
            .sort((a, b) => (a.sort || 0) - (b.sort || 0));
            
        // 构建映射表，方便快速查找
        algorithmMap = {};
        algorithmsConfig.forEach(item => {
            algorithmMap[item.value] = item.label;
        });
        
        logger.info(`[Config] Successfully loaded ${algorithmsConfig.length} business algorithms.`);
    } catch (err) {
        logger.error(`[Config] Failed to load business algorithms config: ${err.message}`);
        // 兜底配置
        algorithmsConfig = [
            {"value": "1", "label": "最大可提取额"},
            {"value": "2", "label": "最高可贷金额"},
            {"value": "3", "label": "最高可贷年限"},
            {"value": "4", "label": "借款人最大可对冲支取金额"}
        ];
        algorithmMap = {
            "1": "最大可提取额",
            "2": "最高可贷金额",
            "3": "最高可贷年限",
            "4": "借款人最大可对冲支取金额"
        };
    }
}

// 模块初始化时即加载
loadAlgorithms();

module.exports = {
    /**
     * 获取算法列表配置 (用于前端下拉框)
     */
    getAlgorithms() {
        if (!algorithmsConfig) loadAlgorithms();
        return algorithmsConfig;
    },
    
    /**
     * 获取算法映射表 (用于前端展示或后端校验)
     */
    getAlgorithmMap() {
        if (!algorithmMap) loadAlgorithms();
        return algorithmMap;
    },
    
    /**
     * 校验算法编码是否合法
     * @param {string} value 算法编码
     * @returns {boolean}
     */
    isValidAlgorithm(value) {
        if (!algorithmMap) loadAlgorithms();
        return algorithmMap.hasOwnProperty(value);
    },
    
    /**
     * 重新加载配置
     */
    reload() {
        loadAlgorithms();
    }
};