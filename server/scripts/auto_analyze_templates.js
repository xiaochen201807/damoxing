/**
 * 增强版模板扫描器 v2
 * 核心改进：按组件文件分组，不混在一起
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

// 模板元数据配置（用于自动创建记录时设置友好的名称和描述）
const TEMPLATE_METADATA = {
    'policy_demo': {
        template_name: '政策分析模板',
        description: '政策参数调整与影响预测分析',
        preview_image: '/templates/policy_demo.png',
        theme_id: 'antd'
    },
    'fx_demo': {
        template_name: '风险分析模板',
        description: '包含AI分析功能的动态演示页面',
        preview_image: '/templates/fx_demo.png',
        theme_id: 'antd'
    },
    'active_demo': {
        template_name: '主动服务模板',
        description: '通用主动服务页面，支持服务卡片配置与动态数据刷新',
        preview_image: '/templates/active_service.png',
        theme_id: 'antd'
    },
    'credit_indicators': {
        template_name: '信用评价指标管理',
        description: '信用评价指标的增删改查管理页面，支持4个API配置',
        preview_image: '/templates/credit_indicators.png',
        theme_id: 'antd'
    },
    'credit_registry': {
        template_name: '信用清册',
        description: '信用主体清册查询与评价明细查看，支持2个API配置',
        preview_image: '/templates/credit_registry.png',
        theme_id: 'antd'
    },
    'credit_risk_monitor': {
        template_name: '风险监控',
        description: 'AI综合风险监控看板，支持8个API配置（4图表+3钻取+1报告）',
        preview_image: '/templates/credit_risk_monitor.png',
        theme_id: 'antd'
    },
    'audit_risk_overview': {
        template_name: '智能稽核-风险总览',
        description: 'AI智能稽核风险总览页面，支持3个API配置（统计+趋势图+饼图）',
        preview_image: '/templates/audit_risk_overview.png',
        theme_id: 'antd'
    },
    'audit_risk_registry': {
        template_name: '智能稽核-风险清册',
        description: 'AI风险清册列表页面，支持1个API配置（列表查询）',
        preview_image: '/templates/audit_risk_registry.png',
        theme_id: 'antd'
    },
    'audit_ai_models': {
        template_name: '智能稽核-AI模型库',
        description: 'AI稽核模型卡片展示页面，支持1个API配置（模型列表）',
        preview_image: '/templates/audit_ai_models.png',
        theme_id: 'antd'
    }
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
    const defaults = {}; // 存储变量的默认值

    // 1. 匹配 {{ varName | default('value') }} 或 {{ var | default(123) }}
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

    // 2. 匹配所有 Nunjucks 标签中的潜在变量
    const tagRegex = /(?:{{|{%)\s*([\s\S]*?)\s*(?:}}|%})/g;
    const identifierRegex = /\b([a-zA-Z_][a-zA-Z0-9_]*)\b/g;

    while ((match = tagRegex.exec(content)) !== null) {
        let tagBody = match[1];
        // 抹除字符串，避免抓取字符串里的单词
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
        'policy_param_selectable'
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
    if (varName === 'enable_policy_param_selection') {
        result.type = 'boolean';
        result.description = '启用政策参数勾选限制';
        result.default = false;
        return result;
    }
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
    } else if (varName === 'query') {
        result.description = '查询参数';
        result.default = '{}';
    } else if (varName === 'page_key') {
        result.description = '页面唯一标识';
        result.default = '';
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

    // 确定这个文件对应的分组
    let groupName = COMPONENT_GROUP_NAMES[filename];
    if (!groupName) {
        // 如果是页面文件，标记为页面级参数
        if (filePath.includes('pages/')) {
            groupName = COMPONENT_GROUP_NAMES['__page__'];
        } else {
            groupName = '⚙️ 其他配置';
        }
    }

    // 提取此文件中的 @param
    const annotations = extractParamAnnotations(content);

    // 如果这个文件有参数定义，创建对应的组
    if (annotations.length > 0) {
        // 第一次遇到这个组时，分配组序号
        if (!context.groupOrderMap[groupName]) {
            context.currentGroupOrder++;
            context.groupOrderMap[groupName] = context.currentGroupOrder;
        }

        if (!context.componentParams[groupName]) {
            context.componentParams[groupName] = [];
        }

        // 保存参数，保持文件中的定义顺序
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

    // 收集所有变量及其在模板中的默认值
    const { variables: vars, defaults: varDefaults } = extractVariables(content);
    vars.forEach(v => context.allVariables.add(v));

    // 合并默认值信息
    Object.entries(varDefaults).forEach(([varName, defaultValue]) => {
        if (!context.templateDefaults[varName]) {
            context.templateDefaults[varName] = defaultValue;
        }
    });

    // 递归处理 includes
    const includes = extractIncludes(content);
    includes.forEach(inc => processFile(inc, templatesDir, context));
}

// 分析单个模板
function analyzeTemplate(templateFile, templatesDir) {
    const entryFile = path.join('pages', templateFile);

    // 上下文对象
    const context = {
        visited: new Set(),
        componentParams: {},       // Map<分组名, [ {name, description, order, groupOrder}, ... ]>
        allParamNames: new Set(),  // 已记录的参数名
        allVariables: new Set(),
        templateDefaults: {},      // 从模板 | default() 提取的默认值
        globalOrder: 0,
        groupOrderMap: {},         // Map<分组名, 组序号>
        currentGroupOrder: 0       // 当前组序号计数器
    };

    processFile(entryFile, templatesDir, context);

    // 构建最终的 params_schema
    const paramsSchema = {
        type: 'object',
        properties: {},
        required: []
    };
    const defaultParams = {};

    // title 不再默认必填，改为可选以降低门槛
    /*
    if (context.allVariables.has('title')) {
        paramsSchema.required.push('title');
    }
    */

    // 按组件分组处理参数
    Object.entries(context.componentParams).forEach(([groupName, params]) => {
        params.forEach(param => {
            const inferred = inferType(param.name);

            // 优先使用从模板中提取的默认值
            // 使用 !== undefined 检查，因为 templateDefaults 可能包含空字符串 ''
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

    // 针对 policy_demo 的精细化自动归类（确保即使没有 @param 也能归入正确组件组）
    // 处理未文档化的变量（那些在模板中使用但没有 @param 的）
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

    // 针对 policy_demo 的精细化自动归类（确保即使没有 @param 也能归入正确组件组）
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
        'enable_policy_param_selection': { group: '⚙️ 表单及 AI组件配置', order: 44, desc: '☑️ 启用政策参数勾选限制', groupOrder: 30 },
        'form_title': { group: '⚙️ 表单及 AI组件配置', order: 40, desc: '📝 表单标题', groupOrder: 30 },
        'form_description': { group: '⚙️ 表单及 AI组件配置', order: 41, desc: '📄 表单描述', groupOrder: 30 },
        'policy_groups': { group: '⚙️ 表单及 AI组件配置', order: 42, desc: '📝 政策分组表单 (JSON)', groupOrder: 30 },
        'policy_actions': { group: '⚙️ 表单及 AI组件配置', order: 43, desc: '🔘 动作按钮配置 (JSON)', groupOrder: 30 },
        'enable_report_button': { group: '🎨 页面头部配置', order: 10, desc: '显示报告生成按钮', groupOrder: 10 }
    };

    if (templateFile.includes('policy_demo')) {
        delete paramsSchema.properties.policy_param_selectable;
        delete defaultParams.policy_param_selectable;
        delete paramsSchema.properties.key;
        delete defaultParams.key;

        paramsSchema.properties.enable_policy_param_selection = {
            ...(paramsSchema.properties.enable_policy_param_selection || {}),
            type: 'boolean',
            description: '☑️ 启用政策参数勾选限制',
            default: false,
            'ui:group': '⚙️ 表单及 AI组件配置',
            'ui:groupOrder': 30,
            'ui:order': 44
        };
        defaultParams.enable_policy_param_selection = false;
    }

    // 统一应用特殊映射（覆盖归类）
    if (templateFile.includes('policy_demo')) {
        Object.entries(policyDemoMapping).forEach(([varName, map]) => {
            if (paramsSchema.properties[varName]) {
                paramsSchema.properties[varName]['ui:group'] = map.group;
                paramsSchema.properties[varName]['ui:groupOrder'] = map.groupOrder || 999;
                paramsSchema.properties[varName].description = map.desc || paramsSchema.properties[varName].description;
                paramsSchema.properties[varName]['ui:order'] = map.order || paramsSchema.properties[varName]['ui:order'];
            }
        });
    }

    return {
        paramsSchema,
        defaultParams,
        variables: Array.from(context.allVariables),
        componentParams: context.componentParams
    };
}

// 主函数
async function syncAllTemplates() {
    const templatesDir = path.join(__dirname, '../templates');
    const pagesDir = path.join(templatesDir, 'pages');

    if (!fs.existsSync(pagesDir)) {
        console.error(`❌ 目录不存在: ${pagesDir}`);
        process.exit(1);
    }

    const files = fs.readdirSync(pagesDir).filter(f => f.endsWith('.j2'));
    console.log(`\n🔍 按组件分组扫描 ${files.length} 个模板文件...\n`);

    let updated = 0;

    for (const file of files) {
        const templateId = file.replace('.j2', '');
        console.log(`📄 ${file} (${templateId})`);

        try {
            const { paramsSchema, defaultParams, variables, componentParams } = analyzeTemplate(file, templatesDir);

            console.log(`   └─ 发现 ${variables.length} 个变量`);

            // 计算最终的分组情况用于日志
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

            // 更新或插入数据库
            await new Promise((resolve) => {
                db.get('SELECT * FROM sys_page_templates_config WHERE template_id = ?', [templateId], (err, row) => {
                    if (row) {
                        // 记录存在，只更新 params_schema 和 default_params，保留其他字段
                        db.run(
                            `UPDATE sys_page_templates_config 
                             SET params_schema = ?, default_params = ? 
                             WHERE template_id = ?`,
                            [JSON.stringify(paramsSchema), JSON.stringify(defaultParams), templateId],
                            (updateErr) => {
                                if (!updateErr) {
                                    console.log(`   ✅ 已更新: ${templateId}`);
                                    updated++;
                                }
                                resolve();
                            }
                        );
                    } else {
                        // 记录不存在，插入新记录
                        // 优先使用配置的元数据，否则自动生成
                        const metadata = TEMPLATE_METADATA[templateId] || {};

                        const templateName = metadata.template_name || templateId
                            .split('_')
                            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                            .join(' ');

                        const description = metadata.description || `自动生成的 ${templateName} 模板`;
                        const previewImage = metadata.preview_image || null;
                        const themeId = metadata.theme_id || 'antd';

                        db.run(
                            `INSERT INTO sys_page_templates_config 
                             (template_id, template_name, description, template_file, components, params_schema, default_params, preview_image, theme_id, is_active)
                             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
                            [
                                templateId,
                                templateName,
                                description,
                                `pages/${file}`,
                                JSON.stringify(Object.keys(componentParams)),
                                JSON.stringify(paramsSchema),
                                JSON.stringify(defaultParams),
                                previewImage,
                                themeId
                            ],
                            (insertErr) => {
                                if (!insertErr) {
                                    console.log(`   🆕 已创建: ${templateId} (${templateName})`);
                                    updated++;
                                } else {
                                    console.error(`   ❌ 插入失败: ${templateId}`, insertErr.message);
                                }
                                resolve();
                            }
                        );
                    }
                });
            });

        } catch (error) {
            console.error(`   └─ ❌ 分析失败:`, error);
        }
    }

    console.log(`\n🎉 完成！已更新 ${updated} 个模板。\n`);
}

syncAllTemplates();
