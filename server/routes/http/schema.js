/**
 * Schema 配置 API 路由
 * 提供模板列表、预览生成、保存页面等功能
 */
const express = require('express');
const router = express.Router();
const nunjucks = require('nunjucks');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const db = require('../../db');
const logger = require('../../utils/logger');
const { escapeParamsForFrontend, sanitizeParams, DOLLAR_PLACEHOLDER } = require('../../utils/amis-variable-escape');

// 配置 Nunjucks 模板引擎
const env = nunjucks.configure(path.join(__dirname, '../../templates'), {
    autoescape: false,
    throwOnUndefined: false,
    noCache: true // 禁用缓存以便模板修改即时生效
});

// 添加 tojson 过滤器（用于安全地将字符串转换为 JSON 格式）
env.addFilter('tojson', function (value) {
    return JSON.stringify(value);
});

// 添加 fromjson 过滤器（用于将 JSON 字符串解析回对象）
env.addFilter('fromjson', function (str) {
    if (!str) return null;
    try {
        return typeof str === 'string' ? JSON.parse(str) : str;
    } catch (e) {
        console.error('Nunjucks fromjson error:', e);
        return str;
    }
});

// GET /api/schema/templates - 获取所有模板
router.get('/templates', async (req, res) => {
    logger.info('[Schema API] Fetching templates');

    try {
        const rows = await db.all('SELECT * FROM sys_page_templates_config ORDER BY created_at DESC');

        // 解析 JSON 字段
        const templates = rows.map(row => ({
            ...row,
            components: row.components ? JSON.parse(row.components) : [],
            params_schema: row.params_schema ? JSON.parse(row.params_schema) : {},
            default_params: row.default_params ? JSON.parse(row.default_params) : {}
        }));

        logger.info(`[Schema API] Found ${templates.length} templates`);
        res.json({ status: 0, data: templates });
    } catch (err) {
        logger.error('[Schema API] Database error:', err);
        return res.status(500).json({ status: 1, msg: '查询失败', data: [] });
    }
});

