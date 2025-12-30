/**
 * policy_demo 模板专属参数分析脚本
 */
const fs = require('fs');
const path = require('path');
const db = require('../db');

// 组件文件名 -> 友好分组名的映射
const COMPONENT_GROUP_NAMES = {
    'header.j2': '🎨 页面头部配置',
    'bar_chart_panel.j2': '📊 柱状图配置',
    'line_chart_panel.j2': '📈 折线图配置',
    'pie_chart.j2': '🥧 饼图配置',
    'stats_cards.j2': '📊 统计卡片配置',
    'unified_policy_component.j2': '⚙️ 表单及 AI组件配置',
    'import_Ai.j2': '🤖 AI分析配置',
    'alert.j2': '💡 提示配置',
    '__page__': '📄 页面参数'
};

// 提取 include 指令
function extractIncludes(content) {
    const includes = [];
    const regex = /{%\s*include\s+['"]([^'"]+)['"]\s*%}/g;
    let match;
    while ((match = regex.exec(content)) !== null) {
        includes.push(match[1]);
    }
    return includes;
}

// 提取变量及其默认值
function extractVariables(content) {
    const vars = new Set();
    const defaults = {};

    const varWithDefaultRegex = /{{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\|\s*default\((.*?)\)/g;
    let match;
    while ((match = varWithDefaultRegex.exec(content)) !== null) {
        const varName = match[1];
        let defaultValue = match[2].trim();
        if ((defaultValue.startsWith('"') && defaultValue.endsWith('"')) ||
            (defaultValue.startsWith("'") && defaultValue.endsWith("'"))) {
            defaultValue = defaultValue.slice(1, -1);
        }
        vars.add(varName);
        defaults[varName] = defaultValue;
    }

    const tagRegex = /(?:{{|{%)\s*([\s\S]*?)\s*(?:}}|%})/g;
    const identifierRegex = /\b([a-zA-Z_][a-zA-Z0-9_]*)\b/g;

    while ((match = tagRegex.exec(content)) !== null) {
        let tagBody = match[1];
        tagBody = tagBody.replace(/'[^']*'/g, "''").replace(/"[^"]*"/g, '""');

        let idMatch;
        while ((idMatch = identifierRegex.exec(tagBody)) !== null) {
            const word = idMatch[1];
            const keywords = ['if', 'else', 'elif', 'endif', 'for', 'in', 'endfor', 'set', 'include', 'with', 'import', 'as', 'default', 'fromjson', 'tojson', 'filter', 'endfilter', 'macro', 'endmacro', 'call', 'endcall', 'true', 'false', 'none', 'and', 'or', 'not', 'is', 'mapping', 'safe', 'item', 'items', 'loop', 'self', 'cycler', 'joiner', 'namespace', 'endset', 'block', 'endblock', 'extends', 'parent'];
            if (!keywords.includes(word)) {
                vars.add(word);
            }
        }
    }

    const junkWords = [
        'if', 'else', 'elif', 'endif', 'for', 'in', 'endfor', 'set', 'include', 'with', 'import', 'as', 'default',
        'fromjson', 'tojson', 'filter', 'endfilter', 'macro', 'endmacro', 'call', 'endcall', 'true', 'false', 'none',
        'and', 'or', 'not', 'is', 'mapping', 'safe', 'item', 'items', 'loop', 'self', 'cycler', 'joiner', 'namespace',
        'endset', 'block', 'endblock', 'extends', 'parent', 'group', 'field', 'action', 'colors', 'background',
        'text_primary', 'text_secondary', 'last', 'index', 'px', 'rem', 'em', 'vh', 'vw', 'className', 'id', 'type', 'name'
    ];

    const builtins = new Set([
        'theme', 'now', 'date', 'g', 'f', 'a', 'i', 'v', 'k', 'comma', 'btn_comma', 'inner_comma', 'footer_comma',
        'subtitle_tpl', 'report_button_json', 'ai_loading', 'show_analysis_result', 'show_prediction'
    ]);

    const filtered = Array.from(vars).filter(v => {
        if (builtins.has(v)) return false;
        if (junkWords.includes(v)) return false;
        if (v.startsWith('_')) return false;
        return true;
    });

    return { variables: filtered, defaults };
}

// 提取 @param 注释
function extractParamAnnotations(content) {
    const params = [];
    const commentBlockRegex = /{#([\s\S]*?)#}/g;
    let blockMatch;
    while ((blockMatch = commentBlockRegex.exec(content)) !== null) {
        const commentBlock = blockMatch[1];
        const paramRegex = /@param\s+([a-zA-Z_][a-zA-Z0-9_]*)\s+([^\n]+)/g;
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

// 类型推断
function inferType(varName) {
    const result = { type: 'string', description: varName.replace(/_/g, ' '), default: '' };
    if (varName.startsWith('enable_') || varName.startsWith('is_')) {
        result.type = 'boolean';
        result.default = true;
    } else if (varName.endsWith('_api')) {
        result.description = varName.replace(/_/g, ' ') + ' 地址';
        result.default = `/api/${varName.replace('_api', '')}`;
    } else if (varName.includes('height') || varName.includes('width')) {
        result.type = 'integer';
        result.default = 400;
    } else if (varName === 'title') {
        result.description = '页面标题';
        result.default = '页面标题';
    } else if (varName === 'subtitle') {
        result.description = '页面副标题';
        result.default = '';
    } else if (varName === 'footer_text') {
        result.description = '底部文本';
        result.default = '© 2025';
    }
    return result;
}

// 递归处理文件，按组件分组存储
function processFile(filePath, templatesDir, context) {
    if (context.visited.has(filePath)) return;
    context.visited.add(filePath);

    const fullPath = path.join(templatesDir, filePath);
    if (!fs.existsSync(fullPath)) {
        console.warn(`   ⚠️  文件不存在: ${filePath}`);
        return;
    }

    const content = fs.readFileSync(fullPath, 'utf-8');
    const filename = path.basename(filePath);

    let groupName = COMPONENT_GROUP_NAMES[filename];
    if (!groupName) {
        if (filePath.includes('pages/')) {
            groupName = COMPONENT_GROUP_NAMES['__page__'];
        } else {
            groupName = '⚙️ 其他配置';
        }
    }

    const annotations = extractParamAnnotations(content);

    if (annotations.length > 0) {
        if (!context.groupOrderMap[groupName]) {
            context.currentGroupOrder++;
            context.groupOrderMap[groupName] = context.currentGroupOrder;
        }

        if (!context.componentParams[groupName]) {
            context.componentParams[groupName] = [];
        }

        annotations.forEach(annotation => {
            if (!context.allParamNames.has(annotation.name)) {
                context.allParamNames.add(annotation.name);
                context.globalOrder++;
                context.componentParams[groupName].push({
                    name: annotation.name,
                    description: annotation.description,
                    order: context.globalOrder,
                    groupOrder: context.groupOrderMap[groupName]
                });
            }
        });
    }

    const { variables: vars, defaults: varDefaults } = extractVariables(content);
    vars.forEach(v => context.allVariables.add(v));

    Object.entries(varDefaults).forEach(([varName, defaultValue]) => {
        if (!context.templateDefaults[varName]) {
            context.templateDefaults[varName] = defaultValue;
        }
    });

    const includes = extractIncludes(content);
    includes.forEach(inc => processFile(inc, templatesDir, context));
}

// 分析模板
function analyzeTemplate(templateFile, templatesDir) {
    const entryFile = path.join('pages', templateFile);

    const context = {
        visited: new Set(),
        componentParams: {},
        allParamNames: new Set(),
        allVariables: new Set(),
        templateDefaults: {},
        globalOrder: 0,
        groupOrderMap: {},
        currentGroupOrder: 0
    };

    processFile(entryFile, templatesDir, context);

    const paramsSchema = {
        type: 'object',
        properties: {},
        required: []
    };
    const defaultParams = {};

    Object.entries(context.componentParams).forEach(([groupName, params]) => {
        params.forEach(param => {
            const inferred = inferType(param.name);
            let defaultValue = context.templateDefaults[param.name];
            if (defaultValue === undefined) {
                defaultValue = inferred.default;
            }

            paramsSchema.properties[param.name] = {
                type: inferred.type,
                description: param.description,
                'ui:group': groupName,
                'ui:groupOrder': param.groupOrder,
                'ui:order': param.order
            };

            if (defaultValue !== undefined) {
                paramsSchema.properties[param.name].default = defaultValue;
                defaultParams[param.name] = defaultValue;
            }
        });
    });

    const undocumented = Array.from(context.allVariables).filter(v => !context.allParamNames.has(v));
    undocumented.forEach(varName => {
        const inferred = inferType(varName);
        context.globalOrder++;

        paramsSchema.properties[varName] = {
            type: inferred.type,
            description: inferred.description + ' (自动推断)',
            'ui:group': '⚙️ 其他配置',
            'ui:groupOrder': 999,
            'ui:order': context.globalOrder
        };

        if (inferred.default !== undefined) {
            paramsSchema.properties[varName].default = inferred.default;
            defaultParams[varName] = inferred.default;
        }
    });

    // policy_demo 专属的特殊映射
    const policyDemoMapping = {
        'current_data_title': { group: '📊 统计卡片配置', order: 21, desc: '🏷️ 当前数据区域标题', groupOrder: 20 },
        'current_data_items': { group: '📊 统计卡片配置', order: 22, desc: '📑 当前数据项 (JSON)', groupOrder: 20 },
        'current_data_quarter': { group: '📊 统计卡片配置', order: 23, desc: '📅 当前季度标签', groupOrder: 20 },
        'columns': { group: '📊 统计卡片配置', order: 24, desc: '🔢 显示列数', groupOrder: 20 },
        'card_height': { group: '📊 统计卡片配置', order: 25, desc: '📏 卡片高度', groupOrder: 20 },
        'api_url': { group: '📊 统计卡片配置', order: 26, desc: '🌐 动态数据接口地址', groupOrder: 20 },
        'api_method': { group: '📊 统计卡片配置', order: 27, desc: '📡 请求方法 (get/post)', groupOrder: 20 },
        'api_data': { group: '📊 统计卡片配置', order: 28, desc: '📦 POST 请求参数 (JSON格式)', groupOrder: 20 },
        'api_headers': { group: '📊 统计卡片配置', order: 29, desc: '🔑 请求头 (JSON格式)', groupOrder: 20 },
        'enable_prediction': { group: '📊 统计卡片配置', order: 30, desc: '🔮 是否启用预测对比', groupOrder: 20 },
        'prediction_data_title': { group: '📊 统计卡片配置', order: 31, desc: '🏷️ 预测数据区域标题', groupOrder: 20 },
        'prediction_data_items': { group: '📊 统计卡片配置', order: 32, desc: '📑 预测数据项 (JSON)', groupOrder: 20 },
        'prediction_columns': { group: '📊 统计卡片配置', order: 33, desc: '🔢 预测显示列数', groupOrder: 20 },
        'form_title': { group: '⚙️ 表单及 AI组件配置', order: 40, desc: '📝 表单标题', groupOrder: 30 },
        'form_description': { group: '⚙️ 表单及 AI组件配置', order: 41, desc: '📄 表单描述', groupOrder: 30 },
        'policy_groups': { group: '⚙️ 表单及 AI组件配置', order: 42, desc: '📝 政策分组表单 (JSON)', groupOrder: 30 },
        'policy_actions': { group: '⚙️ 表单及 AI组件配置', order: 43, desc: '🔘 动作按钮配置 (JSON)', groupOrder: 30 },
        'enable_report_button': { group: '🎨 页面头部配置', order: 10, desc: '显示报告生成按钮', groupOrder: 10 }
    };

    Object.entries(policyDemoMapping).forEach(([varName, map]) => {
        if (paramsSchema.properties[varName]) {
            paramsSchema.properties[varName]['ui:group'] = map.group;
            paramsSchema.properties[varName]['ui:groupOrder'] = map.groupOrder || 999;
            paramsSchema.properties[varName].description = map.desc || paramsSchema.properties[varName].description;
            paramsSchema.properties[varName]['ui:order'] = map.order || paramsSchema.properties[varName]['ui:order'];
        }
    });

    return {
        paramsSchema,
        defaultParams
    };
}

// 主函数
async function analyzePolicyDemo() {
    const templatesDir = path.join(__dirname, '../templates');
    const templateId = 'policy_demo';
    const templateFile = 'policy_demo.j2';

    console.log(`\n🔍 分析模板: ${templateId}\n`);

    try {
        const { paramsSchema, defaultParams } = analyzeTemplate(templateFile, templatesDir);

        const finalGroups = {};
        Object.values(paramsSchema.properties).forEach(prop => {
            const g = prop['ui:group'] || '⚙️ 其他配置';
            if (!finalGroups[g]) finalGroups[g] = 0;
            finalGroups[g]++;
        });

        console.log(`   └─ 分组数: ${Object.keys(finalGroups).length}`);
        Object.entries(finalGroups).forEach(([group, count]) => {
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
    analyzePolicyDemo().then(() => process.exit(0));
}

module.exports = analyzePolicyDemo;
