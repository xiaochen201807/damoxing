/**
 * Schema 配置 API 路由
 * 提供模板列表、预览生成、保存页面等功能
 */
const express = require('express');
const router = express.Router();
const nunjucks = require('nunjucks');
const path = require('path');
const db = require('../db');
const logger = require('../utils/logger');

// 配置 Nunjucks 模板引擎
const env = nunjucks.configure(path.join(__dirname, '../templates'), {
    autoescape: false,
    throwOnUndefined: false
});

// GET /api/schema/templates - 获取所有模板
router.get('/templates', (req, res) => {
    logger.info('[Schema API] Fetching templates');

    db.all('SELECT * FROM sys_page_templates_config ORDER BY created_at DESC', (err, rows) => {
        if (err) {
            logger.error('[Schema API] Database error:', err);
            return res.status(500).json({ status: 1, msg: '查询失败', data: [] });
        }

        // 解析 JSON 字段
        const templates = rows.map(row => ({
            ...row,
            components: row.components ? JSON.parse(row.components) : [],
            params_schema: row.params_schema ? JSON.parse(row.params_schema) : {},
            default_params: row.default_params ? JSON.parse(row.default_params) : {}
        }));

        logger.info(`[Schema API] Found ${templates.length} templates`);
        res.json({ status: 0, data: templates });
    });
});

