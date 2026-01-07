/**
 * active_demo 模板专属参数分析脚本
 */
const fs = require('fs');
const path = require('path');
const db = require('../db');

// 组件文件名 -> 友好分组名的映射
const COMPONENT_GROUP_NAMES = {
    'simple_header.j2': '📄 页面头部配置',
    'configurable_card_grid.j2': '🎴 服务卡片配置',
    'service_card_grid.j2': '🎴 服务卡片配置',
    '__page__': '📄 页面参数',
    '__footer__': '🦶 页面底部配置'
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
        'text_primary', 'text_secondary', 'last', 'index', 'px', 'rem', 'em', 'vh', 'vw', 'className', 'id', 'type', 'name',
        'card', 'data', 'title',
        // 卡片循环中的变量 - 不应作为独立配置项
        'card_list', 'icon', 'desc', 'api', 'api_method', 'api_data', 'target_label', 'target_value',
        'button_label', 'button_icon', 'crud_api', 'crud_api_data', 'crud_columns', 'crud_config',
        'dialog_title', 'md', 'int', 'method', 'url', 'period', 'service_type', 'push', 'join', 'reload_target', 'string', 'trim',
        'defined', 'undefined'
    ];

    const builtins = new Set([
        'theme', 'now', 'date', 'g', 'f', 'a', 'i', 'v', 'k'
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
    const result = { type: 'string', description: varName.replace(/_/g, ' '), default: '', group: null };
    if (varName.startsWith('enable_') || varName.startsWith('is_') || varName.startsWith('show_')) {
        result.type = 'boolean';
        result.default = true;
    } else if (varName.endsWith('_api')) {
        result.description = varName.replace(/_/g, ' ') + ' 地址';
        result.default = `/api/${varName.replace('_api', '')}`;
    } else if (varName === 'page_title' || varName === 'title') {
        result.description = '页面标题';
        result.default = '主动服务';
    } else if (varName === 'cards') {
        result.type = 'array';
        result.title = '卡片列表';
        result.description = '配置显示的服务卡片';
        result.tabsMode = true;
        result.tabsLabelTpl = '${title || "卡片 " + (index + 1)}';
        result.multiLine = true;
        result.subFormMode = 'horizontal';
        result.itemClassName = 'bg-light p-3 mb-3 rounded border';
        result.items = {
            type: 'object',
            title: '卡片',
            properties: {
                title: { type: 'string', title: '标题' },
                icon: { type: 'string', title: '图标', description: 'FontAwesome图标类名，如 fa fa-home' },
                desc: { type: 'string', title: '描述', format: 'textarea' },
                api: { type: 'string', title: '数据接口API' },
                api_data: { type: 'json', title: '数据接口参数' },
                target_label: { type: 'string', title: '数据标签', default: '目标群体' },
                target_value: { type: 'string', title: '静态数据值', description: '不使用API时显示此静态值' },
                button_label: { type: 'string', title: '按钮文本', default: '一键提醒' },
                crud_config: { type: 'json', title: '详情弹窗配置', description: '完整 AMIS JSON 配置 (dialog.body)' }
            }
        };
        result.default = [];
        result.group = COMPONENT_GROUP_NAMES['configurable_card_grid.j2'];
    } else if (varName === 'columns') {
        result.type = 'number';
        result.description = '每行显示的卡片列数';
        result.default = 4;
        result.group = COMPONENT_GROUP_NAMES['configurable_card_grid.j2'];
    } else if (varName === 'service_name') {
        result.description = '组件名称，用于刷新指向';
        result.default = 'service_cards_grid';
        result.group = COMPONENT_GROUP_NAMES['configurable_card_grid.j2'];
    } else if (varName === 'footer_text') {
        result.description = '页面底部版权文字';
        result.default = '住房公积金管理中心 © 2025';
        result.group = COMPONENT_GROUP_NAMES['__footer__'];
    } else if (varName === 'reload_target') {
        result.description = '刷新按钮目标组件名称';
        result.default = 'service_cards_grid';
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
                title: inferred.title || param.description, // Use explicit title if available
                description: param.description,
                'ui:group': groupName,
                'ui:groupOrder': param.groupOrder,
                'ui:order': param.order
            };

            if (inferred.items) {
                paramsSchema.properties[param.name].items = inferred.items;
            }

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

        // 使用推断的分组，如果没有则使用默认分组
        const groupName = inferred.group || '⚙️ 其他配置';
        const groupOrder = inferred.group ? 100 : 999;  // footer 分组排在后面但不是最后

        paramsSchema.properties[varName] = {
            type: inferred.type,
            description: inferred.description + ' (自动推断)',
            'ui:group': groupName,
            'ui:groupOrder': groupOrder,
            'ui:order': context.globalOrder
        };

        if (inferred.default !== undefined) {
            paramsSchema.properties[varName].default = inferred.default;
            defaultParams[varName] = inferred.default;
        }
    });

    return {
        paramsSchema,
        defaultParams
    };
}

// 主函数
async function analyzeActiveDemo() {
    const templatesDir = path.join(__dirname, '../templates');
    const templateId = 'active_demo';
    const templateFile = 'active_demo.j2';

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
    analyzeActiveDemo().then(() => process.exit(0));
}

module.exports = analyzeActiveDemo;
