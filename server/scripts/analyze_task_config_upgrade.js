/**
 * 任务项运行配置工具(升级版)模板解析脚本
 * 用于提取 task_config_upgrade.j2 中的可配置项
 */

const db = require('../db');
const API_PREFIX = process.env.API_ROUTE_PREFIX || '/api';

const API_PARAMS = {
    title: {
        type: 'string',
        title: '页面标题',
        description: '任务项运行配置工具页面标题',
        default: '任务项运行配置工具',
        group: '📄 页面配置',
        groupOrder: 1,
        order: 1
    },
    default_task: {
        type: 'string',
        title: '默认任务项',
        description: '默认选中的任务项代码 (如: tq, jc, dk, hk)',
        default: 'tq',
        group: '📄 页面配置',
        groupOrder: 1,
        order: 2
    },
    default_related_party: {
        type: 'string',
        title: '默认相关方',
        description: '默认选中的相关方代码 (如: person, unit, developer)',
        default: 'person',
        group: '📄 页面配置',
        groupOrder: 1,
        order: 3
    },
    task_config_summary_api: {
        type: 'string',
        title: '页面汇总接口 URL',
        description: '任务项运行配置汇总信息查询接口',
        default: `${API_PREFIX}/task_configmock/summary`,
        group: '🔗 接口配置',
        groupOrder: 2,
        order: 1,
        required: true
    },
    task_config_rows_api: {
        type: 'string',
        title: '列表清单接口 URL',
        description: '任务项运行配置清单查询接口',
        default: `${API_PREFIX}/task_configmock/rows`,
        group: '🔗 接口配置',
        groupOrder: 2,
        order: 2,
        required: true
    },
    task_config_business_options_api: {
        type: 'string',
        title: '应用业务选项接口 URL',
        description: '应用于字段的下拉选项查询接口',
        default: `${API_PREFIX}/task_configmock/business-options`,
        group: '🔗 接口配置',
        groupOrder: 2,
        order: 3,
        required: true
    },
    task_config_group_options_api: {
        type: 'string',
        title: '节点要素选项接口 URL',
        description: '节点要素字段的下拉选项查询接口',
        default: `${API_PREFIX}/task_configmock/group-options`,
        group: '🔗 接口配置',
        groupOrder: 2,
        order: 4,
        required: true
    },
    task_config_save_api: {
        type: 'string',
        title: '配置保存接口 URL',
        description: '任务项运行配置保存接口',
        default: `${API_PREFIX}/task_configmock/save-business-config`,
        group: '🔗 接口配置',
        groupOrder: 2,
        order: 5,
        required: true
    }
};

async function analyzeTaskConfigUpgrade() {
    const templateId = 'task_config_upgrade';
    const paramsSchema = {
        type: 'object',
        properties: {},
        required: []
    };
    const defaultParams = {};

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

    const row = await db.get(
        'SELECT template_id FROM sys_page_templates_config WHERE template_id = ?',
        [templateId]
    );

    const components = JSON.stringify(['react', 'custom', 'tpl']);

    if (row) {
        await db.run(
            `UPDATE sys_page_templates_config
             SET template_name = ?, description = ?, template_file = ?, components = ?, params_schema = ?, default_params = ?
             WHERE template_id = ?`,
            [
                '任务项运行配置工具',
                '关键数据算法升级版任务项运行配置页面原型',
                'pages/task_config_upgrade.j2',
                components,
                JSON.stringify(paramsSchema),
                JSON.stringify(defaultParams),
                templateId
            ]
        );
        console.log(`✅ 已更新模板配置: ${templateId}`);
        return;
    }

    await db.run(
        `INSERT INTO sys_page_templates_config
         (template_id, template_name, description, template_file, components, params_schema, default_params, is_active, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1, datetime('now', '+08:00'))`,
        [
            templateId,
            '任务项运行配置工具',
            '关键数据算法升级版任务项运行配置页面原型',
            'pages/task_config_upgrade.j2',
            components,
            JSON.stringify(paramsSchema),
            JSON.stringify(defaultParams)
        ]
    );
    console.log(`✅ 已创建模板配置: ${templateId}`);
}

if (require.main === module) {
    analyzeTaskConfigUpgrade()
        .then(() => process.exit(0))
        .catch((error) => {
            console.error('❌ 模板分析失败:', error);
            process.exit(1);
        });
}

module.exports = analyzeTaskConfigUpgrade;
