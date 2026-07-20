/**
 * gjznkm_demo 模板专属参数分析脚本
 * 归集智能扩面 - 支持动态导入配置
 */
const fs = require('fs');
const path = require('path');
const db = require('../db');
const { applyTemplateVersionMeta } = require('../utils/template-version');

// 组件文件名 -> 友好分组名的映射
const COMPONENT_GROUP_NAMES = {
    'header.j2': '🎨 页面头部配置',
    'import_Ai.j2': '📥 数据导入与AI分析配置',
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
        'subtitle_tpl', 'report_button_json', 'ai_loading', 'show_analysis_result', 'show_prediction',
        'analysis_requires_import'
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
        if (varName === 'enable_import_check') {
            result.description = '是否启用智能分析前导入状态检查';
        }
    } else if (varName === 'import_check_api') {
        result.description = '智能分析前检查导入状态的接口地址';
        result.default = '';
    } else if (varName === 'import_check_api_method') {
        result.description = '导入状态检查接口请求方法';
        result.default = 'post';
    } else if (varName === 'import_check_data') {
        result.type = 'json';
        result.description = '导入状态检查接口固定参数(JSON)';
        result.default = '{}';
    } else if (varName === 'import_check_adaptor') {
        result.description = '导入状态检查接口适配器，未导入时返回 status 非 0';
        result.default = '';
    } else if (varName.endsWith('_api')) {
        result.description = varName.replace(/_/g, ' ') + ' 地址';
        result.default = `/api/${varName.replace('_api', '')}`;
    } else if (varName.includes('height') || varName.includes('width')) {
        result.type = 'integer';
        result.default = 400;
    } else if (varName === 'title') {
        result.description = '页面标题';
        result.default = '归集智能扩面';
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

    // 🆕 特殊处理：添加 import_items 配置项
    paramsSchema.properties['import_items'] = {
        type: 'array',
        description: '数据导入项配置（每项包含标题、接口、参数等）',
        'ui:group': '📥 数据导入与AI分析配置',
        'ui:groupOrder': 2,
        'ui:order': 100,
        'ui:widget': 'combo',
        items: {
            type: 'object',
            properties: {
                title: { type: 'string', description: '显示标题' },
                key: { type: 'string', description: '字段名' },
                desc: { type: 'string', description: '描述文字' },
                accept: { type: 'string', description: '上传文件类型限制 (默认 .xls,.xlsx)' },
                template_url: { type: 'string', description: '模板下载接口' },
                template_data: { type: 'string', description: '模板下载参数(JSON)' },
                upload_api: { type: 'string', description: '上传接口' },
                upload_data: { type: 'string', description: '上传参数(JSON)' }
            }
        }
    };
    defaultParams['import_items'] = [];

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

    return {
        paramsSchema,
        defaultParams
    };
}

// 主函数
async function analyzeGjznkmDemo() {
    const templatesDir = path.join(__dirname, '../templates');
    const templateId = 'gjznkm_demo';
    const templateFile = 'gjznkm_demo.j2';

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
    analyzeGjznkmDemo().then(() => process.exit(0));
}

module.exports = analyzeGjznkmDemo;
