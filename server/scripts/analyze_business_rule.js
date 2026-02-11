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
    // 关键数据算法选项配置
    algorithm_options: {
        type: 'combo',
        title: '关键数据算法选项',
        description: '配置关键数据算法的下拉选项 (Key为中文拼音首字母)',
        multiple: true,
        items: [
            { type: 'input-text', name: 'label', label: '显示名称', required: true },
            { type: 'input-text', name: 'value', label: '值 (Key)', required: true }
        ],
        default: [
            { "label": "可提取金额", "value": "ktqje" },
            { "label": "可贷款金额", "value": "kdkje" },
            { "label": "可贷款年限", "value": "kdknx" },
            { "label": "贷款还款时可对冲金额", "value": "dkhkskdcje" }
        ],
        placeholder: '例如：[{"label":"显示名称", "value":"值"}]',
        group: '⚙️ 选项配置',
        groupOrder: 4,
        order: 1
    },
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
