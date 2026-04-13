/**
 * 业务标准 (规则) 页面模板解析脚本
 * 用于提取 business_rule.j2 中的可配置项
 */

const fs = require('fs');
const path = require('path');
const db = require('../db');

// API 参数配置定义
const API_PARAMS = {
    // 导入接口
    rule_import_api: {
        type: 'string',
        title: '全量导入接口 URL',
        description: '全量导入业务规则 (CSV/SQL文件上传)',
        default: '/api/ywbz/import',
        group: '🔗 导入导出配置',
        groupOrder: 3,
        order: 1
    },
    // 导出接口
    rule_export_api: {
        type: 'string',
        title: '全量导出接口 URL',
        description: '全量导出业务规则 (CSV文件下载)',
        default: '/api/ywbz/export',
        group: '🔗 导入导出配置',
        groupOrder: 3,
        order: 2
    },
    // 关键数据算法配置改为从本地 JSON 文件读取，不再作为模板配置项
    // 业务内容分类接口
    business_content_class_api: {
        type: 'string',
        title: '业务内容分类接口 URL',
        description: '获取业务内容分类的 API 地址',
        default: '/api/tools/business-content-classes',
        group: '🔗 平台接口配置',
        groupOrder: 1,
        order: 5,
        required: true
    },
    // 业务内容分类参数
    business_content_class_params: {
        type: 'json-editor',
        title: '业务内容分类接口参数',
        description: '获取业务内容分类的请求参数 (JSON格式)',
        default: {},
        group: '🔗 平台接口配置',
        groupOrder: 1,
        order: 6
    },
    selection_policy_ai_enabled: {
        type: 'boolean',
        title: '启用 AI 政策分析',
        description: '是否在清册选择弹窗中展示 AI 政策分析入口',
        default: true,
        group: '🤖 Dify AI 配置',
        groupOrder: 2,
        order: 1
    },
    selection_policy_ai_api: {
        type: 'string',
        title: 'AI 政策分析接口 URL',
        description: '清册选择弹窗中 AI 政策分析提交接口',
        default: '/api/ywbz/selection_ai_apply',
        group: '🤖 Dify AI 配置',
        groupOrder: 2,
        order: 2
    },
    selection_policy_ai_workflow_type: {
        type: 'string',
        title: 'AI 工作流类型',
        description: '用于匹配当前页面 Dify 工作流配置的 workflow_type',
        default: 'business_rule_policy_analysis',
        group: '🤖 Dify AI 配置',
        groupOrder: 2,
        order: 3
    },
    selection_policy_ai_button_text: {
        type: 'string',
        title: 'AI 按钮文案',
        description: '清册选择弹窗中的 AI 分析按钮名称',
        default: 'AI政策分析',
        group: '🤖 Dify AI 配置',
        groupOrder: 2,
        order: 4
    },
    selection_policy_ai_prompt: {
        type: 'string',
        format: 'textarea',
        title: 'AI 分析提示词',
        description: '提交给 Dify 工作流的附加提示，用于约束返回的标准 ID 列表',
        default: '请结合政策文本、当前算法、业务内容分类、候选业务办理标准列表与已选规则，筛选最匹配的业务办理标准。仅返回最终应勾选的标准 ID 列表，并尽量附带简短说明。',
        group: '🤖 Dify AI 配置',
        groupOrder: 2,
        order: 5
    }
};

async function analyzeBusinessRule() {
    const templateId = 'business_rule';
    console.log(`\n🔍 分析模板: ${templateId}\n`);

    try {
        // 构建 params_schema
        const paramsSchema = {
            type: 'object',
            properties: {},
            required: []
        };
        const defaultParams = {};

        // 添加 API 参数
        Object.entries(API_PARAMS).forEach(([name, config]) => {
            const { group, groupOrder, order, default: defaultValue, required, ...otherProps } = config;

            if (required) {
                paramsSchema.required.push(name);
            }

            paramsSchema.properties[name] = {
                ...otherProps,
                'ui:group': group,
                'ui:groupOrder': groupOrder,
                'ui:order': order,
                default: defaultValue
            };
            defaultParams[name] = defaultValue;
        });

        // 统计分组
        const groups = {};
        Object.values(API_PARAMS).forEach(config => {
            if (!groups[config.group]) groups[config.group] = 0;
            groups[config.group]++;
        });

        console.log(`   └─ 分组数: ${Object.keys(groups).length}`);
        Object.entries(groups).forEach(([group, count]) => {
            console.log(`      - ${group}: ${count}个参数`);
        });

        // db.get / db.run 已经是 async 函数，直接 await 即可
        let row;
        try {
            row = await db.get('SELECT template_id FROM sys_page_templates_config WHERE template_id = ?', [templateId]);
        } catch (err) {
            console.error(`   ❌ 查询失败:`, err.message);
            return;
        }

        if (row) {
            // Update existing
            try {
                console.log('   [SQL] UPDATE sys_page_templates_config', {
                    params_schema: JSON.stringify(paramsSchema),
                    default_params: JSON.stringify(defaultParams),
                    templateId
                });
                await db.run(
                    `UPDATE sys_page_templates_config 
                     SET params_schema = ?, default_params = ? 
                     WHERE template_id = ?`,
                    [JSON.stringify(paramsSchema), JSON.stringify(defaultParams), templateId]
                );
                console.log(`   ✅ 已更新: ${templateId}`);
            } catch (err) {
                console.error(`   ❌ 更新失败:`, err.message);
            }
        } else {
            // Insert new
            console.log(`   ✨ 模板不存在，创建新记录: ${templateId}`);
            try {
                console.log('   [SQL] INSERT INTO sys_page_templates_config', {
                    templateId,
                    template_name: '业务规则配置',
                    description: '关键数据计算模型与业务规则配置页面',
                    template_file: 'pages/business_rule.j2',
                    params_schema: JSON.stringify(paramsSchema),
                    default_params: JSON.stringify(defaultParams)
                });
                await db.run(
                    `INSERT INTO sys_page_templates_config 
                     (template_id, template_name, description, template_file, params_schema, default_params, is_active, created_at)
                     VALUES (?, ?, ?, ?, ?, ?, 1, datetime('now', '+08:00'))`,
                    [
                        templateId,
                        '业务规则配置',
                        '关键数据计算模型与业务规则配置页面',
                        'pages/business_rule.j2',
                        JSON.stringify(paramsSchema),
                        JSON.stringify(defaultParams)
                    ]
                );
                console.log(`   ✅ 已创建: ${templateId}`);
            } catch (err) {
                console.error(`   ❌ 创建失败:`, err.message);
            }
        }

        // Verification Step
        try {
            const verifyRow = await db.get('SELECT params_schema FROM sys_page_templates_config WHERE template_id = ?', [templateId]);
            if (verifyRow && verifyRow.params_schema) {
                const schema = JSON.parse(verifyRow.params_schema);
                const paramCount = Object.keys(schema.properties || {}).length;
                console.log(`   🔍 验证成功: 数据库中已存在配置，包含 ${paramCount} 个参数`);
            } else {
                console.error('   🔍 验证失败: 数据库中未找到配置');
            }
        } catch (err) {
            console.error('   🔍 验证失败: 无法读取数据库');
        }

        console.log(`\n🎉 ${templateId} 分析完成！\n`);
        return { success: true, message: `${templateId} 分析完成` };
    } catch (error) {
        console.error(`   └─ ❌ 分析失败:`, error);
        return { success: false, message: error.message };
    }
}

// 支持直接运行和模块导出
if (require.main === module) {
    analyzeBusinessRule().then(() => process.exit(0));
}

module.exports = analyzeBusinessRule;
