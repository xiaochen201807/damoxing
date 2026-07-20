/**
 * credit_indicators 模板专属参数分析脚本
 * 信用评价指标管理页面
 * 保留4个API配置：列表、新增、更新、删除，每个API包含url和data
 */
const fs = require('fs');
const path = require('path');
const db = require('../db');
const { applyTemplateVersionMeta } = require('../utils/template-version');

// API 参数配置定义
const API_PARAMS = {
    // 列表接口
    indicators_list_api: {
        type: 'string',
        title: '列表接口 URL',
        description: '信用评价指标列表查询 API 地址',
        default: '/api/demo/credit/indicators/list',
        group: '🔗 列表接口配置',
        groupOrder: 1,
        order: 1
    },
    indicators_list_data: {
        type: 'json',
        title: '列表接口固定参数',
        description: '列表查询 API 的固定请求参数（JSON格式）',
        default: '{}',
        group: '🔗 列表接口配置',
        groupOrder: 1,
        order: 2
    },
    // 新增接口
    indicators_create_api: {
        type: 'string',
        title: '新增接口 URL',
        description: '新增信用评价指标 API 地址',
        default: '/api/demo/credit/indicators/create',
        group: '🔗 新增接口配置',
        groupOrder: 2,
        order: 3
    },
    indicators_create_data: {
        type: 'json',
        title: '新增接口固定参数',
        description: '新增 API 的固定请求参数（JSON格式）',
        default: '{}',
        group: '🔗 新增接口配置',
        groupOrder: 2,
        order: 4
    },
    // 更新接口
    indicators_update_api: {
        type: 'string',
        title: '更新接口 URL',
        description: '更新信用评价指标 API 地址',
        default: '/api/demo/credit/indicators/update',
        group: '🔗 更新接口配置',
        groupOrder: 3,
        order: 5
    },
    indicators_update_data: {
        type: 'json',
        title: '更新接口固定参数',
        description: '更新 API 的固定请求参数（JSON格式）',
        default: '{}',
        group: '🔗 更新接口配置',
        groupOrder: 3,
        order: 6
    },
    // 删除接口
    indicators_delete_api: {
        type: 'string',
        title: '删除接口 URL',
        description: '删除信用评价指标 API 地址',
        default: '/api/demo/credit/indicators/delete',
        group: '🔗 删除接口配置',
        groupOrder: 4,
        order: 7
    },
    indicators_delete_data: {
        type: 'json',
        title: '删除接口固定参数',
        description: '删除 API 的固定请求参数（JSON格式）',
        default: '{}',
        group: '🔗 删除接口配置',
        groupOrder: 4,
        order: 8
    }
};

// 主函数
async function analyzeCreditIndicators() {
    const templateId = 'credit_indicators';

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
            paramsSchema.properties[name] = {
                type: config.type,
                title: config.title,
                description: config.description,
                'ui:group': config.group,
                'ui:groupOrder': config.groupOrder,
                'ui:order': config.order,
                default: config.default
            };
            defaultParams[name] = config.default;
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

        await new Promise((resolve) => {
            db.run(
                `UPDATE sys_page_templates_config 
                 SET params_schema = ?, default_params = ? 
                 WHERE template_id = ?`,
                [JSON.stringify(applyTemplateVersionMeta(paramsSchema, templateId)), JSON.stringify(defaultParams), templateId],
                (err) => {
                    if (!err) {
                        console.log(`   ✅ 已更新: ${templateId}`);
                    } else {
                        console.error(`   ❌ 更新失败:`, err.message);
                    }
                    resolve();
                }
            );
        });

        console.log(`\n🎉 ${templateId} 分析完成！\n`);
        return { success: true, message: `${templateId} 分析完成` };
    } catch (error) {
        console.error(`   └─ ❌ 分析失败:`, error);
        return { success: false, message: error.message };
    }
}

// 支持直接运行和模块导出
if (require.main === module) {
    analyzeCreditIndicators().then(() => process.exit(0));
}

module.exports = analyzeCreditIndicators;
