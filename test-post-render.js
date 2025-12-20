/**
 * 测试 POST 参数渲染
 * 运行: node test-post-render.js
 */

const nunjucks = require('nunjucks');
const path = require('path');

// 配置 Nunjucks 环境
const env = nunjucks.configure(path.join(__dirname, '../server/templates'), {
    autoescape: false,
    throwOnUndefined: false
});

// 添加自定义过滤器
env.addFilter('tojson', function (obj) {
    return JSON.stringify(obj);
});

env.addFilter('replace', function (str, pattern, replacement) {
    return str.replace(new RegExp(pattern, 'g'), replacement);
});

// 测试参数
const testParams = {
    chart_type: 'pie',
    api_url: '/api/demo/chart/risk-pie-post',
    api_method: 'post',
    api_data: {
        chart_id: 'risk_analysis_001',
        time_range: '30d'
    },
    drilldown_api: '/api/demo/risk-list-post',
    drilldown_method: 'post',
    drilldown_data: {
        chart_id: 'risk_analysis_001'
    }
};

console.log('=== 测试参数 ===');
console.log(JSON.stringify(testParams, null, 2));

try {
    const result = env.render('components/chart_with_ai.j2', testParams);
    const parsed = JSON.parse(result);

    console.log('\n=== 渲染成功 ===');
    console.log('\n图表 API 配置:');
    console.log(JSON.stringify(parsed.columns[0].body.api, null, 2));

    console.log('\n钻取 API 配置:');
    const drilldownApi = parsed.columns[0].body.clickAction?.dialog?.body?.api;
    if (drilldownApi) {
        console.log(JSON.stringify(drilldownApi, null, 2));
    }

    // 验证
    const chartMethod = parsed.columns[0].body.api.method;
    const chartData = parsed.columns[0].body.api.data;

    console.log('\n=== 验证结果 ===');
    console.log(`图表请求方法: ${chartMethod} ${chartMethod === 'post' ? '✅' : '❌ 应该是 post'}`);
    console.log(`图表请求数据: ${chartData ? '✅ 存在' : '❌ 缺失'}`);

    if (drilldownApi) {
        const drilldownMethod = drilldownApi.method;
        console.log(`钻取请求方法: ${drilldownMethod} ${drilldownMethod === 'post' ? '✅' : '❌ 应该是 post'}`);
    }

} catch (error) {
    console.error('\n=== 渲染失败 ===');
    console.error(error.message);
    if (error.message.includes('JSON')) {
        console.error('\n模板输出（前500字符）:');
        try {
            const output = env.render('components/chart_with_ai.j2', testParams);
            console.error(output.substring(0, 500));
        } catch (e) {
            console.error('无法获取模板输出');
        }
    }
}