// 提取处理函数，同时支持 GET 和 POST
const handleTemplateForm = async (req, res) => {
    const { templateId } = req.params;

    // 🔍 调试输出
    console.log('\n========== Template Form API Request ==========');
    console.log('📥 Method:', req.method);
    console.log('📥 Request URL:', req.url);
    console.log('📥 Template ID:', templateId);
    console.log('📥 Query:', req.query);
    console.log('📥 Body:', req.body);
    console.log('==============================================\n');

    logger.info(`[Schema API] Generating form for template: ${templateId}`);

    try {
        const row = await db.get('SELECT params_schema, default_params FROM sys_page_templates_config WHERE template_id = ?', [templateId]);

        if (!row) {
            logger.error('[Schema API] Template not found:', templateId);
            return res.status(404).json({ status: 1, msg: '模板不存在' });
        }

        try {
            const paramsSchema = JSON.parse(row.params_schema || '{}');
            const defaultParams = JSON.parse(row.default_params || '{}');


            // 不再硬编码基础字段，所有字段都遵循 ui:group 分组
            const formFields = [];

            // 辅助函数：将 JSON Schema 转换为 AMIS 表单项
            const convertSchemaToField = (key, schema, defaultParams = {}) => {
                const field = {
                    name: key,
                    label: schema.title || schema.description || key, // Use title first
                    required: (paramsSchema.required && paramsSchema.required.includes(key)) || false
                };

                // 根据类型生成不同的表单控件
                if (schema.type === 'string') {
                    if (schema.format === 'textarea') {
                        field.type = 'textarea';
                    } else if (schema.format === 'color') {
                        // 颜色选择器
                        field.type = 'input-color';
                        field.format = 'hex';
                        field.presetColors = ['#1890ff', '#52c41a', '#faad14', '#722ed1', '#eb2f96', '#fa541c', '#13c2c2', '#2f54eb'];
                    } else {
                        field.type = 'input-text';
                    }
                    field.placeholder = schema.default || '';
                } else if (schema.type === 'integer' || schema.type === 'number') {
                    field.type = 'input-number';
                    field.value = schema.default || defaultParams[key] || 0;
                    if (schema.minimum !== undefined) field.min = schema.minimum;
                    if (schema.maximum !== undefined) field.max = schema.maximum;
                } else if (schema.type === 'boolean') {
                    field.type = 'switch';
                    field.value = schema.default !== undefined ? schema.default : (defaultParams[key] || false);
                } else if (schema.type === 'array') {
                    // 数组类型转换为 Combo 组件
                    field.type = 'combo';
                    field.multiple = true;
                    field.multiLine = schema.multiLine !== false; // 默认 true
                    field.draggable = true; // 支持拖拽排序
                    field.addButtonText = '新增 ' + (schema.items?.title || '项目');

                    // 支持 tabsMode 标签页模式
                    if (schema.tabsMode) {
                        field.tabsMode = true;
                        field.tabsLabelTpl = schema.tabsLabelTpl || '${index + 1}';
                    }

                    // 支持自定义样式类名
                    if (schema.itemClassName) {
                        field.itemClassName = schema.itemClassName;
                    }

                    // 支持子表单模式
                    if (schema.subFormMode) {
                        field.subFormMode = schema.subFormMode;
                    }

                    if (schema.items && schema.items.type === 'object' && schema.items.properties) {
                        // 递归转换数组项的属性（包含 sortOrder 字段供用户手动输入）
                        const subFields = Object.entries(schema.items.properties).map(([subKey, subSchema]) => {
                            return convertSchemaToField(subKey, subSchema, {});
                        });

                        // 如果有 color 字段，用 container 包裹并添加动态背景色
                        if (schema.items.properties.color) {
                            field.items = [
                                {
                                    type: 'container',
                                    style: {
                                        background: 'linear-gradient(135deg, ${color || "#f5f5f5"}15, ${color || "#f5f5f5"}08)',
                                        borderLeft: '4px solid ${color || "#ddd"}',
                                        borderRadius: '8px',
                                        padding: '16px',
                                        marginBottom: '8px'
                                    },
                                    body: subFields
                                }
                            ];
                        } else {
                            field.items = subFields;
                        }
                    } else {
                        // 简单数组 (string array etc) - 暂不支持或使用 input-array
                        field.type = 'input-array';
                    }
                    field.value = schema.default || defaultParams[key] || [];

                } else if (schema.type === 'json') {
                    field.type = 'editor';
                    field.language = 'json';
                    field.placeholder = schema.default || '{}';
                } else if (schema.enum) {
                    field.type = 'select';
                    field.options = schema.enum.map(v => ({ label: v, value: v }));
                } else {
                    field.type = 'input-text';
                }

                return field;
            };

            // 根据 params_schema 动态生成字段并分组
            if (paramsSchema.properties) {
                // 1. 将属性转换为数组并排序
                const sortedFields = Object.entries(paramsSchema.properties)
                    .map(([key, schema]) => ({
                        key,
                        ...schema
                    }))
                    .sort((a, b) => (a['ui:order'] || 9999) - (b['ui:order'] || 9999));

                // 2. 按分组聚合
                const groups = {};

                sortedFields.forEach(schema => {
                    const key = schema.key;

                    const field = convertSchemaToField(key, schema, defaultParams);

                    // 获取分组名和组序号
                    const groupName = schema['ui:group'] || '⚙️ 其他配置';
                    const groupOrder = schema['ui:groupOrder'] || 999;

                    if (!groups[groupName]) {
                        groups[groupName] = {
                            groupOrder: groupOrder,
                            fields: []
                        };
                    }
                    groups[groupName].fields.push(field);
                });

                // 3. 生成 FieldSet，按 groupOrder 排序
                Object.entries(groups)
                    .sort((a, b) => a[1].groupOrder - b[1].groupOrder)
                    .forEach(([groupName, groupData]) => {
                        if (groupData.fields.length > 0) {
                            formFields.push({
                                type: 'fieldSet',
                                title: groupName,
                                className: 'm-t',
                                collapsable: true,
                                collapsed: groupName !== '📄 页面参数',
                                body: groupData.fields
                            });
                        }
                    });
            }

            logger.info(`[Schema API] Generated ${formFields.length} form fields for ${templateId}`);
            res.json({
                status: 0,
                msg: 'success',
                data: {
                    formFields
                }
            });
        } catch (error) {
            logger.error('[Schema API] Error generating form:', error);
            res.status(500).json({ status: 1, msg: '生成表单失败' });
        }
    } catch (err) {
        logger.error('[Schema API] Database error:', err);
        return res.status(500).json({ status: 1, msg: '查询失败' });
    }
};

