/**
 * audit_ai_models 模板专属参数分析脚本
 * 分析 AI 模型库页面模板，生成 params_schema 并更新数据库
 */
const fs = require('fs');
const path = require('path');
const db = require('../db');
const { applyTemplateVersionMeta } = require('../utils/template-version');

// 组件文件名 -> 友好分组名的映射
const COMPONENT_GROUP_NAMES = {
    '__page__': '📄 页面参数',
    '__cards__': '🎴 AI 模型卡片配置',
    '__footer__': '🦶 页面底部配置'
};

// 提取 @param 注释
function extractParamAnnotations(content) {
    const params = [];
    const commentBlockRegex = /{#([\s\S]*?)#}/g;
    let blockMatch;
    while ((blockMatch = commentBlockRegex.exec(content)) !== null) {
        const commentBlock = blockMatch[1];
        // 使用 - 作为参数标记
        const paramRegex = /-\s+([a-zA-Z_][a-zA-Z0-9_]*):\s*([^\n]+)/g;
        let paramMatch;
        while ((paramMatch = paramRegex.exec(commentBlock)) !== null) {
            params.push({
                name: paramMatch[1].trim(),
                description: paramMatch[2].trim()
            });
        }
    }
    return params;
}

// 主函数：分析 audit_ai_models 模板
async function analyzeAuditAiModels() {
    const templatesDir = path.join(__dirname, '../templates');
    const templateFile = path.join(templatesDir, 'pages/audit_ai_models.j2');
    const templateId = 'audit_ai_models';

    console.log(`\n🔍 分析模板: ${templateId}\n`);

    try {
        const content = fs.readFileSync(templateFile, 'utf-8');
        const annotations = extractParamAnnotations(content);

        console.log(`   └─ 发现参数注释: ${annotations.length} 个`);
        annotations.forEach(a => console.log(`      - ${a.name}: ${a.description}`));

        // 构建 params_schema
        const paramsSchema = {
            type: 'object',
            properties: {
                title: {
                    type: 'string',
                    title: '页面标题',
                    description: '页面标题',
                    default: 'AI 稽核模型库',
                    'ui:group': COMPONENT_GROUP_NAMES['__page__'],
                    'ui:groupOrder': 1,
                    'ui:order': 1
                },
                subtitle: {
                    type: 'string',
                    title: '页面副标题',
                    description: '页面副标题说明文字',
                    default: '多人工智能构成的组合风险识别模型，高效发现各类违规行为',
                    'ui:group': COMPONENT_GROUP_NAMES['__page__'],
                    'ui:groupOrder': 1,
                    'ui:order': 2
                },
                columns_count: {
                    type: 'number',
                    title: '列数',
                    description: '每行显示的卡片列数',
                    default: 2,
                    'ui:group': COMPONENT_GROUP_NAMES['__cards__'],
                    'ui:groupOrder': 2,
                    'ui:order': 3
                },
                cards: {
                    type: 'array',
                    title: 'AI 模型卡片列表',
                    description: '配置显示的 AI 模型卡片',
                    'ui:group': COMPONENT_GROUP_NAMES['__cards__'],
                    'ui:groupOrder': 2,
                    'ui:order': 4,
                    tabsMode: true,
                    tabsLabelTpl: '${name || "卡片 " + (index + 1)}',
                    multiLine: true,
                    subFormMode: 'horizontal',
                    itemClassName: 'bg-light p-3 mb-3 rounded border',
                    items: {
                        type: 'object',
                        title: '模型卡片',
                        properties: {
                            sortOrder: {
                                type: 'integer',
                                title: '显示顺序',
                                description: '数字越小越靠前，保存时会按此排序',
                                'ui:order': -1
                            },
                            name: {
                                type: 'string',
                                title: '模型名称',
                                description: '卡片顶部显示的模型名称'
                            },
                            icon: {
                                type: 'string',
                                title: '图标',
                                description: 'FontAwesome 图标类名，如 fa fa-shield'
                            },
                            color: {
                                type: 'string',
                                title: '颜色',
                                description: '卡片头部背景颜色，如 #1890ff',
                                format: 'color'
                            },
                            function: {
                                type: 'string',
                                title: '功能描述',
                                description: '模型的功能说明',
                                format: 'textarea'
                            },
                            technology: {
                                type: 'string',
                                title: '技术说明',
                                description: '使用的技术栈说明',
                                format: 'textarea'
                            }
                        }
                    },
                    default: [
                        {
                            name: '智能风控模型',
                            icon: 'fa fa-shield',
                            color: '#1890ff',
                            function: '基于深度学习的实时风险评估，自动识别异常交易行为和潜在欺诈风险',
                            technology: '深度神经网络 + 实时规则引擎 + 知识图谱'
                        },
                        {
                            name: '合规审计模型',
                            icon: 'fa fa-check-circle',
                            color: '#52c41a',
                            function: '自动化合规检测，智能识别业务流程中的合规风险点和违规操作',
                            technology: 'NLP语义分析 + 业务规则匹配 + 智能推理'
                        },
                        {
                            name: '异常检测模型',
                            icon: 'fa fa-exclamation-triangle',
                            color: '#faad14',
                            function: '多维度异常行为检测，精准发现数据造假、异常操作等问题',
                            technology: '无监督学习 + 统计分析 + 时序异常检测'
                        },
                        {
                            name: '风险预警模型',
                            icon: 'fa fa-bell',
                            color: '#722ed1',
                            function: '提前预测潜在风险，及时预警可能发生的违规行为和业务风险',
                            technology: '时间序列预测 + 概率模型 + 风险评分'
                        }
                    ]
                },
                footer_text: {
                    type: 'string',
                    title: '底部文字',
                    description: '页面底部版权文字',
                    default: '住房公积金管理中心 © 2025',
                    'ui:group': COMPONENT_GROUP_NAMES['__footer__'],
                    'ui:groupOrder': 3,
                    'ui:order': 5
                }
            }
        };

        // 构建默认参数
        const defaultParams = {
            title: 'AI 稽核模型库',
            subtitle: '多人工智能构成的组合风险识别模型，高效发现各类违规行为',
            columns_count: 2,
            cards: paramsSchema.properties.cards.default,
            footer_text: '住房公积金管理中心 © 2025'
        };

        // 先检查模板是否存在
        const existing = await new Promise((resolve, reject) => {
            db.get(
                'SELECT id FROM sys_page_templates_config WHERE template_id = ?',
                [templateId],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                }
            );
        });

        if (existing) {
            // 更新现有记录
            await new Promise((resolve, reject) => {
                db.run(
                    `UPDATE sys_page_templates_config 
                     SET params_schema = ?, default_params = ?
                     WHERE template_id = ?`,
                    [JSON.stringify(applyTemplateVersionMeta(paramsSchema, templateId)), JSON.stringify(defaultParams), templateId],
                    (err) => {
                        if (err) reject(err);
                        else resolve();
                    }
                );
            });
            console.log(`   ✅ 已更新模板配置: ${templateId}`);
        } else {
            // 插入新记录
            await new Promise((resolve, reject) => {
                db.run(
                    `INSERT INTO sys_page_templates_config 
                     (template_id, template_name, description, template_file, components, params_schema, default_params, is_active)
                     VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
                    [
                        templateId,
                        'AI 稽核模型库',
                        'AI 智能稽核模型展示页面，支持自定义卡片配置',
                        'pages/audit_ai_models.j2',
                        '[]',
                        JSON.stringify(applyTemplateVersionMeta(paramsSchema, templateId)),
                        JSON.stringify(defaultParams)
                    ],
                    (err) => {
                        if (err) reject(err);
                        else resolve();
                    }
                );
            });
            console.log(`   ✅ 已创建模板配置: ${templateId}`);
        }

        // 输出分组统计
        const groups = {};
        Object.values(paramsSchema.properties).forEach(prop => {
            const g = prop['ui:group'] || '⚙️ 其他配置';
            if (!groups[g]) groups[g] = 0;
            groups[g]++;
        });

        console.log(`   └─ 分组数: ${Object.keys(groups).length}`);
        Object.entries(groups).forEach(([group, count]) => {
            console.log(`      - ${group}: ${count}个参数`);
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
