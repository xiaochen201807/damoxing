/**
 * 程序控制规则 页面模板解析脚本
 * 用于提取 cxgzkz.j2 中的可配置项
 */

const fs = require('fs');
const path = require('path');
const db = require('../db');

// API 参数配置定义
const API_PARAMS = {
    // 列表查询接口
    rule_list_api: {
        type: 'string',
        title: '查询接口 URL',
        description: '获取程序控制规则列表的 API',
        default: '/api/cxgzkz/list',
        group: '🔗 平台接口配置',
        groupOrder: 1,
        order: 1,
        required: true
    },
    // 保存接口
    rule_save_api: {
        type: 'string',
        title: '保存接口 URL',
        description: '保存/修改程序控制规则的 API',
        default: '/api/cxgzkz/save',
        group: '🔗 平台接口配置',
        groupOrder: 1,
        order: 2,
        required: true
    },
    // 删除接口
    rule_delete_api: {
        type: 'string',
        title: '删除接口 URL',
        description: '删除程序控制规则的 API',
        default: '/api/cxgzkz/delete',
        group: '🔗 平台接口配置',
        groupOrder: 1,
        order: 3,
        required: true
    },
    // 任务项查询接口
    task_info_api: {
        type: 'string',
        title: '任务项接口 URL',
        description: '任务项联想与映射查询接口',
        default: '/api/tools/task-info',
        group: '🔗 平台接口配置',
        groupOrder: 1,
        order: 4,
        required: true
    },
    // 导入接口
    rule_import_api: {
        type: 'string',
        title: '导入接口 URL',
        description: '导入程序控制规则的 API',
        default: '/api/cxgzkz/import',
        group: '🔗 平台接口配置',
        groupOrder: 1,
        order: 5,
        required: true
    },
    // 导出接口
    rule_export_api: {
        type: 'string',
        title: '导出接口 URL',
        description: '导出程序控制规则的 API',
        default: '/api/cxgzkz/export',
        group: '🔗 平台接口配置',
        groupOrder: 1,
        order: 6,
        required: true
    }
};

async function analyzeCxgzkzRule() {
    const templateId = 'cxgzkz';
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

        let row;
        try {
            row = await db.get('SELECT template_id FROM sys_page_templates_config WHERE template_id = ?', [templateId]);
        } catch (err) {
            console.error('   ❌ 查询失败:', err.message);
            return;
        }

        if (row) {
            try {
                console.log('   [SQL] UPDATE sys_page_templates_config', {
                    template_name: '程序规则控制',
                    params_schema: JSON.stringify(paramsSchema),
                    default_params: JSON.stringify(defaultParams),
                    templateId
                });
                await db.run(
                    `UPDATE sys_page_templates_config 
                     SET template_name = ?, params_schema = ?, default_params = ? 
                     WHERE template_id = ?`,
                    ['程序规则控制', JSON.stringify(paramsSchema), JSON.stringify(defaultParams), templateId]
                );
                console.log(`   ✅ 已更新: ${templateId}`);
            } catch (err) {
                console.error('   ❌ 更新失败:', err.message);
            }
        } else {
            console.log(`   ✨ 模板不存在，创建新记录: ${templateId}`);
            try {
                console.log('   [SQL] INSERT INTO sys_page_templates_config', {
                    templateId,
                    template_name: '程序规则控制',
                    description: '用于管理控制系统核心功能的各项参数阈值与开关',
                    template_file: 'pages/cxgzkz.j2',
                    components: '[]',
                    params_schema: JSON.stringify(paramsSchema),
                    default_params: JSON.stringify(defaultParams)
                });
                await db.run(
                    `INSERT INTO sys_page_templates_config 
                     (template_id, template_name, description, template_file, components, params_schema, default_params, is_active, created_at)
                     VALUES (?, ?, ?, ?, ?, ?, ?, 1, datetime('now', '+08:00'))`,
                    [
                        templateId,
                        '程序规则控制',
                        '用于管理控制系统核心功能的各项参数阈值与开关',
                        'pages/cxgzkz.j2',
                        '[]',
                        JSON.stringify(paramsSchema),
                        JSON.stringify(defaultParams)
                    ]
                );
                console.log(`   ✅ 已创建: ${templateId}`);
            } catch (err) {
                console.error('   ❌ 创建失败:', err.message);
            }
        }

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
        console.error('   └─ ❌ 分析失败:', error);
        return { success: false, message: error.message };
    }
}

// 支持直接运行和模块导出
if (require.main === module) {
    analyzeCxgzkzRule().then(() => process.exit(0));
}

module.exports = analyzeCxgzkzRule;