// 注册路由，同时支持 GET 和 POST
// 解决前端 AMIS 有时会发送 POST 请求的问题
router.get('/template-form/:templateId', handleTemplateForm);
router.post('/template-form/:templateId', handleTemplateForm);


// POST /api/schema/preview - 预览生成（不保存）
router.post('/preview', async (req, res) => {
    const { template_id, params } = req.body;

    if (!template_id || !params) {
        return res.status(400).json({
            status: 400,
            msg: '缺少必填参数: template_id 或 params'
        });
    }

    // 查询模板配置
    try {
        const template = await db.get(
            'SELECT * FROM sys_page_templates_config WHERE template_id = ? AND is_active = 1',
            [template_id]
        );

        if (!template) {
            return res.status(404).json({
                status: 404,
                msg: '模板不存在'
            });
        }

        try {
            // 渲染模板
            const GLOBAL_API_PREFIX = process.env.API_ROUTE_PREFIX || '/api';
            const schema_json = env.render(template.template_file, { ...params, GLOBAL_API_PREFIX });
            const parsed = JSON.parse(schema_json);

            logger.info(`[Schema API] Preview generated for template: ${template_id}`);
            res.json({
                status: 0,
                msg: '预览生成成功',
                data: parsed
            });
        } catch (error) {
            logger.error('[Schema API] Template rendering failed:', error);
            res.status(400).json({
                status: 400,
                msg: '模板渲染失败',
                error: error.message
            });
        }
    } catch (err) {
        logger.error('[Schema API] Failed to query template:', err);
        return res.status(500).json({
            status: 500,
            msg: '查询模板失败',
            error: err.message
        });
    }
});

// GET /api/schema/load-config/:pageKey - 加载页面历史配置（用于编辑）
router.get('/load-config/:pageKey', async (req, res) => {
    const { pageKey } = req.params;

    logger.info(`[Schema API] Loading config for page: ${pageKey}`);

    try {
        const page = await db.get(
            'SELECT * FROM sys_page_template WHERE page_key = ? AND is_active = 1',
            [pageKey]
        );

        if (!page) {
            return res.status(404).json({
                status: 404,
                msg: '页面不存在'
            });
        }

        // 检查是否有源数据（source_template_id 和 source_params）
        if (!page.source_template_id || !page.source_params) {
            return res.status(404).json({
                status: 404,
                msg: '该页面没有保存源配置信息，无法重新编辑',
                data: {
                    page_key: pageKey,
                    title: page.title,
                    version: page.version
                }
            });
        }

        try {
            const params = JSON.parse(page.source_params);

            logger.info(`[Schema API] Config loaded successfully for ${pageKey}`);
            res.json({
                status: 0,
                msg: '配置加载成功',
                data: {
                    template_id: page.source_template_id,
                    params: params,
                    page_key: pageKey,
                    page_title: page.title,
                    version: page.version
                }
            });
        } catch (error) {
            logger.error('[Schema API] Failed to parse source_params:', error);
            res.status(500).json({
                status: 500,
                msg: '配置数据格式错误',
                error: error.message
            });
        }
    } catch (err) {
        logger.error('[Schema API] Failed to load config:', err);
        return res.status(500).json({
            status: 500,
            msg: '加载配置失败',
            error: err.message
        });
    }
});


