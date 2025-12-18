/**
 * 缓存管理路由
 * 提供缓存统计和管理接口
 */

const express = require('express');
const router = express.Router();
const cache = require('../../utils/cache');
const logger = require('../../utils/logger');

// 获取缓存统计信息
router.get('/cache/stats', (req, res) => {
    try {
        const stats = cache.getStats();
        res.json({
            status: 0,
            msg: 'success',
            data: stats
        });
    } catch (error) {
        logger.error('[Cache] 获取统计信息失败:', error);
        res.status(500).json({
            status: 500,
            msg: '获取缓存统计失败',
            error: error.message
        });
    }
});

// 清除所有缓存
router.post('/cache/clear', (req, res) => {
    try {
        cache.clearAll();
        res.json({
            status: 0,
            msg: '所有缓存已清除'
        });
    } catch (error) {
        logger.error('[Cache] 清除缓存失败:', error);
        res.status(500).json({
            status: 500,
            msg: '清除缓存失败',
            error: error.message
        });
    }
});

// 清除菜单缓存
router.post('/cache/clear/menu', (req, res) => {
    try {
        cache.menu.clear();
        res.json({
            status: 0,
            msg: '菜单缓存已清除'
        });
    } catch (error) {
        logger.error('[Cache] 清除菜单缓存失败:', error);
        res.status(500).json({
            status: 500,
            msg: '清除菜单缓存失败',
            error: error.message
        });
    }
});

// 清除AI缓存
router.post('/cache/clear/ai', (req, res) => {
    try {
        const { pageId } = req.body;

        if (pageId) {
            cache.ai.clearByPage(pageId);
            res.json({
                status: 0,
                msg: `页面 ${pageId} 的 AI 缓存已清除`
            });
        } else {
            cache.ai.clearAll();
            res.json({
                status: 0,
                msg: '所有 AI 缓存已清除'
            });
        }
    } catch (error) {
        logger.error('[Cache] 清除AI缓存失败:', error);
        res.status(500).json({
            status: 500,
            msg: '清除AI缓存失败',
            error: error.message
        });
    }
});

module.exports = router;
