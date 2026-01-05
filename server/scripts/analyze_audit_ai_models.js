/**
 * audit_ai_models 模板专属参数分析脚本
 * 智能稽核 - AI 模型库页面
 * 只保留1个API配置：模型列表，包含url和data
 */
const db = require('../db');

// API 参数配置定义
const API_PARAMS = {
    // 模型列表接口
    models_list_api: {
        type: 'string',
        title: 'AI 模型列表接口 URL',
        description: 'AI 稽核模型列表 API 地址',
        default: '/api/demo/audit/ai-models/list',
        group: '🔗 模型列表接口配置',
        groupOrder: 1,
        order: 1
    },
    models_list_data: {
        type: 'json',
        title: 'AI 模型列表接口固定参数',
        description: '模型列表 API 的固定请求参数（JSON格式）',
        default: '{}',
        group: '🔗 模型列表接口配置',
        groupOrder: 1,
        order: 2
    }
};

// 主函数
async function analyzeAuditAiModels() {
    const templateId = 'audit_ai_models';

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
    analyzeAuditAiModels().then(() => process.exit(0));
}

module.exports = analyzeAuditAiModels;