// GET /api/schema/wizard - 返回配置向导的完整 Schema (用于 Drawer 嵌入)
// 提取 Wizard 处理函数，同时支持 GET 和 POST
const handleWizardRequest = async (req, res) => {
    // 兼容 POST 请求体和 GET 查询参数
    const mode = req.query.mode || req.body.mode;
    const page_key = req.query.page_key || req.body.page_key;

    try {
        // 获取所有模板
        const templates = await db.all('SELECT * FROM sys_page_templates_config WHERE is_active = 1');

        // 如果是编辑模式，加载历史配置
        let initData = null;
        if (mode === 'edit' && page_key) {
            const pageData = await db.get('SELECT * FROM sys_page_template WHERE page_key = ? AND is_active = 1', [page_key]);

            if (pageData && pageData.source_template_id && pageData.source_params) {
                const parsedParams = JSON.parse(pageData.source_params);

                // 自动为数组项分配 sortOrder（如果没有的话）
                for (const key of Object.keys(parsedParams)) {
                    if (Array.isArray(parsedParams[key])) {
                        parsedParams[key].forEach((item, idx) => {
                            if (item && typeof item === 'object' && item.sortOrder === undefined) {
                                item.sortOrder = (idx + 1) * 10; // 使用 10 的倍数，方便插入
                            }
                        });
                    }
                }

                initData = {
                    template_id: pageData.source_template_id,
                    target_page_key: page_key,
                    page_title: pageData.title,
                    ...parsedParams
                };

                // --- 转义前端显示 ---
                try {
                    escapeParamsForFrontend(initData);
                } catch (e) {
                    logger.warn('[Schema API] Failed to escape params for frontend:', e);
                }
                // ------------------
            } else if (mode === 'edit') {
                // If it's edit mode but source config is missing, return an alert schema
                return res.json({
                    type: "alert",
                    level: "warning",
                    title: "无法编辑配置",
                    body: "该页面可能是在配置向导功能上线前创建的，或者缺少元数据，无法通过向导重新编辑。您仍然可以查看页面预览或使用AI工作流。",
                    showIcon: true,
                    actions: [
                        {
                            type: "button",
                            label: "关闭",
                            actionType: "close"
                        }
                    ]
                });
            }
        }

        // 构建 Wizard Schema
        const wizardSchema = {
            type: "wizard",
            mode: "horizontal",
            initApi: initData ? {
                method: "post",
                url: "/api/schema/echo",  // 使用 echo 接口返回数据
                data: initData
            } : null,
            steps: [
                {
                    title: "选择模板",
                    body: [
                        {
                            type: "select",
                            name: "template_id",
                            label: "选择页面模板",
                            options: templates.map(t => ({
                                label: t.template_name,
                                value: t.template_id,
                                description: t.description
                            })),
                            required: true,
                            searchable: true,
                            menuTpl: "<div><strong>${label}</strong><br/><small class='text-muted'>${description}</small></div>"
                        },
                        { type: "divider" },
                        {
                            type: "select",
                            name: "target_page_key",
                            label: "绑定已有页面 (可选)",
                            description: "如果不选择，则创建新页面。如果选择，将覆盖该页面的配置。",
                            searchable: true,
                            clearable: true,
                            source: {
                                "method": "get",
                                "url": "/api/system/template",
                                "adaptor": "return { status: 0, msg: '', options: (payload.data || []).map(item => ({ label: item.title + ' (' + item.page_key + ')', value: item.page_key })) }"
                            }
                        },
                        {
                            type: "select",
                            name: "app_theme",
                            label: "页面主题风格",
                            options: [
                                { label: "🔵 默认主题 (商务蓝)", value: "default" },
                                { label: "🌑 深色科技 (Dark Mode)", value: "dark" },
                                { label: "🟠 品牌定制 (活力橙)", value: "brand" }
                            ],
                            value: "default",
                            required: true,
                            description: "选择页面的整体配色风格"
                        },
                        {
                            type: "input-text",
                            name: "manual_page_key",
                            label: "新页面标识 (Page Key)",
                            required: true,
                            visibleOn: "${!target_page_key}",
                            validations: { isAlphanumeric: true, maxLength: 50 },
                            placeholder: "例如: detection_dashboard",
                            description: "只能包含字母、数字和下划线"
                        },
                        {
                            type: "input-text",
                            name: "page_title",
                            label: "页面标题",
                            required: true,
                            placeholder: "例如: 风险监测看板"
                        }
                    ]
                },
                {
                    title: "配置参数",
                    initApi: {
                        method: "get",
                        url: "/api/schema/template-form/${template_id}",
                        sendOn: "this.template_id",
                        adaptor: "return { ...payload.data, __debug: 'adaptor executed' };"
                    },
                    body: [
                        {
                            type: "alert",
                            level: "info",
                            body: "💡 填写参数后可点击右下角【预览】按钮查看实时效果",
                            className: "m-b"
                        },
                        {
                            type: "service",
                            visibleOn: "this.template_id",
                            schemaApi: {
                                method: "get",
                                url: "/api/schema/template-form/${template_id}",
                                sendOn: "this.template_id",
                                adaptor: `
                                    // 尝试从 response 中获取（部分版本 AMIS response 即为 payload）
                                    // 优先使用 response，其次 payload，再次 api.body
                                    var data = null;
                                    try {
                                        if (typeof response !== 'undefined') data = response;
                                        else if (typeof payload !== 'undefined') data = payload;
                                        else if (typeof event !== 'undefined' && event.data) data = event.data;
                                    } catch(e) {}
                                    
                                    if (!data || !data.data) {
                                        return {
                                            type: 'alert',
                                            level: 'warning',
                                            body: '⚠️ 无法获取表单配置 (Template ID: ' + (context.template_id || 'undefined') + ')',
                                            actions: [
                                                {
                                                    type: 'button',
                                                    label: '重试',
                                                    actionType: 'reload'
                                                }
                                            ]
                                        };
                                    }
                                    return {
                                        type: 'container',
                                        body: data.data.formFields || [{ type: 'alert', level: 'info', body: '此模板没有配置参数' }]
                                    };
                                `
                            }
                        }
                    ],
                    actions: [
                        {
                            label: "上一步",
                            type: "button",
                            actionType: "prev"
                        },
                        {
                            label: "预览",
                            type: "button",
                            level: "default",
                            icon: "fa fa-eye",
                            actionType: "dialog",
                            dialog: {
                                title: "🔍 配置预览",
                                size: "full",
                                closeOnEsc: true,
                                actions: [
                                    {
                                        type: "button",
                                        label: "关闭",
                                        actionType: "close"
                                    }
                                ],
                                body: {
                                    type: "service",
                                    schemaApi: {
                                        method: "post",
                                        url: "/api/schema/preview",
                                        data: {
                                            template_id: "${template_id}",
                                            params: "$$"
                                        },
                                        adaptor: "return payload.data || { type: 'alert', level: 'danger', body: '预览失败: ' + payload.msg };"
                                    }
                                }
                            }
                        },
                        {
                            label: "保存",
                            type: "button",
                            level: "primary",
                            actionType: "submit"
                        }
                    ]
                }
            ],
            api: {
                method: "post",
                url: "/api/schema/save",
                data: {
                    template_id: "${template_id}",
                    target_page_key: "${target_page_key}",
                    manual_page_key: "${manual_page_key}",
                    page_title: "${page_title}",
                    app_theme: "${app_theme}",
                    params: "$$"
                },
                messages: {
                    success: "保存配置成功"
                }
            }
        };

        res.json(wizardSchema);
    } catch (error) {
        logger.error('[Schema API] Failed to generate wizard schema:', error);
        res.status(500).json({
            status: 500,
            msg: '生成向导失败',
            error: error.message
        });
    }
};

