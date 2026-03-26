/**
 * 项目详情页面模板解析脚本
 * 用于提取 project_detail.j2 中的可配置项
 */

const db = require('../db');
const API_PREFIX = process.env.API_ROUTE_PREFIX || '/api';

const API_PARAMS = {
    title: {
        type: 'string',
        title: '页面标题',
        description: '项目详情页面标题',
        default: '项目详情',
        group: '📄 页面配置',
        groupOrder: 1,
        order: 1
    },
    default_page_size: {
        type: 'integer',
        title: '任务清单默认每页条数',
        description: '项目任务清单默认每页显示条数',
        default: 10,
        group: '📄 页面配置',
        groupOrder: 1,
        order: 2
    },
    project_summary_api: {
        type: 'string',
        title: '项目基本信息接口 URL',
        description: '项目基本信息查询接口',
        default: `${API_PREFIX}/project_detailmock/summary`,
        group: '🔗 接口配置',
        groupOrder: 2,
        order: 1,
        required: true
    },
    project_summary_params: {
        type: 'json',
        title: '项目基本信息接口参数',
        description: '项目基本信息接口请求参数',
        default: {},
        group: '🔗 接口配置',
        groupOrder: 2,
        order: 2
    },
    project_stage_api: {
        type: 'string',
        title: '项目阶段概览接口 URL',
        description: '项目阶段概览查询接口',
        default: `${API_PREFIX}/project_detailmock/stages`,
        group: '🔗 接口配置',
        groupOrder: 2,
        order: 3,
        required: true
    },
    project_stage_params: {
        type: 'json',
        title: '项目阶段概览接口参数',
        description: '项目阶段概览接口请求参数',
        default: {},
        group: '🔗 接口配置',
        groupOrder: 2,
        order: 4
    },
    project_group_api: {
        type: 'string',
        title: '任务分组接口 URL',
        description: '任务分组查询接口',
        default: `${API_PREFIX}/project_detailmock/task-groups`,
        group: '🔗 接口配置',
        groupOrder: 2,
        order: 5,
        required: true
    },
    project_group_params: {
        type: 'json',
        title: '任务分组接口参数',
        description: '任务分组接口请求参数',
        default: {},
        group: '🔗 接口配置',
        groupOrder: 2,
        order: 6
    },
    project_task_api: {
        type: 'string',
        title: '任务清单接口 URL',
        description: '任务清单查询接口',
        default: `${API_PREFIX}/project_detailmock/tasks`,
        group: '🔗 接口配置',
        groupOrder: 2,
        order: 7,
        required: true
    },
    project_task_params: {
        type: 'json',
        title: '任务清单接口参数',
        description: '任务清单接口请求参数',
        default: {},
        group: '🔗 接口配置',
        groupOrder: 2,
        order: 8
    },
    project_resource_api: {
        type: 'string',
        title: '资源清单接口 URL',
        description: '资源清单查询接口',
        default: `${API_PREFIX}/project_detailmock/resources`,
        group: '🔗 接口配置',
        groupOrder: 2,
        order: 9,
        required: true
    },
    project_resource_params: {
        type: 'json',
        title: '资源清单接口参数',
        description: '资源清单接口请求参数',
        default: {},
        group: '🔗 接口配置',
        groupOrder: 2,
        order: 10
    }
};

async function analyzeProjectDetail() {
    const templateId = 'project_detail';
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

    if (row) {
        await db.run(
            `UPDATE sys_page_templates_config
             SET template_name = ?, description = ?, template_file = ?, params_schema = ?, default_params = ?
             WHERE template_id = ?`,
            [
                '项目详情',
                '项目详情看板页面，包含项目基本信息、阶段概览、任务清单和资源清单',
                'pages/project_detail.j2',
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
            '项目详情',
            '项目详情看板页面，包含项目基本信息、阶段概览、任务清单和资源清单',
            'pages/project_detail.j2',
            '[]',
            JSON.stringify(paramsSchema),
            JSON.stringify(defaultParams)
        ]
    );
    console.log(`✅ 已创建模板配置: ${templateId}`);
}

if (require.main === module) {
    analyzeProjectDetail()
        .then(() => process.exit(0))
        .catch((error) => {
            console.error('❌ 模板分析失败:', error);
            process.exit(1);
        });
}

module.exports = analyzeProjectDetail;
