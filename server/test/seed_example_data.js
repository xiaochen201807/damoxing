/**
 * 插入示例模板和组件数据
 * 用于前端开发和演示
 */
const db = require('./db');
const path = require('path');

// 组件库示例数据
const components = [
    {
        component_id: 'bar_chart',
        component_name: '柱状图',
        category: 'chart',
        description: '用于展示分类数据的柱状图表',
        template_path: 'components/bar_chart_panel.j2',
        params_schema: JSON.stringify({
            type: 'object',
            properties: {
                bar_api_url: { type: 'string', description: 'API地址' },
                bar_height: { type: 'integer', default: 350, description: '高度' },
                bar_color: { type: 'string', default: '#5470c6', description: '颜色' },
                bar_clickable: { type: 'boolean', default: true, description: '可点击' }
            },
            required: ['bar_api_url']
        }),
        default_params: JSON.stringify({
            bar_height: 350,
            bar_color: '#5470c6',
            bar_clickable: true
        }),
        example_usage: '用于展示月度销售数据、用户分布等'
    },
    {
        component_id: 'line_chart',
        component_name: '折线图',
        category: 'chart',
        description: '用于展示趋势变化的折线图表',
        template_path: 'components/line_chart_panel.j2',
        params_schema: JSON.stringify({
            type: 'object',
            properties: {
                line_api_url: { type: 'string', description: 'API地址' },
                line_height: { type: 'integer', default: 350, description: '高度' },
                line_smooth: { type: 'boolean', default: true, description: '平滑曲线' }
            },
            required: ['line_api_url']
        }),
        default_params: JSON.stringify({
            line_height: 350,
            line_smooth: true
        }),
        example_usage: '用于展示增长趋势、时间序列数据等'
    },
    {
        component_id: 'funnel_chart',
        component_name: '漏斗图',
        category: 'chart',
        description: '用于展示流程转化的漏斗图表',
        template_path: 'components/funnel_chart_panel.j2',
        params_schema: JSON.stringify({
            type: 'object',
            properties: {
                funnel_api_url: { type: 'string', description: 'API地址' },
                funnel_height: { type: 'integer', default: 400, description: '高度' }
            },
            required: ['funnel_api_url']
        }),
        default_params: JSON.stringify({
            funnel_height: 400
        }),
        example_usage: '用于展示销售漏斗、转化率等'
    }
];

// 页面模板示例数据
const templates = [
    {
        template_id: 'policy_demo',
        template_name: '政策分析模板',
        description: '政策参数调整与影响预测分析',
        template_file: 'pages/policy_demo.j2',
        components: JSON.stringify(['header', 'stats_cards', 'policy_form', 'import_Ai']),
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
            enable_ai_analysis: true
        }),
        preview_image: '/templates/simple_dashboard.png',
        theme_id: 'cxd'
    },
    {
        template_id: 'dual_chart_dashboard',
        template_name: '稽核页面模板',
        description: '包含柱状图和折线图的仪表盘',
        template_file: 'pages/dual_chart_dashboard.j2',
        components: JSON.stringify(['bar_chart', 'line_chart']),
        params_schema: JSON.stringify({
            type: 'object',
            properties: {
                title: { type: 'string', description: '页面标题' },
                bar_api_url: { type: 'string', description: '柱状图API' },
                line_api_url: { type: 'string', description: '折线图API' }
            },
            required: ['title', 'bar_api_url', 'line_api_url']
        }),
        default_params: JSON.stringify({
            title: '综合数据分析',
            bar_height: 350,
            line_height: 350
        }),
        preview_image: '/templates/dual_dashboard.png',
        theme_id: 'antd'
    }
];

// 插入数据
console.log('正在插入示例数据...\n');

// 插入组件
let componentCount = 0;
components.forEach((comp, index) => {
    db.run(`
        INSERT OR REPLACE INTO sys_component_library 
        (component_id, component_name, category, description, template_path, params_schema, default_params, example_usage)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
        comp.component_id,
        comp.component_name,
        comp.category,
        comp.description,
        comp.template_path,
        comp.params_schema,
        comp.default_params,
        comp.example_usage
    ], (err) => {
        componentCount++;
        if (err) {
            console.error(`❌ 插入组件失败: ${comp.component_name}`, err.message);
        } else {
            console.log(`✅ 插入组件: ${comp.component_name}`);
        }

        if (componentCount === components.length) {
            console.log(`\n📦 组件库: ${componentCount}/${components.length} 插入成功\n`);
            insertTemplates();
        }
    });
});

// 插入模板
function insertTemplates() {
    let templateCount = 0;
    templates.forEach((tpl, index) => {
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
            templateCount++;
            if (err) {
                console.error(`❌ 插入模板失败: ${tpl.template_name}`, err.message);
            } else {
                console.log(`✅ 插入模板: ${tpl.template_name}`);
            }

            if (templateCount === templates.length) {
                console.log(`\n📄 模板库: ${templateCount}/${templates.length} 插入成功`);
                console.log('\n🎉 所有示例数据插入完成！');
                process.exit(0);
            }
        });
    });
}
