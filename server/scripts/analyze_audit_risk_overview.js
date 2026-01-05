/**
 * audit_risk_overview 模板专属参数分析脚本
 * 智能稽核 - 风险总览页面
 * 保留3个API配置：统计概览、趋势图、饼图分布，每个API包含url和data
 */
const fs = require('fs');
const path = require('path');
const db = require('../db');

// API 参数配置定义
const API_PARAMS = {
    // 统计概览接口
    stats_api: {
        type: 'string',
        title: '统计概览接口 URL',
        description: '获取顶部4个统计卡片数据的 API 地址',
        default: '/api/demo/audit/risk/overview/stats',
        group: '📊 统计概览配置',
        groupOrder: 1,
        order: 1
    },
    stats_data: {
        type: 'json',
        title: '统计概览接口固定参数',
        description: '统计概览 API 的固定请求参数（JSON格式）',
        default: '{}',
        group: '📊 统计概览配置',
        groupOrder: 1,
        order: 2
    },
    // 趋势图接口
    chart_trend_api: {
        type: 'string',
        title: '趋势图接口 URL',
        description: '近7日AI预警趋势折线图 API 地址',
        default: '/api/demo/audit/risk/overview/chart/trend',
        group: '📈 趋势图配置',
        groupOrder: 2,
        order: 3
    },
    chart_trend_data: {
        type: 'json',
        title: '趋势图接口固定参数',
        description: '趋势图 API 的固定请求参数（JSON格式）',
        default: '{}',
        group: '📈 趋势图配置',
        groupOrder: 2,
        order: 4
    },
    // 饼图分布接口
    chart_pie_api: {
        type: 'string',
        title: '风险分布饼图接口 URL',
        description: 'AI风险类型分布饼图 API 地址',
        default: '/api/demo/audit/risk/overview/chart/pie',
        group: '🥧 饼图分布配置',
        groupOrder: 3,
        order: 5
    },
    chart_pie_data: {
        type: 'json',
        title: '风险分布饼图接口固定参数',
        description: '饼图分布 API 的固定请求参数（JSON格式）',
        default: '{}',
        group: '🥧 饼图分布配置',
        groupOrder: 3,
        order: 6
    }
};

// 主函数
async function analyzeAuditRiskOverview() {
    const templateId = 'audit_risk_overview';

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
                [JSON.stringify(paramsSchema), JSON.stringify(defaultParams), templateId],
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
    analyzeAuditRiskOverview().then(() => process.exit(0));
}

module.exports = analyzeAuditRiskOverview;
