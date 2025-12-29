/**
 * 政策分析页面示例配置脚本
 * 创建一个租房提取政策分析页面示例
 * 
 * 使用方法: node scripts/create_policy_demo_page.js
 */

const db = require('../db');
const fs = require('fs');
const path = require('path');

console.log('\n🚀 开始创建政策分析页面示例...\n');

// 1. 定义页面配置
const pageConfig = {
    page_key: 'zftq_demo',
    page_name: '租房提取政策分析',
    template_path: 'pages/policy_demo.j2',
    params: {
        // Header 配置
        page_title: '租房提取政策智能分析',
        page_subtitle: '基于 AI 的政策参数调整与影响预测',

        // Alert 配置
        alert_type: 'info',
        alert_message: '💡 <strong>使用提示：</strong>调整下方政策参数后，点击"应用并预测"查看政策调整对提取人数和金额的影响。',

        // 当前数据卡片配置
        current_data_title: '当前政策数据',
        current_data_quarter: '2025Q4',
        current_data_items: [
            { label: '满足租房提取人数', value: '225,405' },
            { label: '季度提取人次', value: '153,200' },
            { label: '租房提取占比', value: '28.7', unit: '%' },
            { label: '季度提取金额', value: '3.42', unit: '亿元' }
        ],

        // 预测数据卡片配置（初始隐藏，提交表单后显示）
        // 使用 stats_cards 的标准格式： trend: 'up'/'down', trend_value, trend_color: 'red'/'green'/'auto'
        enable_prediction: true,
        prediction_data_title: '政策预测数据',
        prediction_data_items: [
            { label: '预测满足租房提取人数', value: '284,542', trend: 'up', trend_value: '12.0%', trend_color: 'red' },
            { label: '预测季度提取人次', value: '242,500', trend: 'up', trend_value: '22.05%', trend_color: 'red' },
            { label: '预测租房占比', value: '35.2', unit: '%', trend: 'up', trend_value: '6.5%', trend_color: 'red' },
            { label: '预测季度提取金额', value: '3.97', unit: '亿元', trend: 'up', trend_value: '16.1%', trend_color: 'red' }
        ],

        // 表单配置
        form_title: '调整政策参数',
        form_description: '通过调整以下参数，系统将基于历史数据和 AI 模型预测政策调整后的影响',
        form_fields: [
            {
                type: 'input-number',
                name: 'rent_limit',
                label: '月租金提取上限（元）',
                value: 2500,
                min: 1000,
                max: 5000,
                step: 100,
                required: true,
                description: '职工每月可提取的最高金额'
            },
            {
                type: 'input-number',
                name: 'deposit_months',
                label: '连续缴存月数要求',
                value: 6,
                min: 0,
                max: 12,
                step: 1,
                required: true,
                description: '申请提取前需连续缴存的月数'
            },
            {
                type: 'input-number',
                name: 'annual_times',
                label: '年度提取次数上限',
                value: 1,
                min: 1,
                max: 12,
                step: 1,
                required: true,
                description: '每年最多可申请提取的次数'
            },
            {
                type: 'switch',
                name: 'require_contract',
                label: '是否要求备案租赁合同',
                value: true,
                description: '开启后职工需提供备案的租赁合同'
            }
        ],
        submit_button_text: '📊 应用并预测',
        reset_button_text: '🔄 重置',
        enable_reset: true,
        prediction_api: '/api/policy/zftq/predict',

        // AI 分析配置（复用 import_Ai.j2）
        enable_data_import: false,  // 政策页面不需要数据导入
        enable_ai_analysis: true,
        enable_query_input: true,
        query_label: '进一步分析需求',
        query_placeholder: '例如：分析将月租金上限提高到 3000 元的影响',
        ai_generate_api: '/api/ai/generate-page',
        page_key: 'zftq_demo',
        workflow_type: 'policy_analysis',  // 使用政策分析工作流

        // Footer
        footer_text: '住房公积金管理中心 政策研究部 © 2025'
    }
};

// 2. 将配置存入数据库
const insertPageSql = `
    INSERT INTO sys_page_template (page_key, page_name, template_path, params, created_at, updated_at)
    VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
    ON CONFLICT(page_key) DO UPDATE SET
        page_name = excluded.page_name,
        template_path = excluded.template_path,
        params = excluded.params,
        updated_at = datetime('now')
`;

db.run(
    insertPageSql,
    [
        pageConfig.page_key,
        pageConfig.page_name,
        pageConfig.template_path,
        JSON.stringify(pageConfig.params, null, 2)
    ],
    function (err) {
        if (err) {
            console.error('❌ 创建页面失败:', err.message);
            process.exit(1);
        }

        console.log(`✅ 页面配置已保存: ${pageConfig.page_key}`);
        console.log(`   页面名称: ${pageConfig.page_name}`);
        console.log(`   模板路径: ${pageConfig.template_path}`);
        console.log(`   记录 ID: ${this.lastID || '已更新'}\n`);

        // 3. 创建菜单项（可选）
        const checkMenuSql = 'SELECT id FROM sys_menu WHERE page_key = ?';
        db.get(checkMenuSql, [pageConfig.page_key], (err, row) => {
            if (err) {
                console.error('❌ 检查菜单失败:', err.message);
                process.exit(1);
            }

            if (row) {
                console.log('ℹ️  菜单项已存在，跳过创建\n');
                printSuccessMessage();
                process.exit(0);
            }

            const insertMenuSql = `
                INSERT INTO sys_menu (label, subtitle, page_key, path, icon, \`order\`, route_key, parent_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `;

            db.run(
                insertMenuSql,
                [
                    '租房提取政策分析（示例）',
                    '政策参数调整与预测',
                    pageConfig.page_key,
                    '/zcfx/' + pageConfig.page_key,
                    'fa fa-chart-line',
                    99,  // 排序靠后
                    'zcfx',  // 假设属于政策分析路由
                    null  // 顶级菜单
                ],
                function (err) {
                    if (err) {
                        console.error('❌ 创建菜单失败:', err.message);
                        process.exit(1);
                    }

                    console.log(`✅ 菜单项已创建`);
                    console.log(`   菜单 ID: ${this.lastID}`);
                    console.log(`   访问路径: /zcfx/${pageConfig.page_key}\n`);

                    printSuccessMessage();
                    process.exit(0);
                }
            );
        });
    }
);

function printSuccessMessage() {
    console.log('='.repeat(60));
    console.log('🎉 政策分析页面创建成功！');
    console.log('='.repeat(60));
    console.log('');
    console.log('📋 下一步：');
    console.log('   1. 重启服务器以加载新模板');
    console.log('   2. 访问菜单 "租房提取政策分析（示例）"');
    console.log('   3. 调整政策参数并查看预测结果');
    console.log('   4. 点击"智能分析"按钮获取 AI 洞察');
    console.log('');
    console.log('🔧 自定义配置：');
    console.log('   - 修改数据库中的 params 字段可调整页面配置');
    console.log('   - 参考模板文件：');
    console.log('     • server/templates/pages/policy_demo.j2');
    console.log('     • server/templates/components/stats_cards.j2 (复用)');
    console.log('     • server/templates/components/policy_form.j2');
    console.log('');
}
