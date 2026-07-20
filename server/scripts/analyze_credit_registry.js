/**
 * credit_registry 模板专属参数分析脚本
 * 信用清册管理页面
 * 保留2个API配置：列表、评价明细，每个API包含url和data
 */
const fs = require('fs');
const path = require('path');
const db = require('../db');
const { applyTemplateVersionMeta } = require('../utils/template-version');

// API 参数配置定义
const API_PARAMS = {
    // 列表接口
    registry_list_api: {
        type: 'string',
        title: '清册列表接口 URL',
        description: '信用清册列表查询 API 地址',
        default: '/api/demo/credit/registry/list',
        group: '🔗 清册列表接口配置',
        groupOrder: 1,
        order: 1
    },
    registry_list_data: {
        type: 'json',
        title: '清册列表接口固定参数',
        description: '清册列表查询 API 的固定请求参数（JSON格式）',
        default: '{}',
        group: '🔗 清册列表接口配置',
        groupOrder: 1,
        order: 2
    },
    // 评价明细接口
    registry_details_api: {
        type: 'string',
        title: '评价明细接口 URL',
        description: '信用评价明细查询 API 地址',
        default: '/api/demo/credit/registry/details',
        group: '🔗 评价明细接口配置',
        groupOrder: 2,
        order: 3
    },
    registry_details_data: {
        type: 'json',
        title: '评价明细接口固定参数',
        description: '评价明细查询 API 的固定请求参数（JSON格式）',
        default: '{}',
        group: '🔗 评价明细接口配置',
        groupOrder: 2,
        order: 4
    }
};

// 主函数
async function analyzeCreditRegistry() {
    const templateId = 'credit_registry';

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
    analyzeCreditRegistry().then(() => process.exit(0));
}

module.exports = analyzeCreditRegistry;
