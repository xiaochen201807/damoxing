/**
 * credit_risk_monitor 模板专属参数分析脚本
 * 风险监控页面
 * 保留页面配置 + 8个API配置：4个图表 + 3个钻取 + 1个报告，每个API包含url和data
 */
const fs = require('fs');
const path = require('path');
const db = require('../db');

const DEFAULT_RISK_WARNING_HTML = "<h4 style='color:#d32f2f;margin:0 0 8px 0'>风险说明</h4><p style='margin:0 0 8px 0'>信用等级C与D的信用主体标记为风险主体。</p><ul style='padding-left:20px;margin:0'><li><strong>C级（较差）</strong>：加强业务审核</li><li><strong>D级（差）</strong>：重点监管</li></ul>";

// API 参数配置定义
const API_PARAMS = {
    // ========== 页面配置 ==========
    risk_warning_html: {
        type: 'string',
        format: 'textarea',
        title: '风险说明内容',
        description: '页面顶部风险说明提示内容，支持 HTML',
        default: DEFAULT_RISK_WARNING_HTML,
        group: '📄 页面参数',
        groupOrder: 1,
        order: 0
    },
    // ========== 图表接口 ==========
    // 信用级别饼图
    chart_level_api: {
        type: 'string',
        title: '信用级别饼图 URL',
        description: '信用级别分布饼图 API 地址',
        default: '/api/demo/credit/risk/chart/level',
        group: '📊 信用级别饼图配置',
        groupOrder: 2,
        order: 1
    },
    chart_level_data: {
        type: 'json',
        title: '信用级别饼图固定参数',
        description: '信用级别饼图 API 的固定请求参数（JSON格式）',
        default: '{}',
        group: '📊 信用级别饼图配置',
        groupOrder: 2,
        order: 2
    },
    // 风险行为柱状图
    chart_behavior_api: {
        type: 'string',
        title: '风险行为柱状图 URL',
        description: '风险行为分布柱状图 API 地址',
        default: '/api/demo/credit/risk/chart/behavior',
        group: '📊 风险行为柱状图配置',
        groupOrder: 3,
        order: 3
    },
    chart_behavior_data: {
        type: 'json',
        title: '风险行为柱状图固定参数',
        description: '风险行为柱状图 API 的固定请求参数（JSON格式）',
        default: '{}',
        group: '📊 风险行为柱状图配置',
        groupOrder: 3,
        order: 4
    },
    // 区域风险柱状图
    chart_region_api: {
        type: 'string',
        title: '区域风险柱状图 URL',
        description: '区域风险分布柱状图 API 地址',
        default: '/api/demo/credit/risk/chart/region',
        group: '📊 区域风险柱状图配置',
        groupOrder: 4,
        order: 5
    },
    chart_region_data: {
        type: 'json',
        title: '区域风险柱状图固定参数',
        description: '区域风险柱状图 API 的固定请求参数（JSON格式）',
        default: '{}',
        group: '📊 区域风险柱状图配置',
        groupOrder: 4,
        order: 6
    },
    // 风险趋势折线图
    chart_trend_api: {
        type: 'string',
        title: '风险趋势折线图 URL',
        description: '近30天风险趋势折线图 API 地址',
        default: '/api/demo/credit/risk/chart/trend',
        group: '📈 风险趋势折线图配置',
        groupOrder: 5,
        order: 7
    },
    chart_trend_data: {
        type: 'json',
        title: '风险趋势折线图固定参数',
        description: '风险趋势折线图 API 的固定请求参数（JSON格式）',
        default: '{}',
        group: '📈 风险趋势折线图配置',
        groupOrder: 5,
        order: 8
    },
    // ========== 钻取接口 ==========
    // 信用等级钻取
    drilldown_level_api: {
        type: 'string',
        title: '信用等级钻取 URL',
        description: '饼图点击钻取 API 地址',
        default: '/api/demo/credit/risk/drilldown/level',
        group: '🔍 信用等级钻取配置',
        groupOrder: 6,
        order: 9
    },
    drilldown_level_data: {
        type: 'json',
        title: '信用等级钻取固定参数',
        description: '信用等级钻取 API 的固定请求参数（JSON格式）',
        default: '{}',
        group: '🔍 信用等级钻取配置',
        groupOrder: 6,
        order: 10
    },
    // 风险行为钻取
    drilldown_behavior_api: {
        type: 'string',
        title: '风险行为钻取 URL',
        description: '风险行为柱状图点击钻取 API 地址',
        default: '/api/demo/credit/risk/drilldown/behavior',
        group: '🔍 风险行为钻取配置',
        groupOrder: 7,
        order: 11
    },
    drilldown_behavior_data: {
        type: 'json',
        title: '风险行为钻取固定参数',
        description: '风险行为钻取 API 的固定请求参数（JSON格式）',
        default: '{}',
        group: '🔍 风险行为钻取配置',
        groupOrder: 7,
        order: 12
    },
    // 区域钻取
    drilldown_region_api: {
        type: 'string',
        title: '区域钻取 URL',
        description: '区域柱状图点击钻取 API 地址',
        default: '/api/demo/credit/risk/drilldown/region',
        group: '🔍 区域钻取配置',
        groupOrder: 8,
        order: 13
    },
    drilldown_region_data: {
        type: 'json',
        title: '区域钻取固定参数',
        description: '区域钻取 API 的固定请求参数（JSON格式）',
        default: '{}',
        group: '🔍 区域钻取配置',
        groupOrder: 8,
        order: 14
    },
    // ========== 报告接口 ==========
    generate_report_api: {
        type: 'string',
        title: 'AI报告生成 URL',
        description: '信用体系管理分析报告生成 API 地址',
        default: '/api/demo/credit/risk/generate-report',
        group: '📝 AI报告生成配置',
        groupOrder: 9,
        order: 15
    },
    generate_report_data: {
        type: 'json',
        title: 'AI报告生成固定参数',
        description: 'AI报告生成 API 的固定请求参数（JSON格式）',
        default: '{}',
        group: '📝 AI报告生成配置',
        groupOrder: 9,
        order: 16
    }
};

// 主函数
async function analyzeCreditRiskMonitor() {
    const templateId = 'credit_risk_monitor';

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
            if (config.format) {
                paramsSchema.properties[name].format = config.format;
            }
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
    analyzeCreditRiskMonitor().then(() => process.exit(0));
}

module.exports = analyzeCreditRiskMonitor;
