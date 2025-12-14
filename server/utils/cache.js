/**
 * 缓存管理模块
 * 使用 node-cache 实现内存缓存
 */

const NodeCache = require('node-cache');
const logger = require('./logger');

/**
 * 缓存配置
 * stdTTL: 默认过期时间（秒）
 * checkperiod: 自动检查过期项的周期（秒）
 * useClones: 是否克隆数据（false 性能更好，但要注意引用）
 */

// 菜单缓存（长期缓存，1小时）
const menuCache = new NodeCache({
    stdTTL: 3600, // 1小时
    checkperiod: 600, // 10分钟检查一次
    useClones: false,
});

// AI 结果缓存（中期缓存，30分钟）
const aiCache = new NodeCache({
    stdTTL: 1800, // 30分钟
    checkperiod: 300, // 5分钟检查一次
    useClones: false,
});

// API 响应缓存（短期缓存，5分钟）
const apiCache = new NodeCache({
    stdTTL: 300, // 5分钟
    checkperiod: 60, // 1分钟检查一次
    useClones: false,
});

/**
 * 生成缓存 key
 * @param {string} prefix - 前缀
 * @param {...any} parts - key 的组成部分
 */
function generateKey(prefix, ...parts) {
    return `${prefix}:${parts.join(':')}`;
}

/**
 * 菜单缓存辅助函数
 */
const menu = {
    get: () => menuCache.get('menu_list'),
    set: (data) => {
        menuCache.set('menu_list', data);
        logger.info('[Cache] Menu cached');
    },
    clear: () => {
        menuCache.del('menu_list');
        logger.info('[Cache] Menu cache cleared');
    },
};

/**
 * AI 结果缓存辅助函数
 */
const ai = {
    /**
     * 获取 AI 缓存结果
     * @param {string} pageId - 页面ID
     * @param {string} query - 查询内容
     */
    get: (pageId, query) => {
        const key = generateKey('ai', pageId, query);
        const result = aiCache.get(key);
        if (result) {
            logger.info(`[Cache] AI cache hit: ${key}`);
        }
        return result;
    },

    /**
     * 设置 AI 缓存结果
     * @param {string} pageId - 页面ID
     * @param {string} query - 查询内容
     * @param {any} data - 结果数据
     */
    set: (pageId, query, data) => {
        const key = generateKey('ai', pageId, query);
        aiCache.set(key, data);
        logger.info(`[Cache] AI result cached: ${key}`);
    },

    /**
     * 清除特定页面的 AI 缓存
     * @param {string} pageId - 页面ID
     */
    clearByPage: (pageId) => {
        const keys = aiCache.keys();
        const pageKeys = keys.filter(k => k.startsWith(`ai:${pageId}:`));
        pageKeys.forEach(k => aiCache.del(k));
        logger.info(`[Cache] Cleared ${pageKeys.length} AI cache entries for page: ${pageId}`);
    },

    /**
     * 清除所有 AI 缓存
     */
    clearAll: () => {
        aiCache.flushAll();
        logger.info('[Cache] All AI cache cleared');
    },
};

/**
 * API 响应缓存辅助函数
 */
const api = {
    /**
     * 获取 API 缓存
     * @param {string} url - API URL
     * @param {object} params - 请求参数
     */
    get: (url, params = {}) => {
        const key = generateKey('api', url, JSON.stringify(params));
        return apiCache.get(key);
    },

    /**
     * 设置 API 缓存
     * @param {string} url - API URL
     * @param {object} params - 请求参数
     * @param {any} data - 响应数据
     * @param {number} ttl - 自定义过期时间（秒），可选
     */
    set: (url, params = {}, data, ttl) => {
        const key = generateKey('api', url, JSON.stringify(params));
        if (ttl) {
            apiCache.set(key, data, ttl);
        } else {
            apiCache.set(key, data);
        }
        logger.debug(`[Cache] API cached: ${url}`);
    },

    /**
     * 清除特定 URL 的缓存
     * @param {string} url - API URL
     */
    clearByUrl: (url) => {
        const keys = apiCache.keys();
        const urlKeys = keys.filter(k => k.startsWith(`api:${url}:`));
        urlKeys.forEach(k => apiCache.del(k));
        logger.info(`[Cache] Cleared ${urlKeys.length} cache entries for URL: ${url}`);
    },
};

/**
 * 缓存统计信息
 */
function getStats() {
    return {
        menu: menuCache.getStats(),
        ai: aiCache.getStats(),
        api: apiCache.getStats(),
    };
}

/**
 * 清除所有缓存
 */
function clearAll() {
    menuCache.flushAll();
    aiCache.flushAll();
    apiCache.flushAll();
    logger.info('[Cache] All caches cleared');
}

// 监听缓存事件
[menuCache, aiCache, apiCache].forEach((cache, index) => {
    const names = ['Menu', 'AI', 'API'];

    cache.on('expired', (key, value) => {
        logger.debug(`[Cache] ${names[index]} cache expired: ${key}`);
    });

    cache.on('flush', () => {
        logger.info(`[Cache] ${names[index]} cache flushed`);
    });
});

module.exports = {
    menu,
    ai,
    api,
    getStats,
    clearAll,
};