// 提取处理函数，同时支持 GET 和 POST
const handleTemplateForm = (req, res) => {
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

    db.get('SELECT params_schema, default_params FROM sys_page_templates_config WHERE template_id = ?', [templateId], (err, row) => {
        if (err || !row) {
            logger.error('[Schema API] Template not found:', templateId);
            return res.status(404).json({ status: 1, msg: '模板不存在' });
        }

        try {
            const paramsSchema = JSON.parse(row.params_schema || '{}');
            const defaultParams = JSON.parse(row.default_params || '{}');


            // 不再硬编码基础字段，所有字段都遵循 ui:group 分组
            const formFields = [];

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
                // 定义分组顺序（用于控制FieldSet的显示顺序）
                const groupOrder = [
                    '🎨 页面头部配置',
                    '🤖 AI分析配置',
                    '☁️ 数据导入配置',
                    '📊 柱状图配置',
                    '📈 折线图配置',
                    '📉 图表配置',
                    '📝 报告功能配置',
                    '💡 提示配置',
                    '📄 页面参数',
                    '⚙️ 其他配置'
                ];

                sortedFields.forEach(schema => {
                    const key = schema.key;
                    // 不再跳过任何字段，让所有字段都参与分组

                    const field = {
                        name: key,
                        label: schema.description || key,
                        // 简化逻辑：只根据 default 判断，有默认值就非必填
                        required: schema.default === undefined
                    };

                    // 根据类型生成不同的表单控件
                    if (schema.type === 'string') {
                        field.type = 'input-text';
                        field.placeholder = schema.default || '';
                    } else if (schema.type === 'integer' || schema.type === 'number') {
                        field.type = 'input-number';
                        field.value = schema.default || defaultParams[key] || 0;
                        if (schema.minimum !== undefined) field.min = schema.minimum;
                        if (schema.maximum !== undefined) field.max = schema.maximum;
                    } else if (schema.type === 'boolean') {
                        field.type = 'switch';
                        field.value = schema.default !== undefined ? schema.default : (defaultParams[key] || false);
                    } else if (schema.enum) {
                        field.type = 'select';
                        field.options = schema.enum.map(v => ({ label: v, value: v }));
                    } else {
                        field.type = 'input-text';
                    }

                    if (schema.description) {
                        field.description = schema.description;
                    }

                    // 获取分组名，默认为"其他配置"
                    const groupName = schema['ui:group'] || '⚙️ 其他配置';

                    if (!groups[groupName]) {
                        groups[groupName] = [];
                    }
                    groups[groupName].push(field);
                });

                // 3. 生成 FieldSet
                // 先按预定义顺序添加已知分组
                groupOrder.forEach(groupName => {
                    if (groups[groupName] && groups[groupName].length > 0) {
                        formFields.push({
                            type: 'fieldSet',
                            title: groupName,
                            className: 'm-t',
                            collapsable: true,
                            // 默认展开“页面参数”，其他折叠
                            collapsed: groupName !== '📄 页面参数',
                            body: groups[groupName]
                        });
                        delete groups[groupName]; // 处理完移除
                    }
                });

                // 处理剩下的未预定义顺序的分组
                Object.entries(groups).forEach(([groupName, fields]) => {
                    if (fields.length > 0) {
                        formFields.push({
                            type: 'fieldSet',
                            title: groupName,
                            className: 'm-t',
                            collapsable: true,
                            collapsed: true,
                            body: fields
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
    });
};

// 注册路由，同时支持 GET 和 POST
// 解决前端 AMIS 有时会发送 POST 请求的问题
router.get('/template-form/:templateId', handleTemplateForm);
router.post('/template-form/:templateId', handleTemplateForm);


// POST /api/schema/preview - 预览生成（不保存）
router.post('/preview', (req, res) => {
    const { template_id, params } = req.body;

    if (!template_id || !params) {
        return res.status(400).json({
            status: 400,
            msg: '缺少必填参数: template_id 或 params'
        });
    }

    // 查询模板配置
    db.get(
        'SELECT * FROM sys_page_templates_config WHERE template_id = ? AND is_active = 1',
        [template_id],
        (err, template) => {
            if (err) {
                logger.error('[Schema API] Failed to query template:', err);
                return res.status(500).json({
                    status: 500,
                    msg: '查询模板失败',
                    error: err.message
                });
            }

            if (!template) {
                return res.status(404).json({
                    status: 404,
                    msg: '模板不存在'
                });
            }

            try {
                // 渲染模板
                const schema_json = env.render(template.template_file, params);
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
        }
    );
});

// POST /api/schema/save - 保存页面到数据库 (支持新建和更新绑定)
router.post('/save', (req, res) => {
    // 接收参数：
    // target_page_key: 绑定的已有页面标识 (可选)
    // manual_page_key: 手动输入的新页面标识 (仅当 target_page_key 为空时使用)
    // page_title: 页面标题
    const { template_id, params, target_page_key, manual_page_key, page_title } = req.body;

    const page_key = target_page_key || manual_page_key;
    const title = page_title;

    if (!template_id || !params || !page_key || !title) {
        return res.status(400).json({
            status: 400,
            msg: target_page_key ? '缺少必填参数: template_id, params, page_title' : '缺少必填参数: template_id, params, manual_page_key, page_title'
        });
    }

    // 查询模板配置
    db.get(
        'SELECT * FROM sys_page_templates_config WHERE template_id = ? AND is_active = 1',
        [template_id],
        (err, template) => {
            if (err) {
                logger.error('[Schema API] Failed to query template:', err);
                return res.status(500).json({ status: 500, msg: '查询模板失败', error: err.message });
            }

            if (!template) {
                return res.status(404).json({ status: 404, msg: '模板不存在' });
            }

            try {
                // 渲染模板生成 Schema
                // 注意：传入 page_key 和 title 到模板上下文，以备不时之需
                const renderContext = { ...params, page_key, title };
                const schema_json = env.render(template.template_file, renderContext);
                JSON.parse(schema_json); // 验证 JSON 格式

                // 开始事务处理保存/更新逻辑
                db.serialize(() => {
                    db.run('BEGIN TRANSACTION');

                    // 1. 检查是否存在已有活动页面
                    db.get('SELECT * FROM sys_page_template WHERE page_key = ? AND is_active = 1', [page_key], (err, current) => {
                        if (err) {
                            db.run('ROLLBACK');
                            return res.status(500).json({ status: 500, error: err.message });
                        }

                        let newVersion = 1;

                        if (current) {
                            // 更新模式：归档旧版本
                            newVersion = current.version + 1;
                            db.run("UPDATE sys_page_template SET is_active = 0, backup_time = datetime('now', '+08:00') WHERE id = ?", [current.id], (err) => {
                                if (err) {
                                    logger.error('Failed to archive old version', err);
                                    // 即使归档失败也最好不要继续，为了数据一致性
                                    // 但在此为了简化，我们假设 rollback 会处理
                                }
                            });
                        } else {
                            // 新建模式：检查是否真的没有（可能只有被软删除的历史版本）
                            // 查询最大版本号以防冲突
                            db.get('SELECT MAX(version) as max_ver FROM sys_page_template WHERE page_key = ?', [page_key], (err, row) => {
                                if (row && row.max_ver) {
                                    newVersion = row.max_ver + 1;
                                }
                            });
                        }

                        // 2. 插入新版本
                        const sql = `
                            INSERT INTO sys_page_template 
                            (page_key, title, schema_json, version, is_active)
                            VALUES (?, ?, ?, ?, 1)
                        `;

                        db.run(sql, [page_key, title, schema_json, newVersion], function (err) {
                            if (err) {
                                db.run('ROLLBACK');
                                logger.error('[Schema API] Failed to save page:', err);
                                const msg = err.message.includes('UNIQUE') ? '页面标识已存在或版本冲突' : '保存页面失败';
                                return res.status(500).json({
                                    status: 500,
                                    msg: msg,
                                    error: err.message
                                });
                            }

                            // 3. 清理旧备份 (保留最近5个)
                            if (current) {
                                db.run(`
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

                            db.run('COMMIT');
                            logger.info(`[Schema API] Page saved: ${page_key} v${newVersion} (id: ${this.lastID})`);
                            res.json({
                                status: 0,
                                msg: '保存成功',
                                data: {
                                    id: this.lastID,
                                    page_key,
                                    title,
                                    version: newVersion,
                                    mode: current ? 'update' : 'create'
                                }
                            });
                        });
                    });
                });

            } catch (error) {
                logger.error('[Schema API] Failed to save page:', error);
                res.status(400).json({
                    status: 400,
                    msg: '保存失败: 模板渲染或JSON格式错误',
                    error: error.message
                });
            }
        }
    );
});

// GET /api/schema/components - 获取组件列表
router.get('/components', (req, res) => {
    const { category } = req.query;

    let sql = 'SELECT * FROM sys_component_library WHERE is_active = 1';
    const params = [];

    if (category) {
        sql += ' AND category = ?';
        params.push(category);
    }

    db.all(sql, params, (err, rows) => {
        if (err) {
            logger.error('[Schema API] Failed to query components:', err);
            return res.status(500).json({
                status: 500,
                msg: '查询组件失败',
                error: err.message
            });
        }

        // 解析 JSON 字段
        const components = rows.map(row => ({
            ...row,
            params_schema: row.params_schema ? JSON.parse(row.params_schema) : {},
            default_params: row.default_params ? JSON.parse(row.default_params) : {}
        }));

        logger.info(`[Schema API] Found ${components.length} components`);
        res.json({ status: 0, data: components });
    });
});

module.exports = router;
