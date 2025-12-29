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
    'policy_form.j2': '✏️ 参数表单配置',
    'import_Ai.j2': '🤖 AI分析配置',
    'alert.j2': '💡 提示配置',
    // 页面级参数（在 pages/*.j2 中直接使用的）
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
    // 支持引号值、数字、布尔值、变量引用等 (非贪婪匹配到 ')')
    const varWithDefaultRegex = /{{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\|\s*default\((.*?)\)/g;
    let match;
    while ((match = varWithDefaultRegex.exec(content)) !== null) {
        const varName = match[1];
        let defaultValue = match[2].trim();
        // 去除引号
        if ((defaultValue.startsWith('"') && defaultValue.endsWith('"')) ||
            (defaultValue.startsWith("'") && defaultValue.endsWith("'"))) {
            defaultValue = defaultValue.slice(1, -1);
        }
        vars.add(varName);
        defaults[varName] = defaultValue;
    }

    // 2. 匹配 {% if varName %} - 条件判断说明该变量是可选的
    // 注意：允许 %} 前有其他内容，如 {% if var %}, 或 {% if var %}xxx
    const ifConditionRegex = /{%\s*if\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*[^}]*%}/g;
    while ((match = ifConditionRegex.exec(content)) !== null) {
        const varName = match[1];
        vars.add(varName);
        // 如果还没有默认值，给一个空字符串（表示可选）
        if (!defaults[varName]) {
            defaults[varName] = '';
        }
    }

    // 3. 匹配普通变量 {{ varName }}
    const simpleVarRegex = /{{\s*([a-zA-Z_][a-zA-Z0-9_]*)/g;
    while ((match = simpleVarRegex.exec(content)) !== null) {
        vars.add(match[1]);
    }

    // 4. 匹配控制结构中的变量（for, set）
    const controlVarRegex = /{%\s*(?:for|set)\s+([a-zA-Z_][a-zA-Z0-9_]*)/g;
    while ((match = controlVarRegex.exec(content)) !== null) {
        vars.add(match[1]);
    }

    const builtins = new Set([
        // Jinja2 内置变量
        'loop', 'item', 'items', 'row', 'index', 'default_items', 'theme', 'now', 'date',
        // Joiner 临时变量（用于生成逗号分隔）
        'comma', 'inner_comma', 'btn_comma', 'footer_comma',
        // 模板内部临时变量
        'subtitle_tpl', 'report_button_json', 'not',
        // AMIS 表达式变量（以 $ 开头的运行时变量）
        'ai_loading', 'show_analysis_result', 'user_query'
    ]);
    const filtered = Array.from(vars).filter(v => !builtins.has(v));

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
    const result = { type: 'string', description: varName.replace(/_/g, ' ') };
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

    // title 通常是必填的
    if (context.allVariables.has('title')) {
        paramsSchema.required.push('title');
    }

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
            console.log(`   └─ 分组数: ${Object.keys(componentParams).length}`);
            Object.entries(componentParams).forEach(([group, params]) => {
                console.log(`      - ${group}: ${params.length}个参数`);
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