// GET /api/schema/wizard - 返回配置向导的完整 Schema (用于 Drawer 嵌入)
// 同时支持 GET 和 POST
router.get('/wizard', handleWizardRequest);
router.post('/wizard', handleWizardRequest);


// POST /api/schema/echo - 简单的回显接口，用于 Wizard 初始化数据
router.post('/echo', (req, res) => {
    res.json({
        status: 0,
        msg: 'success',
        data: req.body
    });
});



// POST /api/schema/save - 保存页面到数据库 (支持新建和更新绑定)
router.post('/save', async (req, res) => {
    // 接收参数：
    // target_page_key: 绑定的已有页面标识 (可选)
    // manual_page_key: 手动输入的新页面标识 (仅当 target_page_key 为空时使用)
    // page_title: 页面标题
    const { template_id, params, target_page_key, manual_page_key, page_title } = req.body;

    // --- 参数校验（在修复前）---
    const page_key = target_page_key || manual_page_key;
    const title = page_title;

    if (!template_id || !params || !page_key || !title) {
        const missingFields = [];
        if (!template_id) missingFields.push('template_id');
        if (!params) missingFields.push('params');
        if (!page_key) missingFields.push(target_page_key ? 'page_title' : 'manual_page_key');
        if (!title) missingFields.push('page_title');
        
        logger.warn(`[Schema API] Missing required fields: ${missingFields.join(', ')}`);
        return res.status(400).json({
            status: 400,
            msg: `缺少必填参数: ${missingFields.join(', ')}`
        });
    }

    // --- 自动修复参数逻辑（修复时必须成功）---
    try {
        if (params && typeof params === 'object') {
            sanitizeParams(params);
            logger.info('[Schema API] Params sanitized successfully');
        }
    } catch (e) {
        logger.error('[Schema API] Auto-fix params failed (BLOCKING):', e);
        return res.status(400).json({
            status: 400,
            msg: '参数修复失败: ' + e.message,
            error: process.env.NODE_ENV === 'development' ? e.message : undefined
        });
    }
    // ----------------------

    try {
        const template = await db.get(
            'SELECT * FROM sys_page_templates_config WHERE template_id = ? AND is_active = 1',
            [template_id]
        );

        if (!template) {
            return res.status(404).json({ status: 404, msg: '模板不存在' });
        }

        try {
            const sortedParams = { ...params };
            for (const key of Object.keys(sortedParams)) {
                if (Array.isArray(sortedParams[key])) {
                    sortedParams[key] = [...sortedParams[key]].sort((a, b) => {
                        const orderA = a.sortOrder !== undefined ? a.sortOrder : 999;
                        const orderB = b.sortOrder !== undefined ? b.sortOrder : 999;
                        return orderA - orderB;
                    });
                }
            }

            const app_theme = sortedParams.app_theme || 'default';
            const GLOBAL_API_PREFIX = process.env.API_ROUTE_PREFIX || '/api';

            console.log('--- Template Rendering Context ---');
            console.log('ENV API_ROUTE_PREFIX:', process.env.API_ROUTE_PREFIX);
            console.log('GLOBAL_API_PREFIX:', GLOBAL_API_PREFIX);

            const renderContext = { ...sortedParams, page_key, title, app_theme, GLOBAL_API_PREFIX };
            const schema_json = env.render(template.template_file, renderContext);

            console.log('=== 生成的JSON（前2000字符）===');
            console.log(schema_json.substring(0, 2000));
            console.log('=== 位置1950-2000附近 ===');
            console.log(schema_json.substring(1950, 2000));

            JSON.parse(schema_json);

            let current = null;
            let newVersion = 1;
            let result = null;

            try {
                await db.run('BEGIN TRANSACTION');

                current = await db.get(
                    'SELECT * FROM sys_page_template WHERE page_key = ? AND is_active = 1',
                    [page_key]
                );

                if (current) {
                    newVersion = current.version + 1;
                    logger.info(`[Schema API] Found existing page, creating version ${newVersion}`);
                    
                    await db.run(
                        "UPDATE sys_page_template SET is_active = 0, backup_time = datetime('now', '+08:00') WHERE id = ?",
                        [current.id]
                    );
                } else {
                    // 获取该 page_key 的最大版本号
                    const row = await db.get(
                        'SELECT MAX(version) as max_ver FROM sys_page_template WHERE page_key = ?',
                        [page_key]
                    );
                    
                    // SQLite 在某些情况下会返回 null，需要处理
                    const maxVer = row?.max_ver ?? 0;
                    if (maxVer && maxVer > 0) {
                        newVersion = maxVer + 1;
                        logger.info(`[Schema API] Creating new page version ${newVersion}`);
                    } else {
                        logger.info(`[Schema API] Creating new page with version 1`);
                    }
                }

                const sql = `
                    INSERT INTO sys_page_template 
                    (page_key, title, schema_json, version, is_active, created_at, updated_at, source_template_id, source_params)
                    VALUES (?, ?, ?, ?, 1, datetime('now', '+08:00'), datetime('now', '+08:00'), ?, ?)
                `;

                logger.debug(`[Schema API] Executing INSERT with page_key=${page_key}, version=${newVersion}`);
                
                result = await db.run(sql, [page_key, title, schema_json, newVersion, template_id, JSON.stringify(params)]);

                // 验证插入是否成功
                if (!result || !result.lastID) {
                    throw new Error('Insert returned no lastID');
                }

                logger.info(`[Schema API] Successfully inserted with ID: ${result.lastID}`);

                if (current) {
                    // 清理旧备份，只保留最新 5 个版本
                    await db.run(`
                        DELETE FROM sys_page_template 
                        WHERE page_key = ? AND is_active = 0 
                        AND id NOT IN (
                            SELECT id FROM sys_page_template 
                            WHERE page_key = ? AND is_active = 0 
                            ORDER BY version DESC 
                            LIMIT 5
                        )
                    `, [page_key, page_key]);
                }

                await db.run('COMMIT');
                logger.info(`[Schema API] Transaction committed for page_key: ${page_key}`);
                
            } catch (err) {
                logger.error('[Schema API] Transaction error:', err);
                try {
                    await db.run('ROLLBACK');
                    logger.info('[Schema API] Transaction rolled back');
                } catch (rollbackErr) {
                    logger.error('[Schema API] Rollback failed:', rollbackErr);
                }
                throw err;
            }

            logger.info(`[Schema API] Page saved: ${page_key} v${newVersion} (id: ${result?.lastID || null})`);
            res.json({
                status: 0,
                msg: '保存成功',
                data: {
                    id: result?.lastID || null,
                    page_key,
                    title,
                    version: newVersion,
                    mode: current ? 'update' : 'create',
                    timestamp: new Date().toISOString()
                }
            });
        } catch (error) {
            logger.error('[Schema API] Failed to save page:', error);
            // 提供详细错误信息用于调试
            const errorMsg = error.message || JSON.stringify(error);
            res.status(400).json({
                status: 400,
                msg: '保存失败: 模板渲染或数据库操作错误',
                error: process.env.NODE_ENV === 'development' ? errorMsg : undefined,
                debug_info: {
                    page_key,
                    template_id,
                    schema_json_length: schema_json?.length || 0,
                    params_keys: Object.keys(params || {})
                }
            });
        }
    } catch (err) {
        logger.error('[Schema API] Failed to query template:', err);
        return res.status(500).json({ status: 500, msg: '查询模板失败', error: err.message });
    }
});

