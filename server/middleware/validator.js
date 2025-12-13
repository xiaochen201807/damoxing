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
const validate = (schema, property = 'body') => {
    return (req, res, next) => {
        const { error, value } = schema.validate(req[property], {
            abortEarly: false, // 返回所有错误
            stripUnknown: true, // 移除未知字段
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
        api_url: Joi.string().uri(),
        api_key: Joi.string().min(1).max(500),
        enabled: Joi.number().integer().min(0).max(1),
        description: Joi.string().max(500).allow(''),
    }).min(1), // 至少需要一个字段

    // AI 生成请求
    aiGenerate: Joi.object({
        query: Joi.string().min(1).max(2000).required()
            .messages({
                'string.min': 'query 不能为空',
                'string.max': 'query 长度不能超过 2000',
                'any.required': 'query 是必填项',
            }),
        pageId: Joi.string().alphanum().max(50).allow(''),
    }),

    // 页面 Key 参数
    pageKey: Joi.object({
        pageKey: Joi.string().pattern(/^[a-zA-Z0-9_]+$/).min(1).max(50).required(),
    }),
};

module.exports = {
    validate,
    schemas,
};
