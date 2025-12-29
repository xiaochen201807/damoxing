/**
 * 同步现有模板文件到数据库
 * 为 chart_demo.j2、fx_demo.j2、risk_page_dynamic.j2 创建数据库记录
 */
const db = require('./db');

const missingTemplates = [
    {
        template_id: 'policy_demo',
        template_name: '政策分析模板',
        description: '政策参数调整与影响预测分析',
        template_file: 'pages/policy_demo.j2',
        components: JSON.stringify(['header', 'alert', 'stats_cards', 'policy_form', 'import_Ai']),
        params_schema: JSON.stringify({
            type: 'object',
            properties: {
                page_title: { type: 'string', description: '页面标题', default: '政策分析' },
                page_subtitle: { type: 'string', description: '页面副标题', default: '基于 AI 的政策参数调整与影响预测' },
                current_data_title: { type: 'string', description: '当前数据标题', default: '当前政策数据' },
                prediction_data_title: { type: 'string', description: '预测数据标题', default: '政策预测数据' },
                form_title: { type: 'string', description: '表单标题', default: '调整政策参数' },
                enable_ai_analysis: { type: 'boolean', description: '是否启用AI分析', default: true }
            },
            required: ['page_title']
        }),
        default_params: JSON.stringify({
            page_title: '政策分析',
            page_subtitle: '基于 AI 的政策参数调整与影响预测',
            current_data_title: '当前政策数据',
            current_data_quarter: '2025Q4',
            enable_ai_analysis: true,
            enable_prediction: true,
            footer_text: '住房公积金管理中心 政策研究部 © 2025'
        }),
        preview_image: '/templates/policy_demo.png',
        theme_id: 'antd'
    },
    {
        template_id: 'fx_demo',
        template_name: '风险分析模板',
        description: '包含AI分析功能的动态演示页面',
        template_file: 'pages/fx_demo.j2',
        components: JSON.stringify(['header', 'alert', 'import_ai']),
        params_schema: JSON.stringify({
            type: 'object',
            properties: {
                title: { type: 'string', description: '页面标题', default: 'AI智能分析' },
                subtitle: { type: 'string', description: '页面副标题', default: '数据分析平台' },
                footer_text: { type: 'string', description: '底部文本', default: '住房公积金管理中心 © 2025' }
            },
            required: ['title']
        }),
        default_params: JSON.stringify({
            title: 'AI智能分析',
            subtitle: '数据分析平台',
            footer_text: '住房公积金管理中心 © 2025'
        }),
        preview_image: '/templates/fx_demo.png',
        theme_id: 'antd'
    }
];

console.log('正在同步模板到数据库...\n');

let count = 0;
missingTemplates.forEach((tpl, index) => {
    db.run(`
        INSERT OR REPLACE INTO sys_page_templates_config 
        (template_id, template_name, description, template_file, components, params_schema, default_params, preview_image, theme_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
        tpl.template_id,
        tpl.template_name,
        tpl.description,
        tpl.template_file,
        tpl.components,
        tpl.params_schema,
        tpl.default_params,
        tpl.preview_image,
        tpl.theme_id
    ], (err) => {
        count++;
        if (err) {
            console.error(`❌ 同步失败: ${tpl.template_name}`, err.message);
        } else {
            console.log(`✅ 同步成功: ${tpl.template_name} (${tpl.template_file})`);
        }

        if (count === missingTemplates.length) {
            console.log(`\n🎉 同步完成！共同步 ${count}/${missingTemplates.length} 个模板`);
            console.log('\n刷新配置页面即可看到新模板。');
            process.exit(0);
        }
    });
});