// GET /api/schema/components - 获取组件列表
router.get('/components', async (req, res) => {
    const { category } = req.query;

    let sql = 'SELECT * FROM sys_component_library WHERE is_active = 1';
    const params = [];

    if (category) {
        sql += ' AND category = ?';
        params.push(category);
    }

    try {
        const rows = await db.all(sql, params);
        const components = rows.map(row => ({
            ...row,
            params_schema: row.params_schema ? JSON.parse(row.params_schema) : {},
            default_params: row.default_params ? JSON.parse(row.default_params) : {}
        }));

        logger.info(`[Schema API] Found ${components.length} components`);
        res.json({ status: 0, data: components });
    } catch (err) {
        logger.error('[Schema API] Failed to query components:', err);
        return res.status(500).json({
            status: 500,
            msg: '查询组件失败',
            error: err.message
        });
    }
});


/**
 * 环境配置只读展示
 * GET /api/schema/env-config
 * 用于后端设置页面展示当前配置
 */
router.get('/env-config', (req, res) => {
    // 辅助函数：脱敏处理 API Key
    const maskApiKey = (key) => {
        if (!key) return '未配置';
        if (key.length <= 8) return '****';
        return key.substring(0, 4) + '****' + key.substring(key.length - 4);
    };

    // 配置项定义：包含环境变量名、显示名称、描述、分组
    const configItems = [
        // Dify 配置
        {
            group: 'Dify AI 服务',
            items: [
                {
                    key: 'DIFY_API_URL',
                    label: 'Dify API 地址',
                    value: process.env.DIFY_API_URL || 'https://api.dify.ai/v1',
                    description: 'Dify 服务的 API 基础地址'
                },
                {
                    key: 'DIFY_API_KEY',
                    label: 'Dify API Key',
                    value: maskApiKey(process.env.DIFY_API_KEY),
                    description: '默认的 Dify API 密钥（页面级配置优先）',
                    sensitive: true
                },
                {
                    key: 'DIFY_API_TIMEOUT',
                    label: 'API 超时时间',
                    value: process.env.DIFY_API_TIMEOUT || '300000',
                    description: '调用 Dify API 的超时时间（毫秒），默认 5 分钟',
                    unit: 'ms'
                }
            ]
        },
        // 服务器配置
        {
            group: '服务器配置',
            items: [
                {
                    key: 'PORT',
                    label: '服务端口',
                    value: process.env.PORT || '3001',
                    description: 'Node.js 服务监听端口'
                },
                {
                    key: 'NODE_ENV',
                    label: '运行环境',
                    value: process.env.NODE_ENV || 'development',
                    description: '当前运行环境 (development/production)'
                },
                {
                    key: 'API_ROUTE_PREFIX',
                    label: 'API 路由前缀',
                    value: process.env.API_ROUTE_PREFIX || '/',
                    description: '用于多项目兼容部署的路由前缀'
                },
                {
                    key: 'LOG_LEVEL',
                    label: '日志级别',
                    value: process.env.LOG_LEVEL || 'info',
                    description: '日志输出级别 (debug/info/warn/error)'
                }
            ]
        },
        // 网关配置
        {
            group: '网关集成',
            items: [
                {
                    key: 'GATEWAY_ENABLED',
                    label: '启用网关',
                    value: process.env.GATEWAY_ENABLED || 'false',
                    description: '是否启用第三方网关验证'
                },
                {
                    key: 'GATEWAY_VALIDATE_URL',
                    label: '网关验证地址',
                    value: process.env.GATEWAY_VALIDATE_URL || '未配置',
                    description: '第三方网关 ticket 验证接口'
                },
                {
                    key: 'SKIP_LOCAL_AUTH',
                    label: '跳过本地认证',
                    value: process.env.SKIP_LOCAL_AUTH || 'false',
                    description: '开发环境可设为 true 跳过登录验证'
                }
            ]
        },
        // 数据库配置
        {
            group: '数据库',
            items: [
                {
                    key: 'DB_PATH',
                    label: '数据库路径',
                    value: process.env.DB_PATH || './data/database.sqlite',
                    description: 'SQLite 数据库文件路径'
                }
            ]
        }
    ];

    res.json({
        status: 0,
        msg: 'success',
        data: {
            configGroups: configItems,
            notice: '如需修改配置，请编辑 .env 文件并重启服务',
            lastUpdated: new Date().toISOString()
        }
    });
});

module.exports = router;


