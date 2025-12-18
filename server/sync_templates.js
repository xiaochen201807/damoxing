/**
 * 同步现有模板文件到数据库
 * 为 chart_demo.j2、fx_demo.j2、risk_page_dynamic.j2 创建数据库记录
 */
const db = require('./db');

const missingTemplates = [
    {
        template_id: 'chart_demo',
        template_name: '图表演示页面',
        description: '包含饼图和柱状图的风险分析演示页面',
        template_file: 'pages/chart_demo.j2',
        components: JSON.stringify(['chart_panel', 'bar_chart', 'header', 'alert']),
        params_schema: JSON.stringify({
            type: 'object',
            properties: {
                title: { type: 'string', description: '页面标题', default: '风险分析演示' },
                subtitle: { type: 'string', description: '页面副标题', default: '数据可视化展示' },
                chart_api_url: { type: 'string', description: '饼图API地址', default: '/api/demo/chart-data' },
                bar_api_url: { type: 'string', description: '柱状图API地址', default: '/api/demo/bar-data' },
                footer_text: { type: 'string', description: '底部文本', default: '© 2025' }
            },
            required: ['title']
        }),
        default_params: JSON.stringify({
            title: '风险分析演示',
            subtitle: '数据可视化展示',
            chart_api_url: '/api/demo/chart-data',
            bar_api_url: '/api/demo/bar-data',
            chart_height: 350,
            bar_height: 400,
            footer_text: '© 2025'
        }),
        preview_image: '/templates/chart_demo.png',
        theme_id: 'cxd'
    },
    {
        template_id: 'fx_demo',
        template_name: 'AI分析演示页面',
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
    },
    {
        template_id: 'risk_page_dynamic',
        template_name: '动态风险页面',
        description: '简单的风险分析页面，支持动态副标题',
        template_file: 'pages/risk_page_dynamic.j2',
        components: JSON.stringify(['header']),
        params_schema: JSON.stringify({
            type: 'object',
            properties: {
                title: { type: 'string', description: '页面标题', default: '风险分析' },
                subtitle: { type: 'string', description: '页面副标题' }
            },
            required: ['title']
        }),
        default_params: JSON.stringify({
            title: '风险分析',
            subtitle: '实时监控数据'
        }),
        preview_image: '/templates/risk_page.png',
        theme_id: 'dark'
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
