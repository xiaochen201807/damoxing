/**
 * API 参数验证中间件
 * 使用 Joi 进行请求参数验证
 */

const Joi = require('joi');
const logger = require('../utils/logger');

/**
 * 验证中间件工厂函数
 * @param {Object} schema - Joi 验证模式
 * @param {string} property - 要验证的属性 ('body', 'query', 'params')
 */
const validate = (schema, property = 'body', options = {}) => {
    return (req, res, next) => {
        const { error, value } = schema.validate(req[property], {
            abortEarly: false, // 返回所有错误
            stripUnknown: true, // 默认移除未知字段
            ...options          // 允许覆盖默认配置
        });

        if (error) {
            const errorMessage = error.details.map(detail => detail.message).join(', ');
            logger.warn(`Validation error on ${req.method} ${req.path}: ${errorMessage}`);

            return res.status(400).json({
                status: 400,
                msg: '请求参数验证失败',
                errors: error.details.map(detail => ({
                    field: detail.path.join('.'),
                    message: detail.message,
                })),
            });
        }

        // 使用验证后的值替换原始值
        req[property] = value;
        next();
    };
};

/**
 * 常用验证模式
 */
const schemas = {
    // Dify 配置创建
    difyConfigCreate: Joi.object({
        page_key: Joi.string().pattern(/^[a-zA-Z0-9_]+$/).min(1).max(50).required()
            .messages({
                'string.pattern.base': 'page_key 只能包含字母、数字和下划线',
                'string.min': 'page_key 长度至少为 1',
                'string.max': 'page_key 长度不能超过 50',
                'any.required': 'page_key 是必填项',
            }),
        workflow_name: Joi.string().min(1).max(100).required()
            .messages({
                'string.min': 'workflow_name 长度至少为 1',
                'string.max': 'workflow_name 长度不能超过 100',
                'any.required': 'workflow_name 是必填项',
            }),
        workflow_type: Joi.string().max(50).default('ai_analysis')
            .messages({
                'string.max': 'workflow_type 长度不能超过 50',
            }),
        api_url: Joi.string().uri().required()
            .messages({
                'string.uri': 'api_url 必须是有效的 URL',
                'any.required': 'api_url 是必填项',
            }),
        api_key: Joi.string().min(1).max(500).required()
            .messages({
                'string.min': 'api_key 长度至少为 1',
                'string.max': 'api_key 长度不能超过 500',
                'any.required': 'api_key 是必填项',
            }),
        enabled: Joi.number().integer().min(0).max(1).default(1),
        description: Joi.string().max(500).allow('').default(''),
    }),

    // Dify 配置更新
    difyConfigUpdate: Joi.object({
        workflow_name: Joi.string().min(1).max(100),
        workflow_type: Joi.string().max(50),
        api_url: Joi.string().uri(),
        api_key: Joi.string().min(1).max(500),
        enabled: Joi.number().integer().min(0).max(1),
        description: Joi.string().max(500).allow(''),
    }).min(1), // 至少需要一个字段

    // AI 生成请求
    aiGenerate: Joi.object({
        query: Joi.string().max(2000).allow(''), // 允许为空，具体的必填检查移至 controller 处处理（兼容 data.query）
        pageId: Joi.string().max(50).allow(''),
        workflow_type: Joi.string().max(50).allow(''),
        data: Joi.object().unknown(true).allow(null), // 允许表单数据对象透传
        timestamp: Joi.any()
    }).unknown(true), // 允许其它参数透传

    // 页面 Key 参数
    pageKey: Joi.object({
        pageKey: Joi.string().pattern(/^[a-zA-Z0-9_]+$/).min(1).max(50).required(),
    }),
};

module.exports = {
    validate,
    schemas,
};
