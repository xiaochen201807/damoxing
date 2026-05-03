const path = require('path');
const nunjucks = require('nunjucks');

const env = nunjucks.configure(path.join(__dirname, '../templates'), {
    autoescape: false,
    throwOnUndefined: false,
    noCache: true
});

env.addFilter('tojson', function (value) {
    return JSON.stringify(value);
});

env.addFilter('fromjson', function (str) {
    if (!str) return null;
    try {
        return typeof str === 'string' ? JSON.parse(str) : str;
    } catch (_e) {
        return str;
    }
});

function walk(node, visitor) {
    if (!node) {
        return;
    }
    if (Array.isArray(node)) {
        node.forEach(item => walk(item, visitor));
        return;
    }
    if (typeof node !== 'object') {
        return;
    }
    visitor(node);
    Object.values(node).forEach(value => walk(value, visitor));
}

describe('task_config_upgrade template', () => {
    test('渲染为合法页面 JSON 并声明 React 渲染入口', () => {
        const rendered = env.render('pages/task_config_upgrade.j2', {
            title: '任务项运行配置工具',
            GLOBAL_API_PREFIX: '/api'
        });
        const schema = JSON.parse(rendered);

        expect(schema.type).toBe('page');
        expect(schema.title).toBe('任务项运行配置工具');
        expect(schema.xRenderer).toBe('task-config-upgrade');
        expect(schema.data).toMatchObject({
            task_config_summary_api: '/api/task_configmock/summary',
            task_config_rows_api: '/api/task_configmock/rows',
            task_config_business_options_api: '/api/task_configmock/business-options',
            task_config_group_options_api: '/api/task_configmock/group-options',
            task_config_save_api: '/api/task_configmock/save-business-config'
        });
    });

    test('模板保留任务默认值和 React 回退提示', () => {
        const rendered = env.render('pages/task_config_upgrade.j2', {
            title: '任务项运行配置工具',
            GLOBAL_API_PREFIX: '/api',
            default_task: 'dk',
            default_related_party: 'developer'
        });
        const schema = JSON.parse(rendered);
        const tplNodes = [];

        walk(schema, node => {
            if (node?.type === 'tpl') {
                tplNodes.push(node.tpl);
            }
        });

        expect(schema.data).toMatchObject({
            default_task: 'dk',
            default_related_party: 'developer'
        });
        expect(tplNodes.join('')).toContain('React 渲染器');
    });
});
