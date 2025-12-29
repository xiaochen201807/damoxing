/**
 * 渲染并更新 test123 页面的 schema_json
 */
const nunjucks = require('nunjucks');
const path = require('path');
const db = require('../db');

// 配置 Nunjucks
const env = nunjucks.configure(path.join(__dirname, '../templates'), {
    autoescape: false,
    throwOnUndefined: false
});

// 添加自定义过滤器
env.addFilter('tojson', function (obj) {
    return JSON.stringify(obj);
});

// 示例参数
const demoParams = {
    page_title: "租房提取政策智能分析",
    page_subtitle: "基于 AI 的政策参数调整与影响预测",
    alert_type: "info",
    alert_message: "💡 <strong>使用提示：</strong>调整下方政策参数后，点击\"应用并预测\"查看政策调整对提取人数和金额的影响。",
    current_data_title: "当前政策数据",
    current_data_quarter: "2025Q4",
    current_data_items: [
        { label: "满足租房提取人数", value: "225,405" },
        { label: "季度提取人次", value: "153,200" },
        { label: "租房提取占比", value: "28.7", unit: "%" },
        { label: "季度提取金额", value: "3.42", unit: "亿元" }
    ],
    enable_prediction: true,
    prediction_data_title: "政策预测数据",
    prediction_data_items: [
        { label: "预测满足租房提取人数", value: "284,542", trend: "up", trend_value: "12.0%", trend_color: "red" },
        { label: "预测季度提取人次", value: "242,500", trend: "up", trend_value: "22.05%", trend_color: "red" },
        { label: "预测租房占比", value: "35.2", unit: "%", trend: "up", trend_value: "6.5%", trend_color: "red" },
        { label: "预测季度提取金额", value: "3.97", unit: "亿元", trend: "up", trend_value: "16.1%", trend_color: "red" }
    ],
    form_title: "调整政策参数",
    form_description: "通过调整以下参数，系统将基于历史数据和 AI 模型预测政策调整后的影响",
    footer_text: "住房公积金管理中心 © 2025",
    page_key: "test123",
    title: "租房提取政策智能分析"
};

console.log('🔄 开始渲染模板...');

try {
    // 渲染模板
    const schemaJson = env.render('pages/policy_demo.j2', demoParams);

    // 验证 JSON
    JSON.parse(schemaJson);
    console.log('✅ 模板渲染成功，JSON 格式正确');

    // 更新数据库
    db.run(
        `UPDATE sys_page_template 
         SET schema_json = ?, 
             source_template_id = 'policy_demo',
             source_params = ?,
             updated_at = datetime('now', '+08:00')
         WHERE page_key = 'test123' AND is_active = 1`,
        [schemaJson, JSON.stringify(demoParams, null, 2)],
        function (err) {
            if (err) {
                console.error('❌ 更新失败:', err.message);
                process.exit(1);
            }

            console.log(`✅ test123 页面已更新`);
            console.log(`   影响行数: ${this.changes}`);
            console.log(`\n💡 请刷新浏览器访问 /zcfx/test123`);
            process.exit(0);
        }
    );

} catch (e) {
    console.error('❌ 渲染失败:', e.message);
    console.error(e.stack);
    process.exit(1);
}
