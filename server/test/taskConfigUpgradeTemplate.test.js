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
    test('渲染为合法 AMIS JSON 并声明 mock 数据接口', () => {
        const rendered = env.render('pages/task_config_upgrade.j2', {
            title: '任务项运行配置工具',
            GLOBAL_API_PREFIX: '/api'
        });
        const schema = JSON.parse(rendered);

        expect(schema.type).toBe('page');
        expect(schema.title).toBe('任务项运行配置工具');
        expect(schema.data).toMatchObject({
            task_config_summary_api: '/api/task_configmock/summary',
            task_config_rows_api: '/api/task_configmock/rows',
            task_config_business_options_api: '/api/task_configmock/business-options',
            task_config_group_options_api: '/api/task_configmock/group-options',
            task_config_save_api: '/api/task_configmock/save-business-config'
        });
    });

    test('清册查询区和配置弹窗保留原型主流程', () => {
        const rendered = env.render('pages/task_config_upgrade.j2', {
            title: '任务项运行配置工具',
            GLOBAL_API_PREFIX: '/api'
        });
        const schema = JSON.parse(rendered);
        let crud = null;
        let filterForm = null;
        let configDialog = null;
        const columnNames = [];

        walk(schema, node => {
            if (node?.id === 'task_config_crud') {
                crud = node;
            }
            if (node?.id === 'task_config_filter_form') {
                filterForm = node;
            }
            if (node?.dialog?.title === '配置应用业务') {
                configDialog = node.dialog;
            }
            if (node?.label && node?.name) {
                columnNames.push(node.name);
            }
        });

        expect(crud?.api).toMatchObject({
            method: 'post',
            url: '${task_config_rows_api}'
        });
        expect(filterForm?.body.map(item => item.name || item.type)).toEqual(expect.arrayContaining([
            'relatedParty',
            'task',
            'businessCategory',
            'groupId',
            'keyword',
            'submit'
        ]));
        expect(columnNames).toEqual(expect.arrayContaining([
            'nodeTitle',
            'elementTitle',
            'objectName',
            'formula',
            'description',
            'usageText',
            'algorithmSummary'
        ]));
        expect(configDialog).toBeTruthy();
        expect(JSON.stringify(configDialog)).toContain('appliedBusinesses');
        expect(JSON.stringify(configDialog)).toContain('algorithmParamGroups');
    });
});
